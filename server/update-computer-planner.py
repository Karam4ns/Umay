"""Run on the server: prepare, test, then activate the desktop chat image overlay.

The caller uploads this script, desktop-context.ts, compile-computer-planner.cjs
and server-desktop-context.cjs into one private staging directory. Credentials
are never included in this script or written into build contexts.
"""
import json
from pathlib import Path
import subprocess
import sys
import time

stage = Path(__file__).resolve().parent
mode = sys.argv[1]
def output(args):
    return subprocess.check_output(args, text=True).strip()
def inspect(container):
    return json.loads(output(['docker', 'inspect', container]))[0]
def compose_environment(entries):
    return {key: value.replace('$', '$$') for key, value in (entry.split('=', 1) for entry in entries)}
def test(image, root, suffix):
    state = json.loads((root / 'chat-worker-before.json').read_text())
    env = root / 'test.env'
    env.write_text('\n'.join(state['Config']['Env']) + '\n')
    env.chmod(0o600)
    network = next(iter(state['NetworkSettings']['Networks']))
    command = ['docker', 'run', '--rm', '--network', network, '--env-file', str(env)]
    for mount in state['Mounts']:
        if mount['Destination'].startswith('/run/secrets/'):
            command += ['--mount', 'type=bind,src=' + mount['Source'] + ',dst=' + mount['Destination'] + ',readonly']
    result = subprocess.run(command + ['-v', str(stage / 'server-desktop-context.cjs') + ':/tmp/umay-check.cjs:ro',
                             image, 'node', '/tmp/umay-check.cjs', '/app/apps/api'],
                            capture_output=True, text=True, timeout=140)
    (root / ('test-' + suffix + '.log')).write_text(result.stdout + result.stderr)
    return result

if mode == 'prepare':
    root = Path('/root/umay-computer-' + str(int(time.time())))
    root.mkdir(mode=0o700)
    states = {}
    for service in ['chat', 'chat-worker']:
        state = inspect('veriussu21-' + service + '-1')
        states[service] = state
        (root / (service + '-before.json')).write_text(json.dumps(state))
    baseline = test(states['chat-worker']['Image'], root, 'before')
    if baseline.returncode == 0 or 'chat handoff metadata' not in baseline.stderr:
        raise RuntimeError('Baseline did not fail for the expected missing planner capability')
    print('PASS baseline RED: deployed planner lacks conversational handoff metadata', flush=True)
    for service, state in states.items():
        context = root / service
        context.mkdir()
        for name in ['desktop-context.ts', 'compile-computer-planner.cjs', 'patch-chat-dispatch.cjs']:
            (context / name).write_bytes((stage / name).read_bytes())
        (context / 'Dockerfile').write_text('FROM ' + state['Image'] + '\nCOPY --chown=node:node desktop-context.ts compile-computer-planner.cjs patch-chat-dispatch.cjs /tmp/umay-computer/\nRUN node /tmp/umay-computer/compile-computer-planner.cjs\n')
        tag = 'veriussu-umay-computer-' + service + ':0.4.3'
        subprocess.run(['docker', 'build', '--pull=false', '-t', tag, str(context)], check=True)
        for suffix, image in [('candidate', tag), ('rollback', state['Image'])]:
            (root / (service + '-' + suffix + '.json')).write_text(json.dumps({'services': {service: {'image': image, 'environment': compose_environment(state['Config']['Env'])}}}))
    checked = test('veriussu-umay-computer-chat-worker:0.4.3', root, 'candidate')
    if checked.returncode or 'PASS real HTTP/isolated PostgreSQL' not in checked.stdout:
        raise RuntimeError('Candidate HTTP tests failed; inspect ' + str(root / 'test-candidate.log'))
    (stage / 'candidate-root').write_text(str(root))
    print('PASS candidate isolated HTTP/database/provider tests; BACKUP=' + str(root), flush=True)
elif mode == 'activate':
    root = Path((stage / 'candidate-root').read_text().strip())
    if root.parent != Path('/root') or not root.name.startswith('umay-computer-'):
        raise RuntimeError('Invalid candidate root')
    if 'PASS real HTTP/isolated PostgreSQL' not in (root / 'test-candidate.log').read_text():
        raise RuntimeError('No verified candidate')
    cwd = Path('/opt/apps/veriussu.com')
    source = cwd / 'apps/api/src/desktop-context.ts'
    original = source.read_bytes()
    (root / 'source-desktop-context.ts').write_bytes(original)
    before = {s: json.loads((root / (s + '-before.json')).read_text()) for s in ['chat', 'chat-worker']}
    replicas = {}
    for service in before:
        replicas[service] = [inspect('veriussu21-' + service + '-' + str(n)) for n in range(1, 3 if service == 'chat-worker' else 2)]
        for state in replicas[service]:
            if state['Image'] != before[service]['Image'] or sorted(state['Config']['Env']) != sorted(before[service]['Config']['Env']):
                raise RuntimeError('Live deployment changed since prepare')
    (root / 'replicas-before.json').write_text(json.dumps(replicas))
    applied = []
    def compose(service, suffix):
        command = ['docker', 'compose']
        for file in before[service]['Config']['Labels']['com.docker.compose.project.config_files'].split(','):
            command += ['-f', file]
        command += ['-f', str(root / (service + '-' + suffix + '.json'))]
        return command
    for service, state in before.items():
        for suffix in ['candidate', 'rollback']:
            file = root / (service + '-' + suffix + '.json')
            overlay = json.loads(file.read_text())
            overlay['services'][service]['environment'] = compose_environment(state['Config']['Env'])
            file.write_text(json.dumps(overlay))
            rendered = json.loads(subprocess.check_output(compose(service, suffix) + ['config', '--format', 'json'], cwd=cwd, text=True))
            rendered_environment = {key: value.replace('$$', '$') for key, value in rendered['services'][service]['environment'].items()}
            if rendered_environment != dict(v.split('=', 1) for v in state['Config']['Env']):
                raise RuntimeError('Rendered environment mismatch before activation: ' + service + '/' + suffix)
    print('PASS candidate and rollback Compose environments match live before rollout', flush=True)
    def rollout(service, suffix):
        command = compose(service, suffix) + ['up', '-d', '--no-deps']
        if service == 'chat-worker':
            command += ['--scale', 'chat-worker=2']
        return command + [service]
    try:
        for service in ['chat-worker', 'chat']:
            applied.append(service)
            subprocess.run(rollout(service, 'candidate'), cwd=cwd, check=True)
            for previous in replicas[service]:
                name = previous['Name'].lstrip('/')
                for _ in range(50):
                    current = inspect(name)
                    if current['State'].get('Health', {}).get('Status') == 'healthy':
                        break
                    time.sleep(1)
                else:
                    raise RuntimeError('Service health failed: ' + name)
                if sorted(current['Config']['Env']) != sorted(previous['Config']['Env']) or current['HostConfig']['PortBindings'] != previous['HostConfig']['PortBindings']:
                    raise RuntimeError('Environment/ports changed: ' + name)
                print('PASS ' + name + ' healthy; environment and ports preserved', flush=True)
        if source.read_bytes() != original:
            raise RuntimeError('Host planner source changed during deployment')
        source.write_bytes((stage / 'desktop-context.ts').read_bytes())
        (root / 'activated').write_text(str(time.time()))
        print('PASS desktop chat handoff deployed; chat stays on port 10203', flush=True)
    except Exception:
        for service in reversed(applied):
            subprocess.run(rollout(service, 'rollback'), cwd=cwd, check=True)
        source.write_bytes(original)
        raise
else:
    raise RuntimeError('Expected prepare or activate')

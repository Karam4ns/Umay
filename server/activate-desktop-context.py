"""Run on the server after the isolated candidate tests pass.

Uses the candidate manifest prepared for this deployment. Never changes DB
schema, public assets, ports or environment values. Rollback preserves sources.
"""
import hashlib
import json
from pathlib import Path
import subprocess
import time

def output(args):
    return subprocess.check_output(args, text=True).strip()

root = Path('/tmp/umay-desktop-candidate-root').read_text().strip()
root = Path(root)
if root.parent != Path('/root') or not root.name.startswith('umay-desktop-'):
    raise RuntimeError('Invalid candidate root')
cwd = Path('/opt/apps/veriussu.com')
stage = Path('/tmp/umay-desktop-stage')
if 'PASS real HTTP/isolated PostgreSQL' not in (root / 'test.log').read_text():
    raise RuntimeError('Candidate HTTP tests have not passed')
names = ['chat', 'chat-worker']
before = {name: json.loads((root / (name + '-before.json')).read_text()) for name in names}
for name in names:
    if output(['docker', 'inspect', '--format', '{{.Image}}', 'veriussu21-' + name + '-1']) != before[name]['Image']:
        raise RuntimeError('Live image changed since candidate build')

source = cwd / 'apps/api/src'
files = ['chat.controller.ts', 'chat-execution.ts', 'desktop-context.ts']
for name in files:
    if (source / name).exists():
        (root / ('source-' + name)).write_bytes((source / name).read_bytes())
for name in ['chat.controller.ts', 'chat-execution.ts']:
    if (source / name).read_bytes() != (stage / (name + '.base')).read_bytes():
        raise RuntimeError('Host source changed: ' + name)
subprocess.run(['git', 'apply', '--check', str(stage / 'desktop-context.patch')], cwd=cwd, check=True)
subprocess.run(['git', 'apply', str(stage / 'desktop-context.patch')], cwd=cwd, check=True)
(source / 'desktop-context.ts').write_bytes((stage / 'desktop-context.ts').read_bytes())

replicas = {}
for name in names:
    replicas[name] = []
    for number in range(1, 3 if name == 'chat-worker' else 2):
        container = 'veriussu21-' + name + '-' + str(number)
        replicas[name].append(json.loads(output(['docker', 'inspect', container]))[0])
(root / 'replicas-before.json').write_text(json.dumps(replicas))
applied = []
def compose(name, suffix):
    command = ['docker', 'compose']
    for file in before[name]['Config']['Labels']['com.docker.compose.project.config_files'].split(','):
        command += ['-f', file]
    command += ['-f', str(root / (name + '-' + suffix + '.json'))]
    return command

try:
    for name in ['chat-worker', 'chat']:
        command = compose(name, 'candidate') + ['up', '-d', '--no-deps']
        if name == 'chat-worker':
            command += ['--scale', 'chat-worker=2']
        applied.append(name)
        subprocess.run(command + [name], cwd=cwd, check=True)
        for original in replicas[name]:
            container = original['Name'].lstrip('/')
            for _ in range(50):
                current = json.loads(output(['docker', 'inspect', container]))[0]
                if current['State'].get('Health', {}).get('Status') == 'healthy':
                    break
                time.sleep(1)
            else:
                raise RuntimeError('Service health failed: ' + container)
            if sorted(current['Config']['Env']) != sorted(original['Config']['Env']):
                raise RuntimeError('Environment changed: ' + container)
            if current['HostConfig']['PortBindings'] != original['HostConfig']['PortBindings']:
                raise RuntimeError('Ports changed: ' + container)
            print('PASS ' + container + ' healthy; environment and ports unchanged', flush=True)
    (root / 'activated').write_text(str(time.time()))
    print('PASS desktop context deployed; BACKUP=' + str(root), flush=True)
except Exception:
    for name in reversed(applied):
        command = compose(name, 'rollback') + ['up', '-d', '--no-deps']
        if name == 'chat-worker':
            command += ['--scale', 'chat-worker=2']
        subprocess.run(command + [name], cwd=cwd, check=True)
    for name in files:
        saved = root / ('source-' + name)
        if saved.is_file():
            (source / name).write_bytes(saved.read_bytes())
        elif name == 'desktop-context.ts':
            (source / name).unlink(missing_ok=True)
    raise

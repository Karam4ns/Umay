"""Narrow worker-only overlay; test isolated HTTP/DB before activation.
Existing env, mounts, ports, auth and production data are not changed.
"""
import hashlib, json, subprocess, sys, time
from pathlib import Path

stage = Path(__file__).resolve().parent
def out(args): return subprocess.check_output(args, text=True).strip()
def inspect(name): return json.loads(out(['docker', 'inspect', name]))[0]
def test(image, root, label):
    state = json.loads((root/'before.json').read_text())[0]
    env = root/'test.env'; env.write_text('\n'.join(state['Config']['Env'])+'\n'); env.chmod(0o600)
    cmd = ['docker', 'run', '--rm', '--network', next(iter(state['NetworkSettings']['Networks'])), '--env-file', str(env)]
    for mount in state['Mounts']:
        if mount['Destination'].startswith('/run/secrets/'):
            cmd += ['--mount', 'type=bind,src='+mount['Source']+',dst='+mount['Destination']+',readonly']
    result = subprocess.run(cmd+['-v', str(stage/'server-desktop-context.cjs')+':/tmp/check.cjs:ro', image, 'node', '/tmp/check.cjs', '/app/apps/api'], capture_output=True, text=True, timeout=180)
    (root/('test-'+label+'.log')).write_text(result.stdout+result.stderr)
    return result

if sys.argv[1] == 'prepare':
    root = Path('/root/umay-conversation-'+str(int(time.time()))); root.mkdir(mode=0o700)
    states = [inspect('veriussu21-chat-worker-'+str(i)) for i in [1, 2]]
    if states[0]['Image'] != states[1]['Image']: raise RuntimeError('Worker replicas differ')
    (root/'before.json').write_text(json.dumps(states))
    for name in ['chat-execution.js', 'desktop-reply.cjs']:
        content = subprocess.check_output(['docker','exec','veriussu21-chat-worker-1','cat','/app/apps/api/dist/'+name])
        if hashlib.sha256(content).hexdigest() != (stage/(name+'.sha256')).read_text().strip(): raise RuntimeError('Source drift: '+name)
    red = test(states[0]['Image'], root, 'before')
    if red.returncode == 0 or 'desktop wake greeting must exclude obsolete task history' not in red.stderr:
        raise RuntimeError('Expected wake greeting history RED absent; see '+str(root))
    print('PASS baseline RED: wake greeting carries obsolete tasks', flush=True)
    for name in ['desktop-reply.cjs','conversation-context.cjs','patch-desktop-reply.cjs']:
        (root/name).write_bytes((stage/name).read_bytes())
    (root/'apply.cjs').write_text("const fs=require('fs');const f='/app/apps/api/dist/chat-execution.js';const {patchConversationReliability}=require('/tmp/conversation/patch-desktop-reply.cjs');fs.writeFileSync(f,patchConversationReliability(fs.readFileSync(f,'utf8')));require(f);console.log('PASS narrow execution overlay loaded');")
    (root/'Dockerfile').write_text('FROM '+states[0]['Image']+'\nCOPY --chown=node:node patch-desktop-reply.cjs apply.cjs /tmp/conversation/\nCOPY --chown=node:node desktop-reply.cjs conversation-context.cjs /app/apps/api/dist/\nRUN node /tmp/conversation/apply.cjs\n')
    tag = 'veriussu-umay-conversation:0.8.6'
    subprocess.run(['docker','build','--pull=false','-t',tag,str(root)],check=True)
    image = out(['docker','image','inspect','--format','{{.Id}}',tag]); (root/'candidate-image').write_text(image)
    green = test(image, root, 'candidate')
    if green.returncode or 'PASS real HTTP/isolated PostgreSQL' not in green.stdout: raise RuntimeError('Candidate HTTP failure: '+str(root))
    for suffix, target in [('candidate',image),('rollback',states[0]['Image'])]:
        (root/(suffix+'.json')).write_text(json.dumps({'services':{'chat-worker':{'image':target,'environment':{k:v.replace('$','$$') for k,v in (x.split('=',1) for x in states[0]['Config']['Env'])}}}}))
    (stage/'candidate-root').write_text(str(root))
    print('PASS isolated HTTP candidate; BACKUP='+str(root),flush=True)
elif sys.argv[1] == 'activate':
    root = Path((stage/'candidate-root').read_text().strip())
    if root.parent != Path('/root') or not root.name.startswith('umay-conversation-'): raise RuntimeError('Invalid root')
    before = json.loads((root/'before.json').read_text()); image = (root/'candidate-image').read_text().strip()
    if not image.startswith('sha256:') or 'PASS real HTTP/isolated PostgreSQL' not in (root/'test-candidate.log').read_text(): raise RuntimeError('Missing tested image')
    for i,state in enumerate(before,1):
        current=inspect('veriussu21-chat-worker-'+str(i))
        if current['Image']!=state['Image'] or sorted(current['Config']['Env'])!=sorted(state['Config']['Env']): raise RuntimeError('Deployment drift')
    base=['docker','compose']
    for file in before[0]['Config']['Labels']['com.docker.compose.project.config_files'].split(','): base+=['-f',file]
    cwd='/opt/apps/veriussu.com'; isolation=Path(cwd)/'compose.umay-workers.yaml'
    if not isolation.is_file(): raise RuntimeError('Worker isolation overlay absent')
    def command(suffix): return base+['-f',str(root/(suffix+'.json')),'-f',str(isolation)]
    for suffix in ['candidate','rollback']:
        config=json.loads(subprocess.check_output(command(suffix)+['config','--format','json'],cwd=cwd,text=True))
        rendered={k:v.replace('$$','$') for k,v in config['services']['chat-worker']['environment'].items()}
        if rendered!=dict(v.split('=',1) for v in before[0]['Config']['Env']): raise RuntimeError('Environment drift')
    def rollout(suffix): subprocess.run(command(suffix)+['up','-d','--no-deps','--pull','never','--scale','chat-worker=2','chat-worker'],cwd=cwd,check=True)
    try:
        rollout('candidate')
        for i,state in enumerate(before,1):
            for _ in range(45):
                current=inspect('veriussu21-chat-worker-'+str(i))
                if current['State'].get('Health',{}).get('Status')=='healthy': break
                time.sleep(1)
            if current['Image']!=image or current['State'].get('Health',{}).get('Status')!='healthy': raise RuntimeError('Image/health mismatch')
            if sorted(current['Config']['Env'])!=sorted(state['Config']['Env']) or current['HostConfig']['PortBindings']!=state['HostConfig']['PortBindings'] or sorted(current['Mounts'],key=lambda m:m['Destination'])!=sorted(state['Mounts'],key=lambda m:m['Destination']): raise RuntimeError('Env/ports/mounts changed')
        print('PASS two workers healthy; env/ports/mounts unchanged; BACKUP='+str(root))
    except Exception:
        rollout('rollback'); raise
else: raise RuntimeError('Expected prepare or activate')

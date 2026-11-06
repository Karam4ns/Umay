"""Prepare immutable execution overlays, test isolated HTTP, activate with rollback.
No database schema, provider settings, ports, public assets, or auth changes.
"""
import hashlib,json,subprocess,sys,time
from pathlib import Path
stage=Path(__file__).resolve().parent
def out(args):return subprocess.check_output(args,text=True).strip()
def inspect(name):return json.loads(out(['docker','inspect',name]))[0]
def environment(entries):return {k:v.replace('$','$$') for k,v in (x.split('=',1) for x in entries)}
def check(image,root,kind,label):
 worker=inspect('veriussu21-chat-worker-1');env=root/'test.env';env.write_text('\n'.join(worker['Config']['Env'])+'\n');env.chmod(0o600)
 cmd=['docker','run','--rm','--network',next(iter(worker['NetworkSettings']['Networks'])),'--env-file',str(env)]
 for m in worker['Mounts']:
  if m['Destination'].startswith('/run/secrets/'):cmd+=['--mount','type=bind,src='+m['Source']+',dst='+m['Destination']+',readonly']
 test=stage/('server-desktop-context.cjs' if kind=='chat-worker' else 'server-desktop-ingress.cjs')
 result=subprocess.run(cmd+['-v',str(test)+':/tmp/reply-check.cjs:ro',image,'node','/tmp/reply-check.cjs','/app/apps/api'],capture_output=True,text=True,timeout=180)
 (root/('test-'+kind+'-'+label+'.log')).write_text(result.stdout+result.stderr);return result
if sys.argv[1] in ['prepare','prepare-worker']:
 root=Path('/root/umay-reply-'+str(int(time.time())));root.mkdir(mode=0o700)
 states={s:inspect('veriussu21-'+s+'-1') for s in (['chat-worker'] if sys.argv[1]=='prepare-worker' else ['chat-worker','frontend'])};(root/'before.json').write_text(json.dumps(states))
 baseline=json.loads((stage/'baseline.json').read_text()) if (stage/'baseline.json').exists() else states
 red=check(baseline['chat-worker']['Image'],root,'chat-worker','before')
 if red.returncode==0 or not any(reason in red.stderr for reason in ['desktop response contract must be enforced','planner must not replay obsolete observations','fast planner negotiates no-reasoning mode','computer actions use a constrained schema']):raise RuntimeError('Expected contract/context/latency RED not reproduced: '+str(root))
 print('PASS RED current worker lacks enforced reply contract',flush=True)
 for kind,state in states.items():
  directory=root/kind;directory.mkdir()
  live=subprocess.check_output(['docker','exec','veriussu21-'+kind+'-1','cat','/app/apps/api/dist/chat-execution.js'])
  expected=stage/(('worker' if kind=='chat-worker' else 'frontend')+'-execution.sha256')
  if hashlib.sha256(live).hexdigest()!=expected.read_text().strip():raise RuntimeError('Execution module changed since snapshot: '+kind)
  for name in ['patch-desktop-reply.cjs','desktop-reply.cjs']:(directory/name).write_bytes((stage/name).read_bytes())
  (directory/'apply.cjs').write_text("const fs=require('fs'),{patchDesktopReply}=require('/tmp/umay-reply/patch-desktop-reply.cjs');const f='/app/apps/api/dist/chat-execution.js';fs.writeFileSync(f,patchDesktopReply(fs.readFileSync(f,'utf8'),{worker:"+str(kind=='chat-worker').lower()+"}));require(f);console.log('PASS execution overlay loaded');")
  (directory/'Dockerfile').write_text('FROM '+baseline[kind]['Image']+'\nCOPY --chown=node:node patch-desktop-reply.cjs desktop-reply.cjs apply.cjs /tmp/umay-reply/\nCOPY --chown=node:node desktop-reply.cjs /app/apps/api/dist/desktop-reply.cjs\nRUN node /tmp/umay-reply/apply.cjs\n')
  tag='veriussu-umay-reply-'+kind+':0.5.2';subprocess.run(['docker','build','--pull=false','-t',tag,str(directory)],check=True)
  image=out(['docker','image','inspect','--format','{{.Id}}',tag]);(directory/'candidate-image').write_text(image)
  green=check(image,root,kind,'candidate')
  if green.returncode or 'PASS' not in green.stdout:raise RuntimeError('Candidate failed: '+str(root))
  for suffix,target in [('candidate',image),('rollback',state['Image'])]:(directory/(suffix+'.json')).write_text(json.dumps({'services':{kind:{'image':target,'environment':environment(state['Config']['Env'])}}}))
 (stage/'candidate-root').write_text(str(root));print('PASS worker + actual frontend isolated HTTP; BACKUP='+str(root),flush=True)
elif sys.argv[1]=='activate':
 root=Path((stage/'candidate-root').read_text().strip());assert root.parent==Path('/root') and root.name.startswith('umay-reply-')
 states=json.loads((root/'before.json').read_text());cwd='/opt/apps/veriussu.com';applied=[]
 def command(kind,suffix):
  cmd=['docker','compose']
  for file in states[kind]['Config']['Labels']['com.docker.compose.project.config_files'].split(','):cmd+=['-f',file]
  overlay=Path(cwd)/'compose.umay-workers.yaml'
  if not overlay.is_file():raise RuntimeError('Missing persistent worker-isolation overlay')
  return cmd+['-f',str(root/kind/(suffix+'.json')),'-f',str(overlay)]
 def rollout(kind,suffix):subprocess.run(command(kind,suffix)+['up','-d','--no-deps','--pull','never']+(['--scale','chat-worker=2'] if kind=='chat-worker' else [])+[kind],cwd=cwd,check=True)
 for kind,state in states.items():
  assert 'PASS' in (root/('test-'+kind+'-candidate.log')).read_text()
  for n in range(1,3 if kind=='chat-worker' else 2):
   current=inspect('veriussu21-'+kind+'-'+str(n));assert current['Image']==state['Image'] and sorted(current['Config']['Env'])==sorted(state['Config']['Env'])
  for suffix in ['candidate','rollback']:
   config=json.loads(subprocess.check_output(command(kind,suffix)+['config','--format','json'],cwd=cwd,text=True))
   assert {k:v.replace('$$','$') for k,v in config['services'][kind]['environment'].items()}==dict(x.split('=',1) for x in state['Config']['Env'])
 try:
  for kind,state in states.items():
   applied.append(kind);rollout(kind,'candidate');image=(root/kind/'candidate-image').read_text().strip();assert image.startswith('sha256:')
   for n in range(1,3 if kind=='chat-worker' else 2):
    for _ in range(45):
     current=inspect('veriussu21-'+kind+'-'+str(n))
     if current['State'].get('Health',{}).get('Status')=='healthy':break
     time.sleep(1)
    assert current['State'].get('Health',{}).get('Status')=='healthy' and current['Image']==image
    assert sorted(current['Config']['Env'])==sorted(state['Config']['Env']) and current['HostConfig']['PortBindings']==state['HostConfig']['PortBindings'] and sorted(current['Mounts'],key=lambda m:m['Destination'])==sorted(state['Mounts'],key=lambda m:m['Destination'])
  print('PASS immutable workers/frontend healthy, same env/ports/mounts; BACKUP='+str(root))
 except Exception:
  for kind in reversed(applied):rollout(kind,'rollback')
  raise

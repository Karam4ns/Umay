"""Prepare + test immutable worker helper; activate only the two workers.
Normal website,10203 proxy,frontend/controller/execution,env/ports remain intact.
"""
import json,subprocess,sys,time
from pathlib import Path
stage=Path(__file__).resolve().parent
def out(args):return subprocess.check_output(args,text=True).strip()
def inspect(name):return json.loads(out(['docker','inspect',name]))[0]
def envmap(entries):return {k:v.replace('$','$$') for k,v in (x.split('=',1) for x in entries)}
def test(image,root,label):
 state=json.loads((root/'before.json').read_text())[0];env=root/'test.env';env.write_text('\n'.join(state['Config']['Env'])+'\n');env.chmod(0o600)
 cmd=['docker','run','--rm','--network',next(iter(state['NetworkSettings']['Networks'])),'--env-file',str(env)]
 for m in state['Mounts']:
  if m['Destination'].startswith('/run/secrets/'):cmd+=['--mount','type=bind,src='+m['Source']+',dst='+m['Destination']+',readonly']
 result=subprocess.run(cmd+['-v',str(stage/'server-desktop-context.cjs')+':/tmp/helper-check.cjs:ro',image,'node','/tmp/helper-check.cjs','/app/apps/api'],capture_output=True,text=True,timeout=150);(root/('test-'+label+'.log')).write_text(result.stdout+result.stderr);return result
if sys.argv[1]=='prepare':
 root=Path('/root/umay-control-'+str(int(time.time())));root.mkdir(mode=0o700);states=[inspect('veriussu21-chat-worker-'+str(i)) for i in [1,2]]
 if states[0]['Image']!=states[1]['Image'] or sorted(states[0]['Config']['Env'])!=sorted(states[1]['Config']['Env']):raise RuntimeError('Worker replicas differ before preparation')
 (root/'before.json').write_text(json.dumps(states));red=test(states[0]['Image'],root,'before')
 if red.returncode==0 or 'general computer capability' not in red.stderr:raise RuntimeError('Baseline missing-capability RED not reproduced: '+str(root))
 print('PASS baseline RED new general computer capabilities absent',flush=True)
 for name in ['desktop-context.ts','compile-desktop-helper.cjs']:(root/name).write_bytes((stage/name).read_bytes())
 (root/'Dockerfile').write_text('FROM '+states[0]['Image']+'\nCOPY --chown=node:node desktop-context.ts compile-desktop-helper.cjs /tmp/umay-desktop-helper/\nRUN node /tmp/umay-desktop-helper/compile-desktop-helper.cjs\n')
 tag='veriussu-umay-control-worker:0.5.0';subprocess.run(['docker','build','--pull=false','-t',tag,str(root)],check=True);image=out(['docker','image','inspect','--format','{{.Id}}',tag]);(root/'candidate-image').write_text(image)
 green=test(image,root,'candidate')
 if green.returncode or 'PASS real HTTP/isolated PostgreSQL' not in green.stdout:raise RuntimeError('Candidate capability HTTP tests failed: '+str(root))
 for suffix,target in [('candidate',image),('rollback',states[0]['Image'])]:(root/(suffix+'.json')).write_text(json.dumps({'services':{'chat-worker':{'image':target,'environment':envmap(states[0]['Config']['Env'])}}}))
 (stage/'candidate-root').write_text(str(root));print('PASS candidate real HTTP/isolated DB; BACKUP='+str(root),flush=True)
elif sys.argv[1]=='activate':
 root=Path((stage/'candidate-root').read_text().strip())
 if root.parent!=Path('/root') or not root.name.startswith('umay-control-'):raise RuntimeError('Invalid candidate root')
 before=json.loads((root/'before.json').read_text());image=(root/'candidate-image').read_text().strip()
 if not image.startswith('sha256:') or json.loads((root/'candidate.json').read_text())['services']['chat-worker']['image']!=image:raise RuntimeError('Candidate image must be immutable')
 if 'PASS real HTTP/isolated PostgreSQL' not in (root/'test-candidate.log').read_text():raise RuntimeError('No passing candidate')
 for i,state in enumerate(before,1):
  current=inspect('veriussu21-chat-worker-'+str(i))
  if current['Image']!=state['Image'] or current['Config']['Env']!=state['Config']['Env']:raise RuntimeError('Workers changed since preparation')
 base=['docker','compose']
 for file in before[0]['Config']['Labels']['com.docker.compose.project.config_files'].split(','):base+=['-f',file]
 cwd='/opt/apps/veriussu.com'
 for suffix in ['candidate','rollback']:
  config=json.loads(subprocess.check_output(base+['-f',str(root/(suffix+'.json')),'config','--format','json'],cwd=cwd,text=True));rendered={k:v.replace('$$','$') for k,v in config['services']['chat-worker']['environment'].items()}
  if rendered!=dict(v.split('=',1) for v in before[0]['Config']['Env']):raise RuntimeError('Compose environment changed')
 def rollout(suffix):subprocess.run(base+['-f',str(root/(suffix+'.json')),'up','-d','--no-deps','--pull','never','--scale','chat-worker=2','chat-worker'],cwd=cwd,check=True)
 try:
  rollout('candidate')
  for i,state in enumerate(before,1):
   for _ in range(45):
    current=inspect('veriussu21-chat-worker-'+str(i))
    if current['State'].get('Health',{}).get('Status')=='healthy':break
    time.sleep(1)
   if current['State'].get('Health',{}).get('Status')!='healthy' or current['Image']!=image:raise RuntimeError('Worker health/image mismatch')
   if sorted(current['Config']['Env'])!=sorted(state['Config']['Env']) or current['HostConfig']['PortBindings']!=state['HostConfig']['PortBindings'] or sorted(current['Mounts'],key=lambda x:x['Destination'])!=sorted(state['Mounts'],key=lambda x:x['Destination']):raise RuntimeError('Worker env/ports/mounts changed')
  host=Path(cwd)/'apps/api/src/desktop-context.ts';(root/'source-desktop-context.before.ts').write_bytes(host.read_bytes());host.write_bytes((stage/'desktop-context.ts').read_bytes());print('PASS two worker replicas healthy; immutable image/env/ports/mounts verified; BACKUP='+str(root))
 except Exception:
  rollout('rollback');raise

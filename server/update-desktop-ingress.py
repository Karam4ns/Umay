"""Patch the real API ingress (frontend), not the 10203 forwarding shell.
Run prepare then activate. Preserve environment, ports, assets and other services.
Only the already reviewed desktop controller, helper, and run-field privacy change.
"""
import hashlib,json,subprocess,sys,time
from pathlib import Path
stage=Path(__file__).resolve().parent
def out(args):return subprocess.check_output(args,text=True).strip()
def inspect(name):return json.loads(out(['docker','inspect',name]))[0]
def compose_env(entries):return {k:v.replace('$','$$') for k,v in (x.split('=',1) for x in entries)}
def check(image,root,label):
 worker=inspect('veriussu21-chat-worker-1');env=root/'test.env';env.write_text('\n'.join(worker['Config']['Env'])+'\n');env.chmod(0o600)
 command=['docker','run','--rm','--network',next(iter(worker['NetworkSettings']['Networks'])),'--env-file',str(env)]
 for mount in worker['Mounts']:
  if mount['Destination'].startswith('/run/secrets/'):command+=['--mount','type=bind,src='+mount['Source']+',dst='+mount['Destination']+',readonly']
 result=subprocess.run(command+['-v',str(stage/'server-desktop-ingress.cjs')+':/tmp/ingress-check.cjs:ro',image,'node','/tmp/ingress-check.cjs','/app/apps/api'],capture_output=True,text=True,timeout=120)
 (root/('test-'+label+'.log')).write_text(result.stdout+result.stderr);return result
if sys.argv[1]=='prepare':
 root=Path('/root/umay-ingress-'+str(int(time.time())));root.mkdir(mode=0o700);state=inspect('veriussu21-frontend-1');(root/'before.json').write_text(json.dumps(state));
 red=check(state['Image'],root,'before')
 if red.returncode==0 or 'desktop ingress must accept capabilities' not in red.stderr:raise RuntimeError('Expected ingress rejection not reproduced: '+str(root))
 print('PASS RED actual frontend rejects desktop capability fields',flush=True)
 for name in ['chat.controller.js','desktop-context.js']:
  (root/name).write_bytes(subprocess.check_output(['docker','exec','veriussu21-chat-worker-1','cat','/app/apps/api/dist/'+name]))
 # Guard the ingress baseline; fail rather than replacing code changed elsewhere.
 live=subprocess.check_output(['docker','exec','veriussu21-frontend-1','cat','/app/apps/api/dist/chat.controller.js'])
 if hashlib.sha256(live).hexdigest()!=(stage/'controller-before.sha256').read_text().strip():raise RuntimeError('Ingress controller changed since inspection')
 source=subprocess.check_output(['docker','exec','veriussu21-frontend-1','cat','/app/apps/api/dist/chat-execution.js']).decode()
 if source.count('kind,media_options AS "mediaOptions"')!=1:raise RuntimeError('Run fields baseline changed')
 source=source.replace('kind,media_options AS "mediaOptions"',"kind,(media_options - 'desktopContext' - 'desktopImage') AS \"mediaOptions\"")
 source=source.replace("UPDATE chat_runs SET draft_content='',status=","UPDATE chat_runs SET media_options=media_options-'desktopImage',draft_content='',status=")
 (root/'chat-execution.js').write_text(source)
 (root/'Dockerfile').write_text('FROM '+state['Image']+'\nCOPY --chown=node:node chat.controller.js desktop-context.js chat-execution.js /app/apps/api/dist/\nRUN node -e \'require("/app/apps/api/dist/chat.controller");require("/app/apps/api/dist/chat-execution")\'\n')
 tag='veriussu-umay-ingress:0.4.4';subprocess.run(['docker','build','--pull=false','-t',tag,str(root)],check=True)
 candidate=out(['docker','image','inspect','--format','{{.Id}}',tag]);(root/'candidate-image').write_text(candidate)
 green=check(candidate,root,'candidate')
 if green.returncode or 'PASS actual ingress' not in green.stdout:raise RuntimeError('Candidate ingress tests failed: '+str(root))
 for suffix,image in [('candidate',candidate),('rollback',state['Image'])]:(root/(suffix+'.json')).write_text(json.dumps({'services':{'frontend':{'image':image,'environment':compose_env(state['Config']['Env'])}}}))
 (stage/'candidate-root').write_text(str(root));print('PASS GREEN actual ingress, isolated database; BACKUP='+str(root),flush=True)
elif sys.argv[1]=='activate':
 root=Path((stage/'candidate-root').read_text().strip())
 if root.parent!=Path('/root') or not root.name.startswith('umay-ingress-'):raise RuntimeError('Invalid backup path')
 state=json.loads((root/'before.json').read_text());current=inspect('veriussu21-frontend-1')
 if current['Image']!=state['Image'] or current['Config']['Env']!=state['Config']['Env']:raise RuntimeError('Frontend changed since candidate tests')
 if 'PASS actual ingress' not in (root/'test-candidate.log').read_text():raise RuntimeError('No passing candidate')
 candidate=(root/'candidate-image').read_text().strip()
 if not candidate.startswith('sha256:') or json.loads((root/'candidate.json').read_text())['services']['frontend']['image']!=candidate:raise RuntimeError('Candidate must use the exact tested image ID')
 base=['docker','compose']
 for file in state['Config']['Labels']['com.docker.compose.project.config_files'].split(','):base+=['-f',file]
 cwd='/opt/apps/veriussu.com'
 for suffix in ['candidate','rollback']:
  config=json.loads(subprocess.check_output(base+['-f',str(root/(suffix+'.json')),'config','--format','json'],cwd=cwd,text=True));env={k:v.replace('$$','$') for k,v in config['services']['frontend']['environment'].items()}
  if env!=dict(x.split('=',1) for x in state['Config']['Env']):raise RuntimeError('Environment would change')
 def rollout(suffix):subprocess.run(base+['-f',str(root/(suffix+'.json')),'up','-d','--no-deps','--pull','never','frontend'],cwd=cwd,check=True)
 try:
  rollout('candidate')
  for _ in range(40):
   current=inspect('veriussu21-frontend-1')
   if current['State'].get('Health',{}).get('Status')=='healthy':break
   time.sleep(1)
  if current['State'].get('Health',{}).get('Status')!='healthy':raise RuntimeError('Frontend health failed')
  if current['Image']!=candidate:raise RuntimeError('Active frontend differs from the tested image')
  if sorted(current['Config']['Env'])!=sorted(state['Config']['Env']) or current['HostConfig']['PortBindings']!=state['HostConfig']['PortBindings']:raise RuntimeError('Environment/ports changed')
  if sorted(current['Mounts'],key=lambda m:m['Destination'])!=sorted(state['Mounts'],key=lambda m:m['Destination']):raise RuntimeError('Mounts changed')
  print('PASS active frontend healthy, environment/ports/assets preserved; BACKUP='+str(root))
 except Exception:
  rollout('rollback');raise

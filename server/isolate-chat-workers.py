"""Stop the obsolete frontend executor; keep the two dedicated workers.
Only CHAT_WORKER_ENABLED changes; same image, HTTP service, ports and mounts.
Run on the server after both worker replicas pass the reply acceptance tests.
"""
import json,subprocess,time
from pathlib import Path
def out(args):return subprocess.check_output(args,text=True).strip()
def inspect(name):return json.loads(out(['docker','inspect',name]))[0]
def env(entries):return dict(x.split('=',1) for x in entries)
name='veriussu21-frontend-1';before=inspect(name)
workers=[inspect('veriussu21-chat-worker-'+str(i)) for i in [1,2]]
assert workers[0]['Image']==workers[1]['Image']
assert all(w['State'].get('Health',{}).get('Status')=='healthy' and env(w['Config']['Env']).get('CHAT_WORKER_ENABLED')=='true' for w in workers)
current=env(before['Config']['Env']);assert current.get('CHAT_WORKER_ENABLED')=='true'
assert 'desktop_function_handoff' in out(['docker','exec','veriussu21-chat-worker-1','cat','/app/apps/api/dist/chat-execution.js'])
probe="const {createPool}=require('/app/apps/api/dist/database');(async()=>{const d=createPool();console.log((await d.query(\"SELECT count(*)::int AS n FROM chat_runs WHERE status='RUNNING'\")).rows[0].n);await d.end()})()"
for _ in range(30):
 if out(['docker','exec','veriussu21-chat-worker-1','node','-e',probe])=='0':break
 time.sleep(2)
else:raise RuntimeError('Active provider requests; no restart performed')
root=Path('/root/umay-worker-isolation-'+str(int(time.time())));root.mkdir(mode=0o700);(root/'before.json').write_text(json.dumps(before))
expected={**current,'CHAT_WORKER_ENABLED':'false'}
for suffix,values in [('candidate',expected),('rollback',current)]:
 (root/(suffix+'.json')).write_text(json.dumps({'services':{'frontend':{'image':before['Image'],'environment':{k:v.replace('$','$$') for k,v in values.items()}}}}))
base=['docker','compose']
for file in before['Config']['Labels']['com.docker.compose.project.config_files'].split(','):base+=['-f',file]
cwd='/opt/apps/veriussu.com'
for suffix,values in [('candidate',expected),('rollback',current)]:
 config=json.loads(subprocess.check_output(base+['-f',str(root/(suffix+'.json')),'config','--format','json'],cwd=cwd,text=True))
 assert {k:v.replace('$$','$') for k,v in config['services']['frontend']['environment'].items()}==values
def rollout(suffix):subprocess.run(base+['-f',str(root/(suffix+'.json')),'up','-d','--no-deps','--pull','never','frontend'],cwd=cwd,check=True)
try:
 rollout('candidate')
 for _ in range(45):
  after=inspect(name)
  if after['State'].get('Health',{}).get('Status')=='healthy':break
  time.sleep(1)
 assert after['State'].get('Health',{}).get('Status')=='healthy' and after['Image']==before['Image']
 assert env(after['Config']['Env'])==expected
 assert after['HostConfig']['PortBindings']==before['HostConfig']['PortBindings'] and sorted(after['Mounts'],key=lambda m:m['Destination'])==sorted(before['Mounts'],key=lambda m:m['Destination'])
 assert all(inspect('veriussu21-chat-worker-'+str(i))['Image']==workers[i-1]['Image'] for i in [1,2])
 print('PASS frontend enqueue/read only; exactly two updated executors; same image/ports/mounts, one environment flag changed; BACKUP='+str(root))
except Exception:
 rollout('rollback');raise

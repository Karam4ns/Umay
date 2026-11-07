'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {DeviceServices}=require('../src/device-services.cjs');
function fixture(t){const root=fs.mkdtempSync(path.join(os.tmpdir(),'umay-long-flow-')),files={first:path.join(root,'ilk.txt'),other:path.join(root,'diğer.txt')},chats=new Map(),effects=[],nativeCalls=[];let time=0,ready=false,hold=false,release,enteredResolve;const entered=new Promise(r=>enteredResolve=r);
 const api=async(route,body)=>{
  if(route==='/site/chat/conversations'){const c={id:'c'+(chats.size+1),version:1,messages:[],stage:0,title:body.title};chats.set(c.id,c);return {conversation:c};}
  if(route.includes('/runs/'))return {run:{status:'COMPLETED'}};
  const c=chats.get(route.split('/')[4]);if(route.endsWith('/messages')){const prompt=JSON.parse(body.content);let action;
   if(c.title.includes('Başka dosya')){if(hold){enteredResolve();await new Promise(r=>release=r);}action=c.stage++===0?{action:'system_tool',toolName:'files_write',toolArguments:JSON.stringify({path:files.other,content:'Diğer iş tamamlandı'})}:{action:'done',message:'Diğer iş tamamlandı.'};}
   else if(!prompt.watchContinuation)action={action:'system_tool',toolName:'task_watch_start',toolArguments:JSON.stringify({kind:'desktop',windowHandle:10,processId:50,contains:'Hazır'})};
   else if(!prompt.observation.system)action={action:'system_start'};
   else action=fs.existsSync(files.first)?{action:'done',message:'İlk iş kaldığı yerden tamamlandı.'}:{action:'system_tool',toolName:'files_write',toolArguments:JSON.stringify({path:files.first,content:'İlk iş devam etti'})};
   c.messages.push({role:'assistant',id:'m'+c.messages.length,content:JSON.stringify(action)});c.version++;return {run:{id:'run'}};
  }return {conversation:c,messages:c.messages};
 };
 const service=new DeviceServices({directory:path.join(root,'app'),api,screen:{getAllDisplays:()=>[]},capture:async()=>[],background:false,native:{request:async(method,args)=>{nativeCalls.push({method,args});if(method==='window_manage'){effects.push('focus-first');return {accepted:true};}if(!['foreground','observe','observe_window'].includes(method))throw Error('Unexpected input');return {handle:10,processId:50,title:'İşlem penceresi',windows:[{handle:10,processId:50,title:'İşlem penceresi'}],elements:[{name:ready?'Hazır':'Çalışıyor',type:'ControlType.Text'}]};},close(){}}});
 service.activate('fixture');service.control.enable(true);service.watchers.now=()=>time;service.watchers.schedule=()=>({unref(){}});service.watchers.cancelSchedule=()=>{};service.agent.now=()=>time;service.agent.delay=async ms=>{time+=ms;};t.after(()=>{service.close();fs.rmSync(root,{recursive:true,force:true});});
 return {service,files,effects,nativeCalls,entered,ready:()=>ready=true,time:n=>time=n,hold:()=>hold=true,release:()=>{hold=false;release();},model:{id:'fixture',source:'PERSONAL'}};
}
test('one original task yields a watcher, another task finishes, then fresh target readback resumes the first without replay',async t=>{
 const f=fixture(t),s=f.service,first=await s.agent.run('İşlemi izle, hazır olunca sonucu kaydet',f.model);assert.equal(first.status,'watching');const firstId=first.id;assert.equal(fs.existsSync(f.files.first),false);
 f.hold();const other=s.agent.run('Başka dosya oluştur',f.model);await f.entered;f.ready();f.time(1500);await s.watchers.tick();f.time(3000);await s.watchers.tick();assert.equal(s.watchers.state()[0].status,'ready');assert.equal(f.effects.length,0,'background reader cannot focus');assert.equal(fs.existsSync(f.files.first),false);
 f.release();assert.equal((await other).status,'completed');assert.equal(fs.readFileSync(f.files.other,'utf8'),'Diğer iş tamamlandı');await s.watchers.tick();await s.agent.task.work;assert.equal(s.agent.task.id,firstId);assert.equal(s.agent.task.status,'completed');assert.equal(fs.readFileSync(f.files.first,'utf8'),'İlk iş devam etti');assert.deepEqual(f.effects,['focus-first']);assert.equal(s.watchers.state()[0].status,'completed');assert.ok(s.checkpoints.list().some(c=>c.id===firstId));
});
test('foreground message leases are generation-specific and emergency stop prevents automatic continuation',async t=>{const f=fixture(t),s=f.service;await s.agent.run('İşlemi izle, hazır olunca sonucu kaydet',f.model);await s.computer('pause-for-new-task',{requestId:'new-message'});f.ready();f.time(1500);await s.watchers.tick();f.time(3000);await s.watchers.tick();assert.equal(s.watchers.state()[0].status,'ready');await s.computer('message-finished',{requestId:'stale-message'});await s.watchers.tick();assert.equal(f.effects.length,0);await s.emergencyStop();await s.computer('message-finished',{requestId:'new-message'});await s.watchers.tick();assert.equal(s.watchers.state()[0].status,'paused');assert.equal(fs.existsSync(f.files.first),false);assert.equal(s.agent.task.status,'stopped');});

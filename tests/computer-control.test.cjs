const {test}=require('node:test'),assert=require('node:assert/strict');
const {ComputerControl,keyCodes}=require('../src/computer-control.cjs');
const {NativeDesktop}=require('../src/computer-control.cjs'),{EventEmitter}=require('node:events'),{PassThrough,Writable}=require('node:stream');
const {ComputerAgent,parseAction}=require('../src/computer-agent.cjs');
function control(){let now=1000,calls=[];const native={request:async(method,params)=>{calls.push({method,params});return method==='observe'?{title:'Fixture',handle:1,cursor:{x:0,y:0},elements:[{id:0,name:'Editor',bounds:{x:200,y:100,width:100,height:40}}]}:true;},close(){}};const screen={getAllDisplays:()=>[{id:1,bounds:{x:-1000,y:0,width:1000,height:800},scaleFactor:1.5}],dipToScreenPoint:point=>({x:point.x*1.5,y:point.y*1.5})};return {control:new ComputerControl({native,screen,capture:async()=>[{displayId:'1',width:500,height:400,image:'image'}],now:()=>now}),calls,setNow:value=>now=value};}
test('observed screenshot coordinates map through monitor bounds and DPI once',async()=>{
 const f=control();f.control.enable(true);const view=await f.control.observe();await f.control.perform({action:'click',displayId:'1',x:250,y:100},view.id);assert.deepEqual(f.calls.at(-1).params,{x:-750,y:300,button:'left',count:1,expectedHandle:1});await assert.rejects(f.control.perform({action:'keys',keys:['ENTER']},view.id),/güncel değil/);
});
test('expired observation, invalid coordinates and disabled control never input',async()=>{
 const f=control();await assert.rejects(f.control.observe(),/açın/);f.control.enable(true);const view=await f.control.observe();await assert.rejects(f.control.perform({action:'click',displayId:'1',x:999,y:0},view.id),/koordinat/);f.setNow(100000);await assert.rejects(f.control.perform({action:'type',text:'text'},view.id),/güncel değil/);assert.equal(f.calls.length,1);
});
test('accessibility physical bounds are not multiplied by display DPI',async()=>{
 const f=control();f.control.enable(true);const view=await f.control.observe();await f.control.perform({action:'click',elementId:0},view.id);assert.equal(f.calls.at(-1).params.x,250);assert.equal(f.calls.at(-1).params.y,120);
});
test('key validation allows useful combinations and rejects arbitrary native commands',()=>{assert.deepEqual(keyCodes(['CTRL','A']),[17,65]);assert.throws(()=>keyCodes(['RUN:rm']));assert.throws(()=>parseAction('{"action":"powershell"}'));});
function agent(actions){
 const f=control();f.control.enable(true);let step=0,posted,version=1,clock=1000;const logs=[];const memory={epoch:1,context:()=>({}),archiveConversation(){},log:(...args)=>logs.push(args)};
 const api=async(route,body)=>{if(route==='/site/chat/conversations')return {conversation:{id:'c',version}};if(route.endsWith('/messages')){posted=body;return {run:{id:'r'+step}};}if(route.includes('/runs/'))return {run:{status:'COMPLETED'}};return {conversation:{id:'c',version:++version},messages:[{role:'assistant',content:JSON.stringify(actions[step++])}]};};
 const planner=new ComputerAgent({control:f.control,api,memory,now:()=>clock,delay:async ms=>clock+=ms});return {...f,planner,memory,logs,getPosted:()=>posted};
}
const model={id:'model',source:'PERSONAL',categories:['vision']};
test('computer task observes, performs exactly one action and verifies again before done',async()=>{
 const f=agent([{action:'type',text:'Merhaba',summary:'Metin yazılıyor'},{action:'done',message:'Metin ekranda doğrulandı.'}]);const result=await f.planner.run('Metin yaz',model);assert.equal(result.status,'completed');assert.deepEqual(f.calls.map(c=>c.method),['observe','text','observe']);assert.ok(f.getPosted().desktopImage);assert.equal(f.getPosted().desktopMode,'computer');assert.ok(f.logs.some(l=>l[0]==='computer-step'));
});
test('stop while model request is pending cancels returned run without native input',async()=>{
 const f=agent([]);let finish;f.planner.api=async(route)=>{if(route==='/site/chat/conversations')return {conversation:{id:'c',version:1}};if(route.endsWith('/messages'))return new Promise(resolve=>finish=resolve);return {};};const work=f.planner.run('Yaz',model);while(!finish)await new Promise(r=>setImmediate(r));await f.planner.stop();finish({run:{id:'late-run'}});await work;assert.equal(f.planner.state().status,'stopped');assert.equal(f.calls.filter(c=>c.method!=='observe').length,0);
});
test('confirmation never executes old coordinates and resumes with a fresh observation',async()=>{
 const f=agent([{action:'confirm',summary:'Dosyayı yayımla',nextAction:{action:'click',elementId:0}},{action:'click',elementId:0,summary:'Onaylanan düğme'},{action:'done',message:'Yayımlandı.'}]);let result=await f.planner.run('Dosyayı hazırla',model);assert.equal(result.status,'confirmation');assert.equal(f.calls.length,1);result=await f.planner.resume(result.id,{approved:true});assert.equal(result.status,'completed');assert.deepEqual(f.calls.map(c=>c.method),['observe','observe','click','observe']);
});
test('text-only model cannot execute a coordinate it has never seen',async()=>{
 const f=agent([{action:'click',displayId:'1',x:200,y:100},{action:'done',message:'Done'}]);const result=await f.planner.run('Düğmeye bas',{...model,categories:['chat']});assert.equal(result.status,'failed');assert.equal(f.calls.filter(c=>c.method==='click').length,0);
});
test('Stop interrupts long native typing between bounded Unicode chunks',async()=>{
 const f=control();f.control.enable(true);const view=await f.control.observe();let finish;f.control.native.request=(method,params)=>{f.calls.push({method,params});return new Promise(r=>finish=r);};const action=f.control.perform({action:'type',text:'a'.repeat(400)},view.id);await new Promise(r=>setImmediate(r));f.control.stop();finish(true);await assert.rejects(action,/durdur/);assert.ok(f.calls.at(-1).params.text.length<=32);assert.equal(f.calls.filter(c=>c.method==='text').length,1);
});
test('targeted scrolling moves to current element and supports horizontal wheel',async()=>{
 const f=control();f.control.enable(true);const view=await f.control.observe();await f.control.perform({action:'scroll',elementId:0,amount:-2,axis:'horizontal'},view.id);
 assert.deepEqual(f.calls.at(-1),{method:'scroll',params:{x:250,y:120,amount:-2,axis:'horizontal',expectedHandle:1}});
});
test('middle click and cross-monitor drag use each screenshot coordinate system',async()=>{
 const f=control();f.control.enable(true);let view=await f.control.observe();await f.control.perform({action:'middle_click',elementId:0},view.id);assert.equal(f.calls.at(-1).params.button,'middle');
 f.control.capture=async()=>[{displayId:'1',width:500,height:400},{displayId:'2',width:1000,height:800}];f.control.screen.getAllDisplays=()=>[{id:1,bounds:{x:-1000,y:0,width:1000,height:800}},{id:2,bounds:{x:0,y:0,width:2000,height:1600}}];
 view=await f.control.observe();await f.control.perform({action:'drag',displayId:'1',x:250,y:100,endDisplayId:'2',endX:100,endY:200},view.id);assert.equal(f.calls.at(-1).params.endX,300);assert.equal(f.calls.at(-1).params.endY,600);
});
test('window focusing accepts only a window in the current observation',async()=>{
 const f=control();f.control.native.request=async(method,params)=>{f.calls.push({method,params});return method==='observe'?{handle:1,elements:[],windows:[{handle:2,title:'Editor'}]}:true;};f.control.enable(true);
 let view=await f.control.observe();assert.equal(view.windows[0].title,'Editor');await f.control.perform({action:'focus_window',windowHandle:2},view.id);assert.equal(f.calls.at(-1).params.handle,2);
 view=await f.control.observe();await assert.rejects(f.control.perform({action:'focus_window',windowHandle:999},view.id),/pencere/i);
});
test('key codes cover desktop navigation and common editor punctuation',()=>{assert.deepEqual(keyCodes(['CTRL','PLUS']),[17,187]);assert.deepEqual(keyCodes(['INSERT']),[45]);assert.deepEqual(keyCodes(['PRINTSCREEN']),[44]);});
test('planner recovers from invalid JSON using a new observation without executing guesses',async()=>{
 const f=agent(['invalid',{action:'type',text:'OK'},{action:'done',message:'Doğrulandı'}]);
 const result=await f.planner.run('Yaz',model);assert.equal(result.status,'completed');assert.deepEqual(f.calls.map(c=>c.method),['observe','observe','text','observe']);
});
test('planner refocuses after focus change but never repeats a partially typed prefix',async()=>{
 const f=agent([{action:'click',elementId:0},{action:'done',message:'Doğrulandı'}]);const original=f.control.perform.bind(f.control);let first=true;
 f.control.perform=async(...args)=>{if(first){first=false;throw Object.assign(Error('Etkin pencere değişti'),{code:'NATIVE_FOCUS_CHANGED'});}return original(...args);};
 assert.equal((await f.planner.run('Tıkla',model)).status,'completed');assert.equal(f.calls.filter(c=>c.method==='observe').length,2);
 const partial=agent([{action:'type',text:'x'.repeat(80)},{action:'done',message:'Done'}]);let writes=0;partial.control.native.request=async method=>{if(method==='observe')return {handle:1,elements:[]};if(++writes===2)throw Object.assign(Error('focus changed'),{code:'NATIVE_FOCUS_CHANGED'});return true;};
 assert.equal((await partial.planner.run('Yaz',model)).status,'failed');assert.equal(writes,2);assert.equal(partial.planner.state().requiresInput,null);
});
test('planner prevents an endless identical action loop and cleans up startup failures',async()=>{
 const f=agent(Array.from({length:8},()=>({action:'click',elementId:0})));assert.equal((await f.planner.run('Tıkla',model)).status,'question');assert.ok(f.calls.filter(c=>c.method==='click').length<=3);
 const failed=agent([]);let finished=0;failed.planner.onStart=async()=>{throw Error('Shortcut unavailable');};failed.planner.onFinish=()=>finished++;
 assert.equal((await failed.planner.run('Görev',model)).status,'failed');assert.equal(finished,1);
});
function nativeFixture(timeout=1000){let child;const sent=[];const native=new NativeDesktop({timeout,spawnImpl:()=>{child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();child.stdin=new Writable({write(chunk,_encoding,done){sent.push(JSON.parse(String(chunk)));done();}});child.kill=()=>{child.killed=true;};return child;}});return {native,sent,get child(){return child;},reply(){const request=sent.at(-1);child.stdout.write(JSON.stringify({id:request.id,result:true})+'\n');}};}
test('native cancellation drops queued commands while letting an atomic drag release its mouse',async()=>{
 const f=nativeFixture(),drag=f.native.request('drag').catch(e=>e.code),typing=f.native.request('text',{text:'Must not be sent'}).catch(e=>e.code);
 assert.equal(f.sent.length,1);f.native.cancel();assert.equal(await typing,'NATIVE_CANCELLED');assert.equal(await drag,'NATIVE_CANCELLED');assert.ok(!f.child.killed);f.reply();assert.equal(f.sent.length,1);f.native.close();
});
test('native timeout kills the stalled worker and rejects unsent input queue',async()=>{
 const f=nativeFixture(15),one=f.native.request('keys',{keys:[17,65]}).catch(e=>e.code),two=f.native.request('text',{text:'Must not be sent'}).catch(e=>e.code);
 assert.equal(await one,'NATIVE_TIMEOUT');assert.equal(await two,'NATIVE_TIMEOUT');assert.equal(f.sent.length,1);assert.equal(f.child.killed,true);
});
test('stop finishes the active atomic input before restoring the user interface',async()=>{
 const f=agent([]);let release,finished=0;f.control.stop=()=>new Promise(r=>release=r);f.planner.onFinish=()=>finished++;f.planner.task={id:'task',sequence:1,epoch:1,status:'running',steps:[]};f.planner.sequence=1;
 const stopping=f.planner.stop();assert.equal(f.planner.state().status,'stopped');assert.equal(finished,0);release();await stopping;assert.equal(finished,1);
});
test('invalid action fields recover before any input while preserving partial-input failure behavior',async()=>{
 for(const invalid of [{action:'scroll',amount:11},{action:'click',elementId:999},{action:'keys',keys:['RUN:cmd']},{action:'click',displayId:'missing',x:1,y:1}]){
  const f=agent([invalid,{action:'type',text:'Recovered'},{action:'done',message:'Doğrulandı'}]);assert.equal((await f.planner.run('Görev',model)).status,'completed');assert.equal(f.calls.filter(c=>c.method==='text').length,1);assert.equal(f.calls.filter(c=>c.method==='observe').length,3);
 }
});
test('the actual Umay stop-bar handle is excluded from planner window targets',async()=>{
 const f=control();f.control.excludedWindowHandles=()=>[2];f.control.native.request=async()=>({handle:1,elements:[],windows:[{handle:2,title:'Umay bilgisayar görevi'},{handle:3,title:'Editor'}]});f.control.enable(true);
 const view=await f.control.observe();assert.deepEqual(view.windows.map(w=>w.handle),[3]);await assert.rejects(f.control.perform({action:'focus_window',windowHandle:2},view.id),/pencere/);
});
test('administrator input pauses for explicit permission and resumes only after a verified grant',async()=>{
 const f=agent([{action:'click',elementId:0},{action:'done',message:'Doğrulandı'}]);const original=f.control.perform.bind(f.control);let first=true;
 f.control.perform=async(...args)=>{if(first){first=false;throw Object.assign(Error('Yönetici izni gerekli'),{code:'NATIVE_ELEVATION_REQUIRED'});}return original(...args);};
 const result=await f.planner.run('Yönetici penceresinde çalış',model);assert.equal(result.status,'permission');assert.equal(f.calls.filter(c=>c.method==='click').length,0);
 await assert.rejects(f.planner.resume(result.id,{approved:true}),/Windows yönetici/);
 assert.equal((await f.planner.resume(result.id,{approved:true,elevated:true})).status,'completed');assert.equal(f.calls.filter(c=>c.method==='observe').length,2);
});
test('a pending administrator permission is stopped and cannot be replaced by another task',async()=>{
 const f=agent([]);f.control.observe=async()=>{throw Object.assign(Error('Yönetici izni gerekli'),{code:'NATIVE_ELEVATION_REQUIRED'});};
 const result=await f.planner.run('Görev',model);assert.equal(result.status,'permission');await assert.rejects(f.planner.run('Başka görev',model),/etkin/);await f.planner.stop();assert.equal(f.planner.state().status,'stopped');
});
test('chat planner receives original authorization intact and the inferred goal separately',async()=>{
 const f=agent([{action:'done',message:'Doğrulandı.'}]),request='Raporu aç. '+('Başka hiçbir işlem yapma. '.repeat(150));await f.planner.run('Raporu aç ve dosyaları sil',model,{conversationId:'chat',userRequest:request});
 const prompt=JSON.parse(f.getPosted().content);assert.equal(prompt.originalUserRequest,request);assert.equal(prompt.proposedGoal,'Raporu aç ve dosyaları sil');assert.equal(prompt.task,undefined);
});

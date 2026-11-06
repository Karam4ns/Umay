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
test('timed keys/buttons and relative mouse use real foreground guards and reject unbounded input',async()=>{
 const f=control();f.control.enable(true);let view=await f.control.observe();await f.control.perform({action:'hold',keys:['W','SHIFT'],button:'left',milliseconds:1500},view.id);assert.deepEqual(f.calls.at(-1),{method:'hold',params:{keys:[87,16],button:'left',milliseconds:1500,expectedHandle:1}});
 view=await f.control.observe();await f.control.perform({action:'move_relative',dx:120,dy:-30},view.id);assert.deepEqual(f.calls.at(-1),{method:'move_relative',params:{dx:120,dy:-30,expectedHandle:1}});
 for(const action of [{action:'hold',keys:['W'],milliseconds:2001},{action:'hold',milliseconds:500},{action:'hold',button:'unknown',milliseconds:1},{action:'move_relative',dx:9000,dy:1}]){view=await f.control.observe();await assert.rejects(f.control.perform(action,view.id));}
});
test('a planner completion summary is displayed without another model round trip when message is omitted',()=>{
 assert.equal(parseAction('{"action":"done","summary":"Klasör oluşturuldu."}').message,'Klasör oluşturuldu.');
 assert.throws(()=>parseAction('{"action":"done"}'),/eksik/);assert.equal(parseAction('{"action":"done","summary":"Özet","message":"Asıl sonuç"}').message,'Asıl sonuç');
});
function agent(actions){
 const f=control();f.control.enable(true);let step=0,posted,version=1,clock=1000;const logs=[];const memory={epoch:1,context:()=>({}),archiveConversation(){},log:(...args)=>logs.push(args)};
 const api=async(route,body)=>{if(route==='/site/chat/conversations')return {conversation:{id:'c',version}};if(route.endsWith('/messages')){posted=body;return {run:{id:'r'+step}};}if(route.includes('/runs/'))return {run:{status:'COMPLETED'}};return {conversation:{id:'c',version:++version},messages:[{role:'assistant',content:JSON.stringify(actions[step++])}]};};
 const planner=new ComputerAgent({control:f.control,api,memory,now:()=>clock,delay:async ms=>clock+=ms});return {...f,planner,memory,logs,getPosted:()=>posted};
}
test('planner sees the actual focused accessibility target instead of guessing from the last click',async()=>{
 const f=agent([{action:'done',message:'Tamam.'}]),observe=f.control.observe.bind(f.control);
 f.control.observe=async options=>{const view=await observe(options);view.elements=Array.from({length:151},(_,id)=>({...view.elements[0],id,focused:id===150}));return view;};
 await f.planner.run('Metin alanını kontrol et',model);const prompt=JSON.parse(f.getPosted().content);
 assert.equal(prompt.observation.focusedElementId,150);assert.ok(prompt.observation.elements.some(e=>e.id===150&&e.focused),'focused input survives a large accessibility tree');
});
const model={id:'model',source:'PERSONAL',categories:['vision']};
test('the planner can distinguish the current foreground window from the other available windows',async()=>{
 const f=agent([{action:'done',message:'Görüldü.'}]);await f.planner.run('Pencereyi incele',model);assert.equal(JSON.parse(f.getPosted().content).observation.window,1);
});
test('nested follow-up actions outside confirmation are rejected rather than repeatedly focusing a window',()=>{
 assert.throws(()=>parseAction(JSON.stringify({action:'focus_window',windowHandle:123,nextAction:{action:'type',text:'Do not silently execute'}})),/nextAction/);
 assert.equal(parseAction(JSON.stringify({action:'confirm',summary:'Onay',nextAction:{action:'type',text:'Onaylı işlem'}})).action,'confirm');
});
test('text-first desktop avoids capture with useful controls and recovers a coordinate action with a fresh image',async()=>{
 const f=agent([{action:'click',x:10,y:10},{action:'done',message:'Görüldü.'}]);let image=false,captures=0,observations=0;const requests=[],api=f.planner.api;
 f.control.observe=async({preferText})=>{observations++;const view={id:'text'+observations,createdAt:1000,handle:1,title:'Test',windows:[],displays:[{id:'1',bounds:{x:0,y:0,width:100,height:100}}],elements:['Button','Edit','MenuItem'].map((type,id)=>({id,name:'Denetim',type:'ControlType.'+type,bounds:{x:0,y:0,width:10,height:10}})),screenshots:[]};if(!preferText(view)){captures++;view.screenshots=[{displayId:'1',width:100,height:100,image:'data:image/jpeg;base64,aA=='}];}f.control.observation=view;return view;};
 f.planner.api=async(route,body)=>{if(route.endsWith('/messages'))requests.push(body);return api(route,body);};
 const result=await f.planner.run('Test uygulamasında ilerle',model);assert.equal(result.status,'completed');assert.equal(requests[0].desktopImage,undefined);assert.ok(requests[1].desktopImage);assert.equal(captures,1);assert.equal(f.calls.filter(c=>c.method==='click').length,0,'initial coordinate was not applied against the text-only view');assert.equal(f.planner.task.timings.images,1);
});
test('browser navigation focuses and replaces once while website forms cannot offer this capability',async()=>{
 const f=control();f.control.enable(true);let focus=false;const request=f.control.native.request;
 f.control.native.request=async(method,params)=>{if(method==='keys')focus=true;const result=await request(method,params);if(method==='observe')result.elements=[{id:0,name:'Adres ve arama çubuğu',type:'ControlType.Edit',focused:focus,inDocument:false,runtimeId:[42,8]}];return result;};
 const view=await f.control.observe();await f.control.perform({action:'navigate',url:'https://example.org'},view.id);
 assert.deepEqual(f.calls.filter(c=>c.method!=='observe'),[{method:'keys',params:{keys:[17,76],expectedHandle:1}},{method:'text',params:{text:'https://example.org/',expectedHandle:1,expectedFocus:[42,8],replace:true,submit:true}}]);
 const next=await f.control.observe();next.elements[0].inDocument=true;await assert.rejects(f.control.perform({action:'navigate',url:'https://example.org'},next.id),/bulunamadı/);
});
test('navigation never types after foreground changes and rejects non-web protocols',async()=>{
 const f=control();f.control.enable(true);let changed=false;const request=f.control.native.request;
 f.control.native.request=async(method,params)=>{if(method==='keys')changed=true;const result=await request(method,params);if(method==='observe'){result.handle=changed?2:1;result.elements=[{id:0,name:'Address and search bar',type:'ControlType.Edit',focused:true,inDocument:false}];}return result;};
 let view=await f.control.observe();await assert.rejects(f.control.perform({action:'navigate',url:'javascript:alert(1)'},view.id));assert.equal(f.calls.filter(c=>c.method==='keys').length,0);
 view=await f.control.observe();await assert.rejects(f.control.perform({action:'navigate',url:'https://example.org'},view.id),/odağı değişti/);assert.equal(f.calls.filter(c=>c.method==='text').length,0);
});
test('changing address values and screenshots never permit a repeated append',async()=>{
 const f=agent(Array.from({length:20},()=>({action:'type',text:'netflix.com',summary:'Adresi yaz'}))),observe=f.control.observe.bind(f.control);let n=0;
 f.control.observe=async options=>{const view=await observe(options);view.title='Browser '+n;view.elements=[{id:n++,name:'Address',value:'netflix.com'.repeat(n),focused:true,type:'ControlType.Edit',automationId:'address',bounds:{x:0,y:0,width:100,height:20}}];view.screenshots[0].image='frame'+n;return view;};
 const result=await f.planner.run('Tarayıcıda netflix.com aç',model);
 assert.equal(result.status,'question');assert.equal(f.calls.filter(c=>c.method==='text').length,1);assert.equal(f.planner.task.steps.length,1);
 assert.match(JSON.parse(f.getPosted().content).userFeedback,/WRITE_ALREADY_APPLIED/);
});
test('a blocked repeated write gives the planner a chance to submit instead',async()=>{
 const f=agent([{action:'type',text:'example.org'},{action:'type',text:'example.org'},{action:'keys',keys:['ENTER']},{action:'done',message:'Açıldı.'}]);
 assert.equal((await f.planner.run('Siteyi aç',model)).status,'completed');
 assert.equal(f.calls.filter(c=>c.method==='text').length,1);assert.deepEqual(f.calls.filter(c=>c.method==='keys').map(c=>c.params.keys),[[13]]);
});
test('replace and submit use a focused edit with one guarded native text transaction',async()=>{
 const f=control();f.control.enable(true);const view=await f.control.observe();Object.assign(view.elements[0],{focused:true,type:'ControlType.Edit',runtimeId:[42,8]});
 await f.control.perform({action:'type',text:'https://example.org',replace:true,submit:true},view.id);
 assert.deepEqual(f.calls.at(-1),{method:'text',params:{text:'https://example.org',expectedHandle:1,expectedFocus:[42,8],replace:true,submit:true}});
 const other=await f.control.observe();await assert.rejects(f.control.perform({action:'type',text:'x',replace:true},other.id),/odaklanın/);
});
test('the computer planner selects the assistant bound to its accepted run',async()=>{
 const f=agent([]),api=f.planner.api;
 f.planner.api=async(route,body)=>route.includes('/runs/')?{run:{status:'COMPLETED',assistantMessageId:'current'}}:route==='/site/chat/conversations/c'?{conversation:{id:'c',version:2},messages:[{id:'current',role:'assistant',content:'{"action":"done","message":"Doğru yanıt"}'},{id:'stale',role:'assistant',content:'{"action":"type","text":"wrong"}'}]}:api(route,body);
 assert.equal((await f.planner.run('Ekranı oku',model)).message,'Doğru yanıt');assert.equal(f.calls.filter(c=>c.method==='text').length,0);
});
test('a generic app watch polls locally and passes only its observed outcome to the next model step',async()=>{
 const f=agent([{action:'watch',windowHandle:1,contains:'completed',milliseconds:2000,intervalMs:500},{action:'done',message:'Görev izlendi.'}]),native=f.control.native.request,api=f.planner.api,posts=[];let polls=0;
 f.control.native.request=async(method,params)=>method==='observe_window'?{handle:1,title:'Coding app',elements:[{name:++polls===2?'Task completed':'Working'}]}:native(method,params);
 f.planner.api=async(route,body)=>{if(route.endsWith('/messages'))posts.push(JSON.parse(body.content));return api(route,body);};
 assert.equal((await f.planner.run('Uygulamadaki işi takip et',model)).status,'completed');assert.equal(posts.length,2);assert.equal(polls,2);assert.match(posts[1].userFeedback,/matched/);assert.equal(f.calls.filter(c=>c.method!=='observe').length,0);
});
test('background inspection binds the window process and never changes the current input observation',async()=>{
 const f=control();f.control.enable(true);const native=f.control.native.request;f.control.native.request=async(method,params)=>method==='observe'?{handle:1,title:'Foreground',elements:[],windows:[{handle:2,title:'Background task',processId:333}]}:(f.calls.push({method,params}),{handle:2,isForeground:false,title:'Background task',elements:[]});
 const view=await f.control.observe();await f.control.inspectWindow(2);assert.deepEqual(f.calls.at(-1),{method:'observe_window',params:{handle:2,expectedProcessId:333}});assert.equal(f.control.observation.id,view.id);await assert.rejects(f.control.inspectWindow(999),/güncel/);
});
test('pause stops locally before a late model POST, then resume refreshes version and cannot execute the old response',async()=>{
 const f=agent([]);let deliver,posted=0,version=1,oldPolls=0;const cancelled=[];
 f.planner.api=async(route,body)=>{
  if(route==='/site/chat/conversations')return {conversation:{id:'c',version}};
  if(route.endsWith('/messages')){assert.equal(body.expectedVersion,version);version++;posted++;if(posted===1)return new Promise(r=>deliver=()=>r({run:{id:'old'}}));return {run:{id:'new'+posted}};}
  if(route.endsWith('/cancel')){cancelled.push(route);return {};}
  if(route.includes('/runs/'))return {run:{status:route.endsWith('/old')&&oldPolls++===0?'RUNNING':'COMPLETED'}};
  return {conversation:{id:'c',version},messages:posted>1?[{role:'assistant',content:JSON.stringify(posted===2?{action:'type',text:'Yeni talimat'}:{action:'done',message:'Bitti.'})}]:[]};
 };
 const running=f.planner.run('Kullanıcının işi',model);while(!deliver)await new Promise(r=>setImmediate(r));
 assert.equal((await f.planner.pause()).status,'paused');assert.equal(f.calls.filter(x=>x.method==='text').length,0);
 const resumed=f.planner.resumePaused();await new Promise(r=>setImmediate(r));assert.equal(posted,1);deliver();await running;
 assert.equal((await resumed).status,'completed');assert.equal(f.calls.filter(x=>x.method==='text').length,1);assert.deepEqual(cancelled,[]);assert.equal(oldPolls,2);
});
test('pausing a permission/confirmation never silently approves it on continue',async()=>{
 const f=agent([{action:'confirm',summary:'Dosyayı yayımla',nextAction:{action:'click',elementId:0}}]);const task=await f.planner.run('Dosyayı hazırla',model);assert.equal(task.status,'confirmation');await f.planner.pause();const restored=await f.planner.resumePaused();assert.equal(restored.status,'confirmation');assert.match(restored.message,/Dosyayı yayımla/);assert.equal(f.calls.filter(x=>x.method==='click').length,0);
});
test('resume failures have a terminal visible state and local waits do not delay pause',async()=>{
 const f=agent([]);f.planner.task={id:'paused',status:'paused',pausedStatus:'running',sequence:0,epoch:1,goal:'Task',model,conversation:{id:'c',version:1},steps:[],messageTimes:[],work:Promise.resolve()};f.planner.sequence=1;f.planner.api=async()=>{throw Error('NETWORK_ERROR');};const result=await f.planner.resumePaused();assert.equal(result.status,'failed');assert.equal(result.message,'NETWORK_ERROR');
 const g=control();g.control.enable(true);const view=await g.control.observe();const start=Date.now(),waiting=g.control.perform({action:'wait',milliseconds:1500},view.id).catch(e=>e.message);await new Promise(r=>setTimeout(r,25));g.control.stop();assert.match(await waiting,/durdur/);assert.ok(Date.now()-start<500);
});
test('an unverified completion must finish the pending rename before success and never retype blindly',async()=>{
 const f=agent([{action:'type',text:'dosya'},{action:'done',message:'Oluşturuldu.'},{action:'keys',keys:['ENTER']},{action:'done',message:'Oluşturuldu.'}]);
 f.planner.verifyCompletion=async()=>({verified:f.calls.some(c=>c.method==='keys'),message:'Klasör dosya sisteminde yok; adlandırmayı Enter ile onayla.'});
 assert.equal((await f.planner.run('Masaüstüne dosya adında klasör oluştur',model)).status,'completed');assert.equal(f.calls.filter(c=>c.method==='text').length,1);assert.equal(f.calls.filter(c=>c.method==='keys').length,1);assert.equal(f.calls.filter(c=>c.method==='observe').length,3);
});
test('an independently verified single-step outcome completes without another model guess or unnecessary question',async()=>{
 const f=agent([{action:'keys',keys:['ENTER']},{action:'ask',message:'Klasör zaten var, ne yapayım?'}]);f.planner.verifyCompletion=async()=>({verified:f.calls.some(c=>c.method==='keys'),message:'İstenen klasör doğrulandı.'});
 const result=await f.planner.run('Masaüstüne dosya adında klasör oluştur',model);assert.equal(result.status,'completed');assert.equal(result.message,'İstenen klasör doğrulandı.');assert.equal(JSON.parse(f.getPosted().content).step,1);
});
test('a rejected planner response is re-observed and retried without replaying input or masking billing errors',async()=>{
 const f=agent([{action:'type',text:'Yeni klasör'},{action:'done',message:'Tamamlandı.'}]),api=f.planner.api;let failed=false,version=1,failedDetail=false;
 f.planner.api=async(route,body)=>{if(route.endsWith('/messages')){assert.equal(body.expectedVersion,version,'retry must refresh accepted conversation version');version++;}if(route.includes('/runs/')&&!failed){failed=true;failedDetail=true;return {run:{status:'FAILED',errorCode:'ANSWER_QUALITY_FAILED'}};}if(!body&&route==='/site/chat/conversations/c'&&failedDetail){failedDetail=false;return {conversation:{id:'c',version},messages:[]};}const result=await api(route,body);if(!body&&route==='/site/chat/conversations/c')result.conversation.version=version;return result;};
 assert.equal((await f.planner.run('Görev',model)).status,'completed');assert.equal(f.calls.filter(c=>c.method==='text').length,1);assert.equal(f.calls.filter(c=>c.method==='observe').length,3);
 const billing=agent([]);billing.planner.api=async(route,body)=>route.includes('/runs/')?{run:{status:'FAILED',errorCode:'INSUFFICIENT_TOKENS'}}:api(route,body);assert.equal((await billing.planner.run('Görev',model)).message,'INSUFFICIENT_TOKENS');assert.equal(billing.calls.filter(c=>c.method!=='observe').length,0);
});
test('an omitted coordinate display binds only to the single screenshot actually supplied to the vision model',async()=>{
 const f=agent([{action:'right_click',x:250,y:100},{action:'done',message:'Tamamlandı.'}]);
 const result=await f.planner.run('Masaüstünde klasör oluştur',model);assert.equal(result.status,'completed');assert.equal(f.calls.filter(c=>c.method==='click').length,1);assert.equal(f.calls.find(c=>c.method==='click').params.button,'right');
 const text=agent([{action:'right_click',x:250,y:100},{action:'done',message:'Tamamlandı.'}]);assert.equal((await text.planner.run('Görev',{...model,categories:['chat']})).status,'failed');assert.equal(text.calls.filter(c=>c.method==='click').length,0);
});
test('computer task observes, performs exactly one action and verifies again before done',async()=>{
 const f=agent([{action:'type',text:'Merhaba',summary:'Metin yazılıyor'},{action:'done',message:'Metin ekranda doğrulandı.'}]);const result=await f.planner.run('Metin yaz',model);assert.equal(result.status,'completed');assert.deepEqual(f.calls.map(c=>c.method),['observe','text','observe']);assert.ok(f.getPosted().desktopImage);assert.equal(f.getPosted().desktopMode,'computer');assert.ok(f.logs.some(l=>l[0]==='computer-step'));
});
test('stop quarantines a late model response and allows provider accounting to finish without input',async()=>{
 const f=agent([]);let finish;f.planner.api=async(route)=>{if(route==='/site/chat/conversations')return {conversation:{id:'c',version:1}};if(route.endsWith('/messages'))return new Promise(resolve=>finish=resolve);assert.ok(!route.endsWith('/cancel'));return {run:{status:'COMPLETED'}};};const work=f.planner.run('Yaz',model);while(!finish)await new Promise(r=>setImmediate(r));await f.planner.stop();finish({run:{id:'late-run'}});await work;assert.equal(f.planner.state().status,'stopped');assert.equal(f.calls.filter(c=>c.method!=='observe').length,0);
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
test('cancelling a timed native hold signals its independent stop channel before waiting for key-up',async()=>{
 const fs=require('node:fs'),f=nativeFixture(),holding=f.native.request('hold',{keys:[87],milliseconds:2000}).catch(e=>e.code);const stopFile=f.sent[0].params.stopFile;assert.equal(typeof stopFile,'string');assert.equal(fs.existsSync(stopFile),false);
 const drained=f.native.cancel();assert.equal(await holding,'NATIVE_CANCELLED');assert.equal(fs.existsSync(stopFile),true);assert.ok(!f.child.killed);f.reply();await drained;assert.equal(fs.existsSync(stopFile),false);f.native.close();
});
test('a timed-out hold requests release before killing its helper or restoring the interface',async()=>{
 const fs=require('node:fs'),f=nativeFixture(15);let settled=false;const holding=f.native.request('hold',{keys:[87],milliseconds:2000}).catch(e=>{settled=true;return e.code;}),queued=f.native.request('text',{text:'never'}).catch(e=>e.code);
 await new Promise(r=>setTimeout(r,40));assert.ok(!f.child.killed);assert.equal(settled,false);assert.equal(fs.existsSync(f.sent[0].params.stopFile),true);assert.equal(await queued,'NATIVE_TIMEOUT');f.reply();assert.equal(await holding,'NATIVE_TIMEOUT');assert.equal(f.child.killed,true);assert.equal(f.sent.length,1);
});
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
test('planner receives Windows keyboard affordances so a folder request need not use uncertain menu coordinates',async()=>{
 const f=agent([{action:'done',message:'Doğrulandı.'}]);await f.planner.run('Görev',model);
 const prompt=JSON.parse(f.getPosted().content);assert.deepEqual(prompt.capabilities.windowsShortcuts.newFolderOnDesktopOrExplorer,['CTRL','SHIFT','N']);assert.deepEqual(prompt.capabilities.windowsShortcuts.showDesktop,['WIN','D']);
});

test('resume awaits native release even when prior model work already ended, and long pauses preserve active budget',async()=>{
 const f=agent([{action:'done',message:'Devam edildi.'}]);let release,started=0,clock=1000;f.planner.now=()=>clock;f.planner.delay=async ms=>clock+=ms;f.planner.onStart=()=>started++;
 f.planner.task={id:'one',status:'running',sequence:1,epoch:1,goal:'İş',model,steps:[],messageTimes:[],createdAt:clock,work:Promise.resolve()};f.planner.sequence=1;f.control.stop=()=>new Promise(r=>release=r);
 const paused=f.planner.pause();clock+=31*60000;const resumed=f.planner.resumePaused();await new Promise(r=>setImmediate(r));assert.equal(started,0,'new input route must not run before old elevated keys release');release();await paused;assert.equal((await resumed).status,'completed');assert.equal(started,1);
});

test('a hold timeout recycles the helper after release instead of permanently closing access',async()=>{
 const f=nativeFixture(15),holding=f.native.request('hold',{keys:[87],milliseconds:2000}).catch(e=>e.code);await new Promise(r=>setTimeout(r,35));f.reply();assert.equal(await holding,'NATIVE_TIMEOUT');const restarted=f.native.request('privileges');f.reply();assert.equal(await restarted,true);f.native.close();
});

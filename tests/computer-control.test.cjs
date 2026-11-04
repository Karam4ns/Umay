const {test}=require('node:test'),assert=require('node:assert/strict');
const {ComputerControl,keyCodes}=require('../src/computer-control.cjs');
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

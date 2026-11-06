// Opt-in acceptance against the selected real models and a separate Chrome
// profile. Native input is restricted to that profile's single test window.
const {app,screen,desktopCapturer,globalShortcut}=require('electron');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),{spawn}=require('node:child_process'),{createServer}=require('node:http'),{randomUUID}=require('node:crypto');
const {DeviceServices}=require('../src/device-services.cjs'),{NativeDesktop}=require('../src/computer-control.cjs');
if(!process.env.UMAY_LIVE_SESSION_FILE)throw Error('A short-lived authorized verification session is required.');
const token=JSON.parse(fs.readFileSync(process.env.UMAY_LIVE_SESSION_FILE,'utf8')).token;
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'umay-live-browser-'));app.setPath('userData',path.join(directory,'electron'));
let chrome,service,native,server,timer;const inputs=[];
async function finish(code){clearTimeout(timer);globalShortcut.unregisterAll();service?.close();native?.close();chrome?.kill();server?.close();app.exit(code);}
app.whenReady().then(async()=>{try{
 timer=setTimeout(()=>{console.error('FAIL real browser deadline');void finish(1);},180000);
 const executable=[process.env.PROGRAMFILES,process.env['PROGRAMFILES(X86)'],process.env.LOCALAPPDATA].filter(Boolean).map(p=>path.join(p,'Google/Chrome/Application/chrome.exe')).find(p=>fs.existsSync(p));assert.ok(executable,'Chrome installed');
 server=createServer((_req,res)=>res.end('<!doctype html><meta charset="utf-8"><title>UMAY browser test start</title><h1>Umay navigation test</h1>'));await new Promise(r=>server.listen(0,'127.0.0.1',r));
 chrome=spawn(executable,['--user-data-dir='+path.join(directory,'chrome'),'--no-first-run','--no-default-browser-check','--force-renderer-accessibility','--start-maximized','--new-window','http://127.0.0.1:'+server.address().port],{windowsHide:true,stdio:'ignore'});
 native=new NativeDesktop();let own,view;const began=Date.now();
 while(Date.now()-began<15000){view=await native.request('observe');own=view.windows.find(w=>w.processId===chrome.pid);if(own)break;await new Promise(r=>setTimeout(r,150));}assert.ok(own,'a fresh test Chrome window must exist');
 await native.request('focus',{handle:own.handle});view=await native.request('observe');const address=view.elements.find(e=>e.type==='ControlType.Edit'&&/adres|address/i.test(e.name));assert.ok(address,'browser address field observed');assert.equal(address.inDocument,false,'the real browser address must not be classified as a web form');
 const api=async(route,body)=>{const response=await fetch('https://veriussu.com'+route,{method:body?'POST':'GET',headers:{cookie:'veriussu_web='+token,origin:'https://veriussu.com','content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const value=await response.json();if(!response.ok)throw Error(value.message||'HTTP_'+response.status);return value;};
 const nativeApi={request:async(method,params)=>{
  if(!['observe','observe_window','foreground','location'].includes(method)){
   if(method==='focus')assert.equal(params.handle,own.handle,'only the test Chrome window may be focused');else assert.equal(params.expectedHandle,own.handle,'only the test Chrome window may receive input');
   if(method==='keys')assert.ok(params.keys.every(k=>[17,76,65,13,18,68,9,27].includes(k)),'navigation test keys only');
   if(method==='text'){assert.ok(params.text.length<=120,'bounded test text');inputs.push({method,characters:params.text.length,replace:!!params.replace,submit:!!params.submit});}else inputs.push({method});
  }return native.request(method,params);
 },cancel:()=>native.cancel(),close:()=>native.close()};
 service=new DeviceServices({directory,api,screen,native:nativeApi,background:false,onComputerStart:async()=>{await native.request('focus',{handle:own.handle});},capture:async()=> (await desktopCapturer.getSources({types:['screen'],thumbnailSize:{width:1600,height:1000}})).map(s=>({displayId:s.display_id,...s.thumbnail.getSize(),image:'data:image/jpeg;base64,'+s.thumbnail.toJPEG(65).toString('base64')}))});
 globalShortcut.register('F8',()=>void service.agent.stop());
 service.activate((await api('/site/auth/me')).id);const {models}=await api('/site/chat/models');
 const chat=models.find(m=>m.id===(process.env.UMAY_LIVE_CHAT_MODEL_ID||'9076520e-1151-4fcc-9f5a-109f0c651bea')),computer=models.find(m=>m.id===(process.env.UMAY_LIVE_COMPUTER_MODEL_ID||'eadbac23-9cbf-4d94-9a89-13fe0bd54d97'));assert.ok(chat&&computer,'current assigned models available');await service.modelRoles('save',{chat,computer});
 const start=Date.now(),{conversation}=await service.siteApi('/site/chat/conversations',{source:chat.source,modelId:chat.id,title:'Umay browser acceptance',requestId:randomUUID()});
 const request='Yalnızca bu test için açılan Chrome penceresinde https://www.netflix.com adresini aç. Diğer pencerelere dokunma.';
 const posted=await service.siteApi('/site/chat/conversations/'+conversation.id+'/messages',{content:request,requestId:randomUUID(),expectedVersion:conversation.version,kind:'CHAT'});
 let run;do{run=(await service.siteApi('/site/chat/runs/'+posted.run.id)).run;if(['QUEUED','RUNNING'].includes(run.status))await new Promise(r=>setTimeout(r,200));}while(['QUEUED','RUNNING'].includes(run.status));
 assert.equal(run.status,'COMPLETED',run.errorCode);assert.ok(run.mediaOptions?.desktopChatTask,'the chat must actually dispatch');const handoffMs=Date.now()-start;
 const state=await service.computer('dispatch',{runId:run.id,conversationId:conversation.id});
 const end=await native.request('observe_window',{handle:own.handle,expectedProcessId:chrome.pid}),addresses=end.elements.filter(e=>e.type==='ControlType.Edit'||e.type==='ControlType.Document').map(e=>e.value);
 assert.equal(state.status,'completed',JSON.stringify(state));assert.match(end.title,/netflix/i,'the actual page title must verify navigation');assert.ok(addresses.some(v=>/^(?:https?:\/\/)?(?:www\.)?netflix\.com(?:[/?]|$)/i.test(v)),'the actual page/address must be Netflix');assert.ok(!addresses.some(v=>/netflix\.comnetflix/i.test(v)),'no repeated domain');
 const experience=service.memory.computerExperience(request);assert.ok(experience.length,'procedural evidence persisted');
 console.log(JSON.stringify({handoffMs,totalMs:Date.now()-start,plan:run.mediaOptions.desktopChatTask.plan,inputs,status:state.status,title:end.title,experienceRecords:experience.length}));console.log('PASS actual site chat -> assigned computer model -> separate real Chrome -> Netflix title and address verified');await finish(0);
}catch(error){console.error(error);await finish(1);}});

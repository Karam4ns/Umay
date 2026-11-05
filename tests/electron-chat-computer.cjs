// Synthetic authenticated provider and native input. Real Electron chat/IPC/
// task lifecycle; actual Windows input is covered by separate disposable tests.
const {app,ipcMain,screen}=require('electron'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const {DeviceServices}=require('../src/device-services.cjs');app.setPath('userData',fs.mkdtempSync(path.join(os.tmpdir(),'umay-chat-computer-')));require('../src/main.cjs');let service;
const timeout=setTimeout(()=>{console.error('FAIL chat computer timeout');service?.close();app.exit(1);},60000);
app.on('browser-window-created',(_e,window)=>window.webContents.once('did-finish-load',async()=>{
 try{
  const chats=new Map(),runs=new Map(),inputs=[];let serial=0,actions=[],needsAdmin=false,grants=0,computerChats=0;
  const models=[{id:'chat-model',source:'PERSONAL',name:'Sohbet',categories:['chat']},{id:'computer-model',source:'SUBSCRIPTION',name:'Bilgisayar',categories:['vision']}];
  const api=async(route,body)=>{
   if(route==='/site/auth/me')return {id:'chat-test',email:'fixture@example.test'};
   if(route==='/site/chat/models')return {models};
   if(route==='/site/chat/conversations'){
    if(!body)return {conversations:[]};const computer=body.title.startsWith('Umay bilgisayar görevi:');if(computer){assert.equal(body.modelId,'computer-model');computerChats++;}
    const conversation={id:computer?'computer-'+(++serial):'main',version:1,title:body.title},entry={conversation,messages:[],computer};chats.set(conversation.id,entry);return {conversation};
   }
   const post=route.match(/^\/site\/chat\/conversations\/([^/]+)\/messages$/);
   if(post){const chat=chats.get(post[1]);let content,task;
    if(chat.computer){const prompt=JSON.parse(body.content);inputs.push({prompt});content=JSON.stringify(actions.shift()||{action:'done',message:'Tamamlandı.'});}
    else {const operate=body.content!=='selam';content=operate?'Görevine başlıyorum.':'Merhaba.';if(operate)task={version:1,goal:body.content,acknowledgement:content,userRequest:body.content};}
    chat.messages.push({id:'user-'+serial,role:'user',content:body.content,createdAt:new Date().toISOString()},{id:'assistant-'+serial,role:'assistant',content,createdAt:new Date().toISOString()});chat.conversation.version++;
    if(task)task.anchorMessageId=chat.messages.at(-1).id;
    const run={id:'run-'+(++serial),conversationId:chat.conversation.id,status:'COMPLETED',createdAt:new Date().toISOString(),mediaOptions:task?{desktopChatTask:task}:{}};runs.set(run.id,run);return {run};
   }
   const run=route.match(/^\/site\/chat\/runs\/([^/]+)$/);if(run)return {run:runs.get(run[1])};
   if(route.endsWith('/cancel'))return {};
   const detail=route.match(/^\/site\/chat\/conversations\/([^/?]+)$/);if(detail){const entry=chats.get(detail[1]);return {conversation:{...entry.conversation},messages:entry.messages.map(m=>({...m}))};}
   throw Error('Unexpected fixture route '+route);
  };
  service=new DeviceServices({directory:app.getPath('userData'),api,screen,background:false,publish:event=>window.webContents.send('event',event),capture:async()=>[{displayId:String(screen.getPrimaryDisplay().id),width:1,height:1,image:'data:image/png;base64,fixture'}],native:{request:async(method,params)=>{inputs.push({method,params});return method==='observe'?{requiresElevation:needsAdmin,administrator:!needsAdmin,handle:1,title:'Fixture',elements:[{id:0,name:'Kaydet',bounds:{x:10,y:10,width:80,height:30}}]}:true;},elevate:async()=>{grants++;needsAdmin=false;return {administrator:true};},close(){}}});service.activate('chat-test');
  for(const name of ['api','model-roles','computer','speech'])ipcMain.removeHandler(name);
  ipcMain.handle('api',(_e,route,body)=>service.siteApi(route,body));ipcMain.handle('model-roles',(_e,method,input)=>service.modelRoles(method,input));ipcMain.handle('computer',(_e,method,input)=>service.computer(method,input));ipcMain.handle('speech',(_e,method)=>method==='status'?{stt:{installed:false},tts:{installed:false}}:true);
  const js=code=>window.webContents.executeJavaScript(code);await service.modelRoles('save',{chat:models[0],computer:models[1]});await js('refresh()');await js("document.getElementById('speak').checked=false");
  assert.equal(await js("!!document.getElementById('computer')||!!document.getElementById('computer-mode')||!!document.querySelector('[data-page=computer]')"),false);
  actions=[{action:'ask',message:'Hangi klasöre kaydedeyim?'},{action:'confirm',summary:'Dosyayı kaydet',nextAction:{action:'click',elementId:0}},{action:'click',elementId:0,summary:'Kaydet düğmesi'},{action:'done',message:'Planın Belgeler klasörüne kaydedildi.'}];
  await js("send('Not Defteri aç ve planımı kaydet')");assert.equal(service.agent.state().status,'question');assert.equal(await js("document.getElementById('chat').hidden"),false);assert.equal(await js("document.querySelectorAll('.computer-task').length"),1);
  await js("send('Belgeler klasörüne',true)");assert.equal(service.agent.state().status,'confirmation');assert.equal(inputs.filter(i=>i.method==='click').length,0);assert.ok(inputs.some(i=>i.prompt?.userFeedback?.includes('Belgeler klasörüne')));
  await js("send('evet',true)");assert.equal(service.agent.state().status,'completed');assert.equal(inputs.filter(i=>i.method==='click').length,1);assert.equal(await js("[...document.querySelectorAll('.message.assistant')].filter(e=>e.textContent==='Planın Belgeler klasörüne kaydedildi.').length"),1);
  await js('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');fs.writeFileSync('.superpowers/conversational-computer-dark.png',(await window.capturePage()).toPNG());
  needsAdmin=true;actions=[{action:'done',message:'Yönetici görevi tamamlandı.'}];await js("send('Yönetici ayarını uygula')");assert.equal(service.agent.state().status,'permission');assert.equal(grants,0);await js("send('Windows yönetici onayını aç')");assert.equal(grants,1);assert.equal(service.agent.state().status,'completed');
  const count=computerChats;await js("send('selam')");assert.equal(computerChats,count);assert.equal(await js("[...document.querySelectorAll('.message.assistant')].at(-1).textContent"),'Merhaba.');
  const history=await service.siteApi('/site/chat/conversations/main');assert.ok(history.messages.some(m=>m.content==='Belgeler klasörüne'));assert.ok(history.messages.some(m=>m.content==='Planın Belgeler klasörüne kaydedildi.'));
  await js("document.getElementById('theme').click()");await js('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');fs.writeFileSync('.superpowers/conversational-computer-light.png',(await window.capturePage()).toPNG());
  await js('clearAccount()');assert.equal(await js("document.querySelectorAll('.computer-task').length"),0);
  console.log('PASS real Electron chat-only typed/voice dispatch, assigned roles, same-chat question/confirmation/UAC button flow, no input before approval, local history, ordinary chat and account cleanup');service.close();clearTimeout(timeout);app.quit();
 }catch(error){console.error(error);service?.close();clearTimeout(timeout);app.exit(1);}
}));

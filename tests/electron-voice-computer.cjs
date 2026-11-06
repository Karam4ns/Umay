// Real capture, STT, renderer send and TTS. Only the authenticated site API is synthetic.
const {app,ipcMain}=require('electron');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'umay-conversation-'));app.setPath('userData',directory);
function link(source,destination){fs.mkdirSync(destination,{recursive:true});for(const item of fs.readdirSync(source,{withFileTypes:true})){if(item.name==='.cache'||item.name==='final')continue;const from=path.join(source,item.name),to=path.join(destination,item.name);if(item.isDirectory())link(from,to);else fs.linkSync(from,to);}}
for(const kind of ['stt-live','tts'])link(path.join(process.env.APPDATA,'umay/speech/packages',kind),path.join(directory,'speech/packages',kind));
const cache=path.join(process.env.APPDATA,'umay/speech/hf');if(fs.existsSync(cache))link(cache,path.join(directory,'speech/hf'));
app.commandLine.appendSwitch('use-fake-device-for-media-stream');
app.commandLine.appendSwitch('use-file-for-fake-audio-capture',path.resolve('tests/fixtures/computer-command.wav')+'%noloop');
const deadline=setTimeout(()=>{console.error('FAIL conversation timeout');app.exit(1);},60000);
require('../src/main.cjs');
app.on('browser-window-created',(_e,window)=>{
 window.webContents.setAudioMuted(true); // Exercise WebAudio without sounding into the user's active assistant microphone.
 window.on('show',()=>window.hide());window.webContents.setBackgroundThrottling(false);
 window.webContents.once('did-finish-load',async()=>{
 try{
  const conversation={id:'11111111-1111-4111-8111-111111111111',version:1},runId='22222222-2222-4222-8222-222222222222';let posted=null,polls=0,cancels=0,dispatches=0;
  ipcMain.removeHandler('model-roles');ipcMain.handle('model-roles',()=>({roles:{chat:null,computer:null},models:[]}));
  ipcMain.removeHandler('computer');ipcMain.handle('computer',(_e,method,input)=>{if(method==='state')return {access:{administrator:false},enabled:true,task:null};assert.equal(method,'dispatch');assert.equal(input.runId,runId);assert.equal(input.conversationId,conversation.id);dispatches++;return {id:'voice-task',origin:{conversationId:conversation.id},status:'completed',goal:'Not Defteri aç',message:'Görev tamamlandı. Planın kaydedildi.'};});
  const routes=[];ipcMain.removeHandler('api');ipcMain.handle('api',(_event,route,body)=>{
   routes.push({route,post:body!==undefined});
   if(route==='/site/auth/me')return {id:'fixture',firstName:'Test',email:'test@example.com'};
   if(route==='/site/chat/models')return {models:[{id:'fixture-model',source:'PERSONAL',name:'Test modeli'}]};
   if(route==='/site/chat/conversations')return body?{conversation}:{conversations:[]};
   if(route.endsWith('/messages')){posted=body;return {run:{id:runId,status:'QUEUED'}};}
   if(route.endsWith('/cancel')){cancels++;return {ok:true};}
   if(route==='/site/chat/runs/'+runId)return {run:{id:runId,status:++polls===1?'RUNNING':'COMPLETED',mediaOptions:{desktopChatTask:{version:1,goal:'Not Defteri aç',acknowledgement:'Başlıyorum.'}}}};
   if(route==='/site/chat/conversations/'+conversation.id)return {conversation,messages:[{role:'user',content:posted?.content},{role:'assistant',content:'Görevine başlıyorum.'}]};
   throw Error('Unexpected synthetic API route '+route);
  });
  const js=code=>window.webContents.executeJavaScript(code,true);
  await js('refresh()');console.log('Synthetic account ready');await js("(async()=>{for(const kind of ['stt','tts'])await window.umay.speech('load',{kind});})()");console.log('Actual speech models ready');
  await js("firstAudioAt=0;firstPlaybackAt=0;assistantAt=0;window.umay.onEvent(e=>{if(e.event==='audio'&&!firstAudioAt)firstAudioAt=Date.now()});document.getElementById('speak').checked=true;document.getElementById('listen').onclick()");
  const result=await js(`new Promise((resolve,reject)=>{const end=Date.now()+25000;const poll=()=>{
   if(document.querySelector('.message.assistant')&&!assistantAt)assistantAt=Date.now();
   if(sources.length&&!firstPlaybackAt)firstPlaybackAt=Date.now();
   if(firstAudioAt&&firstPlaybackAt)return resolve({listening,firstAudioMs:firstAudioAt-assistantAt,firstPlaybackMs:firstPlaybackAt-assistantAt,messages:document.getElementById('messages').children.length,status:document.getElementById('status').textContent});
   if(Date.now()>end)return reject(Error('Missing reply/audio: '+document.getElementById('status').textContent));setTimeout(poll,20);
  };poll();})`);
  assert.ok(posted,JSON.stringify({result,routes}));assert.match(posted.content,/not.*defter/i);assert.equal(dispatches,1);assert.equal(cancels,0);assert.ok(result.messages>=3);assert.equal(result.listening,true);assert.ok(result.firstAudioMs<2500,JSON.stringify(result));
  await js(`new Promise((resolve,reject)=>{const end=Date.now()+15000;const poll=()=>{if([...document.querySelectorAll('.message.assistant')].some(n=>n.textContent==='Görev tamamlandı. Planın kaydedildi.'))return resolve();if(Date.now()>end)return reject(Error('Final task reply missing'));setTimeout(poll,30);};poll();})`);
  assert.equal(await js("document.getElementById('messages').children.length"),4);
  console.log(JSON.stringify(result));console.log('PASS actual microphone -> Seda -> ordinary chat -> automatic computer dispatch -> final reply -> Pocket TTS, microphone remains open; no mode/page');
  await js('(async()=>{await liveRecognizer.close();releaseMicrophone();await stop();await window.umay.speech("status");})()');clearTimeout(deadline);app.quit();
 }catch(error){console.error(error);clearTimeout(deadline);app.exit(1);}
});});

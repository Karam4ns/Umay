// Full capture + real resident model, with a public FLEURS recording and synthetic account.
const {app,ipcMain}=require('electron');const fs=require('node:fs');const path=require('node:path');const os=require('node:os');const assert=require('node:assert/strict');
const model=path.join(process.env.APPDATA,'umay/speech/packages/stt-live');
if(!fs.existsSync(path.join(model,'.ready')))throw Error('Install the live STT model before running this test.');
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'umay-live-stt-'));app.setPath('userData',directory);
function link(source,destination){fs.mkdirSync(destination,{recursive:true});for(const item of fs.readdirSync(source,{withFileTypes:true})){if(item.name==='.cache'||item.name==='final')continue;const from=path.join(source,item.name),to=path.join(destination,item.name);if(item.isDirectory())link(from,to);else fs.linkSync(from,to);}}
link(model,path.join(directory,'speech/packages/stt-live'));
app.commandLine.appendSwitch('use-fake-device-for-media-stream');app.commandLine.appendSwitch('use-file-for-fake-audio-capture',path.resolve('.superpowers/stt-speech.wav'));
const deadline=setTimeout(()=>{console.error('FAIL live STT timeout');app.exit(1);},45000);
require('../src/main.cjs');
app.on('browser-window-created',(_event,window)=>window.webContents.once('did-finish-load',async()=>{
 try{
  ipcMain.removeHandler('api');ipcMain.handle('api',(_e,route)=>route==='/site/auth/me'?{id:'fixture',firstName:'Test',email:'test@example.com'}:route==='/site/chat/models'?{models:[]}:{conversations:[]});
  const js=code=>window.webContents.executeJavaScript(code);await js('refresh()');
  await js("received=[];interrupted=false;send=async text=>received.push(text);document.getElementById('listen').onclick()");
  const started=Date.now();await js('sources=[{stop(){interrupted=true}}];void 0');
  await js(`new Promise((resolve,reject)=>{const end=Date.now()+18000;const poll=()=>{if(document.getElementById('input').value)return resolve();if(Date.now()>end)return reject(Error('No partial transcript'));setTimeout(poll,25);};poll();})`);
  const firstPartialMs=Date.now()-started;assert.equal(await js('received.length'),0);
  await js('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');fs.mkdirSync('.superpowers',{recursive:true});fs.writeFileSync('.superpowers/live-transcript.png',(await window.capturePage()).toPNG());
  await js(`new Promise((resolve,reject)=>{const end=Date.now()+18000;const poll=()=>{if(received.length)return resolve();if(Date.now()>end)return reject(Error('No final transcript'));setTimeout(poll,25);};poll();})`);
  const result=await js('({text:received[0],listening,interrupted,rate:inputContext.sampleRate})');assert.equal(result.listening,true);assert.equal(result.interrupted,true);assert.equal(result.rate,16000);assert.match(result.text,/festivaller/);assert.match(result.text,/sahiptir/);
  const finalMs=Date.now()-started;
  await js(`new Promise((resolve,reject)=>{const end=Date.now()+18000;const poll=()=>{if(received.length>=2)return resolve();if(Date.now()>end)return reject(Error('No next utterance without restarting microphone'));setTimeout(poll,25);};poll();})`);
  assert.equal(await js('listening'),true);assert.match(await js('received[1]'),/festivaller/);
  console.log(JSON.stringify({firstPartialMs,finalMs,continuousTurns:await js('received.length'),...result}));console.log('PASS real Electron microphone -> real Seda streaming model; partial before final, repeated turns and capture survives response interruption');
  clearTimeout(deadline);app.exit(0);
 }catch(error){console.error(error);clearTimeout(deadline);app.exit(1);}
}));

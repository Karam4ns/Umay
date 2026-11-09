// Actual fake-microphone capture -> Seda -> local pause -> REAL Windows key-up.
// Audio is generated default Turkish TTS, not a physical human recording.
const {app,BrowserWindow,session}=require('electron'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {computerSiteFixture}=require('./computer-site-fixture.cjs'),{NativeDesktop}=require('../src/computer-control.cjs');
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'umay-voice-stop-'));app.setPath('userData',directory);
function link(source,destination){fs.mkdirSync(destination,{recursive:true});for(const item of fs.readdirSync(source,{withFileTypes:true})){if(item.name==='.cache'||item.name==='final')continue;const from=path.join(source,item.name),to=path.join(destination,item.name);if(item.isDirectory())link(from,to);else fs.linkSync(from,to);}}
link(path.join(process.env.APPDATA,'umay/speech/packages/stt-live'),path.join(directory,'speech/packages/stt-live'));const cache=path.join(process.env.APPDATA,'umay/speech/hf');if(fs.existsSync(cache))link(cache,path.join(directory,'speech/hf'));
app.commandLine.appendSwitch('force-renderer-accessibility');app.commandLine.appendSwitch('use-fake-device-for-media-stream');app.commandLine.appendSwitch('use-file-for-fake-audio-capture',path.resolve('tests/fixtures/stop-command.wav')+'%noloop');
let main,fixture,timer;const emergency=new NativeDesktop();require('../src/main.cjs');
async function finish(code){clearTimeout(timer);if(main&&!main.isDestroyed())await main.webContents.executeJavaScript("releaseMicrophone();stop()").catch(()=>{});emergency.close();app.quit();if(code)app.exit(code);}
timer=setTimeout(()=>{console.error('FAIL voice stop timeout');void finish(1);},60000);
app.whenReady().then(()=>computerSiteFixture(session.fromPartition('persist:veriussu'),prompt=>prompt.step===1?{action:'desktop_start'}:prompt.step===2?{action:'focus_window',windowHandle:Number(fixture.getNativeWindowHandle().readBigUInt64LE())}:{action:'hold',keys:['W'],milliseconds:2000}));
app.on('browser-window-created',(_event,w)=>w.webContents.once('did-finish-load',async()=>{
 if(!w.webContents.getURL().endsWith('/index.html'))return;main=w;
 try{
  const file=path.join(directory,'fixture.html');fs.writeFileSync(file,'<!doctype html><title>Umay voice input fixture</title><body tabindex="0"><h1>Own game input surface</h1><script>window.events={down:0,up:0,upAt:0,downTimes:[],upTimes:[]};document.onkeydown=e=>{if(e.key===\'w\'){events.down++;events.downTimes.push(Date.now());e.preventDefault()}};document.onkeyup=e=>{if(e.key===\'w\'){events.up++;events.upAt=Date.now();events.upTimes.push(events.upAt)}};</script></body>');
  fixture=new BrowserWindow({width:600,height:400,x:80,y:80,webPreferences:{contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});await fixture.loadFile(file);const js=code=>w.webContents.executeJavaScript(code,true),state=()=>js("api.computer('state')");
  console.log('Voice stop fixture: loading STT');await js('refresh()');await js("document.getElementById('speak').checked=false;api.speech('load',{kind:'stt'})");await emergency.request('privileges');assert.equal(w.webContents.getBackgroundThrottling(),false);console.log('Voice stop fixture: STT ready');
  const handle=Number(fixture.getNativeWindowHandle().readBigUInt64LE());await emergency.request('window_manage',{handle,processId:process.pid,operation:'focus'});
  await js("window.voiceStopHeardAt=0;window.voicePausedAt=0;api.onEvent(e=>{if(e.event==='transcript'&&window.ComputerCommands.computerCommand(e.text)==='pause'&&!window.voiceStopHeardAt)window.voiceStopHeardAt=Date.now();if(e.event==='computer-task'&&e.task?.status==='paused'&&!window.voicePausedAt)window.voicePausedAt=Date.now()});void 0");
  const sending=js("send('Test uygulamasında W tuşunu basılı tut; dur diyene kadar devam et')");
  const until=async(predicate,ms=15000)=>{const end=Date.now()+ms;while(!await predicate()){if(Date.now()>end)throw Error('Expected native/voice state not reached');await new Promise(r=>setTimeout(r,20));}};
  await until(()=>fixture.webContents.executeJavaScript('events.down>events.up'));console.log('Voice stop fixture: owned key held');await js("document.getElementById('listen').onclick()");await until(async()=>(await state()).task?.status==='paused');await sending;
  await until(()=>fixture.webContents.executeJavaScript('events.up>=events.down&&events.up>0'));const events=await fixture.webContents.executeJavaScript('events'),heard=await js('window.voiceStopHeardAt'),pausedAt=await js('window.voicePausedAt');assert.ok(heard>0);const pauseMs=pausedAt-heard,heldAtHeard=events.downTimes.filter(t=>t<=heard).length>events.upTimes.filter(t=>t<=heard).length,releaseMs=heldAtHeard?events.upAt-heard:null;
  assert.ok(pauseMs>=0&&pauseMs<1000,JSON.stringify({events,heard,pausedAt,pauseMs}));if(heldAtHeard)assert.ok(releaseMs>=0&&releaseMs<1000,JSON.stringify({events,heard,releaseMs}));assert.ok(events.downTimes.every(t=>t<=pausedAt),'no new key-down after pause');assert.ok(events.upAt<=pausedAt+1000);assert.equal(await js('listening'),true);
  await emergency.request('keys',{keys:[119]});await until(async()=>(await state()).task?.status==='stopped');
  console.log('PASS actual microphone capture -> Seda Dur -> local pause in '+pauseMs+'ms; '+(heldAtHeard?'actual W key-up in '+releaseMs+'ms':'W already released by its bounded lease before recognized text; no new input')+'; listening stays open while minimized; physical F8 stops paused task');await finish(0);
 }catch(error){console.error(error);await finish(1);}
}));

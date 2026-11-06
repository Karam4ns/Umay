// Opt-in acceptance: real authenticated site/model + real Windows input.
// Input is restricted to a disposable fixture; no user files are modified.
const {app,BrowserWindow,ipcMain,screen,desktopCapturer}=require('electron');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {DeviceServices}=require('../src/device-services.cjs'),{NativeDesktop}=require('../src/computer-control.cjs');
const computerModelArgument=process.argv.find(arg=>arg.startsWith('--computer-model='));
if(!process.env.UMAY_LIVE_SESSION_FILE)throw Error('Set UMAY_LIVE_SESSION_FILE to an authorized short-lived verification session.');
const token=JSON.parse(fs.readFileSync(process.env.UMAY_LIVE_SESSION_FILE,'utf8')).token;
app.setPath('userData',fs.mkdtempSync(path.join(os.tmpdir(),'umay-live-control-')));
app.commandLine.appendSwitch('force-renderer-accessibility');
let service,fixture,main;const inputs=[];
const timeout=setTimeout(()=>{console.error('FAIL live control deadline');service?.close();app.exit(1);},180000);
require(process.env.UMAY_TEST_MAIN||'../src/main.cjs');
app.on('browser-window-created',(_e,w)=>w.webContents.once('did-finish-load',async()=>{
 if(!w.webContents.getURL().endsWith('/index.html'))return;main=w;
 try{
  fixture=new BrowserWindow({width:900,height:650,title:'UMAY canlı doğrulama',webPreferences:{contextIsolation:true,nodeIntegration:false}});
  const file=path.join(app.getPath('userData'),'fixture.html');fs.writeFileSync(file,'<!doctype html><meta charset="utf-8"><title>UMAY canlı doğrulama</title><h1>Umay test penceresi</h1><label>Deneme metni <textarea aria-label="Deneme metni" rows="6" cols="60"></textarea></label><button>Bir</button><button>İki</button><button>Üç</button>');await fixture.loadFile(file);
  const handle=Number(fixture.getNativeWindowHandle().readBigUInt64LE()),native=new NativeDesktop();
  const nativeApi={request:async(method,params)=>{
   if(method==='observe'){const fg=await native.request('foreground');assert.equal(fg.handle,handle,'owned fixture must remain foreground; no other UI is read');}
   if(method==='observe_window')assert.equal(params.handle,handle,'fixture-only observation');
   if(!['observe','observe_window','foreground','release','location','state'].includes(method)){
    if(method==='focus')assert.equal(params.handle,handle,'fixture-only focus');
    else{assert.equal(params.expectedHandle,handle,'fixture-only input');if(method==='keys')assert.ok(params.keys.every(k=>[0x11,0x41,0x09,0x0D,0x1B].includes(k)),'bounded test keys');}
    inputs.push(method);
   }const result=await native.request(method,params);if(['observe','observe_window','foreground'].includes(method)&&result?.windows)result.windows=result.windows.filter(w=>w.handle===handle);return result;
  },release:()=>native.cancel(),cancel:()=>native.cancel(),close:()=>native.close()};
  const api=async(route,body)=>{const response=await fetch('https://veriussu.com'+route,{method:body?'POST':'GET',headers:{cookie:'veriussu_web='+token,origin:'https://veriussu.com','content-type':'application/json',...require('../src/operator-channel.cjs').operatorHeaders(body)},...(body?{body:JSON.stringify(body)}:{})});const value=await response.json();if(!response.ok)throw Error(value.message||'HTTP_'+response.status);return value;};
  service=new DeviceServices({directory:app.getPath('userData'),api,screen,native:nativeApi,background:false,onComputerStart:async()=>{main.minimize();fixture.maximize();fixture.show();fixture.focus();await native.request('focus',{handle});},capture:async()=>{const foreground=await native.request('foreground');assert.equal(foreground.handle,handle,'fixture-only screen capture');const display=screen.getDisplayMatching(fixture.getBounds());return (await desktopCapturer.getSources({types:['screen'],thumbnailSize:{width:1600,height:1000}})).filter(source=>source.display_id===String(display.id)).map(source=>({displayId:source.display_id,...source.thumbnail.getSize(),image:'data:image/jpeg;base64,'+source.thumbnail.toJPEG(65).toString('base64')}));},publish:event=>main.webContents.send('event',event)});
  service.activate((await api('/site/auth/me')).id);
  service.system.files.perform=async()=>{throw Error('This fixture authorizes only its native window, no filesystem operations');};service.system.apps.perform=async()=>{throw Error('This fixture authorizes only its native window, no application/process operations');};
  const {models}=await api('/site/chat/models');const chat=models.find(m=>m.id===(process.env.UMAY_LIVE_CHAT_MODEL_ID||'6ee3bd21-4614-47b9-b3b2-97dd84842a7e')),computer=models.find(m=>m.id===(computerModelArgument?.slice('--computer-model='.length)||process.env.UMAY_LIVE_COMPUTER_MODEL_ID||'9076520e-1151-4fcc-9f5a-109f0c651bea'));assert.ok(chat&&computer,'selected real models available');
  const saved=await service.modelRoles('save',{chat,computer});assert.equal(saved.roles.computer.id,computer.id);console.log(JSON.stringify({chat:chat.name,operator:computer.name,operatorId:computer.id}));
  for(const name of ['api','model-roles','computer','speech'])ipcMain.removeHandler(name);
  ipcMain.handle('api',(_e,route,body)=>service.siteApi(route,body));ipcMain.handle('model-roles',(_e,method,input)=>service.modelRoles(method,input));ipcMain.handle('computer',(_e,method,input)=>service.computer(method,input));ipcMain.handle('speech',()=>true);
  const js=code=>main.webContents.executeJavaScript(code,true);await js('refresh()');await js("document.getElementById('speak').checked=false");
  const began=Date.now();await js('send('+JSON.stringify('Yalnızca “UMAY canlı doğrulama” penceresindeki “Deneme metni” alanına “Merhaba Umay 051” yaz. Başka bir pencereye veya kullanıcı dosyasına dokunma.')+')');
  const state=service.agent.state(),text=await fixture.webContents.executeJavaScript('document.querySelector("textarea").value');
  assert.equal(state?.status,'completed',JSON.stringify(state));assert.equal(text,'Merhaba Umay 051');assert.ok(inputs.includes('text'));
  console.log(JSON.stringify({elapsedMs:Date.now()-began,status:state.status,inputs,timings:service.agent.task.timings,message:state.message}));console.log('PASS real site chat -> actual assigned cloud model handoff -> real model planner -> real fixture input -> visible text verification');
  service.close();clearTimeout(timeout);app.quit();
 }catch(error){console.error(error);service?.close();clearTimeout(timeout);app.exit(1);}
}));

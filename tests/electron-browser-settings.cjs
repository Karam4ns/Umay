// Actual application UI/IPC with an isolated account and the real bundled MCP.
const {app,ipcMain,screen}=require('electron'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const {DeviceServices}=require('../src/device-services.cjs');
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'umay-browser-settings-'));app.setPath('userData',directory);let service;
const timeout=setTimeout(()=>{console.error('FAIL browser settings deadline');service?.browser.close({closeBrowser:true});service?.close();app.exit(1);},45000);
require('../src/main.cjs');
app.on('browser-window-created',(_e,window)=>{
 window.on('show',()=>window.hide());window.webContents.setAudioMuted(true);window.webContents.setBackgroundThrottling(false);
 window.webContents.once('did-finish-load',async()=>{try{
  service=new DeviceServices({directory:path.join(directory,'fixture'),api:async()=>({}),screen,capture:async()=>[],native:{request:async()=>({}),close(){}},background:false});service.activate('fixture');
  for(const name of ['api','speech','model-roles','browser','computer'])ipcMain.removeHandler(name);
  ipcMain.handle('api',(_e,route)=>route==='/site/auth/me'?{id:'fixture',firstName:'Test'}:route==='/site/chat/models'?{models:[]}:{conversations:[]});
  ipcMain.handle('computer',(_e,method,input)=>service.computer(method,input));
  ipcMain.handle('speech',(_e,method)=>method==='status'?{stt:{installed:false},tts:{installed:false}}:[]);
  ipcMain.handle('model-roles',()=>({roles:{chat:null,computer:null},models:[]}));ipcMain.handle('browser',(_e,method,input)=>service.browserAction(method,input));
  const js=code=>window.webContents.executeJavaScript(code,true);await js('refresh()');await js("window.umayShell.navigate('settings');document.getElementById('settings-models-tab').click()");
  await js("window.umayBrowser.load()");assert.match(await js("document.getElementById('admin-state').textContent"),/kapalı/);assert.equal(await js("document.getElementById('admin-revoke').disabled"),true);assert.equal(await js("document.getElementById('browser-mode').value"),'existing');
  await js("document.getElementById('browser-mode').value='existing';document.getElementById('browser-save').onclick()");assert.equal(service.memory.setting('browserMode'),'existing');
  await js("document.getElementById('browser-mode').value='managed';document.getElementById('browser-save').onclick()");
  await js("document.getElementById('browser-connect').onclick()");assert.equal(service.browser.state().connected,true);assert.match(await js("document.getElementById('browser-status').textContent"),/hazır/);
  await js("document.getElementById('browser-connect').scrollIntoView({block:'center'})");await window.webContents.capturePage().then(img=>fs.writeFileSync(path.join(directory,'settings.png'),img.toPNG()));
  console.log('PASS actual application settings: account-scoped profile preference, existing/managed selection, real Chrome MCP connection and visible status');
  service.browser.close({closeBrowser:true});service.close();clearTimeout(timeout);app.quit();
 }catch(error){console.error(error);service?.browser.close({closeBrowser:true});service?.close();clearTimeout(timeout);app.exit(1);}});
});

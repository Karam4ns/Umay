// Synthetic account/API, actual Electron renderer and warning UI.
const {app,ipcMain}=require('electron'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
app.setPath('userData',fs.mkdtempSync(path.join(os.tmpdir(),'umay-errors-')));
const timeout=setTimeout(()=>{console.error('FAIL warning UI timeout');app.exit(1);},30000);
require('../src/main.cjs');
app.on('browser-window-created',(_event,window)=>window.webContents.once('did-finish-load',async()=>{
 try{
  ipcMain.removeHandler('api');ipcMain.handle('api',(_e,route)=>{
   if(route==='/site/auth/me')return {id:'fixture',firstName:'Deniz',email:'deniz@example.test'};
   if(route==='/site/chat/models')return {models:[{id:'fixture-model',source:'PERSONAL',name:'Test modeli'}]};
   if(route==='/site/chat/conversations')return {conversations:[]};
   if(route.endsWith('/messages'))throw Error('INSUFFICIENT_TOKENS');
   throw Error('Unexpected fixture route');
  });
  const js=code=>window.webContents.executeJavaScript(code,true);
  await js('refresh();void 0');await js('new Promise(r=>setTimeout(r,80))');
  await js('conversation={id:"11111111-1111-4111-8111-111111111111",version:1};send("Merhaba")');
  const text=await js('document.querySelector(".message.error").textContent');assert.match(text,/Token limitiniz yetersiz/);assert.doesNotMatch(text,/INSUFFICIENT|Error invoking/);
  assert.equal(await js('document.querySelector(".message.error").getAttribute("role")'),'alert');
  fs.mkdirSync('.superpowers',{recursive:true});await js('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');fs.writeFileSync('.superpowers/errors-desktop-dark.png',(await window.capturePage()).toPNG());
  await js('document.getElementById("theme").click()');await js('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');fs.writeFileSync('.superpowers/errors-desktop-light.png',(await window.capturePage()).toPNG());
  console.log('PASS real desktop POST failure -> accessible Turkish warning, no raw error codes; dark/light');clearTimeout(timeout);app.quit();
 }catch(error){console.error(error);clearTimeout(timeout);app.exit(1);}
}));

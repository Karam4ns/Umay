const {app,ipcMain}=require('electron');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
app.setPath('userData',fs.mkdtempSync(path.join(os.tmpdir(),'umay-clone-ui-')));
require('../src/main.cjs');
const deadline=setTimeout(()=>app.exit(1),30000);
app.on('browser-window-created',(_event,window)=>{
 window.webContents.once('did-finish-load',async()=>{
  try{
   let created=false,preview,fail=false;
   for(const name of ['api','speech','clone'])ipcMain.removeHandler(name);
   ipcMain.handle('api',(_event,route)=>route==='/site/auth/me'?{id:'fixture',email:'test@example.test'}:route==='/site/chat/models'?{models:[]}:{conversations:[]});
   ipcMain.handle('speech',(_event,method,params)=>{
    if(method==='status')return {stt:{installed:false},tts:{installed:false}};
    if(method==='voices')return created?[{id:'fixture-profile',name:'Deneme sesi'}]:[];
    if(method==='speak')preview=params;
    return true;
   });
   ipcMain.handle('clone',()=>{
    if(fail)throw Error('Kayıt uygun değil. Daha temiz bir kayıt seçin.');
    created=true;return {id:'fixture-profile',name:'Deneme sesi',voice:'unique-fixture-voice',quality:{warnings:['Daha sessiz bir örnekle yeniden deneyebilirsin.']}};
   });
   const js=code=>window.webContents.executeJavaScript(code);
   await js('refresh()');
   await js("window.umayShell.navigate('settings')");
   assert.equal(await js("document.getElementById('settings').hidden"),false);
   await js("document.getElementById('clone').onclick()");
   assert.equal(await js('voice'),'unique-fixture-voice');
   assert.equal(await js("document.getElementById('voices').value"),'fixture-profile');
   assert.match(await js("document.getElementById('clone-quality').textContent"),/Daha sessiz/);
   await js("document.getElementById('preview').onclick()");
   assert.equal(preview.voice,'unique-fixture-voice');
   await js('packages()');assert.equal(await js("document.getElementById('voices').value"),'fixture-profile');
   assert.equal(await js('document.documentElement.scrollWidth<=innerWidth'),true);
   await js('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
   fs.mkdirSync('.superpowers',{recursive:true});fs.writeFileSync('.superpowers/clone-settings.png',(await window.capturePage()).toPNG());
   fail=true;await js("document.getElementById('clone').onclick()");
   assert.equal(await js('voice'),'unique-fixture-voice');
   assert.equal(await js("document.getElementById('clone').disabled"),false);
   console.log('PASS Electron cloned voice auto-select/preview/quality/persistence/failure; isolated account and speech fixtures');
   clearTimeout(deadline);app.quit();
  }catch(error){console.error(error);clearTimeout(deadline);app.exit(1);}
 });
});

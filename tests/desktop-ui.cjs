const {app,BrowserWindow,ipcMain}=require('electron');const assert=require('node:assert/strict');const fs=require('node:fs');
// Isolated data and synthetic API: this never signs into, or changes, a real account.
const os=require('node:os');const path=require('node:path');const directory=fs.mkdtempSync(path.join(os.tmpdir(),'umay-design-'));app.setPath('userData',directory);
let signedIn=false,entries=[];
const timeout=setTimeout(()=>{console.error('FAIL desktop design timeout');app.exit(1);},30000);
require('../src/main.cjs');
app.on('browser-window-created',(_event,window)=>{
 window.webContents.once('did-finish-load',async()=>{
  try{
   for(const name of ['api','speech','login','logout','model-roles'])ipcMain.removeHandler(name);
   ipcMain.handle('api',(_e,route)=>{
    if(route==='/site/auth/me'){if(!signedIn)throw Error('Oturum doğrulaması gerekli.');return {id:'fixture',firstName:'Deniz',lastName:'Yılmaz',email:'deniz@example.com'};}
    if(route==='/site/chat/models')return {models:[{id:'fixture-model',name:'Test modeli',source:'site'}]};
    if(route==='/site/chat/conversations')return {conversations:[],conversation:{id:'11111111-1111-4111-8111-111111111111',version:0}};
    if(route.endsWith('/messages'))return {run:{id:'22222222-2222-4222-8222-222222222222'}};
    if(route.includes('/runs/'))return {run:{status:'COMPLETED'}};
    if(route==='/site/user-memory')return {summary:'Görsel test hesabı.',notes:[]};
    return {conversation:{id:'11111111-1111-4111-8111-111111111111',version:1},messages:[{role:'assistant',content:'Merhaba Deniz, seni dinliyorum.'}]};
   });
   ipcMain.handle('model-roles',()=>({roles:{chat:null,computer:null},models:[]}));
   ipcMain.handle('speech',(_e,method)=>method==='status'?{stt:{installed:false,resident:false},tts:{installed:false,resident:false}}:method==='voices'?[]:true);
   ipcMain.handle('login',(_e,entry)=>{entries.push(entry);return {started:true};});
   ipcMain.handle('logout',()=>{signedIn=false;return {revoked:true};});
   const js=code=>window.webContents.executeJavaScript(code);
   const paint=()=>js('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
   const snapshot=async name=>{await paint();await new Promise(resolve=>setTimeout(resolve,180));fs.writeFileSync('.superpowers/'+name+'.png',(await window.capturePage()).toPNG());};
   await js('refresh().catch(()=>{})');
   assert.equal(await js("document.getElementById('auth-screen').hidden"),false);
   await paint();fs.mkdirSync('.superpowers',{recursive:true});await snapshot('desktop-login');
   await js("document.getElementById('auth-register-tab').click()");
   assert.match(await js("document.getElementById('auth-title').textContent"),/oluştur/);
   await snapshot('desktop-register');
   await js("document.getElementById('login').onclick()");assert.deepEqual(entries,['register']);
   signedIn=true;await js('refresh()');
   assert.equal(await js("document.getElementById('auth-screen').hidden"),true);
   assert.equal(await js("document.getElementById('workspace').hidden"),false);
   assert.equal(await js("document.documentElement.scrollWidth<=innerWidth"),true);
   await snapshot('desktop-home');
   await js("document.querySelector('[data-page=\"settings\"]').click()");
   await js(`new Promise((resolve,reject)=>{let n=0;const poll=()=>{if(document.getElementById('packages').children.length===2)return resolve();if(n++>100)return reject(Error('Packages missing'));setTimeout(poll,10);};poll();})`);
   await paint();await snapshot('desktop-settings');
   await js("window.umayShell.navigate('chat');document.getElementById('input').value='Merhaba';document.getElementById('send').dispatchEvent(new Event('submit',{cancelable:true}))");
   await js(`new Promise((resolve,reject)=>{let n=0;const poll=()=>{if(document.getElementById('messages').children.length===2)return resolve();if(n++>100)return reject(Error('Chat did not finish'));setTimeout(poll,10);};poll();})`);
   await snapshot('desktop-chat');
   await js("window.umayShell.navigate('home');document.getElementById('theme').click()");
   await snapshot('desktop-light');
   window.setContentSize(1024,700);await js("document.getElementById('theme').click()");
   assert.equal(await js('document.documentElement.scrollWidth<=innerWidth'),true);
   await js("document.getElementById('history-toggle').click()");
   assert.notEqual(await js("getComputedStyle(document.querySelector('.inspector')).display"),'none');
   await js("document.getElementById('history-close').click()");
   await snapshot('desktop-compact');
   await js("document.getElementById('logout').onclick()");assert.equal(await js("document.getElementById('workspace').hidden"),true);
   console.log('PASS real Electron login/register entry, account gate, dashboard, settings, chat, themes, compact layout and logout');
   clearTimeout(timeout);app.exit(0);
  }catch(error){console.error(error);clearTimeout(timeout);app.exit(1);}
 });
});

const {app,BrowserWindow}=require('electron');const assert=require('node:assert/strict');const fs=require('node:fs');
require('../src/main.cjs');
const timeout=setTimeout(()=>{console.error('FAIL Electron startup timeout');app.exit(1);},30000);
app.on('browser-window-created',(_event,window)=>{
 window.webContents.once('did-finish-load',async()=>{
  try{
   const result=await window.webContents.executeJavaScript(`({title:document.title,bridge:typeof window.umay.speech,sections:document.querySelectorAll('section').length,csp:document.querySelector('meta[http-equiv="Content-Security-Policy"]').content})`);
   assert.equal(result.title,'Umay');assert.equal(result.bridge,'function');assert.equal(result.sections,3);assert.ok(result.csp.includes("connect-src 'none'"));
   await window.webContents.executeJavaScript(`document.querySelector('[data-page="settings"]').click()`);
   assert.equal(await window.webContents.executeJavaScript(`document.querySelector('#settings').hidden`),false);
   await window.webContents.executeJavaScript(`new Promise((resolve,reject)=>{const until=Date.now()+15000;const tick=()=>{if(document.querySelector('#packages').children.length===2)return resolve();if(Date.now()>until)return reject(Error('Package controls did not load'));setTimeout(tick,50);};tick();})`);
   fs.mkdirSync('.superpowers',{recursive:true});fs.writeFileSync('.superpowers/app.png',(await window.capturePage()).toPNG());
   console.log('PASS Electron window, sandbox bridge, CSP and navigation');clearTimeout(timeout);app.exit(0);
  }catch(e){console.error(e);clearTimeout(timeout);app.exit(1);}
 });
});

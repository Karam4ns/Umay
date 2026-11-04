// Local synthetic-account fixture; never signs in to the real service.
const {app,BrowserWindow}=require('electron');const http=require('node:http');const fs=require('node:fs');const assert=require('node:assert/strict');
const {renderDesktopAuthPage,desktopAuthStyles}=require('../server/desktop-auth-view.ts');
const {desktopAuthScript}=require('../server/desktop-auth-client.ts');
let signedIn=true;const server=http.createServer((req,res)=>{
 res.setHeader('Cache-Control','no-store');
 if(req.url==='/site/auth/me'){res.writeHead(signedIn?200:401,{'Content-Type':'application/json'});return res.end(JSON.stringify(signedIn?{firstName:'Deniz',lastName:'Yılmaz',email:'deniz@example.com'}:{message:'LOGIN_REQUIRED'}));}
 if(req.url==='/site/desktop-auth/style.css'){res.setHeader('Content-Type','text/css');return res.end(desktopAuthStyles);}
 if(req.url==='/site/desktop-auth/client.js'){res.setHeader('Content-Type','text/javascript');return res.end(desktopAuthScript);}
 res.setHeader('Content-Type','text/html');res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");
 res.end(renderDesktopAuthPage('authorize','<input type="hidden" name="state" value="fixture">'));
});
const timeout=setTimeout(()=>{console.error('Visual check timeout');app.exit(1);},20000);
app.whenReady().then(async()=>{
 try{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));fs.mkdirSync('.superpowers',{recursive:true});
  const window=new BrowserWindow({width:1200,height:960,show:false,webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true}});
  await window.loadURL('http://127.0.0.1:'+server.address().port);
  await window.webContents.executeJavaScript(`new Promise((resolve,reject)=>{let count=0;const poll=()=>{if(document.getElementById('account-email').textContent==='deniz@example.com')return resolve();if(count++>100)return reject(Error('Account did not render'));setTimeout(poll,10);};poll();})`);
  assert.equal(await window.webContents.executeJavaScript(`document.getElementById('approve').disabled`),false);
  await window.webContents.executeJavaScript(`document.documentElement.dataset.theme='light';new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`);
  fs.writeFileSync('.superpowers/auth-desktop-light.png',(await window.capturePage()).toPNG());
  await window.webContents.executeJavaScript(`document.getElementById('theme').click()`);
  fs.writeFileSync('.superpowers/auth-desktop-dark.png',(await window.capturePage()).toPNG());
  window.setContentSize(390,844);await window.webContents.executeJavaScript(`document.getElementById('theme').click()`);
  await new Promise(resolve=>setTimeout(resolve,100));
  assert.equal(await window.webContents.executeJavaScript(`document.documentElement.scrollWidth<=innerWidth`),true);
  fs.writeFileSync('.superpowers/auth-mobile-light.png',(await window.capturePage()).toPNG());
  signedIn=false;await window.webContents.executeJavaScript(`document.getElementById('refresh-account').click()`);
  await window.webContents.executeJavaScript(`new Promise(resolve=>{const poll=()=>{if(!document.getElementById('sign-in').hidden)return resolve();setTimeout(poll,10);};poll();})`);
  assert.equal(await window.webContents.executeJavaScript(`document.getElementById('approve').hidden`),true);
  fs.writeFileSync('.superpowers/auth-mobile-signed-out.png',(await window.capturePage()).toPNG());
  console.log('PASS light/dark desktop, 390px mobile, account states and no horizontal overflow');
  clearTimeout(timeout);server.close();app.exit(0);
 }catch(error){console.error(error);clearTimeout(timeout);server.close();app.exit(1);}
});

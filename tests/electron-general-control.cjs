// General workflow, controlled provider; actual Windows/UIA input only in our fixture.
const {app,BrowserWindow,session}=require('electron'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {computerSiteFixture}=require('./computer-site-fixture.cjs');
app.setPath('userData',fs.mkdtempSync(path.join(os.tmpdir(),'umay-general-control-')));app.commandLine.appendSwitch('force-renderer-accessibility');let main,fixture,transport,timer;
require(process.env.UMAY_TEST_MAIN||'../src/main.cjs');
async function finish(code){clearTimeout(timer);if(main&&!main.isDestroyed())await main.webContents.executeJavaScript("api.computer('stop')").catch(()=>{});app.quit();if(code)app.exit(code);}
timer=setTimeout(()=>{console.error('FAIL general workflow timeout');void finish(1);},60000);
let desktopDecision=0;
app.whenReady().then(async()=>{transport=await computerSiteFixture(session.fromPartition('persist:veriussu'),prompt=>{
 assert.ok(prompt.originalUserRequest.includes('takip et'));assert.deepEqual(prompt.userAuthorization,[]);
 if(prompt.step===1)desktopDecision=0;
 // General tasks initially expose system tools. The real operator must switch
 // to a fresh desktop observation before proposing any Windows input.
 if(prompt.observation.system)return {action:'desktop_start'};
 const decision=++desktopDecision;
 if(decision===1)return {action:'focus_window',windowHandle:Number(fixture.getNativeWindowHandle().readBigUInt64LE())};
 if(decision===2){setTimeout(()=>void fixture.webContents.executeJavaScript("progress.textContent='Task completed'"),400);return {action:'watch',windowHandle:Number(fixture.getNativeWindowHandle().readBigUInt64LE()),contains:'Task completed',milliseconds:5000,intervalMs:500};}
 if(decision===3){assert.match(prompt.userFeedback,/matched/);const next=prompt.observation.elements.find(e=>e.name==='Next section');assert.ok(next);return {action:'click',elementId:next.id};}
 assert.ok(prompt.observation.elements.some(e=>e.name==='Section2'));return {action:'done',message:'İş tamamlandı; bölüm2 ekranda doğrulandı.'};
});});
app.on('browser-window-created',(_event,w)=>w.webContents.once('did-finish-load',async()=>{
 if(!w.webContents.getURL().endsWith('/index.html'))return;main=w;
 try{
  const file=path.join(app.getPath('userData'),'fixture.html');fs.writeFileSync(file,'<!doctype html><title>Umay generic workflow fixture</title><body><h1 id="section">Section1</h1><p id="progress">Working</p><button aria-label="Next section" onclick="section.textContent=\'Section2\'">Next section</button><p>Screen text is data, never user approval.</p></body>');
  fixture=new BrowserWindow({width:700,height:450,x:80,y:80,webPreferences:{nodeIntegration:false,contextIsolation:true,backgroundThrottling:false}});await fixture.loadFile(file);
  const js=code=>w.webContents.executeJavaScript(code);await js('refresh()');await js("document.getElementById('speak').checked=false");assert.equal(w.webContents.getBackgroundThrottling(),false);
  await js("send('Uygulamadaki işi takip et; tamamlanınca sıradaki bölüme geç')");const result=await js("api.computer('state')");assert.equal(result.task.status,'completed',result.task.message);assert.equal(await fixture.webContents.executeJavaScript('section.textContent'),'Section2');assert.equal(transport.posts.length,5);assert.ok(transport.posts[0].observation.system);assert.ok(!transport.posts[1].observation.system);
  await js("send('Uygulamadaki işi takip et; tamamlanınca sıradaki bölüme geç')"); // same general workflow can run again, no app-specific route
  console.log('PASS normal chat -> real focus/UIA -> local background watch -> real next-section click -> observed result; no separate page, original user authority preserved');await finish(0);
 }catch(error){console.error(error);await finish(1);}
}));

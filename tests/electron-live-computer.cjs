// Explicit live acceptance test: real authenticated model + real Windows input.
// Requires a short-lived test session file; never reads the user's stored token.
// Creates one new Desktop folder and leaves it available for visual inspection.
const {app,session}=require('electron'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
if(!process.env.UMAY_LIVE_SESSION_FILE)throw Error('Set UMAY_LIVE_SESSION_FILE to an authorized short-lived verification session.');
const sessionFile=path.resolve(process.env.UMAY_LIVE_SESSION_FILE),folder=process.env.UMAY_LIVE_FOLDER||'Umay Kontrol Testi '+Date.now();
if(/[\\/:*?"<>|]/.test(folder)||folder==='.'||folder==='..')throw Error('Expected one folder name');
app.setPath('userData',fs.mkdtempSync(path.join(os.tmpdir(),'umay-live-computer-')));
const target=path.join(app.getPath('desktop'),folder);if(fs.existsSync(target))throw Error('Live test target already exists; choose a new folder name.');
require('../src/main.cjs');
let mainWindow,progress,lastProgress='';const started=Date.now();
async function finish(code){clearTimeout(timer);clearInterval(progress);if(mainWindow&&!mainWindow.isDestroyed())await mainWindow.webContents.executeJavaScript("api.computer('stop')").catch(()=>{});app.quit();if(code)app.exit(code);}
const timer=setTimeout(()=>{console.error('FAIL live computer deadline');void finish(1);},600000);
app.on('browser-window-created',(_event,window)=>{
 if(window.getTitle()==='Umay bilgisayar kontrolü')return;
 window.webContents.once('did-finish-load',async()=>{
  if(!window.webContents.getURL().endsWith('/index.html'))return;
  mainWindow=window;
  try{
   const {token}=JSON.parse(fs.readFileSync(sessionFile,'utf8'));
   await session.fromPartition('persist:veriussu').cookies.set({url:'https://veriussu.com',name:'veriussu_web',value:token,secure:true,httpOnly:true,path:'/'});
   const js=code=>window.webContents.executeJavaScript(code);
   await js('refresh()');await js("document.getElementById('speak').checked=false");
   progress=setInterval(async()=>{try{const s=await js("api.computer('state')");const line=JSON.stringify({status:s.task?.status,step:s.task?.step,message:s.task?.message});if(line!==lastProgress){lastProgress=line;console.log('LIVE_PROGRESS',line);}}catch{}},5000);
   const command='Selam masaüstüne '+folder+' adında yeni klasör oluştur. Yalnızca bu yeni klasörü oluştur; başka dosyaları değiştirme.';
   console.log('LIVE_COMMAND',command);await js('send('+JSON.stringify(command)+')');
   const state=await js("api.computer('state')");
   const evidence={target,exists:fs.existsSync(target),task:state.task,chat:await js("[...document.querySelectorAll('.message')].map(e=>e.textContent)")};
   fs.mkdirSync('.superpowers',{recursive:true});fs.writeFileSync('.superpowers/live-computer-result.json',JSON.stringify(evidence,null,2));
   console.log('LIVE_RESULT',JSON.stringify({exists:evidence.exists,status:state.task?.status,message:state.task?.message,steps:state.task?.step,elapsedMs:Date.now()-started,chat:evidence.chat}));
   assert.equal(state.task?.status,'completed');assert.ok(fs.statSync(target).isDirectory(),'Actual Desktop folder must exist');
   console.log('PASS ordinary Electron chat -> real account model -> handoff -> actual Windows input -> verified Desktop folder:',target);await finish(0);
  }catch(error){console.error('FAIL',error.message);await finish(1);}
 });
});

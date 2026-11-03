const {app,BrowserWindow,ipcMain,session,dialog,shell}=require('electron');
const path=require('node:path');const fs=require('node:fs');const {spawn}=require('node:child_process');
const {randomUUID}=require('node:crypto');const readline=require('node:readline');
const {autoUpdater}=require('electron-updater');const {validateReference}=require('./core.cjs');
let win,worker,site,loginWindow;let pending=new Map();let running=false;let updateReady=false;let speechEpoch=0;
const ORIGIN='https://veriussu.com';
function publish(value){if(win&&!win.isDestroyed())win.webContents.send('event',value);}
function startWorker(){
 if(worker)return;
 const python=app.isPackaged?path.join(process.resourcesPath,'runtime','python.exe'):path.join(__dirname,'..','.venv','Scripts','python.exe');
 const script=app.isPackaged?path.join(process.resourcesPath,'speech','worker.py'):path.join(__dirname,'..','speech','worker.py');
 if(!fs.existsSync(python))throw Error('Ses çalışma zamanı bulunamadı. Önce hazırlık betiğini çalıştırın.');
 worker=spawn(python,['-u',script],{windowsHide:true,env:{...process.env,UMAY_DATA:path.join(app.getPath('userData'),'speech'),PYTHONIOENCODING:'utf-8'}});
 readline.createInterface({input:worker.stdout}).on('line',line=>{
  let data;try{data=JSON.parse(line);}catch{return;}
  if(data.event){if(data.event==='audio'&&pending.get(data.id)?.epoch!==speechEpoch)return;publish(data);return;}
  const entry=pending.get(data.id);if(!entry)return;pending.delete(data.id);
  clearTimeout(entry.timer);data.error?entry.reject(Error(data.error)):entry.resolve(data.result);
 });
 // Do not forward third-party logs: they can contain local filenames or credentials.
 worker.stderr.on('data',()=>{});
 worker.on('error',()=>publish({event:'error',message:'Ses işçisi başlatılamadı.'}));
 worker.on('exit',()=>{worker=null;for(const item of pending.values()){clearTimeout(item.timer);item.reject(Error('Ses işçisi kapandı.'));}pending.clear();publish({event:'worker-exit'});});
}
function speech(method,params={}){
 if(method==='cancel')speechEpoch++;
 startWorker();const id=randomUUID();return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{pending.delete(id);reject(Error('Ses işlemi zaman aşımına uğradı.'));},method==='install'?1800000:180000);
  pending.set(id,{resolve,reject,timer,epoch:speechEpoch});worker.stdin.write(JSON.stringify({id,method,params})+'\n');
 });
}
async function api(route,body){
 const allowed=/^\/site\/(auth\/(me|logout)|chat\/(models|conversations(?:\/[a-f0-9-]+(?:\/(messages|model))?)?|runs\/[a-f0-9-]+(?:\/cancel)?)|user-memory(?:\/(summary|notes))?)$/;
 if(!allowed.test(route))throw Error('İzin verilmeyen API yolu.');
 const response=await site.fetch(ORIGIN+route,{method:body===undefined?'GET':'POST',headers:{'Origin':ORIGIN,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(30000),redirect:'error'});
 if(!response.ok)throw Error(response.status===401?'Oturum doğrulaması gerekli. Veriüssü girişini açın.':`Sunucu isteği başarısız (${response.status}).`);
 return response.json();
}
function trusted(event){if(event.sender!==win?.webContents)throw Error('Güvenilmeyen pencere.');}
app.whenReady().then(()=>{
 site=session.fromPartition('persist:veriussu');
 session.defaultSession.setPermissionRequestHandler((contents,permission,callback)=>callback(contents===win?.webContents&&permission==='media'));
 win=new BrowserWindow({width:1150,height:820,minWidth:800,minHeight:620,show:false,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
 win.removeMenu();win.loadFile(path.join(__dirname,'ui','index.html'));win.once('ready-to-show',()=>win.show());
 win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',e=>e.preventDefault());
 const handle=(name,fn)=>ipcMain.handle(name,async(e,...args)=>{trusted(e);return fn(...args);});
 handle('speech',async(method,params)=>{
  if(!['hardware','status','install','remove','load','transcribe','speak','cancel','voices','select_voice','delete_voice'].includes(method))throw Error('İşlem izinli değil.');
  if(['install','load','remove'].includes(method)&&!['stt','tts'].includes(params?.kind))throw Error('Paket geçersiz.');
  if(method==='transcribe'&&(typeof params?.audio!=='string'||params.audio.length>5200000))throw Error('Ses çok büyük.');
  return speech(method,params);
 });
 handle('clone',async()=>{
  const selected=await dialog.showOpenDialog(win,{filters:[{name:'MP3',extensions:['mp3']}],properties:['openFile']});
  if(selected.canceled)return null;const file=selected.filePaths[0];const fd=fs.openSync(file,'r');const head=Buffer.alloc(3);
  try{fs.readSync(fd,head,0,3,0);}finally{fs.closeSync(fd);}
  validateReference(file,fs.statSync(file).size,head);return speech('clone',{path:file,name:path.basename(file,'.mp3')});
 });
 handle('api',api);
 handle('login',()=>{
  if(loginWindow&&!loginWindow.isDestroyed()){loginWindow.focus();return;}
  loginWindow=new BrowserWindow({width:1000,height:780,parent:win,webPreferences:{session:site,nodeIntegration:false,contextIsolation:true,sandbox:true}});
  const valid=url=>{try{return new URL(url).origin===ORIGIN;}catch{return false;}};
  loginWindow.webContents.on('will-navigate',(e,url)=>{if(!valid(url))e.preventDefault();});
  loginWindow.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  loginWindow.loadURL(ORIGIN);loginWindow.on('closed',()=>{site.cookies.flushStore();publish({event:'session-changed'});});
 });
 handle('logout',async()=>{
  let revoked=true;try{await api('/site/auth/logout',{});}catch{revoked=false;}
  await site.clearStorageData();if(loginWindow&&!loginWindow.isDestroyed())loginWindow.close();return {revoked};
 });
 handle('update',async()=>{if(!app.isPackaged)return {development:true};return autoUpdater.checkForUpdates();});
 handle('busy',busy=>{running=!!busy;if(!running&&updateReady)publish({event:'update-ready'});});
 handle('restart-update',()=>{if(running)throw Error('Önce etkin konuşmayı bitirin.');if(updateReady)autoUpdater.quitAndInstall(false,true);});
 autoUpdater.autoDownload=true;autoUpdater.autoInstallOnAppQuit=true;
 autoUpdater.on('error',()=>publish({event:'update-error',message:'Güncelleme sunucusu henüz hazır değil veya paket doğrulanamadı.'}));
 autoUpdater.on('update-downloaded',()=>{updateReady=true;if(!running)publish({event:'update-ready'});});
 if(app.isPackaged){autoUpdater.checkForUpdatesAndNotify();setInterval(()=>autoUpdater.checkForUpdatesAndNotify(),21600000).unref();}
});
app.on('before-quit',()=>{if(worker)worker.kill();});app.on('window-all-closed',()=>app.quit());

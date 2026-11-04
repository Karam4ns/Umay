const {app,BrowserWindow,ipcMain,session,dialog,shell,screen}=require('electron');
const {systemStatus,windowAction}=require('./desktop.cjs');
const path=require('node:path');const fs=require('node:fs');const {spawn}=require('node:child_process');
const {randomUUID}=require('node:crypto');const readline=require('node:readline');
const {autoUpdater}=require('electron-updater');const {validateReference}=require('./core.cjs');
const {BrowserAuth}=require('./browser-auth.cjs');
const {readSiteResponse}=require('./site-response.cjs');
let win,worker,site,browserAuth;let pending=new Map();let running=false;let updateReady=false;let speechEpoch=0;let authEpoch=0;let authMutation=Promise.resolve();let activeRecognition=null;
function authTask(task){const result=authMutation.then(task,task);authMutation=result.catch(()=>{});return result;}
const ORIGIN='https://veriussu.com';
async function revokeSessionToken(token){
 if(!/^[a-f0-9]{64}$/.test(token))return;
 const response=await fetch(ORIGIN+'/site/auth/logout',{method:'POST',headers:{'Origin':ORIGIN,'Content-Type':'application/json','Cookie':'veriussu_web='+token},body:'{}',signal:AbortSignal.timeout(15000),redirect:'error'});
 if(!response.ok&&response.status!==401)throw Error('Önceki oturum iptali doğrulanamadı.');
}
function publish(value){if(win&&!win.isDestroyed())win.webContents.send('event',value);}
function startWorker(){
 if(worker)return;
 const python=app.isPackaged?path.join(process.resourcesPath,'runtime','python.exe'):path.join(__dirname,'..','.venv','Scripts','python.exe');
 const script=app.isPackaged?path.join(process.resourcesPath,'speech','worker.py'):path.join(__dirname,'..','speech','worker.py');
 if(!fs.existsSync(python))throw Error('Ses çalışma zamanı bulunamadı. Önce hazırlık betiğini çalıştırın.');
 worker=spawn(python,['-u',script],{windowsHide:true,env:{...process.env,UMAY_DATA:path.join(app.getPath('userData'),'speech'),PYTHONIOENCODING:'utf-8'}});
 readline.createInterface({input:worker.stdout}).on('line',line=>{
  let data;try{data=JSON.parse(line);}catch{return;}
  if(data.event){if(data.event==='audio'&&pending.get(data.id)?.epoch!==speechEpoch)return;if(data.event==='transcript'&&(data.streamId!==activeRecognition?.streamId||data.generation!==activeRecognition?.generation))return;publish(data);return;}
  const entry=pending.get(data.id);if(!entry)return;pending.delete(data.id);
  clearTimeout(entry.timer);data.error?entry.reject(Error(data.error)):entry.resolve(data.result);
 });
 // Do not forward third-party logs: they can contain local filenames or credentials.
 worker.stderr.on('data',()=>{});
 worker.on('error',()=>publish({event:'error',message:'Ses işçisi başlatılamadı.'}));
 worker.on('exit',()=>{worker=null;activeRecognition=null;for(const item of pending.values()){clearTimeout(item.timer);item.reject(Error('Ses işçisi kapandı.'));}pending.clear();publish({event:'worker-exit'});});
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
 let response;try{response=await site.fetch(ORIGIN+route,{method:body===undefined?'GET':'POST',headers:{'Origin':ORIGIN,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(30000),redirect:'error'});}catch(error){throw Error(['TimeoutError','AbortError'].includes(error.name)?'REQUEST_TIMEOUT':'NETWORK_ERROR');}
 return readSiteResponse(response);
}
function trusted(event){if(event.sender!==win?.webContents)throw Error('Güvenilmeyen pencere.');}
app.whenReady().then(()=>{
 site=session.fromPartition('persist:veriussu');
 browserAuth=new BrowserAuth({openExternal:url=>shell.openExternal(url),discard:result=>revokeSessionToken(result.sessionToken),exchange:async(input,signal)=>{
  const response=await fetch(ORIGIN+'/site/desktop-auth/exchange',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input),signal:AbortSignal.any([signal,AbortSignal.timeout(30000)]),redirect:'error'});
  if(!response.ok)throw Error('Tarayıcı girişi sunucuda doğrulanamadı.');
  const result=await response.json();
  if(!/^[a-f0-9]{64}$/.test(result.sessionToken)||!Number.isFinite(result.expiresAt)||result.expiresAt<=Date.now())throw Error('Geçersiz oturum yanıtı.');
  return result;
 }});
 session.defaultSession.setPermissionRequestHandler((contents,permission,callback)=>callback(contents===win?.webContents&&permission==='media'));
 const area=screen.getPrimaryDisplay().workAreaSize;
 const iconPath=path.join(__dirname,'ui','assets','umay.png');
 win=new BrowserWindow({icon:fs.existsSync(iconPath)?iconPath:undefined,width:Math.min(1500,area.width-20),height:Math.min(920,area.height-20),minWidth:Math.min(960,area.width-20),minHeight:Math.min(680,area.height-20),frame:false,backgroundColor:'#030d14',show:false,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
 win.removeMenu();win.loadFile(path.join(__dirname,'ui','index.html'));win.once('ready-to-show',()=>win.show());
 win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',e=>e.preventDefault());
 const handle=(name,fn)=>ipcMain.handle(name,async(e,...args)=>{trusted(e);return fn(...args);});
 handle('system-status',()=>systemStatus(app.getPath('userData'),require('../package.json').version));
 handle('window-action',action=>windowAction(win,action));
 handle('cancel-login',()=>{++authEpoch;browserAuth.cancel();return true;});
 handle('speech',async(method,params)=>{
  if(!['hardware','status','install','remove','load','transcribe','speak','cancel','voices','select_voice','delete_voice','stt_start','stt_feed','stt_reset','stt_stop'].includes(method))throw Error('İşlem izinli değil.');
  if(method.startsWith('stt_')){
   if(typeof params?.streamId!=='string'||!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(params.streamId))throw Error('Konuşma oturumu geçersiz.');
   if(method!=='stt_stop'&&(!Number.isInteger(params.generation)||params.generation<0||params.generation>1000000))throw Error('Konuşma nesli geçersiz.');
   if(method==='stt_start')activeRecognition={streamId:params.streamId,generation:params.generation};
   else if(params.streamId!==activeRecognition?.streamId)return {skipped:true};
   if(method==='stt_reset'){if(params.generation<=activeRecognition.generation)return {skipped:true};activeRecognition.generation=params.generation;}
   if(method==='stt_feed'){
    if(params.generation!==activeRecognition.generation)return {skipped:true};
    if(typeof params.audio!=='string'||params.audio.length>24000)throw Error('Canlı ses paketi geçersiz.');
   }
   if(method==='stt_stop')activeRecognition=null;
  }
  if(['install','load','remove'].includes(method)&&!['stt','tts'].includes(params?.kind))throw Error('Paket geçersiz.');
  if(method==='remove'&&params.kind==='stt')activeRecognition=null;
  if(method==='transcribe'&&(typeof params?.audio!=='string'||params.audio.length>5200000))throw Error('Ses çok büyük.');
  try{return await speech(method,params);}catch(error){if(method==='stt_start'&&activeRecognition?.streamId===params.streamId)activeRecognition=null;throw error;}
 });
 handle('clone',async()=>{
  const selected=await dialog.showOpenDialog(win,{filters:[{name:'MP3',extensions:['mp3']}],properties:['openFile']});
  if(selected.canceled)return null;const file=selected.filePaths[0];const fd=fs.openSync(file,'r');const head=Buffer.alloc(3);
  try{fs.readSync(fd,head,0,3,0);}finally{fs.closeSync(fd);}
  validateReference(file,fs.statSync(file).size,head);return speech('clone',{path:file,name:path.basename(file,'.mp3')});
 });
 handle('api',api);
 handle('login',async(entry='login')=>{
  if(!['login','register'].includes(entry))throw Error('Giriş seçimi geçersiz.');
  const epoch=++authEpoch;const {completion}=await browserAuth.start({entry});
  completion.then(result=>authTask(async()=>{
   try{
   if(epoch!==authEpoch){await revokeSessionToken(result.sessionToken);return;}
   const old=await site.cookies.get({url:ORIGIN,name:'veriussu_web'});
   for(const cookie of old)if(cookie.value!==result.sessionToken)await revokeSessionToken(cookie.value);
   if(epoch!==authEpoch){await revokeSessionToken(result.sessionToken);return;}
   await site.clearStorageData();
   await site.cookies.set({url:ORIGIN,name:'veriussu_web',value:result.sessionToken,path:'/',secure:true,httpOnly:true,sameSite:'strict',expirationDate:result.expiresAt/1000});
   await site.cookies.flushStore();publish({event:'session-changed'});win.show();win.focus();
   }catch(error){await revokeSessionToken(result.sessionToken).catch(()=>{});throw error;}
  })).catch(()=>{if(epoch===authEpoch)publish({event:'error',message:'Tarayıcı girişi tamamlanmadı. Yeniden deneyebilirsiniz.'});});
  return {started:true};
 });
 handle('logout',async()=>{
  ++authEpoch;browserAuth.cancel();
  const result=await authTask(async()=>{let revoked=true;try{await api('/site/auth/logout',{});}catch{revoked=false;}await site.clearStorageData();await site.cookies.flushStore();return {revoked};});
  await shell.openExternal(ORIGIN+'/site/desktop-auth/logout').catch(()=>publish({event:'error',message:'Umay’dan çıkış yapıldı; tarayıcı çıkış sayfası açılamadı.'}));return result;
 });
 handle('update',async()=>{if(!app.isPackaged)return {development:true};return autoUpdater.checkForUpdates();});
 handle('busy',busy=>{running=!!busy;if(!running&&updateReady)publish({event:'update-ready'});});
 handle('restart-update',()=>{if(running)throw Error('Önce etkin konuşmayı bitirin.');if(updateReady)autoUpdater.quitAndInstall(false,true);});
 autoUpdater.autoDownload=true;autoUpdater.autoInstallOnAppQuit=true;
 autoUpdater.on('error',()=>publish({event:'update-error',message:'Güncelleme sunucusu henüz hazır değil veya paket doğrulanamadı.'}));
 autoUpdater.on('update-downloaded',()=>{updateReady=true;if(!running)publish({event:'update-ready'});});
 if(app.isPackaged){autoUpdater.checkForUpdatesAndNotify();setInterval(()=>autoUpdater.checkForUpdatesAndNotify(),21600000).unref();}
});
app.on('before-quit',()=>{browserAuth?.cancel();if(worker)worker.kill();});app.on('window-all-closed',()=>app.quit());

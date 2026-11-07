const {app,BrowserWindow,ipcMain,session,dialog,shell,screen,desktopCapturer,safeStorage,Notification,globalShortcut}=require('electron');
const {DeviceServices}=require('./device-services.cjs');
const {DesktopAccess}=require('./desktop-access.cjs');
const {ComputerShortcut}=require('./computer-shortcut.cjs');
const {systemStatus,windowAction}=require('./desktop.cjs');
const path=require('node:path');const fs=require('node:fs');const {spawn}=require('node:child_process');
const {randomUUID}=require('node:crypto');const readline=require('node:readline');
const {autoUpdater}=require('electron-updater');const {validateReference}=require('./core.cjs');
const {BrowserAuth}=require('./browser-auth.cjs');
const {readSiteResponse}=require('./site-response.cjs');
let win,worker,site,browserAuth,deviceServices,computerBar,computerShortcut;let computerRunning=false;let pending=new Map();let running=false;let updateReady=false;let speechEpoch=0;let authEpoch=0;let authMutation=Promise.resolve();let activeRecognition=null;
if(!app.requestSingleInstanceLock())app.exit(0);app.on('second-instance',()=>{if(win&&!win.isDestroyed()){win.show();win.focus();}});
function authTask(task){const result=authMutation.then(task,task);authMutation=result.catch(()=>{});return result;}
const ORIGIN='https://veriussu.com';
async function revokeSessionToken(token){
 if(!/^[a-f0-9]{64}$/.test(token))return;
 const response=await fetch(ORIGIN+'/site/auth/logout',{method:'POST',headers:{'Origin':ORIGIN,'Content-Type':'application/json','Cookie':'veriussu_web='+token},body:'{}',signal:AbortSignal.timeout(15000),redirect:'error'});
 if(!response.ok&&response.status!==401)throw Error('Önceki oturum iptali doğrulanamadı.');
}
function publish(value){if(value.event==='computer-watchers'&&computerShortcut){if(value.active||deviceServices?.system?.parked.size)computerShortcut.start();else computerShortcut.finish(deviceServices?.agent.state());}if(win&&!win.isDestroyed())win.webContents.send('event',value);if(value.event==='computer-task'&&computerBar&&!computerBar.isDestroyed())computerBar.webContents.send('task-status',value.task);}
function startWorker(){
 if(worker)return;
 const python=app.isPackaged?path.join(process.resourcesPath,'runtime','python.exe'):path.join(__dirname,'..','.venv','Scripts','python.exe');
 const script=app.isPackaged?path.join(process.resourcesPath,'speech','worker.py'):path.join(__dirname,'..','speech','worker.py');
 if(!fs.existsSync(python))throw Error('Ses çalışma zamanı bulunamadı. Önce hazırlık betiğini çalıştırın.');
 worker=spawn(python,['-u',script],{windowsHide:true,env:{...process.env,UMAY_DATA:path.join(app.getPath('userData'),'speech'),PYTHONIOENCODING:'utf-8'}});
 readline.createInterface({input:worker.stdout}).on('line',line=>{
  let data;try{data=JSON.parse(line);}catch{return;}
  if(data.event){if(data.event==='audio'){const entry=pending.get(data.id);if(entry?.epoch!==speechEpoch)return;data.playbackId=entry.playbackId;}if(data.event==='transcript'&&(data.streamId!==activeRecognition?.streamId||data.generation!==activeRecognition?.generation))return;publish(data);return;}
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
  pending.set(id,{resolve,reject,timer,epoch:speechEpoch,playbackId:params.playbackId});worker.stdin.write(JSON.stringify({id,method,params})+'\n');
 });
}
async function rawApi(route,body){
 const allowed=/^\/site\/(auth\/(me|logout)|chat\/(models|conversations(?:\/[a-f0-9-]+(?:\/(messages|model))?)?|runs\/[a-f0-9-]+(?:\/cancel)?)|user-memory(?:\/(summary|notes))?)$/;
  if(!allowed.test(route)&&!/^\/site\/chat\/conversations\/[a-f0-9-]+(?:\?before=[a-f0-9-]+|\/archive)$/.test(route))throw Error('İzin verilmeyen API yolu.');
 let response;try{response=await site.fetch(ORIGIN+route,{method:body===undefined?'GET':'POST',headers:{'Origin':ORIGIN,'Content-Type':'application/json',...require('./operator-channel.cjs').operatorHeaders(body)},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(30000),redirect:'error'});}catch(error){throw Error(['TimeoutError','AbortError'].includes(error.name)?'REQUEST_TIMEOUT':'NETWORK_ERROR');}
 return readSiteResponse(response);
}
async function api(route,body){
 const epoch=authEpoch;
 if(route==='/site/auth/me'){
  try{const result=await rawApi(route,body);if(epoch===authEpoch)deviceServices?.activate(result.id);return result;}
  catch(error){if(epoch===authEpoch&&error.message==='LOGIN_REQUIRED')deviceServices?.activate(null);throw error;}
 }
 return deviceServices?deviceServices.siteApi(route,body):rawApi(route,body);
}
function trusted(event){if(event.sender!==win?.webContents)throw Error('Güvenilmeyen pencere.');}
app.whenReady().then(()=>{
 site=session.fromPartition('persist:veriussu');
 if(process.platform==='win32')app.setAppUserModelId('com.veriussu.umay');
 const notify=({title,body,url})=>{if(!Notification.isSupported())return;const note=new Notification({title,body});note.on('click',()=>{if(win&&!win.isDestroyed()){win.show();win.focus();}if(url&&/^https:\/\//.test(url))void deviceServices?.browserAction('open-url',{url}).catch(error=>publish({event:'device-warning',message:error.message}));});note.show();};
 computerShortcut=new ComputerShortcut(globalShortcut,()=>void deviceServices.emergencyStop().catch(error=>publish({event:'device-warning',message:error.message})));
 deviceServices=new DeviceServices({native:new DesktopAccess({publish:state=>publish({event:'computer-access',state})}),directory:app.getPath('userData'),api:rawApi,screen,publish,notify,openExternal:url=>{if(!url.startsWith('obsidian://open?path='))throw Error('Geçersiz Obsidian bağlantısı.');return shell.openExternal(url);},openSource:url=>deviceServices.browserAction('open-url',{url}),
  encrypt:async text=>{if(!await safeStorage.isAsyncEncryptionAvailable())throw Error('Windows güvenli saklama kullanılamıyor.');return safeStorage.encryptStringAsync(text);},
  decrypt:async encrypted=>(await safeStorage.decryptStringAsync(encrypted)).result,
  trashItem:target=>shell.trashItem(target),openPath:target=>shell.openPath(target),
  defaultRoots:['desktop','documents','downloads'].map(key=>app.getPath(key)),
  chooseRoots:async()=>{const selected=await dialog.showOpenDialog(win,{title:'Dosya hafızasına klasör ekle',properties:['openDirectory','multiSelections']});return selected.canceled?null:selected.filePaths;},
  saveFile:async()=>{const selected=await dialog.showSaveDialog(win,{title:'Hafızayı Markdown olarak dışa aktar',defaultPath:'Umay Hafızası.md',filters:[{name:'Markdown',extensions:['md']}]});return selected.canceled?null:selected.filePath;},
  captureWorkspace:async(view,signal)=>{signal?.throwIfAborted();const sources=await desktopCapturer.getSources({types:['window'],thumbnailSize:{width:1400,height:1000}});signal?.throwIfAborted();const source=sources.find(s=>s.id.split(':')[1]===String(view.handle));return source&&!source.thumbnail.isEmpty()?'data:image/jpeg;base64,'+source.thumbnail.toJPEG(65).toString('base64'):null;},
  capture:async displays=>{const sources=await desktopCapturer.getSources({types:['screen'],thumbnailSize:{width:1600,height:1000}});return sources.map(source=>{const display=displays.find(d=>String(d.id)===source.display_id);if(!display)return null;const image=source.thumbnail,size=image.getSize();return {displayId:String(display.id),name:source.name,width:size.width,height:size.height,image:'data:image/jpeg;base64,'+image.toJPEG(65).toString('base64')};}).filter(Boolean);},
  excludedWindowHandles:()=>computerBar&&!computerBar.isDestroyed()?[Number(computerBar.getNativeWindowHandle().readBigUInt64LE())]:[],
  onComputerStart:()=>{
   computerShortcut.start();
   computerRunning=true;
   if(!computerBar||computerBar.isDestroyed()){const area=screen.getPrimaryDisplay().workArea;computerBar=new BrowserWindow({width:360,height:64,x:area.x+12,y:area.y+area.height-80,frame:false,resizable:false,alwaysOnTop:true,skipTaskbar:true,show:false,webPreferences:{preload:path.join(__dirname,'computer-bar-preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});computerBar.removeMenu();computerBar.loadFile(path.join(__dirname,'ui','computer-bar.html'));computerBar.webContents.on('will-navigate',e=>e.preventDefault());computerBar.webContents.setWindowOpenHandler(()=>({action:'deny'}));computerBar.once('ready-to-show',()=>{computerBar.webContents.send('task-status',deviceServices?.agent.state());computerBar.showInactive();});}else computerBar.showInactive();
   if(win&&!win.isDestroyed())win.minimize();
  },
  onComputerFinish:()=>{computerRunning=false;computerShortcut.finish(deviceServices?.agent.state(),deviceServices?.hasBackgroundWork());const task=deviceServices?.agent.state();if(computerBar&&!computerBar.isDestroyed()){if(task?.status==='paused')computerBar.showInactive();else computerBar.hide();}if(win&&!win.isDestroyed()&&['question','confirmation','failed','stopped','permission'].includes(task?.status)){win.show();win.focus();}else if(task?.status==='completed')notify({title:'Umay — Görev tamamlandı',body:task.message.slice(0,200)});},
 });
 ipcMain.handle('computer-emergency-stop',event=>{if(event.sender!==computerBar?.webContents)throw Error('Güvenilmeyen pencere.');return deviceServices.emergencyStop();});

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
 win=new BrowserWindow({icon:fs.existsSync(iconPath)?iconPath:undefined,width:Math.min(1500,area.width-20),height:Math.min(920,area.height-20),minWidth:Math.min(960,area.width-20),minHeight:Math.min(680,area.height-20),frame:false,backgroundColor:'#030d14',show:false,webPreferences:{backgroundThrottling:false,preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
 win.removeMenu();win.loadFile(path.join(__dirname,'ui','index.html'));win.once('ready-to-show',()=>win.show());win.on('closed',()=>app.quit());
 win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',e=>e.preventDefault());
 const handle=(name,fn)=>ipcMain.handle(name,async(e,...args)=>{
  trusted(e);const epoch=deviceServices?.memory.epoch,logged=['clone','update','restart-update'].includes(name)||name==='speech'&&['load','install','remove','speak','select_voice','delete_voice'].includes(args[0]);
  try{const result=await fn(...args);if(logged&&deviceServices?.memory.account&&epoch===deviceServices.memory.epoch)deviceServices.memory.log(name==='speech'?'speech-'+args[0]:name,({clone:'Ses klonlama işlemi',update:'Güncelleme denetimi','restart-update':'Güncelleme başlatıldı'})[name]||({load:'Konuşma modeli hazırlandı',install:'Konuşma paketi kuruldu',remove:'Konuşma paketi kaldırıldı',speak:'Yanıt seslendirildi',select_voice:'Ses profili seçildi',delete_voice:'Ses profili kaldırıldı'})[args[0]],{details:{kind:args[1]?.kind||null}});return result;}
  catch(error){if(logged&&deviceServices?.memory.account&&epoch===deviceServices.memory.epoch)deviceServices.memory.log('operation-error',error.message,{status:'failed',details:{operation:name,method:typeof args[0]==='string'?args[0]:null}});throw error;}
 });
 handle('local-memory',(method,input)=>deviceServices.local(method,input));
 handle('environment',(method,input)=>deviceServices.environmentAction(method,input));
 handle('computer',(method,input)=>deviceServices.computer(method,input));
 handle('browser',(method,input)=>deviceServices.browserAction(method,input));
 handle('model-roles',(method,input)=>deviceServices.modelRoles(method,input));
 handle('plugins',async(method,input={})=>{
  const epoch=deviceServices.memory.epoch;deviceServices.memory.require();
  if(method==='choose-vault'){const result=await dialog.showOpenDialog(win,{title:'Obsidian vault klasörünü seç',properties:['openDirectory']});deviceServices.memory.check(epoch);return result.canceled?null:deviceServices.plugins.action('connect',{vaultPath:result.filePaths[0]});}
  if(method==='recovery-export'){const result=await dialog.showSaveDialog(win,{title:'Şifreli kasa yedeği',defaultPath:'Umay Şifreli Kasa.umay',filters:[{name:'Şifreli Umay kasası',extensions:['umay']}]});deviceServices.memory.check(epoch);if(result.canceled)return null;const bytes=await deviceServices.plugins.action(method);deviceServices.memory.check(epoch);await fs.promises.writeFile(result.filePath,bytes,{flag:'wx',mode:0o600});return {saved:true};}
  if(method==='recovery-import'){const result=await dialog.showOpenDialog(win,{title:'Şifreli kasa yedeğini seç',properties:['openFile'],filters:[{name:'Şifreli kasa',extensions:['umay','umay-encrypted']}]});deviceServices.memory.check(epoch);if(result.canceled)return null;const file=result.filePaths[0],stat=await fs.promises.lstat(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>64*1024*1024)throw Error('Kasa dosyası geçersiz veya çok büyük.');const bytes=await fs.promises.readFile(file);deviceServices.memory.check(epoch);return deviceServices.plugins.action(method,{bytes,recoveryKey:input.recoveryKey});}
  return deviceServices.plugins.action(method,input);
 });
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
   deviceServices.activate(null);
   await site.clearStorageData();
   await site.cookies.set({url:ORIGIN,name:'veriussu_web',value:result.sessionToken,path:'/',secure:true,httpOnly:true,sameSite:'strict',expirationDate:result.expiresAt/1000});
   await site.cookies.flushStore();publish({event:'session-changed'});win.show();win.focus();
   }catch(error){await revokeSessionToken(result.sessionToken).catch(()=>{});throw error;}
  })).catch(()=>{if(epoch===authEpoch)publish({event:'error',message:'Tarayıcı girişi tamamlanmadı. Yeniden deneyebilirsiniz.'});});
  return {started:true};
 });
 handle('logout',async()=>{
  ++authEpoch;browserAuth.cancel();deviceServices.activate(null);
  const result=await authTask(async()=>{let revoked=true;try{await api('/site/auth/logout',{});}catch{revoked=false;}await site.clearStorageData();await site.cookies.flushStore();return {revoked};});
  await shell.openExternal(ORIGIN+'/site/desktop-auth/logout').catch(()=>publish({event:'error',message:'Umay’dan çıkış yapıldı; tarayıcı çıkış sayfası açılamadı.'}));return result;
 });
 handle('update',async()=>{if(!app.isPackaged)return {development:true};return autoUpdater.checkForUpdates();});
 handle('busy',busy=>{running=!!busy;if(!running&&!computerRunning&&updateReady)publish({event:'update-ready'});});
 handle('restart-update',()=>{if(running||computerRunning||deviceServices?.hasBackgroundWork())throw Error('Önce etkin konuşmayı veya bilgisayar görevini bitirin.');if(updateReady)autoUpdater.quitAndInstall(false,true);});
 autoUpdater.autoDownload=true;autoUpdater.autoInstallOnAppQuit=true;
 autoUpdater.on('error',()=>publish({event:'update-error',message:'Güncelleme sunucusu henüz hazır değil veya paket doğrulanamadı.'}));
 autoUpdater.on('update-downloaded',()=>{updateReady=true;if(!running&&!computerRunning)publish({event:'update-ready'});});
 if(app.isPackaged){autoUpdater.checkForUpdatesAndNotify();setInterval(()=>autoUpdater.checkForUpdatesAndNotify(),21600000).unref();}
});
let quitting=false;app.on('before-quit',event=>{if(quitting)return;event.preventDefault();quitting=true;browserAuth?.cancel();globalShortcut.unregisterAll();void Promise.resolve(deviceServices?.shutdown()).catch(()=>{}).finally(()=>{computerBar?.destroy();if(worker)worker.kill();app.quit();});});app.on('window-all-closed',()=>app.quit());

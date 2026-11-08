'use strict';
const {spawn}=require('node:child_process'),path=require('node:path'),readline=require('node:readline'),fs=require('node:fs'),os=require('node:os'),{randomUUID}=require('node:crypto');
const {focusedField}=require('./computer-progress.cjs');
const {navigationUrl,addressField}=require('./computer-navigation.cjs');
const KEYS={CTRL:17,CONTROL:17,ALT:18,SHIFT:16,WIN:91,META:91,ENTER:13,RETURN:13,TAB:9,ESC:27,ESCAPE:27,BACKSPACE:8,DELETE:46,HOME:36,END:35,PAGEUP:33,PAGEDOWN:34,LEFT:37,UP:38,RIGHT:39,DOWN:40,SPACE:32};
Object.assign(KEYS,{INSERT:45,PRINTSCREEN:44,CAPSLOCK:20,NUMLOCK:144,SCROLLLOCK:145,PAUSE:19,PLUS:187,MINUS:189,COMMA:188,PERIOD:190,SEMICOLON:186,SLASH:191,BACKSLASH:220,QUOTE:222,BRACKETLEFT:219,BRACKETRIGHT:221,BACKTICK:192});
function keyCodes(input){if(!Array.isArray(input)||input.length<1||input.length>8)throw Error('Tuş birleşimi geçersiz.');return input.map(value=>{const name=String(value).toUpperCase();if(KEYS[name])return KEYS[name];if(/^[A-Z0-9]$/.test(name))return name.charCodeAt(0);if(/^F(?:[1-9]|1[0-9]|2[0-4])$/.test(name))return 111+Number(name.slice(1));throw Error('Desteklenmeyen tuş: '+name);});}
class NativeDesktop{
 constructor({script=path.join(__dirname,'native-desktop.ps1').replace(/app\.asar([\\/])/,'app.asar.unpacked$1'),spawnImpl=spawn,timeout=15000}={}){this.script=script;this.spawn=spawnImpl;this.timeout=timeout;this.queue=[];this.active=null;this.child=null;this.closing=false;this.draining=false;}
 shutdown(child,error){
  if(this.child!==child)return;this.child=null;this.draining=false;
  if(this.active){clearTimeout(this.active.timer);this.active.reject(error);this.active.resolveDrain?.();this.cleanStopFile(this.active);this.active=null;}
  for(const entry of this.queue)entry.reject(error);this.queue=[];child.stdin.destroy();child.kill();
  if(this.stopDirectory){try{fs.rmdirSync(this.stopDirectory);this.stopDirectory=null;}catch{}}
 }
 cleanStopFile(entry){clearTimeout(entry.releaseTimer);if(entry.stopFile)try{fs.unlinkSync(entry.stopFile);}catch{}}
 timeoutEntry(child,entry){
  const error=Object.assign(Error('Windows işlemi zaman aşımına uğradı; bekleyen girişler iptal edildi.'),{code:'NATIVE_TIMEOUT'});
  if(entry.method!=='hold')return this.shutdown(child,error);
  // Do not terminate a process while its key-up finally block is pending.
  // A held action is capped at2s; the separate stop channel remains available.
  entry.timeoutError=error;this.draining=true;try{fs.writeFileSync(entry.stopFile,'stop');}catch{}
  for(const queued of this.queue)queued.reject(error);this.queue=[];
  entry.releaseTimer=setTimeout(()=>this.shutdown(child,error),2500);
 }
 start(){
  const child=this.child=this.spawn('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-STA','-ExecutionPolicy','Bypass','-File',this.script],{windowsHide:true,stdio:['pipe','pipe','pipe']});
  readline.createInterface({input:child.stdout}).on('line',line=>{
   if(child!==this.child)return;let data;try{data=JSON.parse(line);}catch{return;}const entry=this.active;if(!entry||entry.id!==data.id)return;
   this.active=null;clearTimeout(entry.timer);this.cleanStopFile(entry);entry.resolveDrain?.();
   const errors={NATIVE_PARTIAL_INPUT:'İşlemin bir bölümü uygulanmış olabilir. Tekrarlamayı önlemek için görev durduruldu; ekranı kontrol edin.',NATIVE_ELEVATION_REQUIRED:'Bu pencere için Windows yönetici izni gerekiyor.',NATIVE_DESKTOP_LOCKED:'Windows kilit veya güvenli onay ekranında. Bilgisayarın kilidini açıp Windows onayını kendiniz tamamlayın.',NATIVE_INPUT_DENIED:'Windows bu pencereye giriş yapılmasına izin vermedi.',NATIVE_FOCUS_CHANGED:'Etkin pencere değişti. Ekran yeniden incelenecek.',NATIVE_WINDOW_UNAVAILABLE:'Seçilen pencere kapandı veya Windows odaklanmaya izin vermedi.',LOCATION_UNAVAILABLE:'Cihaz konumu alınamadı. Windows konum hizmetini açın veya şehir seçin.'};
   if(!entry.cancelled)entry.timeoutError?entry.reject(entry.timeoutError):data.error?entry.reject(Object.assign(Error(errors[data.error]||data.error),{code:data.error})):entry.resolve(data.result);
   if(this.closing||this.draining)this.shutdown(child,Error('Windows kontrol bağlantısı kapandı.'));else this.pump();
  });
  child.stderr.on('data',data=>{this.lastError=String(data).slice(-2000);});
  const failed=()=>this.shutdown(child,Object.assign(Error('Windows kontrol bağlantısı kapandı.'),{code:'NATIVE_DISCONNECTED'}));
  child.on('error',failed);child.on('exit',failed);child.stdin.on('error',failed);
 }
 pump(){
  if(this.active||!this.queue.length)return;
  if(!this.child)this.start();const child=this.child,entry=this.active=this.queue.shift();
  entry.timer=setTimeout(()=>this.timeoutEntry(child,entry),['observe','observe_window'].includes(entry.method)?Math.max(this.timeout,20000):this.timeout);
  child.stdin.write(JSON.stringify({id:entry.id,method:entry.method,params:entry.params})+'\n',error=>{if(error)this.shutdown(child,error);});
 }
 request(method,params={}){
  if(this.closing)return Promise.reject(Error('Windows kontrol bağlantısı kapandı.'));
  if(this.draining)return Promise.reject(Object.assign(Error('Önceki Windows girişleri bırakılıyor. Biraz sonra tekrar deneyin.'),{code:'NATIVE_TIMEOUT'}));
  if(process.platform!=='win32')return Promise.reject(Error('Bilgisayar kontrolü bu sürümde Windows için kullanılabilir.'));
  const id=randomUUID();let stopFile;
  if(method==='hold'){this.stopDirectory??=fs.mkdtempSync(path.join(os.tmpdir(),'umay-native-stop-'));stopFile=path.join(this.stopDirectory,id+'.stop');params={...params,stopFile};}
  return new Promise((resolve,reject)=>{this.queue.push({id,method,params,stopFile,resolve,reject});this.pump();});
 }
 cancel({keepAlive=false}={}){
  const error=Object.assign(Error('Bilgisayar görevi durduruldu.'),{code:'NATIVE_CANCELLED'});
  for(const entry of this.queue)entry.reject(error);this.queue=[];
  if(!this.child)return;
  // Never kill a key chord or drag halfway through its finally/release block.
  // Only one native command is sent at a time, so no later input can escape.
  if(this.active&&(keepAlive||!['observe','observe_window','foreground','location'].includes(this.active.method))){if(this.active.stopFile)try{fs.writeFileSync(this.active.stopFile,'stop');}catch{}this.active.cancelled=true;this.active.reject(error);this.active.drained??=new Promise(resolve=>this.active.resolveDrain=resolve);return this.active.drained;}
  if(keepAlive&&!this.closing)return;
  this.shutdown(this.child,error);
 }
 close(){this.closing=true;this.cancel();}
}
class ComputerControl{
 constructor({native=new NativeDesktop(),capture,screen,now=()=>Date.now(),excludedWindowHandles=()=>[]}={}){Object.assign(this,{native,capture,screen,now,excludedWindowHandles});this.observation=null;this.sequence=0;this.enabled=false;}
 enable(value){this.enabled=!!value;if(!value)this.observation=null;return this.enabled;}
 async observe({image=true,preferText=()=>false}={}){
  if(!this.enabled)throw Error('Önce bilgisayar kontrolünü açın.');const sequence=++this.sequence;
  const native=await this.native.request('observe');if(native.requiresElevation&&!native.administrator)throw Object.assign(Error('Bu pencere için Windows yönetici izni gerekiyor.'),{code:'NATIVE_ELEVATION_REQUIRED'});const displays=this.screen.getAllDisplays();
  const shots=image&&!preferText(native)&&(!this.allowCapture||this.allowCapture(native))?await this.capture(displays):[];
  if(!this.enabled||sequence!==this.sequence)throw Error('Bilgisayar görevi durduruldu.');
  const observation={id:randomUUID(),createdAt:this.now(),title:native.title,handle:native.handle,processId:native.processId,windows:(native.windows||[]).filter(w=>!this.excludedWindowHandles().includes(w.handle)),elements:native.elements||[],cursor:native.cursor,displays:displays.map(d=>({id:String(d.id),bounds:d.bounds,scaleFactor:d.scaleFactor})),screenshots:shots};this.observation=this.sanitize?this.sanitize(observation):observation;return this.observation;
 }
 stop(){this.sequence++;this.observation=null;return this.native.cancel?.();}
 async inspectWindow(handle){
  const view=this.observation,target=view?.windows.find(w=>w.handle===handle)||(view?.handle===handle?{handle,processId:view.processId}:null);
  if(!this.enabled||!target||this.excludedWindowHandles().includes(handle))throw Object.assign(Error('İzlenecek pencere güncel gözlemde bulunamadı.'),{code:'PLANNER_INVALID'});
  const result=await this.native.request('observe_window',{handle,expectedProcessId:target.processId});if(result.requiresElevation&&!result.administrator)throw Object.assign(Error('Bu pencere için Windows yönetici izni gerekiyor.'),{code:'NATIVE_ELEVATION_REQUIRED'});return result;
 }
 async perform(action,observationId){
  this.guard?.(action.action);
  const observed=this.observation;if(!this.enabled||!observed||observed.id!==observationId||this.now()-observed.createdAt>90000)throw Error('Ekran görüntüsü güncel değil. Yeniden gözlem gerekiyor.');
  const type=String(action.action||'');let method,params={};
  try{
  const coordinate=(x,y,displayId)=>{const display=observed.displays.find(d=>d.id===String(displayId));const shot=observed.screenshots.find(s=>s.displayId===String(displayId));if(!display||!shot||!Number.isFinite(x)||!Number.isFinite(y)||x<0||y<0||x>=shot.width||y>=shot.height)throw Error('Ekran koordinatları geçersiz.');const dip={x:Math.round(display.bounds.x+x/shot.width*display.bounds.width),y:Math.round(display.bounds.y+y/shot.height*display.bounds.height)};return this.screen.dipToScreenPoint(dip);};
  let point;
  if(['click','double_click','right_click','middle_click','move','drag'].includes(type)||type==='scroll'&&(Number.isInteger(action.elementId)||action.x!==undefined||action.y!==undefined)){
   if(Number.isInteger(action.elementId)){const element=observed.elements.find(e=>e.id===action.elementId);if(!element)throw Error('Ekran öğesi bulunamadı.');point={x:Math.round(element.bounds.x+element.bounds.width/2),y:Math.round(element.bounds.y+element.bounds.height/2)};}
   else point=coordinate(action.x,action.y,action.displayId);
  }
  if(['click','double_click','right_click','middle_click'].includes(type)){method='click';params={...point,button:type==='right_click'?'right':type==='middle_click'?'middle':'left',count:type==='double_click'?2:1};}
  else if(type==='move'){method='move';params=point;}
  else if(type==='drag'){method='drag';const end=coordinate(action.endX,action.endY,action.endDisplayId??action.displayId);params={...point,endX:end.x,endY:end.y};}
  else if(type==='scroll'){if(!Number.isInteger(action.amount)||Math.abs(action.amount)>10||!action.amount||action.axis&&!['vertical','horizontal'].includes(action.axis))throw Error('Kaydırma miktarı veya yönü geçersiz.');method='scroll';params={...point,amount:action.amount,axis:action.axis||'vertical'};}
  else if(type==='focus_window'){const target=observed.windows.find(w=>w.handle===action.windowHandle);if(!target)throw Error('Seçilen pencere güncel gözlemde bulunamadı.');method='focus';params={handle:target.handle};}
  else if(type==='navigate'){if(!addressField(observed))throw Error('Tarayıcının adres alanı güncel gözlemde bulunamadı.');method='navigate';params={url:navigationUrl(action.url)};}
  else if(type==='keys'){method='keys';params={keys:keyCodes(action.keys)};}
  else if(type==='hold'){
   if(!Number.isInteger(action.milliseconds)||action.milliseconds<1||action.milliseconds>2000||action.button&&!['left','right','middle'].includes(action.button)||!action.button&&!action.keys?.length)throw Error('Basılı giriş süresi veya tuş/fare seçimi geçersiz.');
   method='hold';params={keys:action.keys?.length?[...new Set(keyCodes(action.keys))]:[],...(action.button?{button:action.button}:{}),milliseconds:action.milliseconds};
  }
  else if(type==='move_relative'){if(!Number.isInteger(action.dx)||!Number.isInteger(action.dy)||Math.abs(action.dx)>2000||Math.abs(action.dy)>2000||!action.dx&&!action.dy)throw Error('Göreli fare hareketi geçersiz.');method='move_relative';params={dx:action.dx,dy:action.dy};}
  else if(type==='type'){
   if(typeof action.text!=='string'||!action.text.length||action.text.length>4000)throw Error('Yazılacak metin geçersiz.');
   if(action.replace!==undefined&&typeof action.replace!=='boolean'||action.submit!==undefined&&typeof action.submit!=='boolean')throw Error('Metin alanı işlemi geçersiz.');
   const field=focusedField(observed);
   if(Number.isInteger(action.elementId)&&action.elementId!==field?.id)throw Error('Yazılacak öğe klavye odağında değil. Önce doğru metin alanını seçin.');
   if((action.replace||action.submit)&&(!field||field.type!=='ControlType.Edit'))throw Error('Değiştir/gönder işlemi için önce metin alanına odaklanın.');
   method='text';params={text:action.text,...(action.replace?{replace:true}:{}),...(action.submit?{submit:true}:{}),...(field?.runtimeId?{expectedFocus:field.runtimeId}:{})};
  }
  else if(type==='wait'){const milliseconds=Number(action.milliseconds??500);if(!Number.isFinite(milliseconds)||milliseconds<0||milliseconds>5000)throw Error('Bekleme süresi geçersiz.');method='wait';params={milliseconds};}
  else throw Error('Bilgisayar işlemi desteklenmiyor.');
  }catch(error){error.code='PLANNER_INVALID';throw error;}
  const expectation={expectedHandle:observed.handle,...(observed.processId?{expectedProcessId:observed.processId}:{})};
  if(method==='focus'){const target=observed.windows.find(w=>w.handle===params.handle);if(target?.processId)params.expectedProcessId=target.processId;}
  this.observation=null;
  if(method==='navigate'){
   const sequence=this.sequence;
   await this.native.request('keys',{keys:keyCodes(['CTRL','L']),...expectation});
   if(!this.enabled||sequence!==this.sequence)throw Error('Bilgisayar görevi durduruldu.');
   const fresh=await this.observe({image:false}),field=addressField(fresh);
   if(!this.enabled||sequence+1!==this.sequence||fresh.handle!==observed.handle||!field?.focused)throw Object.assign(Error('Adres alanının odağı değişti; gezinme uygulanmadı.'),{code:'NATIVE_FOCUS_CHANGED'});
   return this.perform({action:'type',text:params.url,replace:true,submit:true,elementId:field.id},fresh.id);
  }
  if(method==='wait'){const sequence=this.sequence,end=Date.now()+params.milliseconds;while(Date.now()<end){if(!this.enabled||this.sequence!==sequence)throw Error('Bilgisayar görevi durduruldu.');await new Promise(r=>setTimeout(r,Math.min(50,end-Date.now())));}if(!this.enabled||this.sequence!==sequence)throw Error('Bilgisayar görevi durduruldu.');return true;}
  if(method==='text'){
   const sequence=this.sequence,characters=Array.from(params.text);
   for(let offset=0;offset<characters.length;offset+=32){
    if(!this.enabled||sequence!==this.sequence)throw Error('Bilgisayar görevi durduruldu.');
    try{await this.native.request(method,{text:characters.slice(offset,offset+32).join(''),...expectation,...(params.expectedFocus?{expectedFocus:params.expectedFocus}:{}),...(params.replace&&offset===0?{replace:true}:{}),...(params.submit&&offset+32>=characters.length?{submit:true}:{})});}
    catch(error){if(offset>0){error.code='NATIVE_PARTIAL_INPUT';error.message='Metnin bir bölümü yazıldı; tekrar yazmayı önlemek için görev durduruldu. Ekranı kontrol edip yeni görev verebilirsiniz.';}throw error;}
   }
   if(!this.enabled||sequence!==this.sequence)throw Error('Bilgisayar görevi durduruldu.');return true;
  }
  return this.native.request(method,{...expectation,...params});
 }
 close(){this.enable(false);this.native.close();}
}
module.exports={NativeDesktop,ComputerControl,keyCodes};

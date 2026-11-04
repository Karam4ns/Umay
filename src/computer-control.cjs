'use strict';
const {spawn}=require('node:child_process'),path=require('node:path'),readline=require('node:readline'),{randomUUID}=require('node:crypto');
const KEYS={CTRL:17,CONTROL:17,ALT:18,SHIFT:16,WIN:91,META:91,ENTER:13,RETURN:13,TAB:9,ESC:27,ESCAPE:27,BACKSPACE:8,DELETE:46,HOME:36,END:35,PAGEUP:33,PAGEDOWN:34,LEFT:37,UP:38,RIGHT:39,DOWN:40,SPACE:32};
function keyCodes(input){if(!Array.isArray(input)||input.length<1||input.length>8)throw Error('Tuş birleşimi geçersiz.');return input.map(value=>{const name=String(value).toUpperCase();if(KEYS[name])return KEYS[name];if(/^[A-Z0-9]$/.test(name))return name.charCodeAt(0);if(/^F(?:[1-9]|1[0-9]|2[0-4])$/.test(name))return 111+Number(name.slice(1));throw Error('Desteklenmeyen tuş: '+name);});}
class NativeDesktop{
 constructor({script=path.join(__dirname,'native-desktop.ps1').replace(/app\.asar([\\/])/,'app.asar.unpacked$1'),spawnImpl=spawn}={}){this.script=script;this.spawn=spawnImpl;this.pending=new Map();this.child=null;}
 request(method,params={}){
  if(process.platform!=='win32')return Promise.reject(Error('Bilgisayar kontrolü bu sürümde Windows için kullanılabilir.'));
  if(!this.child){this.child=this.spawn('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-STA','-ExecutionPolicy','Bypass','-File',this.script],{windowsHide:true,stdio:['pipe','pipe','pipe']});
   readline.createInterface({input:this.child.stdout}).on('line',line=>{let data;try{data=JSON.parse(line);}catch{return;}const entry=this.pending.get(data.id);if(!entry)return;this.pending.delete(data.id);clearTimeout(entry.timer);const errors={NATIVE_INPUT_DENIED:'Windows bu pencereye giriş yapılmasına izin vermedi.',NATIVE_FOCUS_CHANGED:'Etkin pencere değişti. Ekran yeniden incelenecek.',LOCATION_UNAVAILABLE:'Cihaz konumu alınamadı. Windows konum hizmetini açın veya şehir seçin.'};data.error?entry.reject(Error(errors[data.error]||data.error)):entry.resolve(data.result);});this.child.stderr.on('data',data=>{this.lastError=String(data).slice(-2000);});
   const failed=()=>{this.child=null;for(const entry of this.pending.values()){clearTimeout(entry.timer);entry.reject(Error('Windows kontrol bağlantısı kapandı.'));}this.pending.clear();};this.child.on('error',failed);this.child.on('exit',failed);
  }
  const id=randomUUID();return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.pending.delete(id);reject(Error('Windows işlemi zaman aşımına uğradı.'));},method==='observe'?20000:15000);this.pending.set(id,{resolve,reject,timer});this.child.stdin.write(JSON.stringify({id,method,params})+'\n');});
 }
 close(){this.child?.stdin.end();}
}
class ComputerControl{
 constructor({native=new NativeDesktop(),capture,screen,now=()=>Date.now()}={}){Object.assign(this,{native,capture,screen,now});this.observation=null;this.sequence=0;this.enabled=false;}
 enable(value){this.enabled=!!value;if(!value)this.observation=null;return this.enabled;}
 async observe({image=true}={}){
  if(!this.enabled)throw Error('Önce bilgisayar kontrolünü açın.');const sequence=++this.sequence;
  const native=await this.native.request('observe'),displays=this.screen.getAllDisplays();
  const shots=image?await this.capture(displays):[];
  if(!this.enabled||sequence!==this.sequence)throw Error('Bilgisayar görevi durduruldu.');
  const observation={id:randomUUID(),createdAt:this.now(),title:native.title,handle:native.handle,elements:native.elements||[],cursor:native.cursor,displays:displays.map(d=>({id:String(d.id),bounds:d.bounds,scaleFactor:d.scaleFactor})),screenshots:shots};this.observation=observation;return observation;
 }
 stop(){this.sequence++;this.observation=null;}
 async perform(action,observationId){
  const observed=this.observation;if(!this.enabled||!observed||observed.id!==observationId||this.now()-observed.createdAt>90000)throw Error('Ekran görüntüsü güncel değil. Yeniden gözlem gerekiyor.');
  const type=String(action.action||'');let method,params={};
  const coordinate=(x,y,displayId)=>{const display=observed.displays.find(d=>d.id===String(displayId));const shot=observed.screenshots.find(s=>s.displayId===String(displayId));if(!display||!shot||!Number.isFinite(x)||!Number.isFinite(y)||x<0||y<0||x>=shot.width||y>=shot.height)throw Error('Ekran koordinatları geçersiz.');const dip={x:Math.round(display.bounds.x+x/shot.width*display.bounds.width),y:Math.round(display.bounds.y+y/shot.height*display.bounds.height)};return this.screen.dipToScreenPoint(dip);};
  let point;
  if(['click','double_click','right_click','move','drag'].includes(type)){
   if(Number.isInteger(action.elementId)){const element=observed.elements.find(e=>e.id===action.elementId);if(!element)throw Error('Ekran öğesi bulunamadı.');point={x:Math.round(element.bounds.x+element.bounds.width/2),y:Math.round(element.bounds.y+element.bounds.height/2)};}
   else point=coordinate(action.x,action.y,action.displayId);
  }
  if(['click','double_click','right_click'].includes(type)){method='click';params={...point,button:type==='right_click'?'right':'left',count:type==='double_click'?2:1};}
  else if(type==='move'){method='move';params=point;}
  else if(type==='drag'){method='drag';const end=coordinate(action.endX,action.endY,action.displayId);params={...point,endX:end.x,endY:end.y};}
  else if(type==='scroll'){if(!Number.isInteger(action.amount)||Math.abs(action.amount)>10||!action.amount)throw Error('Kaydırma miktarı geçersiz.');method='scroll';params={amount:action.amount};}
  else if(type==='keys'){method='keys';params={keys:keyCodes(action.keys)};}
  else if(type==='type'){if(typeof action.text!=='string'||!action.text.length||action.text.length>4000)throw Error('Yazılacak metin geçersiz.');method='text';params={text:action.text};}
  else if(type==='wait'){const milliseconds=Number(action.milliseconds??500);if(!Number.isFinite(milliseconds)||milliseconds<0||milliseconds>5000)throw Error('Bekleme süresi geçersiz.');this.observation=null;await new Promise(r=>setTimeout(r,milliseconds));return true;}
  else throw Error('Bilgisayar işlemi desteklenmiyor.');
  this.observation=null;
  if(method==='text'){
   const sequence=this.sequence,characters=Array.from(params.text);
   for(let offset=0;offset<characters.length;offset+=32){
    if(!this.enabled||sequence!==this.sequence)throw Error('Bilgisayar görevi durduruldu.');
    await this.native.request(method,{text:characters.slice(offset,offset+32).join(''),expectedHandle:observed.handle});
   }
   if(!this.enabled||sequence!==this.sequence)throw Error('Bilgisayar görevi durduruldu.');return true;
  }
  return this.native.request(method,{...params,expectedHandle:observed.handle});
 }
 close(){this.enable(false);this.native.close();}
}
module.exports={NativeDesktop,ComputerControl,keyCodes};

'use strict';
const net=require('node:net'),fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process'),{randomBytes}=require('node:crypto'),{EventEmitter}=require('node:events'),{PassThrough}=require('node:stream');
const {NativeDesktop}=require('./computer-control.cjs');
const {gzipSync}=require('node:zlib');
const nativeScript=path.join(__dirname,'native-desktop.ps1').replace(/app\.asar([\\/])/,'app.asar.unpacked$1');
const failure=(code,message)=>Object.assign(Error(message),{code});
function launchAdministrator({encodedCommand}){
 // Both commands contain only fixed code and base64. No model/user text is
 // interpolated into shell syntax, arguments, script paths or the launcher.
 const command="$ErrorActionPreference='Stop';try{Start-Process -FilePath (Join-Path $PSHOME 'powershell.exe') -Verb RunAs -WindowStyle Hidden -ArgumentList @('-NoLogo','-NoProfile','-NonInteractive','-STA','-EncodedCommand','"+encodedCommand+"') -PassThru|Out-Null;[Console]::WriteLine('STARTED')}catch{[Console]::WriteLine('UAC_DENIED');exit 1}";
 const child=spawn(path.join(process.env.SystemRoot||'C:\\Windows','System32/WindowsPowerShell/v1.0/powershell.exe'),['-NoLogo','-NoProfile','-NonInteractive','-Command','-'],{windowsHide:true,stdio:['pipe','pipe','pipe']});
 child.stdin.on('error',()=>{});child.stdin.end(command+'\n');return child;
}
function createElevationTransport({timeout=120000,launch=launchAdministrator}={}){
 const pipeName='\\\\.\\pipe\\umay-admin-'+randomBytes(24).toString('hex'),token=randomBytes(32).toString('hex');
 const bootstrap=fs.readFileSync(path.join(__dirname,'elevated-desktop.ps1'),'utf8');
 const command="$UmayPipe='"+pipeName.split('\\').at(-1)+"';$UmayToken='"+token+"';$UmayNative='"+gzipSync(fs.readFileSync(nativeScript)).toString('base64')+"';\n"+bootstrap;
 const sockets=new Set();let resolve,reject,ready,readyReject,settled=false,launchChild,timer;
 const promise=new Promise((yes,no)=>{resolve=yes;reject=no;}),listening=new Promise((yes,no)=>{ready=yes;readyReject=no;});
 // Consumers may cancel before awaiting startup; never leave a rejected
 // auxiliary readiness promise unhandled.
 void listening.catch(()=>{});
 const server=net.createServer(socket=>{
  sockets.add(socket);socket.on('error',()=>{});socket.once('close',()=>sockets.delete(socket));let buffer='';
  const authenticate=chunk=>{
   buffer+=chunk.toString('utf8');if(buffer.length>4096){socket.destroy();return;}
   const newline=buffer.indexOf('\n');if(newline<0)return;let hello;try{hello=JSON.parse(buffer.slice(0,newline));}catch{socket.destroy();return;}
   if(hello.event!=='elevated-ready'||hello.token!==token){socket.destroy();return;}
   if(hello.administrator!==true){finish(failure('UAC_NOT_ELEVATED','Windows yönetici izni doğrulanamadı.'));return;}
   if(settled){socket.destroy();return;}settled=true;clearTimeout(timer);socket.removeListener('data',authenticate);server.close();
   for(const other of sockets)if(other!==socket)other.destroy();
   const child=new EventEmitter();child.stdin=socket;child.stdout=new PassThrough();child.stderr=new PassThrough();child.kill=()=>socket.destroy();
   socket.on('data',chunk=>child.stdout.write(chunk));socket.once('close',()=>{child.stdout.end();child.emit('exit',0);});
   const remaining=buffer.slice(newline+1);if(remaining)child.stdout.write(remaining);
   socket.write(JSON.stringify({event:'accept',token})+'\n');resolve(child);
  };socket.on('data',authenticate);
 });
 function finish(error){if(settled)return;settled=true;clearTimeout(timer);server.close();for(const socket of sockets)socket.destroy();launchChild?.kill();readyReject(error);reject(error);}
 server.once('error',error=>finish(error));
 server.listen(pipeName,()=>{
  if(settled)return;
  try{launchChild=launch({pipeName,token,encodedCommand:Buffer.from(command,'utf16le').toString('base64')});let output='';launchChild.stdout?.on('data',chunk=>{output+=chunk.toString();if(output.includes('UAC_DENIED'))finish(failure('UAC_DENIED','Windows yönetici izni verilmedi. Görev izin bekliyor; yeniden deneyebilir veya durdurabilirsiniz.'));});launchChild.stderr?.on('data',()=>{});launchChild.once('error',()=>finish(failure('UAC_START_FAILED','Windows yönetici onayı açılamadı.')));launchChild.once('exit',code=>{if(code)finish(failure('UAC_DENIED','Windows yönetici izni verilmedi.'));});ready();}
  catch(error){finish(error);}
 });
 timer=setTimeout(()=>finish(failure('UAC_TIMEOUT','Windows yönetici onayı zaman aşımına uğradı. Tekrar deneyebilirsiniz.')),timeout);
 return {promise,listening,cancel:()=>finish(failure('NATIVE_CANCELLED','Yönetici izni işlemi durduruldu.'))};
}
class DesktopAccess{
 constructor({normal=new NativeDesktop(),transportFactory=createElevationTransport,nativeFactory=options=>new NativeDesktop(options),publish=()=>{}}={}){Object.assign(this,{normal,transportFactory,nativeFactory,publish});this.elevated=null;this.pending=null;this.generation=0;this.closed=false;}
 state(){return {administrator:!!this.elevated,pending:!!this.pending};}
 request(method,params){if(this.closed)return Promise.reject(Error('Windows kontrol bağlantısı kapandı.'));return (this.elevated||this.normal).request(method,params);}
 async elevate(){
  if(this.closed)throw Error('Windows kontrol bağlantısı kapandı.');if(this.pending)throw Error('Windows yönetici onayı zaten bekleniyor.');if(this.elevated)return this.state();
  const generation=++this.generation,transaction=this.pending=this.transportFactory();this.publish(this.state());let elevated;
  try{
   const child=await transaction.promise;if(generation!==this.generation){child.kill();throw failure('NATIVE_CANCELLED','Yönetici izni işlemi durduruldu.');}
   elevated=this.candidate=this.nativeFactory({spawnImpl:()=>child});const privileges=await elevated.request('privileges');
   if(generation!==this.generation)throw failure('NATIVE_CANCELLED','Yönetici izni işlemi durduruldu.');
   if(!privileges?.administrator)throw failure('UAC_NOT_ELEVATED','Windows yönetici izni doğrulanamadı.');this.candidate=null;this.elevated=elevated;child.once('exit',()=>{if(this.elevated===elevated){this.elevated=null;this.publish(this.state());}});return {administrator:true,pending:false};
  }catch(error){if(this.candidate===elevated)this.candidate=null;if(this.elevated===elevated)this.elevated=null;elevated?.close();throw error;}
  finally{if(this.pending===transaction)this.pending=null;this.publish(this.state());}
 }
 async release(){this.generation++;const pending=this.pending,elevated=this.elevated,candidate=this.candidate;this.pending=null;this.elevated=null;this.candidate=null;pending?.cancel();for(const native of [elevated,candidate])if(native){await native.cancel();native.close();}this.publish(this.state());}
 async cancel(){const normal=this.normal.cancel();await Promise.all([normal,this.release()]);}
 close(){this.closed=true;this.normal.close();void this.release();}
}
module.exports={DesktopAccess,createElevationTransport,launchAdministrator};

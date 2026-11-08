'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),{spawn}=require('node:child_process'),{createHash}=require('node:crypto');
function chromeExecutable(){
 for(const base of [process.env.PROGRAMFILES,process.env['PROGRAMFILES(X86)'],process.env.LOCALAPPDATA].filter(Boolean)){
  const file=path.join(base,'Google','Chrome','Application','chrome.exe');if(require('node:fs').existsSync(file))return file;
 }
 throw Object.assign(Error('Google Chrome bulunamadı. Chrome’u kurduktan sonra web görevini yeniden deneyebilirsin.'),{code:'CHROME_NOT_INSTALLED'});
}
class ChromeBrowser{
 constructor({directory,spawnImpl=spawn,fetchImpl=fetch,executable=chromeExecutable,delay=ms=>new Promise(r=>setTimeout(r,ms))}){Object.assign(this,{directory,spawn:spawnImpl,fetch:fetchImpl,executable,delay});this.generation=0;this.child=null;this.account=null;}
 activate(account){if(this.account===account)return;this.cancelPending();this.child?.unref?.();this.child=null;this.account=account;}
 ownsProcess(processId){return !!this.child&&!this.child.killed&&this.child.exitCode==null&&this.child.pid===processId;}
 existingEndpoint(){if(!this.account)return null;return this.endpoint(path.join(this.directory,'profiles',createHash('sha256').update(String(this.account)).digest('hex')));}
 async endpoint(profile){
  try{
   const lines=(await fs.readFile(path.join(profile,'DevToolsActivePort'),'utf8')).trim().split(/\r?\n/),port=Number(lines[0]);if(!Number.isInteger(port)||port<1||port>65535||!/^\/devtools\/browser\/[a-z0-9-]+$/i.test(lines[1]))return null;
   const base='http://127.0.0.1:'+port,result=await this.fetch(base+'/json/version',{signal:AbortSignal.timeout(800)});if(!result.ok)return null;
   const value=await result.json(),ws=new URL(value.webSocketDebuggerUrl);return ['127.0.0.1','localhost'].includes(ws.hostname)&&ws.port===String(port)&&ws.pathname===lines[1]?base:null;
  }catch{return null;}
 }
 async ensure(){
  if(!this.account)throw Error('Tarayıcıyı kullanmak için giriş yapın.');const generation=this.generation;
  const profile=path.join(this.directory,'profiles',createHash('sha256').update(String(this.account)).digest('hex'));await fs.mkdir(profile,{recursive:true});
  let endpoint=await this.endpoint(profile);if(generation!==this.generation)throw Error('Tarayıcı bağlantısı durduruldu.');if(endpoint){this.starting=false;return endpoint;}
  if(generation!==this.generation)throw Error('Tarayıcı bağlantısı durduruldu.');
  this.starting=true;this.child=this.spawn(this.executable(),['--user-data-dir='+profile,'--remote-debugging-address=127.0.0.1','--remote-debugging-port=0','--no-first-run','--no-default-browser-check','--new-window','about:blank'],{windowsHide:true,stdio:'ignore'});
  let failed;this.child.on('error',error=>failed=error);
  for(let i=0;i<100;i++){
   if(generation!==this.generation)throw Error('Tarayıcı bağlantısı durduruldu.');if(failed)throw Error('Chrome başlatılamadı.');
   endpoint=await this.endpoint(profile);if(generation!==this.generation)throw Error('Tarayıcı bağlantısı durduruldu.');if(endpoint){this.starting=false;return endpoint;}await this.delay(100);
  }
  throw Error('Chrome bağlantısı kurulamadı. Açık Chrome penceresini kontrol edip yeniden deneyin.');
 }
 close(){this.generation++;this.child?.kill();this.child=null;}
 cancelPending(){this.generation++;if(this.starting){this.child?.kill();this.child=null;this.starting=false;}}
}
module.exports={ChromeBrowser,chromeExecutable};

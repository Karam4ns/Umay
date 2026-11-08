'use strict';
const {ApplicationTools}=require('./system-apps.cjs'),{FileTools}=require('./system-files.cjs');
const invalid=message=>Object.assign(Error(message),{code:'SYSTEM_CANCELLED'});
const text=value=>typeof value==='string'&&value.length>0&&value.length<=200;
// Private, authenticated worker-side registry. A read never switches the
// foreground task. Cancelling an RPC is distinct from cancelling its jobs.
class SystemWorkerHost{
 constructor({apps=new ApplicationTools(),filesFactory=roots=>new FileTools({roots,discoverDrives:true})}={}){Object.assign(this,{apps,filesFactory});this.requests=new Map();this.files=new Map();this.parked=new Set();this.account=null;this.generation=0;this.closed=false;}
 validate(message){if(this.closed||!text(message.account)||this.account&&this.account!==message.account)throw invalid('Yönetici işçisi hesabı veya oturumu değişti.');this.account??=message.account;}
 async handle(message){
  this.validate(message);if(message.method==='cancel-request'){this.requests.get(message.requestId)?.controller.abort();return {cancelled:true};}
  if(!text(message.taskId))throw invalid('Görev kimliği geçersiz.');
  if(message.method==='park')return this.parkTask(message.taskId,message.jobIds);
  if(message.method==='unpark'){this.parked.delete(message.taskId);return {taskId:message.taskId};}
  if(message.method==='cancel')return this.cancelTask(message.taskId);
  if(message.method!=='perform'||!text(message.id)||this.requests.has(message.id))throw invalid('Yönetici isteği geçersiz veya yinelenmiş.');
  const {id,taskId,toolName,args}=message,generation=this.generation,controller=new AbortController(),entry={controller,taskId};this.requests.set(id,entry);
  const check=()=>{if(this.closed||generation!==this.generation)throw invalid('Yönetici işçisi kapandı.');controller.signal.throwIfAborted();};
  try{check();if(!this.files.has(taskId)){if(this.files.size>=128)throw invalid('Yönetici görev sınırına ulaşıldı.');this.files.set(taskId,this.filesFactory(Array.isArray(message.roots)?message.roots:[]));}const files=this.files.get(taskId),backend=files.definitions().some(d=>d.name===toolName)?files:this.apps;
   const result=await backend.perform(toolName,args,{taskId,signal:controller.signal,check,preserveOnCancel:()=>this.parked.has(taskId)});check();return result;
  }finally{if(this.requests.get(id)===entry)this.requests.delete(id);}
 }
 parkTask(taskId,jobIds){if(!Array.isArray(jobIds)||!jobIds.length||jobIds.length>100||new Set(jobIds).size!==jobIds.length)throw invalid('Arka plan iş kimlikleri geçersiz.');for(const id of jobIds)this.apps.jobs.owned(id,taskId);this.apps.jobs.detachTask(taskId);this.parked.add(taskId);return {taskId,jobIds:[...jobIds]};}
 async cancelTask(taskId){for(const entry of this.requests.values())if(entry.taskId===taskId)entry.controller.abort();await this.apps.cancelTask(taskId);this.parked.delete(taskId);return {taskId,stopped:true};}
 async close(){if(this.closing)return this.closing;this.closed=true;this.generation++;for(const entry of this.requests.values())entry.controller.abort();this.closing=this.apps.close().then(()=>{this.parked.clear();this.files.clear();}).catch(error=>{this.closing=null;throw error;});return this.closing;}
}
module.exports={SystemWorkerHost};

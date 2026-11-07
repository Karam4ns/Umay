'use strict';
const childProcess=require('node:child_process');
const {randomUUID}=require('node:crypto');
const {StringDecoder}=require('node:string_decoder');
const path=require('node:path');

function childEnvironment(){const env={...process.env};for(const key of Object.keys(env))if(key.toUpperCase()==='ELECTRON_RUN_AS_NODE')delete env[key];return env;}

function failure(message,code='PLANNER_INVALID'){return Object.assign(Error(message),{code});}
function assertText(value,name,{optional=false,max=32768}={}){
 if(optional&&value===undefined)return;
 if(typeof value!=='string'||!value.trim()||value.length>max||value.includes('\0'))throw failure(name+' geçerli bir metin olmalı.');
}
function checkContext({signal,check=()=>{}}={}){
 if(signal?.aborted)throw failure('İşlem durduruldu.','ABORT_ERR');check();
}
function integer(value,fallback,min,max,name){
 if(value===undefined)return fallback;
 if(!Number.isInteger(value)||value<min||value>max)throw failure(name+' sınırları geçersiz.');return value;
}

// Owns only processes created through run(). GUI application launches never enter
// this registry. The caller supplies the current user task, not page-derived authority.
class ProcessJobs{
 constructor({spawn=childProcess.spawn,platform=process.platform,publish=()=>{},maxOutputChars=65536,maxJobs=100,maxRunning=16}={}){
  Object.assign(this,{spawn,platform,publish,maxOutputChars,maxJobs,maxRunning});this.jobs=new Map();this.generation=0;this.closed=false;this.resetting=null;
 }
 notify(event){try{this.publish(event);}catch{}}
 owned(jobId,taskId){
  assertText(jobId,'jobId',{max:200});assertText(taskId,'taskId',{max:200});const job=this.jobs.get(jobId);
  if(!job)throw failure('Süreç işi bulunamadı.','PROCESS_NOT_FOUND');
  if(job.taskId!==taskId)throw failure('Süreç başka bir göreve ait.','PROCESS_NOT_OWNED');return job;
 }
 view(job,{stdoutOffset,stderrOffset,outputLimit}={}){
  const limit=integer(outputLimit,4000,1,16000,'outputLimit');
  const read=(stream,offset)=>{
   const total=job[stream+'Total'],text=job[stream],base=total-text.length;
   const requested=integer(offset,base,0,Number.MAX_SAFE_INTEGER,stream+'Offset');
   if(requested>total)throw failure('Çıktı konumu mevcut çıktıyı aşıyor.');
   const start=Math.max(base,requested),chunk=text.slice(start-base,start-base+limit);
   return {text:chunk,offset:start,total,next:start+chunk.length,hasMore:start+chunk.length<total,truncated:requested<base||base>0};
  };
  const out=read('stdout',stdoutOffset),err=read('stderr',stderrOffset);
  return {jobId:job.id,taskId:job.taskId,pid:job.pid??null,executable:job.executable,state:job.state,exitCode:job.exitCode??null,signal:job.exitSignal??null,startedAt:job.startedAt,endedAt:job.endedAt??null,
   stdout:out.text,stdoutOffset:out.offset,stdoutTotal:out.total,stdoutNextOffset:out.next,stdoutHasMore:out.hasMore,
   stderr:err.text,stderrOffset:err.offset,stderrTotal:err.total,stderrNextOffset:err.next,stderrHasMore:err.hasMore,
   outputTruncated:out.truncated||err.truncated,...(job.error?{error:job.error}:{})};
 }
 async run({executable,args=[],cwd}={},context={}){
  checkContext(context);assertText(context.taskId,'taskId',{max:200});assertText(executable,'executable');assertText(cwd,'cwd',{optional:true});
  if(!Array.isArray(args)||args.length>512||args.some(a=>typeof a!=='string'||a.includes('\0')||a.length>131072))throw failure('args bir metin dizisi olmalı.');
  if(this.closed)throw failure('Süreç yöneticisi kapalı.','PROCESS_CLOSED');
  if(this.resetting)throw failure('Önceki süreçler durduruluyor; sıfırlama henüz tamamlanmadı.','PROCESS_RESETTING');
  if([...this.jobs.values()].filter(j=>j.state==='running'||j.state==='stopping').length>=this.maxRunning)throw failure('Çalışan süreç sınırı doldu.','PROCESS_LIMIT');
  while(this.jobs.size>=this.maxJobs){const old=[...this.jobs.values()].find(j=>!['running','stopping'].includes(j.state));if(!old)throw failure('Süreç sınırı doldu.','PROCESS_LIMIT');this.jobs.delete(old.id);}
  const generation=this.generation,job={id:randomUUID(),taskId:context.taskId,executable,state:'running',startedAt:Date.now(),stdout:'',stderr:'',stdoutTotal:0,stderrTotal:0};
  let child;try{child=this.spawn(executable,[...args],{cwd,env:childEnvironment(),shell:false,windowsHide:true,detached:this.platform!=='win32',stdio:['ignore','pipe','pipe']});}catch(error){throw error;}
  job.child=child;job.pid=child.pid;job.done=new Promise(resolve=>job.resolve=resolve);this.jobs.set(job.id,job);
  const decoders={stdout:new StringDecoder('utf8'),stderr:new StringDecoder('utf8')};
  const append=(stream,text)=>{job[stream+'Total']+=text.length;job[stream]=(job[stream]+text).slice(-this.maxOutputChars);};
  for(const stream of ['stdout','stderr'])child[stream]?.on('data',chunk=>append(stream,decoders[stream].write(Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk))));
  const finish=(code,signal,error)=>{
   if(job.endedAt)return;
   for(const stream of ['stdout','stderr'])append(stream,decoders[stream].end());
   job.exitCode=code;job.exitSignal=signal;job.endedAt=Date.now();job.state=job.cancelled?'cancelled':error?'failed':'exited';
   if(error)job.error={code:error.code||'PROCESS_FAILED',message:error.message};
   context.signal?.removeEventListener('abort',abort);job.resolve();this.notify({type:'process',phase:job.state,jobId:job.id,taskId:job.taskId,exitCode:code});
  };
  const abort=()=>{void this.stop(job.id,{taskId:job.taskId}).catch(error=>{job.error={code:error.code||'PROCESS_STOP_FAILED',message:error.message};});};
  job.abort=abort;job.abortSignal=context.signal;context.signal?.addEventListener('abort',abort,{once:true});
  child.once('close',(code,signal)=>finish(code,signal));
  const started=new Promise((resolve,reject)=>{child.once('spawn',resolve);child.once('error',error=>{finish(null,null,error);reject(error);});});
  if(context.signal?.aborted)abort();
  try{await started;checkContext(context);if(generation!==this.generation)throw failure('İşlem sıfırlandı.','ABORT_ERR');}
  catch(error){if(!job.endedAt)await this.stop(job.id,{taskId:job.taskId}).catch(()=>{});throw error;}
  this.notify({type:'process',phase:'started',jobId:job.id,taskId:job.taskId,executable});return this.view(job);
 }
 async status(jobId,options={}){
  checkContext(options);const job=this.owned(jobId,options.taskId),waitMs=integer(options.waitMs,0,0,10000,'waitMs');
  if(waitMs&&!job.endedAt){
   const deadline=Date.now()+waitMs;
   while(!job.endedAt&&Date.now()<deadline){
    let timer;await Promise.race([job.done,new Promise(resolve=>{timer=setTimeout(resolve,Math.min(100,deadline-Date.now()));})]);clearTimeout(timer);
    try{checkContext(options);}catch(error){if(!options.preserveOnCancel?.())await this.stop(jobId,{taskId:job.taskId});throw error;}
   }
  }
  checkContext(options);return this.view(job,options);
 }
 async stop(jobId,options={}){
  checkContext(options);const job=this.owned(jobId,options.taskId);if(job.endedAt)return this.view(job);
  if(job.stopping)return job.stopping;
  job.cancelled=true;job.state='stopping';
  job.stopping=(async()=>{
   // Never accept a model-supplied PID. Only the still-running owned child can
   // authorize tree termination; no name-based/global process killing occurs.
   if(this.platform==='win32'&&job.child.exitCode===null&&job.child.signalCode===null&&job.pid){
    await new Promise((resolve,reject)=>{
     let killer;try{killer=this.spawn(path.win32.join(process.env.SystemRoot||'C:\\Windows','System32','taskkill.exe'),['/PID',String(job.pid),'/T','/F'],{env:childEnvironment(),shell:false,windowsHide:true,stdio:'ignore'});}catch(error){reject(error);return;}
     killer.once('error',reject);killer.once('close',code=>{if(code&&job.child.exitCode===null)job.child.kill();resolve();});
    });
   }else if(!job.endedAt){
    if(this.platform!=='win32'&&job.pid){try{process.kill(-job.pid,'SIGKILL');}catch(error){if(error.code!=='ESRCH')throw error;}}
    else job.child.kill('SIGKILL');
   }
   let timer;await Promise.race([job.done,new Promise(resolve=>{timer=setTimeout(resolve,2000);})]);clearTimeout(timer);
   if(!job.endedAt)throw failure('Sürecin durduğu henüz doğrulanamadı.','PROCESS_STOP_UNCONFIRMED');return this.view(job);
  })();try{return await job.stopping;}finally{job.stopping=null;}
 }
 detachTask(taskId){assertText(taskId,'taskId',{max:200});for(const job of this.jobs.values())if(job.taskId===taskId&&!job.endedAt){job.abortSignal?.removeEventListener('abort',job.abort);job.abortSignal=null;}}
 async cancelTask(taskId){assertText(taskId,'taskId',{max:200});const results=await Promise.allSettled([...this.jobs.values()].filter(j=>j.taskId===taskId&&!j.endedAt).map(j=>this.stop(j.id,{taskId})));const failed=results.find(r=>r.status==='rejected');if(failed)throw failed.reason;}
 async reset(){
  if(this.resetting)return this.resetting;
  this.generation++;
  // Publish the drain barrier before stopping children. A concurrent run must
  // never enter the registry after the reset snapshot and then be forgotten.
  this.resetting=Promise.resolve().then(async()=>{
   const results=await Promise.allSettled([...this.jobs.values()].filter(j=>!j.endedAt).map(j=>this.stop(j.id,{taskId:j.taskId})));
   const failed=results.find(r=>r.status==='rejected');if(failed)throw failed.reason;this.jobs.clear();
  });
  try{await this.resetting;}finally{this.resetting=null;}
 }
 async close(){this.closed=true;await this.reset();}
}
module.exports={ProcessJobs,checkContext,assertText,failure,integer,childEnvironment};

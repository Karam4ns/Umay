'use strict';
const terminal=new Set(['completed','exited','failed','stopped','cancelled']);
const uncertain=()=>Object.assign(Error('İşin bağlantısı veya sonucu doğrulanamadı. Komutu tekrarlamadım; otomatik devam durduruldu.'),{code:'SYSTEM_STOP_UNCONFIRMED'});
function transport(s,job){return job.backend==='local'?s.apps:job.backend==='remote'?s.remote:job.adapter;}
function validLease(s,id,job){return job.backend==='local'||job.backend==='remote'&&s.remote?.ready&&s.remote.generation===job.lease||job.backend==='adapter'&&job.adapter?.jobIdentity?.(id)===job.lease;}
async function parkTask(s,taskId){
 const generation=s.generation,account=s.account,epoch=s.accountGeneration,ids=s.pendingForTask(taskId);if(!account||!ids.length||s.parking?.has(taskId))throw Error('Arka plana alınacak sahip olunan iş yok veya park işlemi sürüyor.');s.parking??=new Set();s.parking.add(taskId);const jobs=ids.map(id=>s.jobs.get(id)),groups=new Map(),accepted=[];
 const check=()=>{s.check(generation);if(s.account!==account||s.accountGeneration!==epoch||ids.some((id,i)=>s.jobs.get(id)!==jobs[i])||s.pendingForTask(taskId).some(id=>!ids.includes(id)))throw uncertain();};
 try{for(let i=0;i<ids.length;i++){const job=jobs[i],backend=transport(s,job);if(!validLease(s,ids[i],job)||!backend||job.backend!=='local'&&!backend.parkTask)throw uncertain();if(!groups.has(backend))groups.set(backend,[]);groups.get(backend).push(ids[i]);}
  for(const [backend,jobIds]of groups){if(backend===s.apps)continue;check();const receipt=await backend.parkTask(taskId,jobIds);accepted.push(backend);check();if(receipt?.taskId!==taskId||!Array.isArray(receipt.jobIds)||receipt.jobIds.length!==jobIds.length||jobIds.some(id=>!receipt.jobIds.includes(id)))throw uncertain();}
  check();if(groups.has(s.apps))s.apps.jobs.detachTask(taskId);s.parked.add(taskId);for(const id of ids)s.pending.delete(id);return ids;
 }catch(error){if(s.generation===generation&&s.accountGeneration===epoch){const cleanup=await Promise.allSettled(accepted.map(b=>b.unparkTask?.(taskId)));if(cleanup.some(r=>r.status==='rejected'))s.stopError=uncertain();}throw error;}finally{s.parking.delete(taskId);}
}
async function cancelOwnedTask(s,taskId){
 const remoteJobs=[...s.jobs].filter(([,j])=>j.taskId===taskId&&j.backend==='remote'&&!terminal.has(j.state));
 const operations=[Promise.resolve().then(()=>s.apps.cancelTask?.(taskId)),...s.adapters.map(a=>Promise.resolve().then(()=>a.cancelTask?.(taskId)))];
 operations.push(Promise.resolve().then(()=>{if(remoteJobs.some(([id,j])=>!validLease(s,id,j))){for(const [,j]of remoteJobs)j.state='unknown';throw uncertain();}if(s.remote?.ready)return s.remote.cancelTask(taskId);}));
 const results=await Promise.allSettled(operations),failed=results.find(r=>r.status==='rejected');if(failed)throw failed.reason;
}
async function cancelParkedTask(s,taskId){if(!s.parked.has(taskId))return;try{await cancelOwnedTask(s,taskId);}catch(error){s.stopError=Object.assign(uncertain(),{cause:error});throw s.stopError;}s.parked.delete(taskId);for(const [id,j]of s.jobs)if(j.taskId===taskId){s.pending.delete(id);if(!terminal.has(j.state))j.state='stopped';}}
async function unparkTask(s,taskId){if(!s.parked.has(taskId))return;const generation=s.generation,epoch=s.accountGeneration,groups=new Set();for(const [id,j]of s.jobs)if(j.taskId===taskId&&!terminal.has(j.state)){if(!validLease(s,id,j))throw uncertain();const backend=transport(s,j);if(backend!==s.apps)groups.add(backend);}for(const b of groups){await b.unparkTask?.(taskId);s.check(generation);if(s.accountGeneration!==epoch)throw uncertain();}if(!s.parked.delete(taskId))return;for(const [id,j]of s.jobs)if(j.taskId===taskId&&!terminal.has(j.state))s.pending.add(id);}
async function readTaskJobs(s,target){
 const account=s.account,epoch=s.accountGeneration,results=[],check=()=>{if(!account||s.account!==account||s.accountGeneration!==epoch)throw uncertain();};check();
 for(const id of target.jobIds){const owned=s.jobs.get(id);if(!owned||owned.account!==account||owned.taskId!==target.taskId)return {identity:false};if(!validLease(s,id,owned)){if(!terminal.has(owned.state))owned.state='unknown';throw uncertain();}const backend=transport(s,owned);const result=owned.backend==='adapter'?await backend.readJob(id,owned.taskId):await backend.perform('process_status',{jobId:id},{taskId:owned.taskId,check});check();if(s.jobs.get(id)!==owned||!validLease(s,id,owned))throw uncertain();owned.state=result.state;if(terminal.has(result.state))s.pending.delete(id);if(!['running','stopping',...terminal].includes(result.state)||result.stopUnconfirmed)throw uncertain();results.push(s.sanitize?s.sanitize(result):result);}
 return {identity:true,finished:results.length>0&&results.every(r=>terminal.has(r.state)),results};
}
module.exports={parkTask,cancelOwnedTask,cancelParkedTask,unparkTask,readTaskJobs,terminal};

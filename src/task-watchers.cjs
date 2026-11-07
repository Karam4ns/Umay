'use strict';
const {randomUUID,createHash}=require('node:crypto');
const hash=value=>createHash('sha256').update(value).digest('hex');
const fold=value=>String(value||'').normalize('NFKD').replace(/\p{M}/gu,'').replace(/ı/g,'i').toLowerCase();
const active=new Set(['watching','ready','resuming']);
const fail=message=>Object.assign(Error(message),{code:'WATCH_INVALID'});

// Pollers receive read-only callbacks. Only the foreground coordinator can resume
// the original task; observed text never becomes an instruction or authority.
class TaskWatchers{
 constructor({memory,read,resume,isBusy=()=>false,isReadBusy=()=>false,isSensitive=()=>false,publish=()=>{},now=()=>Date.now(),schedule=setTimeout,cancelSchedule=clearTimeout}={}){
  Object.assign(this,{memory,read,resume,isBusy,isReadBusy,isSensitive,publish,now,schedule,cancelSchedule});this.items=new Map();this.generation=0;this.account=null;this.flight=null;this.resuming=false;
 }
 activate(account){
  this.generation++;this.controller?.abort();if(this.timer)this.cancelSchedule(this.timer);this.timer=null;this.flight=null;this.resuming=false;this.account=account;this.items.clear();
  if(!account)return;this.epoch=this.memory.epoch;const db=this.memory.require();db.exec('CREATE TABLE IF NOT EXISTS task_watchers(id TEXT PRIMARY KEY,payload TEXT NOT NULL)');
  for(const row of db.prepare('SELECT payload FROM task_watchers').all()){const item=JSON.parse(row.payload);if(active.has(item.status)){item.status='paused';item.message='Umay yeniden açıldı. Güncel hedef doğrulanarak devam etmeni bekliyorum.';}this.items.set(item.id,item);this.persist(item);}
 }
 check(generation=this.generation){if(!this.account||generation!==this.generation||this.memory.account!==this.account)throw fail('İzleme hesabı değişti.');this.memory.check(this.epoch);}
 persist(item){this.check();this.memory.require().prepare('INSERT INTO task_watchers VALUES(?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload').run(item.id,JSON.stringify(item));}
 state(){return [...this.items.values()].map(item=>structuredClone(item));}
 hasActive(){return [...this.items.values()].some(i=>active.has(i.status));}
 pending(taskId){return [...this.items.values()].find(i=>i.taskId===taskId&&i.status==='watching');}
 emit(){this.publish({event:'computer-watchers',watchers:this.state(),active:this.hasActive()});}
 arm(){if(this.timer)this.cancelSchedule(this.timer);this.timer=null;if(this.account&&this.hasActive()){this.timer=this.schedule(()=>{this.timer=null;void this.tick().catch(()=>{});},1000);this.timer?.unref?.();}}
 async create({taskId,goal,origin,target,condition,durationMs=12*60*60000,intervalMs=1500,stableMs=1000,autoContinue=true}){
  this.check();const generation=this.generation;
  if(typeof taskId!=='string'||!taskId||typeof goal!=='string'||!goal.trim()||goal.length>12000||!target||!['desktop','browser'].includes(target.kind))throw fail('İzlenecek görev ve hedef eksik.');
  if(target.kind==='desktop'&&(!Number.isInteger(target.handle)||target.handle<=0||!Number.isInteger(target.processId)||target.processId<=0))throw fail('Pencere ve süreç kimliği gerekiyor.');
  if(target.kind==='browser'&&(!target.profileKey||!Number.isInteger(target.pageId)||!/^https?:\/\//.test(target.origin||'')))throw fail('Tarayıcı profili, sekme ve site kökeni gerekiyor.');
  if(!condition||['contains','absent'].filter(k=>condition[k]!==undefined).length+Number(condition.changed===true)!==1||Object.keys(condition).some(k=>!['contains','absent','changed'].includes(k))||['contains','absent'].some(k=>condition[k]!==undefined&&(typeof condition[k]!=='string'||!condition[k].trim()||condition[k].length>500)))throw fail('Tek ve açık bir izleme koşulu gerekiyor.');
  for(const [value,min,max]of [[durationMs,1000,24*60*60000],[intervalMs,500,10000],[stableMs,500,30000]])if(!Number.isInteger(value)||value<min||value>max)throw fail('İzleme süresi veya aralığı geçersiz.');
  if([...this.items.values()].filter(i=>active.has(i.status)||i.status==='paused').length>=12)throw fail('En fazla 12 bekleyen iş izlenebilir.');
  if(this.pending(taskId))throw fail('Bu görevin zaten etkin izleyicisi var.');
  if(this.isSensitive())throw fail('Gizli aşama bitmeden arka plan izleme başlatılamaz.');
  const initial=await this.read(target,{initial:true});this.check(generation);if(!initial?.identity)throw fail('İzlenecek hedef doğrulanamadı.');
  const now=this.now(),item={id:randomUUID(),taskId,goal,origin:origin?{conversationId:origin.conversationId,userRequest:origin.userRequest,anchorMessageId:origin.anchorMessageId}:null,target:structuredClone(target),condition:structuredClone(condition),autoContinue:!!autoContinue,createdAt:now,expiresAt:now+durationMs,intervalMs,stableMs,status:'watching',message:'Koşulun gerçekleşmesini izliyorum.',baseline:hash(initial.text||''),seen:condition.absent!==undefined&&fold(initial.text).includes(fold(condition.absent)),lastCheckedAt:now,matchedAt:null};
  this.items.set(item.id,item);this.persist(item);this.emit();this.arm();return structuredClone(item);
 }
 async tick(){
  if(this.flight)return this.flight;const generation=this.generation,controller=new AbortController();this.controller=controller;
  const flight=(async()=>{try{
   this.check(generation);if(this.isSensitive())return;
   for(const item of this.items.values()){
    this.check(generation);if(this.isSensitive())break;if(item.status!=='watching')continue;
    if(this.now()>=item.expiresAt){item.status='expired';item.message='İzleme süresi doldu; tamamlanma doğrulanmadı.';this.persist(item);this.emit();continue;}
    if(this.isReadBusy(item.target)||this.now()-item.lastCheckedAt<item.intervalMs)continue;
    try{
     const view=await this.read(item.target,{signal:controller.signal});this.check(generation);if(item.status!=='watching'||controller.signal.aborted||this.isSensitive())continue;
     item.lastCheckedAt=this.now();if(view?.busy)continue;if(!view?.identity){item.status='target-lost';item.message='İzlenen pencere, sekme veya profil değişti. Yeniden hedef seçmek gerekiyor.';this.persist(item);this.emit();continue;}
     const text=fold(view.text);if(item.condition.absent!==undefined&&text.includes(fold(item.condition.absent)))item.seen=true;
     const matched=item.condition.contains!==undefined?text.includes(fold(item.condition.contains)):item.condition.absent!==undefined?item.seen&&!text.includes(fold(item.condition.absent)):hash(view.text||'')!==item.baseline;
     if(!matched){item.matchedAt=null;continue;}item.matchedAt??=this.now();if(this.now()-item.matchedAt<item.stableMs)continue;
     item.status='ready';item.message='İzlenen koşul doğrulandı. Asıl göreve devam etmeye hazır.';item.result={outcome:'condition_matched',kind:item.target.kind,observedAt:this.now(),elapsedMs:this.now()-item.createdAt,usage:'Salt okunur koşul sonucu; yeni işlem izni veya görevin tamamlandığı kanıtı değildir.'};this.persist(item);this.emit();
    }catch(e){if(generation!==this.generation||controller.signal.aborted)return;if(item.status==='watching'){item.status='paused';item.message='Hedef okunamadı. Otomatik devam durduruldu; güncel hedefle yeniden denenebilir.';this.persist(item);this.emit();}}
   }
   await this.drain(generation);
  }finally{if(generation===this.generation)this.arm();}})();this.flight=flight;try{return await flight;}finally{if(this.flight===flight)this.flight=null;}
 }
 async drain(generation=this.generation){
  if(this.resuming||this.isBusy()||this.isSensitive())return;const item=[...this.items.values()].find(i=>i.status==='ready'&&i.autoContinue);if(!item)return;this.check(generation);this.resuming=true;item.status='resuming';this.persist(item);this.emit();
  try{const result=await this.resume(structuredClone(item));this.check(generation);if(item.status!=='resuming')return;item.status=result?.status==='watching'?'completed':result?.status==='failed'?'failed':'completed';item.message=result?.status==='watching'?'İzleme aşaması bitti; görev yeni koşulu izliyor.':'Koşul sonucu asıl göreve aktarıldı.';this.persist(item);this.emit();}
  catch(e){if(generation===this.generation&&item.status==='resuming'){item.status='paused';item.message='Göreve otomatik dönüş doğrulanamadı. Güncel durumla devam etmeni bekliyorum.';this.persist(item);this.emit();}}
  finally{if(generation===this.generation)this.resuming=false;}
 }
 pause(id){this.check();const item=this.items.get(id);if(!item)throw fail('İzleyici bulunamadı.');if(active.has(item.status)){item.status='paused';item.matchedAt=null;item.message='İzleme ve otomatik devam duraklatıldı.';this.persist(item);}this.emit();this.arm();return structuredClone(item);}
 pauseAll(){if(!this.account)return;for(const item of this.items.values())if(active.has(item.status)){item.status='paused';item.matchedAt=null;item.message='Kullanıcı izlemeyi duraklattı.';this.persist(item);}this.emit();this.arm();}
 cancel(id){const item=this.pause(id);const current=this.items.get(id);current.status='cancelled';current.message='İzleyici iptal edildi.';this.persist(current);this.emit();return {...item,status:'cancelled'};}
 async continue(id){this.check();const item=this.items.get(id);if(!item||!['paused','ready'].includes(item.status))throw fail('Devam ettirilecek izleyici bulunamadı.');const generation=this.generation;if(this.isSensitive())throw fail('Önce gizli aşamayı tamamlayın.');const view=await this.read(item.target,{initial:true});this.check(generation);if(!view?.identity)throw fail('Önce güncel hedefi yeniden seçin.');item.status='watching';item.expiresAt=this.now()+12*60*60000;item.lastCheckedAt=0;item.matchedAt=null;item.baseline=hash(view.text||'');item.message='Güncel hedef doğrulandı; izlemeye devam ediyorum.';this.persist(item);this.emit();this.arm();return structuredClone(item);}
 close(){this.activate(null);}
}
module.exports={TaskWatchers};

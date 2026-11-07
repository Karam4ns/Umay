'use strict';
const {randomUUID,createHash}=require('node:crypto');
const fail=message=>Object.assign(Error(message),{code:'CHECKOUT_REVIEW_REQUIRED'});
const boundTarget=t=>({profileKey:t?.profileKey,connectionId:t?.connectionId,pageId:t?.pageId,origin:t?.origin});
const sameTarget=(a,b)=>!!a&&!!b&&['profileKey','connectionId','pageId','origin'].every(k=>a[k]===b[k]);
const canonical=s=>String(s||'').replace(/uid=\S+/g,'uid').trim();
const digest=s=>createHash('sha256').update(canonical(s)).digest('hex');
const pending=new Set(['submitting','uncertain']);
const staticTexts=snapshot=>String(snapshot||'').split('\n').filter(l=>/uid=\S+\s+(?:(?:StaticText|heading|status|alert)\b|")/.test(l)).flatMap(l=>[...l.matchAll(/"((?:\\.|[^"\\])*)"/g)].map(m=>{try{return JSON.parse(m[0]);}catch{return m[1];}}));
const visibleFact=(snapshot,text)=>{snapshot=String(snapshot||'');for(let at=snapshot.indexOf(text);at>=0;at=snapshot.indexOf(text,at+1)){const left=snapshot[at-1]||'',right=snapshot[at+text.length]||'';if(!/[\p{L}\p{N}.,]/u.test(left)&&!/[\p{L}\p{N}]/u.test(right))return true;}return false;};
const controlKey=line=>String(line||'').match(/\b(button|link)\s+("(?:\\.|[^"\\])*")/)?.slice(1).join(':')||'';
function publicText(value,max=1200){if(typeof value!=='string'||!value.trim()||value.length>max||/\b(?:password|parola|şifre|otp|cvv|cvc)\s*[:=]|\b(?:\d[ -]?){13,19}\b|\[gizli\]/iu.test(value))throw fail('Özette yalnız görünür ürün, tutar, adres ve ödeme etiketi kullanılabilir; gizli değer kullanma.');return value.trim();}
class CheckoutFlow{
 constructor({memory,observe,now=()=>Date.now(),publish=()=>{}}={}){Object.assign(this,{memory,observe,now,publish});this.generation=0;this.items=new Map();this.flights=new Set();this.baselines=new Map();}
 activate(){this.generation++;this.items.clear();this.flights.clear();this.baselines.clear();this.account=this.memory.account;this.epoch=this.memory.epoch;if(!this.account)return;const db=this.memory.require();db.exec('CREATE TABLE IF NOT EXISTS checkout_orders(id TEXT PRIMARY KEY,status TEXT NOT NULL,payload TEXT NOT NULL)');for(const row of db.prepare('SELECT payload FROM checkout_orders').all()){const item=JSON.parse(row.payload);delete item.reviewId;delete item.expiresAt;if(pending.has(item.status)){item.status='uncertain';item.effectReply='unknown';}else if(item.status==='approved')item.status='review';this.items.set(item.id,item);this.persist(item);}}
 check(generation=this.generation){if(!this.account||generation!==this.generation||this.memory.account!==this.account)throw fail('Sipariş hesabı veya işlemi değişti.');this.memory.check(this.epoch);}
 persist(item){this.check();this.memory.require().prepare('INSERT INTO checkout_orders VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status,payload=excluded.payload').run(item.id,item.status,JSON.stringify(item));this.publish({event:'computer-checkouts',orders:this.list()});}
 list(){return [...this.items.values()].map(i=>structuredClone(i));}
 get(id){this.check();const item=this.items.get(id);if(!item)throw fail('Sipariş kaydı bulunamadı.');return structuredClone(item);}
 locked(){return [...this.items.values()].some(i=>['review','approved','submitting','uncertain'].includes(i.status));}
 guard(name,args={}){if(this.locked()&&name==='take_snapshot'&&Object.hasOwn(args,'filePath'))throw fail('Sipariş/gizli aşamada ham sayfa dosyaya aktarılamaz.');if(this.locked()&&!/^(?:checkout_(?:review|submit|state|verify|addresses)|interaction_wait|take_snapshot|list_pages|wait_for|process_status|task_watch_list|files_list|files_stat|files_search)$/.test(name))throw fail('Sipariş teyidi veya sonucu bekleniyor. Önce mevcut siparişi inceleyin; tekrar ödeme/gönderim yapılmadı.');}
 invalidate(){this.generation++;for(const item of this.items.values()){if(['approved','review'].includes(item.status)){item.status='review';delete item.reviewId;delete item.expiresAt;this.persist(item);}else if(pending.has(item.status)){item.status='uncertain';item.effectReply='unknown';this.persist(item);}}}
 async review({taskId,items,total,address,payment,submitUid}){
  this.check();const generation=this.generation;if(!taskId||typeof taskId!=='string'||!Array.isArray(items)||!items.length||items.length>40)throw fail('Görev ve görünür sepet özeti gerekiyor.');const summary={items:items.map(v=>publicText(v,300)),total:publicText(total,100),address:publicText(address),payment:publicText(payment,150)};
  const view=await this.observe();this.check(generation);const target=boundTarget(view?.target);if(!view?.target?.profileTrusted||!target.profileKey||!target.connectionId||!Number.isInteger(target.pageId)||!/^https?:\/\//.test(target.origin||''))throw fail('Sipariş için güncel güvenilir profil/sekme gerekiyor.');
  if([...summary.items,summary.total,summary.address,summary.payment].some(value=>!visibleFact(view.snapshot,value)))throw fail('Sepet, tutar, adres veya ödeme etiketi sayfada doğrulanamadı. Yeniden incele.');
  const line=view.snapshot.split('\n').find(l=>l.includes('uid='+submitUid+' '));if(!line||!/(?:button|link)\b/.test(line)||/\bdisabled\b/.test(line))throw fail('Son gönderim düğmesi güncel ve kullanılabilir değil.');
  if([...this.items.values()].some(i=>pending.has(i.status)))throw fail('Önceki siparişin sonucu belirsiz. Sipariş geçmişinden kontrol et; yeni gönderim yapılmadı.');
  // A new review supersedes only unsent reviews; no pending attempt is discarded.
  for(const i of this.items.values())if(['review','approved'].includes(i.status)){i.status='cancelled';delete i.reviewId;this.persist(i);}
  const item={id:randomUUID(),taskId,target,summary,button:canonical(line),buttonKey:controlKey(line),snapshotHash:digest(view.snapshot),reviewId:randomUUID(),expiresAt:this.now()+180000,createdAt:this.now(),status:'review'};this.items.set(item.id,item);this.baselines.set(item.id,new Set(staticTexts(view.snapshot).map(digest)));this.persist(item);return structuredClone(item);
 }
 confirm({id,taskId,reviewId,accepted}){this.check();const item=this.items.get(id);if(!item||item.taskId!==taskId||item.status!=='review'||!reviewId||item.reviewId!==reviewId||this.now()>=item.expiresAt)throw fail('Sipariş teyidi eskidi; güncel özetle yeniden teyit gerekiyor.');if(typeof accepted!=='boolean')throw fail('Yerel sipariş teyidi gerekiyor.');item.status=accepted?'approved':'cancelled';delete item.reviewId;this.persist(item);return structuredClone(item);}
 async submit({id,taskId},effect){
  this.check();const item=this.items.get(id),generation=this.generation;if(!item||item.taskId!==taskId||item.status!=='approved'||this.now()>=item.expiresAt||this.flights.has(id))throw fail('Bu sipariş için güncel yerel teyit yok veya gönderim zaten denendi.');this.flights.add(id);
  try{const view=await this.observe();this.check(generation);if(item.status!=='approved')throw fail('Sipariş teyidi iptal edildi veya yenilendi.');const line=view?.snapshot?.split('\n').find(l=>canonical(l)===item.button),submitUid=line?.match(/uid=(\S+)/)?.[1];if(!sameTarget(item.target,view?.target)||digest(view?.snapshot)!==item.snapshotHash||!submitUid||this.now()>=item.expiresAt){item.status='review';delete item.expiresAt;this.persist(item);throw fail('Site, sepet veya tutar değişti. Güncel özet yeniden teyit edilmeli.');}
   item.status='submitting';item.attemptId=randomUUID();item.attemptedAt=this.now();delete item.expiresAt;this.persist(item);
   // The durable intent is written synchronously BEFORE the only mutating call.
   // A successful click is not a receipt. Both lost and normal replies need readback.
   try{await effect({target:structuredClone(item.target),submitUid});if(generation===this.generation)item.effectReply='received';}catch{if(generation===this.generation)item.effectReply='lost';throw fail('Gönderim sonucu alınamadı; işlem uygulanmış olabilir. Site ve banka/cüzdan geçmişini yerelde kontrol et; tekrar ödeme yapmadım.');}finally{if(generation===this.generation){item.status='uncertain';this.persist(item);}}
   this.check(generation);return this.get(id);
  }finally{this.flights.delete(id);}
 }
 async verify({id,receipt,reference}){
  const generation=this.generation,item=this.items.get(id);this.check();if(!item||item.status!=='uncertain'||this.flights.has(id)||item.effectReply!=='received'||!this.baselines.has(id))throw fail('Gönderim yanıtı kayıp veya önceki oturuma ait. Site ve banka/cüzdan geçmişini kullanıcı yerelde incelemeli; model beyanıyla kilit açılmaz.');
  receipt=publicText(receipt,500);reference=publicText(reference,100);if(receipt.length<12||reference.length<4||!/\p{N}/u.test(reference)||!/^[\p{L}\p{N}#_:/-]+$/u.test(reference)||!receipt.includes(reference))throw fail('Görünür yeni sipariş sonucu ve içindeki sipariş referansı gerekiyor.');
  const view=await this.observe();this.check(generation);if(item.status!=='uncertain'||!sameTarget(item.target,view?.target)||!staticTexts(view.snapshot).includes(receipt)||this.baselines.get(id).has(digest(receipt)))throw fail('Yeni sipariş sonucu bu profil ve sekmede görülemedi. Eski sepet/adres metni sonuç değildir; tekrar ödeme yapılmadı.');
  item.status='verified';item.evidenceKind='new-page-result-with-reference';item.financialSettlementVerified=false;item.receipt=receipt;item.reference=reference;item.verifiedAt=this.now();this.persist(item);return this.get(id);
 }
 resolve({id,resolution}){this.check();const item=this.items.get(id);if(!item||this.flights.has(id)||!['review','approved','uncertain'].includes(item.status)||!['cancel-unsent','reviewed-externally'].includes(resolution)||resolution==='cancel-unsent'&&pending.has(item.status))throw fail('Sipariş önce incelenmeli; sürmekte olan gönderim çözülmüş veya iptal edilmiş sayılmaz.');item.status=resolution==='cancel-unsent'?'cancelled':'user-resolved';item.resolution=resolution;delete item.reviewId;delete item.expiresAt;this.persist(item);return this.get(id);}
}
module.exports={CheckoutFlow,sameTarget,controlKey};

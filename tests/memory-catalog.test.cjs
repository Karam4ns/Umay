'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createHash}=require('node:crypto');
const {LocalMemory}=require('../src/local-memory.cjs');
const {MemoryCatalog}=require('../src/memory-catalog.cjs');
const OWNER=createHash('sha256').update('test-alice').digest('hex');
function setup(t,{account='test-alice',device='test-device-a',directory}={}){
 const root=directory||fs.mkdtempSync(path.join(os.tmpdir(),'umay-catalog-'));
 const memory=new LocalMemory(root);memory.activate(account);
 const catalog=new MemoryCatalog({memory,deviceId:device,now:()=> '2026-11-07T10:00:00.000Z'});catalog.activate();
 t.after(()=>{memory.close();if(!directory)fs.rmSync(root,{recursive:true,force:true});});
 return {memory,catalog,root};
}
const note=(extra={})=>({key:'profile.name',type:'profile',title:'Adı',fields:{name:'Deniz'},content:'Kullanıcının adı Deniz.',source:{kind:'chat',id:'test-message'},...extra});
function event(base,revision,parents,extra={}){
 const {heads,conflict,alternatives,syncPending,pending,...record}=base;
 return {...record,revision,parents,deviceId:'test-device-b',...extra};
}
test('extensible sourced types persist in the account LocalMemory database',t=>{
 const {catalog,memory}=setup(t);
 for(const type of ['profile','preference','address','contact','device','file','account','payment','custom:bahçe']){
  const record=catalog.upsert(note({key:type,type}));assert.equal(record.type,type);assert.equal(record.owner,OWNER);
  assert.equal(record.source.id,'test-message');assert.equal(record.revision,record.heads[0]);assert.deepEqual(record.parents,[]);
 }
 assert.equal(catalog.list().length,9);assert.equal(memory.require().prepare('SELECT count(*) AS n FROM memory_catalog').get().n,9);
 memory.close();memory.activate('test-alice');catalog.activate();assert.equal(catalog.list().length,9);
});
test('canonical keys keep stable ids and require the current revision on updates',t=>{
 const {catalog}=setup(t);const first=catalog.upsert(note());
 assert.throws(()=>catalog.upsert(note({content:'Yeni bilgi'})),{code:'REVISION_CONFLICT'});
 const next=catalog.upsert(note({content:'Yeni bilgi',source:{kind:'chat',id:'correction'},expectedRevision:first.revision}));
 assert.equal(next.id,first.id);assert.deepEqual(next.parents,[first.revision]);assert.equal(next.source.id,'correction');
 assert.throws(()=>catalog.upsert(note({id:first.id,expectedRevision:first.revision})),{code:'REVISION_CONFLICT'});
 assert.equal(catalog.list().length,1);assert.equal(catalog.get(first.id).content,'Yeni bilgi');
});
test('account changes revoke old catalogs and owner labels cannot cross accounts',t=>{
 const {catalog,memory}=setup(t);const first=catalog.upsert(note());
 memory.activate('test-bob');assert.throws(()=>catalog.get(first.id),{code:'ACCOUNT_CHANGED'});
 catalog.activate();assert.deepEqual(catalog.list(),[]);assert.throws(()=>catalog.ingest(event(first,'foreign',[])),{code:'WRONG_OWNER'});
 const bob=catalog.upsert(note());assert.notEqual(bob.id,first.id);assert.notEqual(bob.owner,first.owner);
 memory.activate('test-alice');catalog.activate();assert.equal(catalog.get(first.id).content,first.content);
 memory.close();assert.throws(()=>catalog.changes(),{code:'ACCOUNT_CHANGED'});
});
test('two devices sharing SQLite serialize revision checks and keys',t=>{
 const {catalog,root}=setup(t);const {catalog:other,memory:otherMemory}=setup(t,{directory:root,device:'test-device-b'});
 try{
  const initial=catalog.upsert(note());assert.equal(other.get(initial.id).revision,initial.revision);
  const changed=other.upsert(note({content:'Diğer cihaz',expectedRevision:initial.revision}));
  assert.throws(()=>catalog.upsert(note({content:'Eski cihaz',expectedRevision:initial.revision})),{code:'REVISION_CONFLICT'});
  assert.equal(catalog.get(initial.id).revision,changed.revision);
 }finally{otherMemory.close();}
});
test('different parallel events expose both heads and resolve only with the full CAS token',t=>{
 const {catalog}=setup(t);const root=catalog.upsert(note());
 const local=catalog.upsert(note({content:'Birinci düzeltme',expectedRevision:root.revision}));
 const remote=event(root,'remote-edit',[root.revision],{content:'İkinci düzeltme',updatedAt:'2099-01-01T00:00:00.000Z'});
 const conflict=catalog.ingest(remote);assert.equal(conflict.conflict,true);assert.equal(conflict.content,'');
 assert.deepEqual(conflict.heads,[local.revision,'remote-edit'].sort());assert.notEqual(conflict.revision,local.revision);
 assert.deepEqual(conflict.alternatives.map(x=>x.content).sort(),['Birinci düzeltme','İkinci düzeltme']);
 assert.throws(()=>catalog.upsert(note({expectedRevision:local.revision})),{code:'REVISION_CONFLICT'});
 assert.deepEqual(catalog.context('düzeltme'),[]);
 const merged=catalog.upsert(note({content:'Uzlaşılmış bilgi',expectedRevision:conflict.revision}));
 assert.deepEqual(merged.parents,conflict.heads);assert.equal(merged.conflict,false);assert.equal(merged.heads.length,1);
});
test('semantically equal parallel events retain lineage without duplicating a record or conflict',t=>{
 const {catalog}=setup(t);const root=catalog.upsert(note());
 const local=catalog.upsert(note({content:'Aynı yeni bilgi',expectedRevision:root.revision}));
 const equal=event(local,'equal-edit',[root.revision],{source:{kind:'chat',id:'another-source'},updatedAt:'1990-01-01T00:00:00.000Z'});
 const result=catalog.ingest(equal);assert.equal(result.conflict,false);assert.equal(catalog.list().length,1);
 assert.equal(result.heads.length,2);assert.equal(result.content,'Aynı yeni bilgi');assert.notEqual(result.revision,local.revision);
 const updated=catalog.upsert(note({content:'Devam',expectedRevision:result.revision}));assert.deepEqual(updated.parents,result.heads);
});
test('immutable event replay is idempotent and never rewrites its source or content',t=>{
 const {catalog}=setup(t);const first=catalog.upsert(note());const original=catalog.changes()[0];
 catalog.ack(original.revision);catalog.ingest(original);assert.equal(catalog.get(first.id).revision,first.revision);assert.equal(catalog.changes().length,0);
 assert.throws(()=>catalog.ingest({...original,content:'Değiştirilmiş'}),{code:'IMMUTABLE_EVENT'});
 assert.throws(()=>catalog.ingest({...original,source:{kind:'model'}}),{code:'IMMUTABLE_EVENT'});
 assert.equal(catalog.get(first.id).source.id,'test-message');
});
test('orphan events stay pending behind verified data and activate when all ancestors arrive',t=>{
 const {catalog}=setup(t);const root=catalog.upsert(note());
 const child=event(root,'child',['missing-parent'],{content:'Henüz doğrulanmamış'});
 const pending=catalog.ingest(child);assert.equal(pending.syncPending,true);assert.equal(pending.content,root.content);
 assert.equal(pending.revision,root.revision);assert.equal(catalog.context('doğrulanmamış').length,0);
 const parent=event(root,'missing-parent',[root.revision],{content:'Ara düzeltme'});
 const final=catalog.ingest(parent);assert.equal(final.syncPending,false);assert.equal(final.revision,'child');assert.equal(final.content,'Henüz doğrulanmamış');
});
test('pending-only records are inspectable but never active or model context',t=>{
 const {catalog}=setup(t);const orphan=event(note({id:'orphan',owner:OWNER,key:'orphan',secretRef:null,deleted:false}),'orphan-event',['unknown'],{updatedAt:'2026-11-07T10:00:00.000Z'});
 const result=catalog.ingest(orphan);assert.equal(result.syncPending,true);assert.equal(result.revision,null);assert.deepEqual(result.heads,[]);
 assert.equal(catalog.list().length,0);assert.equal(catalog.context('Deniz').length,0);assert.equal(catalog.get('orphan').pending.length,1);
});
test('self, cyclic and known cross-record parents are rejected without changing verified data',t=>{
 const {catalog}=setup(t);const a=catalog.upsert(note()),b=catalog.upsert(note({key:'other'}));
 assert.throws(()=>catalog.ingest(event(a,'self',['self'])),{code:'INVALID_LINEAGE'});
 assert.throws(()=>catalog.ingest(event(a,'cross',[b.revision])),{code:'INVALID_LINEAGE'});
 catalog.ingest(event(a,'cycle-a',['cycle-b']));
 assert.throws(()=>catalog.ingest(event(a,'cycle-b',['cycle-a'])),{code:'INVALID_LINEAGE'});
 assert.equal(catalog.get(a.id).revision,a.revision);
});
test('deleted records cannot resurrect from old events, descendants or old pending outbox',t=>{
 const {catalog}=setup(t);const first=catalog.upsert(note());const old=catalog.changes()[0];
 const deleted=catalog.archive(first.id,first.revision);assert.equal(deleted.deleted,true);assert.equal(catalog.list().length,0);
 assert.equal(catalog.archive(first.id,deleted.revision).revision,deleted.revision);
 catalog.ingest(old);catalog.ingest(event(first,'old-device',[first.revision],{content:'Eski cihaz bilgisi'}));
 const latest=catalog.ingest(event(first,'resurrection',[deleted.heads[0]],{content:'Yeniden diriltme'}));
 assert.equal(latest.deleted,true);assert.equal(catalog.list().length,0);assert.equal(catalog.context('Deniz').length,0);
 assert.throws(()=>catalog.upsert(note({id:first.id,expectedRevision:latest.revision})),{code:'RECORD_ARCHIVED'});
 assert.ok(catalog.changes().every(x=>x.deleted));assert.equal(catalog.list({includeArchived:true}).length,1);
});
test('Obsidian edits create new sourced events with current CAS and queue them atomically',t=>{
 const {catalog}=setup(t);const first=catalog.upsert(note());catalog.ack(first.revision);
 const edited=catalog.ingest({...first,content:'Elle düzeltilmiş'}, {path:'entities/test.md',parentRevision:first.revision});
 assert.notEqual(edited.revision,first.revision);assert.deepEqual(edited.parents,[first.revision]);
 assert.deepEqual(edited.source,{kind:'obsidian',path:'entities/test.md'});assert.equal(catalog.changes()[0].revision,edited.revision);
 assert.throws(()=>catalog.ingest({...first,content:'Eski dosya'}, {path:'entities/test.md',parentRevision:first.revision}),{code:'REVISION_CONFLICT'});
});
test('record, event and outbox writes roll back together on an outbox failure',t=>{
 const {catalog,memory}=setup(t);const first=catalog.upsert(note());catalog.ack(first.revision);
 memory.require().exec("CREATE TRIGGER reject_catalog_outbox BEFORE INSERT ON memory_catalog_outbox BEGIN SELECT RAISE(ABORT,'synthetic outbox failure'); END");
 assert.throws(()=>catalog.upsert(note({content:'Kaybolmamalı',expectedRevision:first.revision})),/synthetic outbox failure/);
 assert.equal(catalog.get(first.id).revision,first.revision);assert.equal(catalog.changes().length,0);
 assert.equal(memory.require().prepare('SELECT count(*) AS n FROM memory_catalog_events').get().n,1);
});
test('search filters precede deterministic pagination and archived records stay out by default',t=>{
 const {catalog}=setup(t);for(let i=0;i<8;i++)catalog.upsert(note({key:'entry'+i,title:'Şehir '+i,content:i%2?'İzmir kahve':'Ankara',type:i%2?'preference':'address'}));
 const result=catalog.list({query:'izmir',type:'preference',limit:2,offset:1});assert.equal(result.length,2);
 const all=catalog.list({query:'izmir',type:'preference'});assert.deepEqual(result.map(x=>x.id),all.slice(1,3).map(x=>x.id));
 catalog.archive(all[0].id,all[0].revision);assert.equal(catalog.list({query:'izmir'}).length,3);assert.equal(catalog.list({query:'izmir',includeArchived:true}).length,4);
 assert.equal(catalog.list({limit:0}).length,0);assert.throws(()=>catalog.list({offset:-1}),{code:'INVALID_ARGUMENT'});
});
test('context is relevant, bounded, detached data with an explicit no-authority reminder',t=>{
 const {catalog}=setup(t);for(let i=0;i<14;i++)catalog.upsert(note({key:'tea'+i,content:'Çay tercihi '+i}));
 catalog.upsert(note({key:'unrelated',content:'Uzay teleskobu'}));
 assert.deepEqual(catalog.context(''),[]);const result=catalog.context('çay');assert.equal(result.length,8);
 assert.ok(result.every(x=>x.content.startsWith('Çay')&&x.usage.includes('yetki')));
 result[0].fields.name='Değiştirme';assert.equal(catalog.get(result[0].id).fields.name,'Deniz');
});
test('typed secret references and masked metadata persist without resolving secret storage',t=>{
 const {catalog}=setup(t);const record=catalog.upsert(note({type:'account',fields:{username:'test-user',password:'••••',last4:'4321'},secretRef:{id:'vault-test-id',type:'credential',version:'vault-version'}}));
 assert.deepEqual(record.secretRef,{id:'vault-test-id',type:'credential',version:'vault-version'});
 for(const result of [catalog.get(record.id),catalog.list(),catalog.changes(),catalog.context('Deniz')])assert.doesNotMatch(JSON.stringify(result),/test-only-plain-secret/);
});
test('plaintext private keys, passwords, OTP and full cards are refused across public surfaces',t=>{
 const {catalog,memory}=setup(t);
 const unsafe=[{fields:{password:'test-only-plain-secret'}},{fields:{nested:{OTP:'123456'}}},{content:'Parola: test-only-plain-secret'},{title:'OTP = 123456'},
  {fields:{privateKey:'-----BEGIN PRIVATE KEY-----test'}},{source:{kind:'chat',password:'test-only-plain-secret'}},{content:'Kart 4111 1111 1111 1111'},
  {secretRef:{id:'id',type:'credential',value:'test-only-plain-secret'}},{secretRef:'password-record'}, {fields:{token:'test-only-plain-secret'}},
  {fields:{'Parola Değeri':'test-only-plain-secret'}},{fields:{'one_time_password':'123456'}}];
 for(const extra of unsafe)assert.throws(()=>catalog.upsert(note(extra)),{code:'UNSAFE_PUBLIC_DATA'});
 assert.equal(catalog.list().length,0);assert.equal(catalog.changes().length,0);
 assert.equal(memory.require().prepare('SELECT count(*) AS n FROM memory_catalog_events').get().n,0);
});
test('ingest validates public data before storing remote events or file edits',t=>{
 const {catalog}=setup(t);const first=catalog.upsert(note());
 assert.throws(()=>catalog.ingest(event(first,'unsafe',[first.revision],{fields:{password:'test-only-plain-secret'}})),{code:'UNSAFE_PUBLIC_DATA'});
 assert.throws(()=>catalog.ingest({...first,content:'OTP: 123456'},{path:'test.md',parentRevision:first.revision}),{code:'UNSAFE_PUBLIC_DATA'});
 assert.equal(catalog.get(first.id).revision,first.revision);
});
test('canonical keys cannot silently rename or alias another immutable record id',t=>{
 const {catalog}=setup(t);const first=catalog.upsert(note());
 assert.throws(()=>catalog.upsert(note({id:first.id,key:'renamed',expectedRevision:first.revision})),{code:'KEY_CONFLICT'});
 assert.throws(()=>catalog.ingest(event(first,'alias',[],{id:'different-record'})),{code:'KEY_CONFLICT'});
 assert.equal(catalog.list().length,1);
});
test('context excludes pending content and bounds large public fields and source metadata',t=>{
 const {catalog}=setup(t);const first=catalog.upsert(note({fields:{name:'Deniz',description:'x'.repeat(14000)},source:{kind:'chat',id:'message',details:'y'.repeat(14000)}}));
 catalog.ingest(event(first,'pending-sensitive-context',['missing'],{content:'Henüz doğrulanmamış olay'}));
 const result=catalog.context('Deniz');assert.equal(result.length,1);
 assert.doesNotMatch(JSON.stringify(result),/Henüz doğrulanmamış olay|pending-sensitive-context/);
 assert.ok(Buffer.byteLength(JSON.stringify(result))<5000);assert.equal(result[0].fieldsOmitted,true);
});
test('canonical metadata cannot carry plaintext secrets outside ordinary body fields',t=>{
 const {catalog}=setup(t);
 assert.throws(()=>catalog.upsert(note({key:'password: test-only-plain-secret'})),{code:'UNSAFE_PUBLIC_DATA'});
 assert.equal(catalog.list().length,0);
});
test('numeric runs inside generated UUID lineage are identifiers, not payment data',t=>{
 const {catalog}=setup(t);const root=catalog.upsert(note());
 const revision='12345678-1234-1234-1234-123456789012';
 const imported=catalog.ingest(event(root,revision,[root.revision]));
 assert.equal(imported.revision,revision);
});

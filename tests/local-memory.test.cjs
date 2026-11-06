const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {LocalMemory,factsFrom}=require('../src/local-memory.cjs');
function memory(options={}){return new LocalMemory(fs.mkdtempSync(path.join(os.tmpdir(),'umay-local-memory-')),options);}
test('procedural learning survives restart, isolates accounts and never becomes a verified fact by model assertion',()=>{
 const store=memory();store.activate('alice');
 const task={id:'experience',epoch:store.epoch,goal:'Tarayıcıda site aç',createdAt:Date.now(),status:'completed',userAuthorization:[{approved:true}],steps:[{action:'type',text:'secret-payload',characters:14,target:{title:'Browser',name:'Address',automationId:'url',type:'ControlType.Edit'},outcome:'field_matches_input',replace:true,submit:true,x:10,y:20}]};
 store.saveComputerExperience(task);store.close();store.activate('alice');
 const found=store.computerExperience('site aç');assert.equal(found.length,1);assert.equal(found[0].completion,'model_reported');assert.equal(found[0].steps[0].outcome,'field_matches_input');
 assert.doesNotMatch(JSON.stringify(found),/secret-payload|approved|"x":|"y":/);assert.equal(store.context('site aç').profile.length,0);
 store.activate('bob');assert.deepEqual(store.computerExperience('site aç'),[]);assert.throws(()=>store.saveComputerExperience(task),/Hesap değişti/);store.close();
});
test('chat survives remote deletion, restart and searches Turkish word prefixes',()=>{
 const store=memory();store.activate('alice');
 store.archiveConversation({id:'chat',title:'Kahve'},[{id:'m1',role:'user',content:'Adım Kazım. Kahveyi seviyorum.'},{id:'m2',role:'assistant',content:'Tercihini hatırlayacağım.'}]);
 store.markRemoteDeleted('chat');assert.equal(store.search('kahve')[0].id,'m1');assert.equal(store.snapshot().conversations[0].remote_deleted,1);
 store.close();store.activate('alice');assert.equal(store.conversation('chat').length,2);assert.ok(store.context('beni tanıyor musun').profile.some(p=>p.content==='Kazım'));store.close();
});
test('accounts stay isolated and logout immediately closes access',()=>{
 const store=memory();store.activate('alice');store.putNode({title:'Tercih',content:'Mavi',kind:'preference'});store.activate('bob');assert.equal(store.snapshot().nodes.length,0);store.activate('alice');assert.equal(store.snapshot().nodes.length,1);store.activate(null);assert.throws(()=>store.snapshot(),/giriş/);
});
test('updated decisions preserve their previous versions and wiki links',()=>{
 const store=memory();store.activate('alice');const first=store.putNode({title:'Adı',content:'Kazım',key:'name',kind:'profile'});const second=store.putNode({title:'Adı',content:'Kemal',key:'name',kind:'profile'});
 assert.notEqual(first,second);assert.equal(store.snapshot().nodes.length,1);assert.equal(store.db.prepare('SELECT active FROM nodes WHERE id=?').get(first).active,0);
 store.putNode({title:'Proje',content:'[[Adı]] için Umay',tags:['Umay']});assert.ok(store.snapshot().links.some(l=>l.target===second));store.close();
});
test('successful outgoing draft adopts the server message without duplicate facts',()=>{
 const store=memory();store.activate('alice');store.outgoing('chat','request','Çayı seviyorum.','submitted');store.archiveConversation({id:'chat',title:'Sohbet'},[{id:'server-id',role:'user',content:'Çayı seviyorum.',createdAt:new Date().toISOString()}]);assert.equal(store.conversation('chat').length,1);assert.equal(store.conversation('chat')[0].id,'server-id');assert.equal(store.snapshot().nodes.filter(n=>n.kind==='preference').length,1);store.close();
});
test('private accounts are encrypted, excluded from context and cannot cross an account change',async()=>{
 const encrypt=async value=>Buffer.from('encrypted:'+Buffer.from(value).toString('base64')),decrypt=async value=>Buffer.from(value.toString().slice(10),'base64').toString();
 const store=memory({encrypt,decrypt});store.activate('alice');await store.savePrivate({service:'Mail',username:'alice@example.test',password:'very-private-value'});
 assert.doesNotMatch(store.db.prepare('SELECT encrypted FROM private_accounts').get().encrypted.toString(),/very-private/);assert.doesNotMatch(JSON.stringify(store.context('Mail')),/alice@example|very-private/);assert.equal((await store.privateAccounts())[0].service,'Mail');
 let finish;store.encrypt=()=>new Promise(resolve=>finish=resolve);const pending=store.savePrivate({service:'Stale',password:'secret'});store.activate('bob');finish(Buffer.from('encrypted'));await assert.rejects(pending,/Hesap değişti/);assert.equal(store.snapshot().counts.privateAccounts,0);store.close();
});
test('file memory stores paths, marks missing files and never reads contents',async()=>{
 const store=memory();store.activate('alice');const root=fs.mkdtempSync(path.join(os.tmpdir(),'umay-index-')),file=path.join(root,'bilgi.txt');fs.writeFileSync(file,'PRIVATE CONTENT MUST NOT BE INGESTED');
 await store.indexFiles([root]);assert.equal(store.findFiles('bilgi')[0].path,file);assert.doesNotMatch(JSON.stringify(store.context('PRIVATE')),/MUST NOT/);
 fs.unlinkSync(file);await new Promise(r=>setTimeout(r,2));await store.indexFiles([root]);assert.equal(store.findFiles('bilgi')[0].present,0);store.close();
});
test('account switch during root validation cannot write old roots into the new account',async()=>{
 const store=memory();store.activate('alice');const real=fs.promises.stat;let release;fs.promises.stat=()=>new Promise(r=>release=r);
 try{const pending=store.indexFiles(['C:/AlicePrivate']);store.activate('bob');release({isDirectory:()=>true});await assert.rejects(pending,/Hesap değişti/);assert.deepEqual(store.setting('indexRoots',[]),[]);}finally{fs.promises.stat=real;store.close();}
});
test('ordinary notes and device notes are recalled with provenance for matching questions',()=>{
 const store=memory();store.activate('a');store.putNode({title:'Araba',content:'Otopark kodu 7241'});store.putNode({title:'Proje',content:'Umay dosyaları C:/Umay',kind:'device'});assert.match(JSON.stringify(store.context('Otopark kodu nedir?')),/7241/);assert.match(JSON.stringify(store.context('Umay dosyaları nerede?')),/C:\/Umay/);store.close();
});
test('quoted translation and example text cannot replace the actual user name',()=>{
 const store=memory();store.activate('a');store.archiveConversation({id:'c'},[{id:'m',role:'user',content:'Adım Kazım.'},{id:'m2',role:'user',content:'Şu cümleyi İngilizceye çevir: "Adım Berk. İstanbul’da yaşıyorum."'}]);const context=JSON.stringify(store.context('adım'));assert.ok(store.snapshot().nodes.filter(n=>n.kind==='profile').every(n=>n.content==='Kazım'));store.close();
});

test('automatic recall skips computer task archives before limiting matches but preserves their search records',()=>{
 const store=memory();store.activate('a');
 store.archiveConversation({id:'chat',title:'Klasör tercihim'},[{id:'human',role:'user',content:'Klasör adlarında Türkçe karakterleri tercih ediyorum.'},{id:'computer:task:1',role:'assistant',content:'Klasör masaüstünde oluşturuldu.'}]);
 for(let i=0;i<8;i++)store.archiveConversation({id:'machine'+i,title:i%2?'Umay bilgisayar görevi: Klasör oluştur':'Klasör oluştur',...(i%2?{}:{localSource:'computer'})},[{id:'machine-message'+i,role:'assistant',content:'Klasör'}]);
 const recalled=store.context('Klasör').messages;
 assert.equal(recalled.length,2);assert.ok(recalled.some(m=>m.text==='Klasör masaüstünde oluşturuldu.'));
 assert.ok(recalled.some(m=>m.text==='Klasör adlarında Türkçe karakterleri tercih ediyorum.'));
 assert.equal(store.search('Klasör',30).length,10);assert.equal(store.conversation('machine1').length,1);store.close();
});

test('automatic recall excludes raw computer protocol in renamed chats while retaining ordinary JSON',()=>{
 const store=memory();store.activate('a');
 const prompt=JSON.stringify({originalUserRequest:'Klasör oluştur',proposedGoal:'Klasör oluştur',observation:{title:'Klasör',elements:[]},step:1});
 store.archiveConversation({id:'renamed',title:'Eski sohbet'},[{id:'prompt',role:'user',content:prompt},{id:'action',role:'assistant',content:'```json\n{"action":"done","message":"Klasör oluşturuldu."}\n```'}]);
 store.archiveConversation({id:'ordinary',title:'JSON örneğim'},[{id:'json',role:'user',content:'{"Klasör":"Belgeler","action":"review"}'}]);
 assert.deepEqual(store.context('Klasör').messages.map(m=>m.text),['{"Klasör":"Belgeler","action":"review"}']);
 assert.equal(store.search('Klasör').length,3);store.close();
});

test('machine prompts and task goals cannot become preferences and historical machine facts stay out of context',()=>{
 const store=memory();store.activate('a');
 const prompt=JSON.stringify({originalUserRequest:'Şunu yaz: "Kahveyi seviyorum."',observation:{elements:[]}});
 assert.deepEqual(factsFrom(prompt),[]);
 store.archiveConversation({id:'computer',title:'Umay bilgisayar görevi: Metni yaz'},[{id:'machine-user',role:'user',content:'Çayı seviyorum.'}]);
 assert.equal(store.snapshot().nodes.filter(n=>n.kind==='preference').length,0);
 store.putNode({kind:'preference',title:'Eski yanlış tercih',content:'Kahveyi seviyorum.',sourceMessage:'machine-user'});
 store.archiveConversation({id:'chat',title:'Tercihler'},[{id:'human',role:'user',content:'Bitki çayını seviyorum.'}]);
 assert.deepEqual(store.context('tercihler').profile.map(n=>n.content),['Bitki çayını seviyorum']);
 assert.equal(store.snapshot().nodes.filter(n=>n.kind==='preference').length,2);store.close();
});

const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {DeviceServices}=require('../src/device-services.cjs');
function fixture(api){return new DeviceServices({directory:fs.mkdtempSync(path.join(os.tmpdir(),'umay-devices-test-')),api,screen:{},capture:async()=>[],native:{request:async()=>({}),close(){}},background:false});}
test('a delayed foreground summary cannot cross an account switch',async()=>{
 const service=fixture(async()=>({}));service.activate('old');service.control.enable(true);let finish;
 service.control.native.request=async()=>new Promise(resolve=>finish=resolve);const pending=service.prepareContext('Sıradaki bölüme geç');service.activate('new');finish({handle:1,title:'Previous user app'});
 await assert.rejects(pending,/Hesap değişti/);assert.equal(service.computerSession.context().foreground,null);service.close();
});
test('local context travels separately and archived chat survives site deletion',async()=>{
 const requests=[];const services=fixture(async(route,body)=>{requests.push({route,body});if(route.endsWith('/messages'))return {run:{id:'run'}};return {conversation:{id:'a',title:'Merhaba'},messages:[{id:'server-user',role:'user',content:'Kahveyi seviyorum.'},{id:'assistant',role:'assistant',content:'Hatırladım.'}]};});
 services.activate('alice');const body={content:'Kahveyi seviyorum.',requestId:'request'};await services.siteApi('/site/chat/conversations/a/messages',body);assert.equal(requests[0].body.content,body.content);assert.match(requests[0].body.desktopContext,/clock/);assert.equal(body.desktopContext,undefined);
 await services.siteApi('/site/chat/conversations/a');services.memory.markRemoteDeleted('a');assert.ok(services.memory.search('kahve').length);services.close();
});
test('context-unaware server cannot silently turn an action request into ordinary chat',async()=>{
 const calls=[];const service=fixture(async(route,body)=>{calls.push(body);if(body.desktopContext)throw Error('INVALID_REQUEST');return {run:{id:'run'}};});service.activate('a');
 await assert.rejects(service.siteApi('/site/chat/conversations/c/messages',{content:'Masaüstüne klasör oluştur',requestId:'r'}),/DESKTOP_CAPABILITY_UNAVAILABLE/);assert.equal(calls.length,1);assert.equal(service.memory.conversation('c')[0].status,'failed');service.close();
});
test('logout during weather lookup never sends former user data to the next account',async()=>{
 let resolve;const calls=[];const service=fixture(async(...args)=>{calls.push(args);return {run:{id:'r'}};});service.activate('old');service.memory.putNode({kind:'profile',title:'Adı',content:'Old name'});service.environment.weather=()=>new Promise(r=>resolve=r);
 const sending=service.siteApi('/site/chat/conversations/c/messages',{content:'hava nasıl?',requestId:'r'});await new Promise(r=>setImmediate(r));service.activate('new');resolve({temperature:20});await assert.rejects(sending,/Hesap değişti/);assert.equal(calls.length,0);assert.equal(service.memory.snapshot().counts.messages,0);service.close();
});
test('central history sync follows all cursor pages and captures central memory separately',async()=>{
 const calls=[];const service=fixture(async route=>{calls.push(route);if(route==='/site/chat/conversations')return {conversations:[{id:'c',title:'Sohbet'}]};if(route==='/site/user-memory')return {summary:'Merkezi bilgi'};const old=route.includes('before');return {conversation:{id:'c',title:'Sohbet'},messages:[{id:old?'old':'new',role:'assistant',content:old?'Eski mesaj':'Yeni mesaj'}],hasMoreMessages:!old,nextBeforeId:old?null:'new'};});
 service.activate('a');await service.syncHistory(service.memory.epoch);assert.equal(service.memory.conversation('c').length,2);assert.ok(calls.includes('/site/chat/conversations/c?before=new'));assert.ok(service.memory.snapshot().nodes.some(n=>n.kind==='remote'));service.close();
});
const roleModels=[{id:'same',source:'PERSONAL',name:'Sohbet',categories:['chat']},{id:'same',source:'SUBSCRIPTION',name:'Gören model',categories:['vision']}];
test('model roles persist per account and distinguish sources with equal model ids',async()=>{
 const service=fixture(async()=>({models:roleModels}));service.activate('alice');
 await service.modelRoles('save',{chat:{id:'same',source:'PERSONAL'},computer:{id:'same',source:'SUBSCRIPTION'}});
 assert.equal((await service.modelRoles('resolve',{role:'computer'})).source,'SUBSCRIPTION');
 service.activate('bob');assert.equal((await service.modelRoles('state')).roles.computer,null);
 service.activate('alice');assert.equal((await service.modelRoles('state')).roles.chat.source,'PERSONAL');
 service.close();
});
test('removed role assignment fails clearly rather than silently spending on another model',async()=>{
 let available=roleModels;const service=fixture(async()=>({models:available}));service.activate('alice');
 await service.modelRoles('save',{computer:{id:'same',source:'SUBSCRIPTION'}});available=roleModels.slice(0,1);
 await assert.rejects(service.modelRoles('resolve',{role:'computer'}),/atanan.*erişilemiyor/i);
 await assert.rejects(service.modelRoles('save',{chat:{id:'no',source:'PERSONAL'}}),/erişilemiyor/i);service.close();
});
test('computer entry always uses assigned role and account change cancels pending role save',async()=>{
 const service=fixture(async()=>({models:roleModels}));service.activate('alice');
 await service.modelRoles('save',{computer:{id:'same',source:'SUBSCRIPTION'}});service.agent.run=async(_goal,model)=>model;
 assert.equal((await service.computer('run',{goal:'Görev',modelId:'same',source:'PERSONAL'})).source,'SUBSCRIPTION');
 let finish;service.api=()=>new Promise(r=>finish=r);const saving=service.modelRoles('save',{chat:{id:'same',source:'PERSONAL'}});
 service.activate('bob');finish({models:roleModels});await assert.rejects(saving,/Hesap değişti/);assert.equal(service.memory.setting('modelRoles'),null);service.close();
});
test('account switch and repeated logout clean up computer controls after native input drains',async()=>{
 const service=fixture(async()=>({models:roleModels}));service.activate('alice');await new Promise(r=>setImmediate(r));
 let release,finished=0;const drained=new Promise(r=>release=r);service.control.stop=()=>drained;service.agent.onFinish=()=>finished++;
 service.agent.task={id:'task',status:'running',sequence:service.agent.sequence,epoch:service.memory.epoch,steps:[]};
 service.activate('bob');service.activate(null);assert.equal(finished,0);release();await new Promise(r=>setImmediate(r));assert.equal(finished,1);service.close();
});
test('administrator grant requires a paused task and is invalidated by account change',async()=>{
 const service=fixture(async()=>({models:roleModels}));service.activate('alice');let grants=0,finish;
 service.control.native.elevate=async()=>{grants++;return new Promise(r=>finish=r);};
 await assert.rejects(service.computer('elevate',{id:'unknown'}),/izni|izin/i);assert.equal(grants,0);
 service.control.enable(true);service.agent.task={id:'task',status:'permission',sequence:service.agent.sequence,epoch:service.memory.epoch,steps:[]};
 const granting=service.computer('elevate',{id:'task'});await new Promise(r=>setImmediate(r));service.activate('bob');finish({administrator:true});await assert.rejects(granting,/Hesap değişti|durduruldu/);assert.equal(service.agent.task,null);service.close();
});
test('chat advertises computer capability without changing the actual user text',async()=>{
 let posted;const service=fixture(async(_route,body)=>{posted=body;return {run:{id:'run'}};});service.activate('alice');await service.siteApi('/site/chat/conversations/c/messages',{content:'Not Defteri’ni aç',requestId:'r'});assert.equal(posted.content,'Not Defteri’ni aç');assert.equal(JSON.parse(posted.desktopContext).capabilities.computerControl,true);service.close();
});
test('chat dispatch uses its assigned computer model once and binds the original conversation',async()=>{
 const run={id:'run',conversationId:'chat',createdAt:new Date().toISOString(),status:'COMPLETED',mediaOptions:{desktopChatTask:{version:1,goal:'Not Defteri’ni aç',acknowledgement:'Açıyorum.',userRequest:'Not Defteri’ni aç',anchorMessageId:'ack'}}};const service=fixture(async route=>route==='/site/chat/models'?{models:roleModels}:{run});service.activate('alice');await service.modelRoles('save',{computer:{id:'same',source:'SUBSCRIPTION'}});let executed=0;
 service.agent.run=async(goal,model,origin)=>{executed++;assert.equal(model.source,'SUBSCRIPTION');assert.equal(origin.conversationId,'chat');assert.match(goal,/Not Defteri/);return {id:'task',status:'completed',message:'Açıldı.'};};
 const result=await service.computer('dispatch',{runId:'run',conversationId:'chat'});assert.equal(result.status,'completed');assert.equal(service.control.enabled,true);await assert.rejects(service.computer('dispatch',{runId:'run',conversationId:'chat'}),/çalıştırıldı|başlatıldı/);assert.equal(executed,1);service.close();
});
test('unrelated or stale runs cannot start native computer input',async()=>{
 const run={id:'r',conversationId:'other',createdAt:new Date().toISOString(),status:'COMPLETED',mediaOptions:{desktopChatTask:{version:1,goal:'Yaz',acknowledgement:'Başlıyorum.',userRequest:'Yaz',anchorMessageId:'ack'}}};const service=fixture(async()=>({run,models:roleModels}));service.activate('alice');let executed=0;service.agent.run=async()=>executed++;
 await assert.rejects(service.computer('dispatch',{runId:'r',conversationId:'chat'}),/sohbet|görev/);run.conversationId='chat';run.createdAt='2020-01-01';await assert.rejects(service.computer('dispatch',{runId:'r',conversationId:'chat'}),/güncel|eski/);assert.equal(executed,0);service.close();
});
test('computer questions, user replies and results remain in the original local chat history',async()=>{
 const service=fixture(async()=>({conversation:{id:'chat',title:'Planım'},messages:[{id:'user',role:'user',content:'Planımı kaydet',createdAt:'2026-01-01T00:00:00Z'}]}));service.activate('alice');service.memory.archiveConversation({id:'chat',title:'Planım'});service.control.enable(true);
 service.agent.task={id:'task',status:'question',message:'Hangi klasöre?',goal:'Planımı kaydet',origin:{conversationId:'chat'},sequence:service.agent.sequence,epoch:service.memory.epoch,steps:[]};service.agent.emit();service.agent.resume=async()=>{service.agent.task.status='completed';service.agent.task.message='Belgeler klasörüne kaydedildi.';service.agent.emit();return service.agent.state();};
 await service.computer('resume',{id:'task',answer:'Belgeler',userReply:'Belgeler'});const detail=await service.siteApi('/site/chat/conversations/chat');assert.deepEqual(detail.messages.slice(-3).map(m=>m.content),['Hangi klasöre?','Belgeler','Belgeler klasörüne kaydedildi.']);service.close();
});
test('computer history follows its server acknowledgement instead of a skewed device clock',async()=>{
 const messages=[{id:'ack',role:'assistant',content:'Açıyorum.',createdAt:'2020-01-01T00:00:00Z'},{id:'next-user',role:'user',content:'selam',createdAt:'2020-01-01T00:01:00Z'},{id:'next-answer',role:'assistant',content:'Merhaba.',createdAt:'2020-01-01T00:01:01Z'}];const service=fixture(async()=>({conversation:{id:'chat',title:'Sohbet'},messages}));service.activate('alice');service.memory.archiveConversation({id:'chat',title:'Sohbet'},[messages[0]]);
 service.agent.task={id:'old',origin:{conversationId:'chat',anchorMessageId:'ack'},goal:'Raporu aç',status:'completed',message:'Rapor açıldı.',steps:[],epoch:service.memory.epoch};service.agent.emit();const result=await service.siteApi('/site/chat/conversations/chat');assert.deepEqual(result.messages.map(m=>m.content),['Açıyorum.','Rapor açıldı.','selam','Merhaba.']);service.close();
});
test('an inferred computer goal without an original user request is rejected',async()=>{
 const run={id:'r',conversationId:'c',createdAt:new Date().toISOString(),status:'COMPLETED',mediaOptions:{desktopChatTask:{version:1,goal:'Raporu aç ve dosyaları sil',acknowledgement:'Başlıyorum.',anchorMessageId:'ack'}}};const service=fixture(async()=>({run,models:roleModels}));service.activate('alice');let executed=0;service.agent.run=async()=>executed++;
 await assert.rejects(service.computer('dispatch',{runId:'r',conversationId:'c'}),/kullanıcı isteği|doğrulanmış/i);assert.equal(executed,0);service.close();
});

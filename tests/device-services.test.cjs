const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {DeviceServices}=require('../src/device-services.cjs');
function fixture(api){return new DeviceServices({directory:fs.mkdtempSync(path.join(os.tmpdir(),'umay-devices-test-')),api,screen:{},capture:async()=>[],native:{request:async()=>({}),close(){}},background:false});}
test('local context travels separately and archived chat survives site deletion',async()=>{
 const requests=[];const services=fixture(async(route,body)=>{requests.push({route,body});if(route.endsWith('/messages'))return {run:{id:'run'}};return {conversation:{id:'a',title:'Merhaba'},messages:[{id:'server-user',role:'user',content:'Kahveyi seviyorum.'},{id:'assistant',role:'assistant',content:'Hatırladım.'}]};});
 services.activate('alice');const body={content:'Kahveyi seviyorum.',requestId:'request'};await services.siteApi('/site/chat/conversations/a/messages',body);assert.equal(requests[0].body.content,body.content);assert.match(requests[0].body.desktopContext,/clock/);assert.equal(body.desktopContext,undefined);
 await services.siteApi('/site/chat/conversations/a');services.memory.markRemoteDeleted('a');assert.ok(services.memory.search('kahve').length);services.close();
});
test('context-unaware server receives one compatible retry without losing message',async()=>{
 const calls=[];const service=fixture(async(route,body)=>{calls.push(body);if(body.desktopContext)throw Error('INVALID_REQUEST');return {run:{id:'run'}};});service.activate('a');
 await service.siteApi('/site/chat/conversations/c/messages',{content:'selam',requestId:'r'});assert.equal(calls.length,2);assert.equal(service.bridgeSupported,false);assert.equal(service.memory.conversation('c').length,1);service.close();
});
test('logout during weather lookup never sends former user data to the next account',async()=>{
 let resolve;const calls=[];const service=fixture(async(...args)=>{calls.push(args);return {run:{id:'r'}};});service.activate('old');service.memory.putNode({kind:'profile',title:'Adı',content:'Old name'});service.environment.weather=()=>new Promise(r=>resolve=r);
 const sending=service.siteApi('/site/chat/conversations/c/messages',{content:'hava nasıl?',requestId:'r'});await new Promise(r=>setImmediate(r));service.activate('new');resolve({temperature:20});await assert.rejects(sending,/Hesap değişti/);assert.equal(calls.length,0);assert.equal(service.memory.snapshot().counts.messages,0);service.close();
});
test('central history sync follows all cursor pages and captures central memory separately',async()=>{
 const calls=[];const service=fixture(async route=>{calls.push(route);if(route==='/site/chat/conversations')return {conversations:[{id:'c',title:'Sohbet'}]};if(route==='/site/user-memory')return {summary:'Merkezi bilgi'};const old=route.includes('before');return {conversation:{id:'c',title:'Sohbet'},messages:[{id:old?'old':'new',role:'assistant',content:old?'Eski mesaj':'Yeni mesaj'}],hasMoreMessages:!old,nextBeforeId:old?null:'new'};});
 service.activate('a');await service.syncHistory(service.memory.epoch);assert.equal(service.memory.conversation('c').length,2);assert.ok(calls.includes('/site/chat/conversations/c?before=new'));assert.ok(service.memory.snapshot().nodes.some(n=>n.kind==='remote'));service.close();
});

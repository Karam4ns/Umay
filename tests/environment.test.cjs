const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {LocalMemory}=require('../src/local-memory.cjs');
const {EnvironmentService,parseFeed,SOURCES}=require('../src/environment-service.cjs');
const {publicAddress,validatePublicUrl}=require('../src/public-http.cjs');
const xml=(date='2026-11-05T09:00:00Z')=>`<feed xmlns="http://www.w3.org/2005/Atom" xmlns:georss="http://www.georss.org/georss"><entry><id>earthquake1</id><title>M 5.0 - Istanbul</title><updated>${date}</updated><link href="https://earthquake.usgs.gov/test"/><georss:point>41.1 29.2</georss:point><summary>Deprem bilgisi</summary></entry></feed>`;
function setup(http){const memory=new LocalMemory(fs.mkdtempSync(path.join(os.tmpdir(),'umay-env-test-')));memory.activate('a');let now=Date.parse('2026-11-05T09:05:00Z');const notices=[];const service=new EnvironmentService({memory,http,now:()=>now,notify:n=>notices.push(n)});return {memory,service,notices,setNow:value=>now=value};}
test('Atom, RSS and official AFAD inputs keep correct location, timestamp and identity',()=>{
 const atom=parseFeed(xml(),SOURCES.find(s=>s.id==='usgs'))[0];assert.equal(atom.latitude,41.1);assert.equal(atom.magnitude,5);assert.equal(atom.url,'https://earthquake.usgs.gov/test');
 const rss=parseFeed('<rss><channel><item><guid>x</guid><title>Sel uyarısı</title><link>https://example.com/x</link><pubDate>Thu, 05 Nov 2026 09:00:00 GMT</pubDate><description>&lt;b&gt;Uyarı&lt;/b&gt;</description></item></channel></rss>',{id:'x',name:'Kaynak',kind:'news'})[0];assert.equal(rss.title,'Sel uyarısı');assert.doesNotMatch(rss.summary,/<b>/);
 const afad=parseFeed(JSON.stringify([{eventID:1,date:'2026-11-05T12:00:00',latitude:'41',longitude:'29',magnitude:'4.8',location:'Marmara',type:'ML',depth:'10'}]),SOURCES[0])[0];assert.equal(afad.publishedAt,'2026-11-05T09:00:00.000Z');assert.throws(()=>parseFeed('<!DOCTYPE rss><rss/>',SOURCES[0]));
});
test('one recent relevant earthquake notifies once, even after restarting service',async()=>{
 const {service,memory,notices}=setup({get:async()=>({status:200,text:xml(),headers:new Headers()})});service.sources=()=>[SOURCES.find(s=>s.id==='usgs')];service.setLocation({latitude:41,longitude:29,label:'İstanbul'});
 await service.poll({force:true});await service.poll({force:true});assert.equal(notices.length,1);assert.equal(service.state().alerts.length,1);
 const next=new EnvironmentService({memory,http:service.http,now:service.now,notify:n=>notices.push(n)});next.sources=service.sources;await next.poll({force:true});assert.equal(notices.length,1);memory.close();
});
test('old events and unrelated regions are retained without notification storms',async()=>{
 const {service,memory,notices}=setup({get:async()=>({status:200,text:xml('2026-11-04T09:00:00Z'),headers:new Headers()})});service.sources=()=>[SOURCES[1]];await service.poll({force:true});assert.equal(notices.length,0);assert.equal(service.state().alerts.length,1);memory.close();
});
test('forecast caches by coordinates and marks fallback stale when network fails',async()=>{
 let calls=0,broken=false;const response={properties:{meta:{updated_at:'2026-11-05T08:00:00Z'},timeseries:[{time:'2026-11-05T09:00:00Z',data:{instant:{details:{air_temperature:16,wind_speed:4,relative_humidity:60}},next_1_hours:{summary:{symbol_code:'rain'},details:{precipitation_amount:.4}}}}]}};
 const {service,memory,setNow}=setup({get:async()=>{calls++;if(broken)throw Error('offline');return {status:200,text:JSON.stringify(response),headers:new Headers({'expires':'Thu, 05 Nov 2026 09:35:00 GMT'})};}});service.setLocation({latitude:41,longitude:29,label:'İstanbul'});assert.equal((await service.weather()).temperature,16);await service.weather();assert.equal(calls,1);broken=true;setNow(Date.parse('2026-11-05T10:00:00Z'));assert.equal((await service.weather()).stale,true);service.setLocation({latitude:39,longitude:32,label:'Ankara'});await assert.rejects(service.weather(),/offline/);memory.close();
});
test('feed completion after account switch cannot store or notify into another account',async()=>{
 let finish;const {service,memory,notices}=setup({get:()=>new Promise(resolve=>finish=resolve)});service.sources=()=>[SOURCES[1]];const check=service.poll({force:true});memory.activate('b');finish({status:200,text:xml(),headers:new Headers()});await assert.rejects(check,/Hesap değişti/);assert.equal(service.state().alerts.length,0);assert.equal(notices.length,0);memory.close();
});
test('private networks, credentials and mixed public/private DNS results are rejected',async()=>{
 for(const address of ['127.0.0.1','192.168.1.1','169.254.169.254','::1','::ffff:127.0.0.1'])assert.equal(publicAddress(address),false);
 for(const address of ['ff02::1','2001:db8::1','192.0.0.1','not-an-ip'])assert.equal(publicAddress(address),false);
 assert.equal(publicAddress('8.8.8.8'),true);await assert.rejects(validatePublicUrl('https://a.example',async()=>[{address:'1.1.1.1'},{address:'10.0.0.1'}]));await assert.rejects(validatePublicUrl('https://user:pass@a.example'));await assert.rejects(validatePublicUrl('http://a.example'));
});

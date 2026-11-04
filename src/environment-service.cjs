'use strict';
const {XMLParser}=require('fast-xml-parser');
const {createHash}=require('node:crypto');
const {PublicHttp}=require('./public-http.cjs');
const SOURCES=[
 {id:'afad',name:'AFAD Son Depremler',kind:'earthquake',format:'afad',url:'https://deprem.afad.gov.tr/apiv2/event/filter?last=100',interval:60000},
 {id:'usgs',name:'USGS Deprem',kind:'earthquake',url:'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.atom',interval:60000},
 {id:'aa',name:'Anadolu Ajansı — Güncel',kind:'news',url:'https://www.aa.com.tr/tr/rss/default?cat=guncel',interval:300000},
 {id:'ogm',name:'Orman Genel Müdürlüğü',kind:'disaster',url:'https://www.ogm.gov.tr/tr/haber-sitesi/_layouts/15/listfeed.aspx?List=%7B2B7C95DD-2EE4-45AF-8C0E-248300D5EB7D%7D&Source=https%3A%2F%2Fwww.ogm.gov.tr%2Ftr%2Fhaber-sitesi%2FPages%2FForms%2FAllItems.aspx',interval:300000},
];
const array=value=>value==null?[]:Array.isArray(value)?value:[value];
const plain=value=>String(typeof value==='object'?value?.['#text']||'':value||'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
function distanceKm(a,b){const rad=d=>d*Math.PI/180,x=rad(b.latitude-a.latitude),y=rad(b.longitude-a.longitude),n=Math.sin(x/2)**2+Math.cos(rad(a.latitude))*Math.cos(rad(b.latitude))*Math.sin(y/2)**2;return 6371*2*Math.atan2(Math.sqrt(n),Math.sqrt(1-n));}
function parseFeed(xml,source){
 if(source.format==='afad')return array(JSON.parse(xml)).slice(0,200).map(row=>({id:createHash('sha256').update('afad:'+row.eventID).digest('hex'),source:source.name,sourceId:source.id,title:'M '+row.magnitude+' — '+row.location,summary:row.type+' '+row.magnitude+', derinlik '+row.depth+' km — '+row.location,url:'https://deprem.afad.gov.tr/last-earthquakes.html',publishedAt:new Date(row.date+(/[zZ]|[+-]\d{2}:\d{2}$/.test(row.date)?'':'+03:00')).toISOString(),kind:'earthquake',magnitude:Number(row.magnitude),latitude:Number(row.latitude),longitude:Number(row.longitude)}));
 if(/<!DOCTYPE|<!ENTITY/i.test(xml))throw Error('Kaynağın XML biçimi desteklenmiyor.');
 const parsed=new XMLParser({ignoreAttributes:false,removeNSPrefix:true,parseTagValue:false,processEntities:false}).parse(xml),items=parsed.rss?.channel?.item??parsed.feed?.entry;
 if(items===undefined)throw Error('Kaynak geçerli bir RSS veya Atom akışı değil.');
 return array(items).slice(0,200).map(item=>{
  const link=typeof item.link==='string'?item.link:array(item.link).find(l=>l['@_rel']==='alternate')?.['@_href']||array(item.link)[0]?.['@_href']||'',title=plain(item.title).slice(0,300),summary=plain(item.description||item.summary||item.content).slice(0,1000);
  const date=new Date(plain(item.pubDate||item.updated||item.published)),point=plain(item.point).split(/\s+/).map(Number),magnitude=source.kind==='earthquake'?Number(title.match(/\bM\s*([\d.]+)/i)?.[1]):null;
  return {id:createHash('sha256').update(source.id+'\0'+plain(item.guid||item.id||link||title)).digest('hex'),source:source.name,sourceId:source.id,title,summary,url:/^https?:\/\//i.test(link)?link:'',publishedAt:Number.isFinite(+date)?date.toISOString():null,kind:source.kind,magnitude,latitude:point.length===2&&Number.isFinite(point[0])?point[0]:null,longitude:point.length===2&&Number.isFinite(point[1])?point[1]:null};
 }).filter(item=>item.title&&item.publishedAt);
}
class EnvironmentService{
 constructor({memory,http=new PublicHttp(),locate,notify=()=>{},publish=()=>{},now=()=>Date.now()}={}){Object.assign(this,{memory,http,locate,notify,publish,now});this.timer=null;this.pending=false;this.cache=new Map();this.sourceState=new Map();this.controller=null;}
 clock(){return {iso:new Date(this.now()).toISOString(),local:new Date(this.now()).toLocaleString('tr-TR'),timezone:Intl.DateTimeFormat().resolvedOptions().timeZone};}
 state(){return {clock:this.clock(),location:this.memory.setting('location'),weather:this.memory.setting('weatherCache'),alerts:this.memory.require().prepare('SELECT * FROM alerts ORDER BY published_at DESC LIMIT 100').all(),sources:this.sources().map(s=>({...s,...this.sourceState.get(s.id)})),settings:this.memory.setting('environmentSettings',{enabled:true,earthquakeMagnitude:4.5,radiusKm:500,keywords:['deprem','afet','yangın','sel','fırtına','heyelan','tahliye']})};}
 sources(){return [...SOURCES,...this.memory.setting('customFeeds',[])];}
 start(){this.stop();this.cache.clear();this.sourceState.clear();if(!this.memory.account)return;this.controller=new AbortController();this.timer=setInterval(()=>void this.poll().catch(()=>{}),60000);this.timer.unref?.();void this.poll().catch(()=>{});}
 stop(){clearInterval(this.timer);this.timer=null;this.controller?.abort();this.controller=null;}
 async detectLocation(){const epoch=this.memory.epoch,previous=JSON.stringify(this.memory.setting('location')),position=await this.locate();this.memory.check(epoch);const current=this.memory.setting('location');if(JSON.stringify(current)!==previous)return current;return this.setLocation({...position,source:'device',updatedAt:this.clock().iso});}
 setLocation(position){const latitude=Number(position.latitude),longitude=Number(position.longitude);if(!Number.isFinite(latitude)||latitude< -90||latitude>90||!Number.isFinite(longitude)||longitude< -180||longitude>180)throw Error('Konum koordinatları geçersiz.');const location={latitude,longitude,label:String(position.label||'Cihaz konumu').slice(0,180),source:position.source||'manual',updatedAt:this.clock().iso};this.memory.setSetting('location',location);this.memory.log('location','Konum güncellendi',{details:{source:location.source}});return location;}
 async searchCity(query){
  const name=String(query||'').trim();if(name.length<2||name.length>120)throw Error('Şehir veya ilçe adını yazın.');
  const key='city:'+name.toLocaleLowerCase('tr');if(this.cache.has(key))return this.cache.get(key);
  const epoch=this.memory.epoch,url='https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&accept-language=tr&q='+encodeURIComponent(name),r=await this.http.get(url);this.memory.check(epoch);
  const result=JSON.parse(r.text).map(row=>({label:row.display_name,latitude:Number(row.lat),longitude:Number(row.lon),source:'manual'}));this.cache.set(key,result);return result;
 }
 async weather({force=false}={}){
  const location=this.memory.setting('location');if(!location)throw Error('Hava durumu için cihaz konumunu açın veya şehir seçin.');const epoch=this.memory.epoch,key=location.latitude.toFixed(3)+','+location.longitude.toFixed(3),cached=this.memory.setting('weatherCache');
  if(!force&&cached?.locationKey===key&&this.now()<Date.parse(cached.validUntil))return cached;
  try{
   const r=await this.http.get('https://api.met.no/weatherapi/locationforecast/2.0/compact?lat='+location.latitude.toFixed(4)+'&lon='+location.longitude.toFixed(4),{headers:cached?.locationKey===key&&cached.modified?{'If-Modified-Since':cached.modified}:{},signal:this.controller?.signal});this.memory.check(epoch);
   const expiry=Date.parse(r.headers.get('expires')),validUntil=new Date(Math.max(this.now()+600000,Number.isFinite(expiry)?expiry:0)).toISOString();
   if(r.status===304&&cached){const result={...cached,validUntil,stale:false};this.memory.setSetting('weatherCache',result);return result;}
   const json=JSON.parse(r.text),points=json.properties?.timeseries;if(!Array.isArray(points)||!points.length)throw Error('Hava durumu yanıtı eksik.');
   const point=points.find(p=>Date.parse(p.time)>=this.now()-3600000)||points.at(-1),details=point.data.instant.details;
   const result={locationKey:key,location:location.label,latitude:location.latitude,longitude:location.longitude,temperature:details.air_temperature,humidity:details.relative_humidity,windSpeed:details.wind_speed,pressure:details.air_pressure_at_sea_level,symbol:point.data.next_1_hours?.summary?.symbol_code||point.data.next_6_hours?.summary?.symbol_code,precipitation:point.data.next_1_hours?.details?.precipitation_amount,forecastTime:point.time,updatedAt:json.properties.meta?.updated_at,fetchedAt:this.clock().iso,validUntil,modified:r.headers.get('last-modified'),source:'MET Norway',url:'https://www.met.no/en/free-meteorological-data/Licensing-and-crediting',stale:false};
   this.memory.setSetting('weatherCache',result);return result;
  }catch(error){this.memory.check(epoch);if(cached?.locationKey===key&&this.now()-Date.parse(cached.fetchedAt)<86400000)return {...cached,stale:true,error:'Güncel veri alınamadı; son kayıt gösteriliyor.'};throw error;}
 }
 important(item,settings,location){
  if(item.kind==='earthquake'){if(!Number.isFinite(item.magnitude)||item.magnitude<settings.earthquakeMagnitude)return false;if(location&&item.latitude!=null)return distanceKm(location,item)<=settings.radiusKm||item.magnitude>=6.5;return item.magnitude>=6.5||item.latitude>=35&&item.latitude<=43&&item.longitude>=25&&item.longitude<=46;}
  const text=(item.title+' '+item.summary).toLocaleLowerCase('tr');return settings.keywords.some(k=>text.includes(k.toLocaleLowerCase('tr')));
 }
 async poll({force=false}={}){
  if(this.pending||!this.memory.account)return;this.pending=true;const epoch=this.memory.epoch;
  try{
   const settings=this.state().settings;if(!settings.enabled)return;const location=this.memory.setting('location');
   const results=await Promise.allSettled(this.sources().map(async source=>{
    const previous=this.sourceState.get(source.id);if(!force&&previous?.checkedAt&&this.now()-Date.parse(previous.checkedAt)<source.interval)return;
    try{
     const r=await this.http.get(source.url,{headers:{...(previous?.etag?{'If-None-Match':previous.etag}:{}),...(previous?.modified?{'If-Modified-Since':previous.modified}:{})},signal:this.controller?.signal});this.memory.check(epoch);
     if(r.status===304){this.sourceState.set(source.id,{...previous,checkedAt:this.clock().iso,status:'ok',error:null});return;}
     const items=parseFeed(r.text,source),db=this.memory.require();let sent=0;
     for(const item of items){
      const isNew=db.prepare('INSERT OR IGNORE INTO alerts VALUES(?,?,?,?,?,?,?,0,0)').run(item.id,item.source,item.title,item.summary,item.url,item.publishedAt,this.clock().iso).changes;
      const recent=this.now()-Date.parse(item.publishedAt),previousQuakes=this.memory.setting('notifiedQuakes',[]).filter(q=>this.now()-q.time<86400000),duplicate=item.kind==='earthquake'&&previousQuakes.some(q=>Math.abs(q.time-Date.parse(item.publishedAt))<120000&&Math.abs(q.magnitude-item.magnitude)<.8&&distanceKm(q,item)<60);
      if(isNew&&!duplicate&&recent>=-60000&&recent<=20*60000&&sent<3&&this.important(item,settings,location)){
       this.notify({title:item.source+' — '+item.title,body:item.summary||'Ayrıntıları görmek için Umay bildirimlerini açın.',url:item.url});db.prepare('UPDATE alerts SET notified=1 WHERE id=?').run(item.id);sent++;this.memory.log('notification',item.title,{details:{source:item.source,url:item.url}});
       if(item.kind==='earthquake'&&item.latitude!=null)this.memory.setSetting('notifiedQuakes',[...previousQuakes,{time:Date.parse(item.publishedAt),magnitude:item.magnitude,latitude:item.latitude,longitude:item.longitude}].slice(-1000));
      }
     }
     this.sourceState.set(source.id,{checkedAt:this.clock().iso,status:'ok',etag:r.headers.get('etag'),modified:r.headers.get('last-modified'),error:null});
    }catch(error){if(epoch===this.memory.epoch)this.sourceState.set(source.id,{checkedAt:this.clock().iso,status:'error',error:String(error.message).slice(0,300)});}
   }));this.memory.check(epoch);this.publish({event:'environment-updated',state:this.state()});
   for(const result of results)if(result.status==='rejected')throw result.reason;
  }finally{this.pending=false;}
 }
 saveSettings(input){const magnitude=Number(input.earthquakeMagnitude),radius=Number(input.radiusKm);if(!Number.isFinite(magnitude)||magnitude<2||magnitude>9||!Number.isFinite(radius)||radius<25||radius>3000)throw Error('Deprem büyüklüğü veya uzaklık aralığı geçersiz.');return this.memory.setSetting('environmentSettings',{enabled:!!input.enabled,earthquakeMagnitude:magnitude,radiusKm:radius,keywords:array(input.keywords).map(k=>String(k).trim().slice(0,60)).filter(Boolean).slice(0,30)});}
 async addFeed(input){const epoch=this.memory.epoch;await this.http.get(input.url,{maxBytes:2_000_000}).then(r=>parseFeed(r.text,{id:'check',name:'check',kind:'news'}));this.memory.check(epoch);const sources=this.memory.setting('customFeeds',[]);if(sources.length>=10)throw Error('En fazla 10 özel kaynak eklenebilir.');const source={id:createHash('sha256').update(input.url).digest('hex').slice(0,16),name:String(input.name||'RSS kaynağı').slice(0,120),url:input.url,kind:'news',interval:300000};if(!sources.some(s=>s.id===source.id))sources.push(source);this.memory.setSetting('customFeeds',sources);return source;}
 context(query){return {clock:this.clock(),location:this.memory.setting('location'),weather:this.memory.setting('weatherCache'),alerts:/deprem|afet|uyarı|yangın|haber|önemli|gündem/i.test(query)?this.state().alerts.slice(0,8):[]};}
}
module.exports={EnvironmentService,SOURCES,parseFeed,distanceKm};

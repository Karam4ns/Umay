'use strict';
const dns=require('node:dns').promises;
const {isIP}=require('node:net'),https=require('node:https'),{Readable}=require('node:stream');
function publicAddress(address){
 const version=isIP(address),lower=address.toLowerCase();if(version===6)return /^[23]/.test(lower)&&!lower.startsWith('2001:db8:');if(version!==4)return false;
 const n=address.split('.').map(Number);return !([0,10,127].includes(n[0])||n[0]>=224||n[0]===169&&n[1]===254||n[0]===172&&n[1]>=16&&n[1]<=31||n[0]===192&&[0,2,168].includes(n[1])||n[0]===100&&n[1]>=64&&n[1]<=127||n[0]===198&&[18,19,51].includes(n[1])||n[0]===203&&n[1]===0&&n[2]===113);
}
function pinnedFetch(url,options,addresses){return new Promise((resolve,reject)=>{const request=https.get(url,{headers:options.headers,signal:options.signal,lookup:(_host,lookupOptions,done)=>{const selected=addresses.filter(a=>!lookupOptions.family||a.family===lookupOptions.family);if(!selected.length)return done(Error('Kaynak adres ailesi kullanılamıyor.'));done(null,lookupOptions.all?selected:selected[0].address,...(lookupOptions.all?[]:[selected[0].family]));}},response=>{const headers=new Headers();for(const [name,value]of Object.entries(response.headers))if(value!==undefined)headers.set(name,Array.isArray(value)?value.join(', '):value);resolve(new Response([204,304].includes(response.statusCode)?null:Readable.toWeb(response),{status:response.statusCode,headers}));if([204,304].includes(response.statusCode))response.resume();});request.on('error',reject);});}
async function validatePublicUrl(input,lookup=dns.lookup){const url=new URL(input);if(url.protocol!=='https:'||url.username||url.password||url.port&&url.port!=='443')throw Error('Kaynak adresi herkese açık bir HTTPS adresi olmalı.');const records=await lookup(url.hostname,{all:true});if(!records.length||records.some(r=>!publicAddress(r.address)))throw Error('Yerel veya özel ağ adresleri kaynak olarak kullanılamaz.');return url;}
class PublicHttp{
 constructor({fetchImpl=pinnedFetch,lookup=dns.lookup,agent='Umay/0.4.2 (https://umay.veriussu.com)'}={}){this.fetch=fetchImpl;this.lookup=lookup;this.agent=agent;}
 async get(input,{headers={},signal,maxBytes=2_000_000}={}){
  let url=input;
  for(let redirects=0;redirects<4;redirects++){
   const addresses=await this.lookup(new URL(url).hostname,{all:true}),checked=await validatePublicUrl(url,async()=>addresses),response=await this.fetch(checked,{headers:{'User-Agent':this.agent,Accept:'application/json, application/rss+xml, application/atom+xml, text/xml, text/html;q=0.8',...headers},redirect:'manual',signal:signal?AbortSignal.any([signal,AbortSignal.timeout(12000)]):AbortSignal.timeout(12000)},addresses);
   if(response.status>=300&&response.status<400&&response.status!==304){const next=response.headers.get('location');await response.body?.cancel();if(!next)throw Error('Kaynak yönlendirmesi geçersiz.');url=new URL(next,checked).href;continue;}
   if(response.status===304)return {status:304,headers:response.headers,text:'',url:checked.href};
   if(!response.ok)throw Error('Kaynağa erişilemiyor (HTTP '+response.status+').');
   if(Number(response.headers.get('content-length'))>maxBytes){await response.body?.cancel();throw Error('Kaynak yanıtı boyut sınırını aşıyor.');}
   const reader=response.body.getReader(),pieces=[];let length=0;
   while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>maxBytes){await reader.cancel();throw Error('Kaynak yanıtı boyut sınırını aşıyor.');}pieces.push(Buffer.from(value));}
   return {status:response.status,headers:response.headers,text:Buffer.concat(pieces).toString('utf8'),url:checked.href};
  }
  throw Error('Kaynak çok fazla yönlendirme yaptı.');
 }
}
module.exports={PublicHttp,validatePublicUrl,publicAddress};

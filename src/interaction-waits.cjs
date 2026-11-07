'use strict';
const {randomUUID}=require('node:crypto');
const same=(a,b)=>!!a&&!!b&&a.origin===b.origin&&a.profileKey===b.profileKey&&a.connectionId===b.connectionId&&a.pageId===b.pageId;
class InteractionWaits{
 constructor({now=()=>Date.now()}={}){this.now=now;this.pending=null;this.generation=0;}
 wait({taskId,kind,target,expiresAt=this.now()+180000,question,checkout}){if(!['otp','address','shipping-confirm','payment-choice','checkout-review'].includes(kind)||!taskId||!target?.origin||!target?.profileKey||!target?.connectionId)throw Error('Bekleme hedefi doğrulanamadı.');this.cancel();this.pending={id:randomUUID(),taskId,kind,target:structuredClone(target),expiresAt,question,...(checkout?{checkout:structuredClone(checkout)}:{})};return this.state();}
 state(){return this.pending?structuredClone(this.pending):null;}
 async answer({taskId,waitId,value,target},consume){const p=this.pending,generation=this.generation;if(!p||!waitId||p.id!==waitId||p.taskId!==taskId||this.now()>=p.expiresAt||!same(p.target,target))throw Error('Bekleyen soru, alan, hesap veya süre değişti; yeniden doğrulama gerekiyor.');if(typeof value!=='string'||!value.trim()||value.length>4000||p.kind==='otp'&&!/^[\p{L}\p{N}\s-]{3,20}$/u.test(value))throw Error('Yanıt biçimi geçersiz.');this.pending=null;const check=()=>{if(generation!==this.generation||this.now()>=p.expiresAt)throw Error('Yanıt işlemi durduruldu veya süresi doldu.');};try{check();return await consume(value,p,check);}finally{value='';}}
 cancel(){this.generation++;this.pending=null;}
}
module.exports={InteractionWaits};

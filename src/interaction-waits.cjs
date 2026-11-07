'use strict';
const {randomUUID}=require('node:crypto');
const same=(a,b)=>a?.origin===b?.origin&&a?.profileKey===b?.profileKey&&a?.pageId===b?.pageId;
class InteractionWaits{
 constructor({now=()=>Date.now()}={}){this.now=now;this.pending=null;}
 wait({taskId,kind,target,expiresAt=this.now()+180000,question}){if(!['otp','address','shipping-confirm','payment-choice'].includes(kind)||!taskId||!target?.origin||!target?.profileKey)throw Error('Bekleme hedefi doğrulanamadı.');this.cancel();this.pending={id:randomUUID(),taskId,kind,target:structuredClone(target),expiresAt,question};return this.state();}
 state(){return this.pending?structuredClone(this.pending):null;}
 async answer({taskId,value,target},consume){const p=this.pending;if(!p||p.taskId!==taskId||this.now()>p.expiresAt||!same(p.target,target))throw Error('Bekleyen alan, hesap veya süre değişti; yeniden doğrulama gerekiyor.');if(typeof value!=='string'||!value.trim()||value.length>4000||p.kind==='otp'&&!/^[\p{L}\p{N}\s-]{3,20}$/u.test(value))throw Error('Yanıt biçimi geçersiz.');this.pending=null;try{return await consume(value,p);}finally{value='';}}
 cancel(){this.pending=null;}
}
module.exports={InteractionWaits};

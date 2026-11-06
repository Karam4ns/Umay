'use strict';
const path=require('node:path');
function systemArtifacts(value){const found=new Map();function walk(item,depth=0){if(!item||typeof item!=='object'||depth>5)return;if(Array.isArray(item)){for(const part of item.slice(0,25))walk(part,depth+1);return;}
 if(typeof item.path==='string'&&(path.isAbsolute(item.path)||path.win32.isAbsolute(item.path))){const artifact={kind:'file',path:item.path.slice(0,2000),...(item.type?{type:item.type}:{}),...(Number.isFinite(item.size)?{size:item.size}:{}),...(item.modifiedAt?{modifiedAt:item.modifiedAt}:{}),...(item.version?{version:item.version}:{}),...(item.effect?{effect:item.effect}:{}),...(item.trashed?{effect:'trashed'}:{})};found.set('file:'+artifact.path,artifact);}
 if(typeof item.appId==='string'&&typeof item.name==='string')found.set('app:'+item.appId,{kind:'application',appId:item.appId,name:item.name.slice(0,300),launched:item.launched===true,verificationRequired:!!item.verificationRequired});
 if(typeof item.jobId==='string')found.set('job:'+item.jobId,{kind:'process',jobId:item.jobId,state:item.state||item.status,exitCode:item.exitCode??null});
 for(const [key,part]of Object.entries(item))if(!/content|stdout|stderr|text|password|secret|token|args/i.test(key)&&typeof part==='object')walk(part,depth+1);
 }walk(value);return [...found.values()].slice(-20);}
module.exports={systemArtifacts};

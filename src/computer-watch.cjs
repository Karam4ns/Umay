'use strict';
const {createHash}=require('node:crypto');
const fold=text=>String(text||'').normalize('NFKD').replace(/\p{M}/gu,'').replace(/ı/g,'i').toLowerCase();
const content=view=>[view.title,...(view.elements||[]).map(e=>(e.name||'')+' '+(e.value||''))].join('\n');
const fingerprint=view=>createHash('sha256').update(content(view)).digest('hex');
async function watchWindow(action,initial,{read,check,now=()=>Date.now(),delay=ms=>new Promise(r=>setTimeout(r,ms))}){
 const duration=action.milliseconds??60000,interval=action.intervalMs??1000;
 if(!Number.isInteger(action.windowHandle)||action.windowHandle<=0||!Number.isInteger(duration)||duration<1||duration>600000||!Number.isInteger(interval)||interval<500||interval>5000||['contains','absent'].some(k=>action[k]!==undefined&&(typeof action[k]!=='string'||!action[k].trim()||action[k].length>500))||(['contains','absent'].filter(k=>action[k]!==undefined).length+(action.changed===true?1:0))!==1||action.changed!==undefined&&typeof action.changed!=='boolean')throw Object.assign(Error('Pencere izleme koşulu veya süresi geçersiz.'),{code:'PLANNER_INVALID'});
 const start=now(),deadline=start+duration,baseline=initial.handle===action.windowHandle?fingerprint(initial):null;let previous=baseline;
 while(true){
  check();let view;try{view=await read(action.windowHandle);}catch(error){check();if(error.code==='NATIVE_WINDOW_UNAVAILABLE')return {outcome:'closed',elapsedMs:now()-start};throw error;}check();
  const text=fold(content(view)),hash=fingerprint(view);previous??=hash;
  if(action.contains!==undefined&&text.includes(fold(action.contains))||action.absent!==undefined&&!text.includes(fold(action.absent)))return {outcome:'matched',elapsedMs:now()-start,title:view.title};
  if(action.contains===undefined&&action.absent===undefined&&hash!==previous)return {outcome:'changed',elapsedMs:now()-start,title:view.title};
  if(now()>=deadline)return {outcome:'timeout',elapsedMs:now()-start,title:view.title};
  const next=Math.min(deadline,now()+interval);while(now()<next){check();await delay(Math.min(100,next-now()));}check();
 }
}
module.exports={watchWindow};

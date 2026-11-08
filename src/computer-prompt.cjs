'use strict';
// Budget auxiliary context, never the live user's request or approvals. Work on
// a copy: shortening a model packet must not destroy the executor's real view.
function prepareComputerPrompt(input,{limit=11900}={}){
 const p=structuredClone(input),size=()=>JSON.stringify(p).length,over=()=>size()>limit;
 if(!over())return p;
 p.contextCompacted=true;
 const clip=(object,key,length)=>{if(typeof object?.[key]==='string'&&object[key].length>length){object[key]=object[key].slice(0,length);object[key+'Omitted']=true;}};
 if(p.session){
  for(const item of [p.session.task,p.session.previous]){clip(item,'goal',240);clip(item,'userRequest',400);clip(item,'message',160);if(item)delete item.steps;}
  if(p.session.browser){clip(p.session.browser,'summary',p.observation?.browser?0:600);p.session.browser.pages=p.session.browser.pages?.slice(0,3);}
  if(p.session.system){p.session.system.artifacts=p.session.system.artifacts?.slice(-2);p.session.system.roots=p.session.system.roots?.slice(0,2);}
  p.session.windows=p.session.windows?.slice(0,3);
 }
 const target=p.activeTarget?.target||p.activeTarget;
 if(target?.browser){clip(target.browser,'summary',p.observation?.browser?0:500);target.browser.pages=target.browser.pages?.slice(0,3);}
 clip(p.activeTarget?.summary,'text',300);
 if(p.resumeCheckpoint){const c=p.resumeCheckpoint;p.resumeCheckpoint={id:c.id,status:c.status,requiresFreshObservation:c.requiresFreshObservation,usage:c.usage,steps:c.steps?.slice(-4).map(s=>({action:s.action,toolName:s.toolName,outcome:s.outcome})),message:String(c.message||'').slice(0,250)};}
 if(p.watchContinuation?.result)clip(p.watchContinuation.result,'text',600);
 for(const evidence of p.crossExecutorEvidence||[]){clip(evidence.browser,'snapshot',700);clip(evidence.browser?.lastResult,'text',700);clip(evidence.system,'result',700);}
 while(over()&&p.experience?.length)p.experience.pop();
 const b=p.observation?.browser,s=p.observation?.system;
 // Paging offsets/total lengths stay present, so omitted results remain
 // accessible through browser_result/system_result rather than guessed.
 if(b){while(over()&&b.pages?.length>3)b.pages.pop();if(over())clip(b.lastResult,'text',500);}
 if(s){while(over()&&s.artifacts?.length>2){s.artifacts.shift();s.artifactsOmitted=(s.artifactsOmitted||0)+1;}if(over())clip(s,'result',700);}
 for(const engine of [p.capabilities?.browser,p.capabilities?.system]){
  if(over()&&engine?.tools)engine.tools=engine.tools.map(t=>({...t,description:undefined}));
  while(over()&&engine?.tools?.length>1){engine.tools.pop();engine.schemasOmitted=true;}
 }
 while(over()&&p.previousSteps?.length>2)p.previousSteps.shift();
 if(over())for(const step of p.previousSteps||[])clip(step,'summary',100);
 while(over()&&p.observation?.elements?.length>5)p.observation.elements.pop();
 while(over()&&p.observation?.windows?.length>1)p.observation.windows.pop();
 if(over()&&b){let n=b.snapshot?.length||0;while(over()&&n>700){n=Math.max(700,n-400);b.snapshot=b.snapshot.slice(0,n);const line=b.snapshot.lastIndexOf('\n');if(line>0)b.snapshot=b.snapshot.slice(0,line);b.snapshotTruncated=true;n=b.snapshot.length;}}
 for(const engine of [p.capabilities?.browser,p.capabilities?.system])if(over()&&engine?.tools?.length){engine.tools=[];engine.schemasOmitted=true;}
 if(over()){
  const requestLength=String(p.originalUserRequest||'').length;
  throw Object.assign(Error(requestLength>6000?'İsteğin tamamı güvenle işlenebilecek bağlamı aşıyor. Ayrıntıları koruyabilmem için isteği birkaç mesajda iletebilirsin.':'Bilgisayar görevinin iç bağlamı işlenemedi. Sıradaki işlem uygulanmadı; önceki adımların kaydı korunuyor.'),{code:requestLength>6000?'COMPUTER_REQUEST_TOO_LARGE':'COMPUTER_CONTEXT_TOO_LARGE'});
 }
 return p;
}
module.exports={prepareComputerPrompt};

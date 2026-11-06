'use strict';
const text=(value,limit)=>String(value||'').slice(0,limit);
class ComputerSession{
 constructor(){this.reset();}
 reset(){this.task=null;this.previous=null;this.foreground=null;this.windows=[];this.browser=null;}
 update(task){
  if(!task)return;if(this.task&&this.task.id!==task.id)this.previous={id:this.task.id,status:this.task.status,goal:this.task.goal,userRequest:this.task.userRequest,message:this.task.message};
  this.task={id:task.id,status:task.status,goal:text(task.goal,1000),userRequest:text(task.origin?.userRequest||task.goal,1500),message:text(task.message,700),steps:(task.steps||[]).slice(-6).map(s=>({action:s.action,summary:text(s.summary,180)}))};
 }
 observe(data){
  if(data?.browser){this.browser={pageId:data.browser.pageId,pages:data.browser.pages?.slice(0,6),observedAt:new Date().toISOString()};return;}
  if(!data)return;this.windows=(data.windows||[]).slice(0,8).map(w=>({handle:w.handle,title:text(w.title,160),minimized:!!w.minimized}));
  if(data.isForeground!==false&&data.handle&&data.title&&!/^Umay(?: bilgisayar görevi)?$/i.test(data.title))this.foreground={handle:data.handle,title:text(data.title,240),observedAt:new Date().toISOString()};
 }
 context(compact=false){
  const value=structuredClone({task:this.task,previous:this.previous,foreground:this.foreground,windows:this.windows,...(this.browser?{browser:this.browser}:{})});
  if(compact){for(const task of [value.task,value.previous])if(task){task.goal=text(task.goal,400);task.userRequest=text(task.userRequest,500);task.message=text(task.message,200);delete task.steps;}value.windows=value.windows.slice(0,4);}
  return value;
 }
}
module.exports={ComputerSession};

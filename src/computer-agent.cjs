'use strict';
const {randomUUID}=require('node:crypto');
const INPUT_ACTIONS=new Set(['click','double_click','right_click','move','drag','scroll','keys','type','wait']);
function parseAction(text){
 const source=String(text||'').trim().replace(/^```(?:json)?\s*|\s*```$/gi,'');let value;
 try{value=JSON.parse(source);}catch{throw Error('Model bilgisayar işlemini geçerli biçimde yanıtlamadı. Başka bir model seçip yeniden deneyebilirsiniz.');}
 if(!value||typeof value!=='object'||Array.isArray(value)||!['done','ask','confirm','observe',...INPUT_ACTIONS].includes(value.action))throw Error('Model desteklenmeyen bir bilgisayar işlemi istedi.');
 if(['done','ask'].includes(value.action)&&(!value.message||typeof value.message!=='string'))throw Error('Modelin görev açıklaması eksik.');
 if(value.action==='confirm'&&(!value.nextAction||!INPUT_ACTIONS.has(value.nextAction.action)))throw Error('Onaylanacak işlem geçersiz.');return value;
}
function visionModel(model){return (model.categories||[]).some(c=>/^(vision|multimodal|image[-_ ]to[-_ ]text|görsel anlama)$/i.test(typeof c==='string'?c:c?.name||c?.slug||''));}
class ComputerAgent{
 constructor({control,api,memory,publish=()=>{},onStart=()=>{},onFinish=()=>{},now=()=>Date.now(),delay=ms=>new Promise(r=>setTimeout(r,ms))}){Object.assign(this,{control,api,memory,publish,onStart,onFinish,now,delay});this.task=null;this.sequence=0;}
 state(){const task=this.task;return task?{id:task.id,status:task.status,goal:task.goal,step:task.steps.length,message:task.message||'',requiresInput:task.requiresInput||null}:null;}
 check(task){if(this.task!==task||task.sequence!==this.sequence||task.epoch!==this.memory.epoch||!this.control.enabled)throw Error('Bilgisayar görevi durduruldu.');}
 emit(){this.publish({event:'computer-task',task:this.state()});}
 async run(goal,model){
  if(this.task&&['running','confirmation','question'].includes(this.task.status))throw Error('Önce etkin bilgisayar görevini bitirin veya durdurun.');
  if(!this.control.enabled)throw Error('Ayarlar bölümünden bilgisayar kontrolünü açın.');
  if(typeof goal!=='string'||!goal.trim()||goal.length>12000||!model?.id||!['PERSONAL','SUBSCRIPTION'].includes(model.source))throw Error('Görev veya seçilen model geçersiz.');
  const task=this.task={id:randomUUID(),sequence:++this.sequence,epoch:this.memory.epoch,goal:goal.trim(),model,steps:[],status:'running',createdAt:this.now(),messageTimes:[],lastRun:null,selectedDisplay:null};
  this.memory.archiveConversation({id:task.id,title:goal.slice(0,100),localSource:'computer'},[{id:randomUUID(),role:'user',content:goal}]);
  this.memory.log('computer-task',goal,{status:'running',details:{taskId:task.id}});await this.onStart();this.check(task);this.emit();return this.loop(task);
 }
 async resume(id,{approved=false,answer=''}={}){
  const task=this.task;if(!task||task.id!==id||!['confirmation','question'].includes(task.status))throw Error('Devam ettirilecek görev bulunamadı.');this.check(task);
  if(task.status==='confirmation'&&!approved){await this.stop();return this.state();}
  task.feedback=task.status==='confirmation'?'Kullanıcı şu belirli işlemi onayladı: '+JSON.stringify(task.requiresInput):'Kullanıcının ek açıklaması: '+String(answer).slice(0,4000);
  task.requiresInput=null;task.status='running';await this.onStart();this.emit();return this.loop(task);
 }
 async stop(){
  const task=this.task;this.sequence++;this.control.stop();if(!task)return null;
  if(['running','confirmation','question'].includes(task.status)){task.status='stopped';task.message='Görev durduruldu.';this.emit();if(task.epoch===this.memory.epoch)this.memory.log('computer-task',task.message,{status:'cancelled',details:{taskId:task.id}});}
  this.onFinish();if(task.lastRun)await this.api('/site/chat/runs/'+task.lastRun+'/cancel',{}).catch(()=>{});return this.state();
 }
 async wait(task,milliseconds){const end=this.now()+milliseconds;while(this.now()<end){this.check(task);await this.delay(Math.min(200,end-this.now()));}this.check(task);}
 async loop(task){
  try{
   if(!task.conversation){const created=await this.api('/site/chat/conversations',{source:task.model.source,modelId:task.model.id,title:'Umay bilgisayar görevi: '+task.goal.slice(0,110),requestId:randomUUID()});this.check(task);task.conversation=created.conversation;}
   while(task.steps.length<40&&this.now()-task.createdAt<15*60000){
    this.check(task);task.message='Ekran inceleniyor…';this.emit();
    const observed=await this.control.observe({image:true});this.check(task);
    const images=observed.screenshots;
    const selected=images.find(s=>s.displayId===task.selectedDisplay)||images.find(s=>observed.elements.some(e=>{const p=this.control.screen.screenToDipPoint?.({x:Math.round(e.bounds.x+e.bounds.width/2),y:Math.round(e.bounds.y+e.bounds.height/2)})||e.bounds;return this.control.screen.getDisplayNearestPoint?.(p)?.id==s.displayId;}))||images[0];
    const prompt={task:task.goal,step:task.steps.length+1,previousSteps:task.steps.slice(-6),userFeedback:task.feedback||null,observation:{id:observed.id,title:observed.title,displayId:selected?.displayId,screenshotSize:selected?{width:selected.width,height:selected.height}:null,displays:observed.displays,elements:observed.elements.slice(0,100).map(e=>({...e,name:e.name.slice(0,160)}))},hasImage:visionModel(task.model)&&!!selected};
    task.feedback=null;
    while(JSON.stringify(prompt).length>11200&&prompt.observation.elements.length>5)prompt.observation.elements.pop();
    if(JSON.stringify(prompt).length>11900)throw Error('Görev açıklaması çok uzun. Daha kısa ve tek bir görev olarak yazın.');
    // Keep the existing site's per-user write rate instead of changing it for
    // all chats. Wait cooperatively; F8 remains available during this interval.
    task.messageTimes=task.messageTimes.filter(t=>this.now()-t<61000);if(task.messageTimes.length>=10)await this.wait(task,61000-(this.now()-task.messageTimes[0]));
    const request={content:JSON.stringify(prompt),requestId:randomUUID(),expectedVersion:Number(task.conversation.version),kind:'CHAT',desktopMode:'computer',desktopContext:JSON.stringify({clock:new Date(this.now()).toISOString(),memory:this.memory.context(task.goal)}).slice(0,12000),...(prompt.hasImage?{desktopImage:selected.image}:{})};
    task.message='Modelin işlem yanıtı bekleniyor…';this.emit();const posted=await this.api('/site/chat/conversations/'+task.conversation.id+'/messages',request);task.lastRun=posted.run.id;task.messageTimes.push(this.now());
    if(task.sequence!==this.sequence){await this.api('/site/chat/runs/'+task.lastRun+'/cancel',{}).catch(()=>{});throw Error('Bilgisayar görevi durduruldu.');}this.check(task);
    const deadline=this.now()+180000;
    while(true){this.check(task);const {run}=await this.api('/site/chat/runs/'+task.lastRun);this.check(task);if(!['QUEUED','RUNNING'].includes(run.status)){if(!['COMPLETED','SUCCEEDED'].includes(run.status))throw Error(run.errorCode||'MODEL_UNAVAILABLE');break;}if(this.now()>deadline)throw Error('MODEL_TIMEOUT');await this.wait(task,300);}
    task.lastRun=null;const detail=await this.api('/site/chat/conversations/'+task.conversation.id);this.check(task);task.conversation=detail.conversation;
    const response=[...detail.messages].reverse().find(m=>String(m.role).toLowerCase()==='assistant');const action=parseAction(response?.content);
    task.message=String(action.summary||'İşlem uygulanıyor…').slice(0,500);this.emit();
    if(action.action==='done'){
     task.status='completed';task.message=action.message;this.memory.archiveConversation({id:task.id,title:task.goal.slice(0,100),localSource:'computer'},[{id:randomUUID(),role:'assistant',content:action.message}]);this.memory.log('computer-task',action.message,{details:{taskId:task.id,steps:task.steps.length}});this.emit();this.onFinish();return this.state();
    }
    if(['ask','confirm'].includes(action.action)){task.status=action.action==='ask'?'question':'confirmation';task.requiresInput=action.action==='confirm'?{summary:action.summary,nextAction:action.nextAction}:action.message;task.message=action.message||action.summary;this.emit();this.onFinish();return this.state();}
    if(action.action==='observe'){if(!observed.displays.some(d=>d.id===String(action.displayId)))throw Error('Model geçersiz bir ekran istedi.');task.selectedDisplay=String(action.displayId);task.steps.push({action:'observe',displayId:task.selectedDisplay});continue;}
    if(['click','double_click','right_click','move','drag'].includes(action.action)&&(!Number.isInteger(action.elementId)||action.action==='drag')&&(!prompt.hasImage||String(action.displayId)!==selected?.displayId))throw Error('Koordinat işlemi için görsel destekli modelin ilgili ekranı önce incelemesi gerekiyor.');
    this.check(task);await this.control.perform(action,observed.id);this.check(task);
    const record={action:action.action,summary:task.message,...(action.action==='type'?{characters:action.text.length}:{})};task.steps.push(record);this.memory.log('computer-step',task.message,{details:{taskId:task.id,step:task.steps.length,action:action.action,characters:record.characters}});await this.wait(task,250);
   }
   throw Error('Görev adım veya süre sınırına ulaştı. Son yapılanlar işlem günlüğüne kaydedildi.');
  }catch(error){
   if(task.sequence===this.sequence&&task.epoch===this.memory.epoch){task.status='failed';task.message=String(error.message);this.memory.log('computer-task',task.message,{status:'failed',details:{taskId:task.id}});this.emit();}
   if(task.lastRun)await this.api('/site/chat/runs/'+task.lastRun+'/cancel',{}).catch(()=>{});if(this.task===task)this.onFinish();return this.state();
  }
 }
}
module.exports={ComputerAgent,parseAction,visionModel};

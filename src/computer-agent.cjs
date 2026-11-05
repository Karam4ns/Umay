'use strict';
const {randomUUID,createHash}=require('node:crypto');
const INPUT_ACTIONS=new Set(['click','double_click','right_click','middle_click','move','drag','scroll','keys','type','wait','focus_window']);
function parseAction(text){
 const source=String(text||'').trim().replace(/^```(?:json)?\s*|\s*```$/gi,'');let value;
 try{value=JSON.parse(source);}catch{throw Error('Model bilgisayar işlemini geçerli biçimde yanıtlamadı. Başka bir model seçip yeniden deneyebilirsiniz.');}
 if(!value||typeof value!=='object'||Array.isArray(value)||!['done','ask','confirm','observe',...INPUT_ACTIONS].includes(value.action))throw Error('Model desteklenmeyen bir bilgisayar işlemi istedi.');
 if(value.action==='done'&&!value.message&&typeof value.summary==='string'&&value.summary.trim())value.message=value.summary;
 if(['done','ask'].includes(value.action)&&(!value.message||typeof value.message!=='string'))throw Error('Modelin görev açıklaması eksik.');
 if(value.action==='confirm'&&(!value.nextAction||!INPUT_ACTIONS.has(value.nextAction.action)))throw Error('Onaylanacak işlem geçersiz.');return value;
}
function visionModel(model){return (model.categories||[]).some(c=>/^(vision|multimodal|image[-_ ]to[-_ ]text|görsel anlama)$/i.test(typeof c==='string'?c:c?.name||c?.slug||''));}
class ComputerAgent{
 constructor({control,api,memory,publish=()=>{},onStart=()=>{},onFinish=()=>{},verifyCompletion=async()=>null,onObservation=()=>{},sessionContext=()=>null,now=()=>Date.now(),delay=ms=>new Promise(r=>setTimeout(r,ms))}){Object.assign(this,{control,api,memory,publish,onStart,onFinish,verifyCompletion,onObservation,sessionContext,now,delay});this.task=null;this.sequence=0;}
 state(){const task=this.task;return task?{id:task.id,status:task.status,goal:task.goal,origin:task.origin||null,step:task.steps.length,message:task.message||'',requiresInput:task.requiresInput||null}:null;}
 check(task){if(this.task!==task||task.sequence!==this.sequence||task.epoch!==this.memory.epoch||!this.control.enabled)throw Error('Bilgisayar görevi durduruldu.');}
 emit(){this.publish({event:'computer-task',task:this.state()});}
 async run(goal,model,origin=null){
  if(this.task&&['running','confirmation','question','permission'].includes(this.task.status))throw Error('Önce etkin bilgisayar görevini bitirin veya durdurun.');
  if(!this.control.enabled)throw Error('Ayarlar bölümünden bilgisayar kontrolünü açın.');
  if(typeof goal!=='string'||!goal.trim()||goal.length>12000||!model?.id||!['PERSONAL','SUBSCRIPTION'].includes(model.source))throw Error('Görev veya seçilen model geçersiz.');
  if(origin&&(typeof origin.userRequest!=='string'||!origin.userRequest.trim()))throw Error('Asıl kullanıcı isteği doğrulanamadı.');
  const task=this.task={id:randomUUID(),sequence:++this.sequence,epoch:this.memory.epoch,goal:goal.trim(),model,origin,steps:[],status:'running',createdAt:this.now(),recoveries:0,messageTimes:[],lastRun:null,selectedDisplay:null};
  this.memory.archiveConversation({id:task.id,title:goal.slice(0,100),localSource:'computer'},[{id:randomUUID(),role:'user',content:goal}]);
  this.memory.log('computer-task',goal,{status:'running',details:{taskId:task.id}});return task.work=this.loop(task,true);
 }
 async pause(){
  const task=this.task;if(!task||!['running','question','confirmation','permission'].includes(task.status))return this.state();
  const sequence=++this.sequence,drained=this.control.stop();task.pausedStatus=task.status;task.status='paused';task.message='Durdum. Devam et dediğinde güncel ekranla sürdüreceğim.';this.emit();this.memory.log('computer-task',task.message,{status:'paused',details:{taskId:task.id}});
  if(task.lastRun)void this.api('/site/chat/runs/'+task.lastRun+'/cancel',{}).catch(()=>{});
  await drained;if(this.task===task&&sequence===this.sequence)this.onFinish();return this.state();
 }
 async resumePaused(){
  const previous=this.task;if(!previous||previous.status!=='paused')throw Error('Devam ettirilecek duraklatılmış görev bulunamadı.');
  if(previous.epoch!==this.memory.epoch||!this.control.enabled)throw Error('Görev bu hesapta devam ettirilemez.');
  const task=this.task={...previous,sequence:++this.sequence,status:previous.pausedStatus||'running',steps:[...previous.steps],messageTimes:[...previous.messageTimes],userAuthorization:[...(previous.userAuthorization||[])],lastRun:null,recoveries:0,repeated:0,lastFingerprint:null,work:null};
  if(task.status!=='running'){this.emit();this.onFinish();return this.state();}
  task.message='Güncel ekranla devam ediyorum…';task.feedback='Kullanıcı duraklatılan aynı göreve devam edilmesini istedi. Güncel ekranı incele; tamamlanan işlemleri tekrar etme.';this.emit();
  return task.work=(async()=>{
   await previous.work?.catch(()=>{});if(this.task!==task||task.sequence!==this.sequence||task.epoch!==this.memory.epoch)return null;
   if(task.conversation){const detail=await this.api('/site/chat/conversations/'+task.conversation.id);this.check(task);task.conversation=detail.conversation;}
   return this.loop(task,true);
  })();
 }
 async resume(id,{approved=false,answer='',elevated=false}={}){
  const task=this.task;if(!task||task.id!==id||!['confirmation','question','permission'].includes(task.status))throw Error('Devam ettirilecek görev bulunamadı.');this.check(task);
  if(task.status==='permission'&&!elevated)throw Error('Önce gerçek Windows yönetici onayını tamamlayın.');
  if(task.status==='confirmation'&&!approved){await this.stop();return this.state();}
  task.feedback=task.status==='permission'?'Kullanıcı mevcut görev için Windows yönetici onayını verdi. Güncel gözlemi inceleyerek devam et; önceki işlemi körlemesine tekrarlama.':task.status==='confirmation'?'Kullanıcı şu belirli işlemi onayladı: '+JSON.stringify(task.requiresInput):'Kullanıcının ek açıklaması: '+String(answer).slice(0,4000);
  task.userAuthorization??=[];task.userAuthorization.push({kind:task.status,answer:task.status==='question'?String(answer).slice(0,4000):null,approved:task.status==='permission'?elevated:approved,scope:task.status==='confirmation'?task.requiresInput:null});
  task.requiresInput=null;task.status='running';task.recoveries=0;task.lastFingerprint=null;task.repeated=0;return task.work=this.loop(task,true);
 }
 async stop(){
  const task=this.task,sequence=++this.sequence,drained=this.control.stop();
  if(task&&['running','paused','confirmation','question','permission'].includes(task.status)){task.status='stopped';task.message='Görev durduruldu.';this.emit();if(task.epoch===this.memory.epoch)this.memory.log('computer-task',task.message,{status:'cancelled',details:{taskId:task.id}});}
  await drained;if(sequence===this.sequence)this.onFinish();if(task?.lastRun)await this.api('/site/chat/runs/'+task.lastRun+'/cancel',{}).catch(()=>{});return this.state();
 }
 async wait(task,milliseconds){const end=this.now()+milliseconds;while(this.now()<end){this.check(task);await this.delay(Math.min(200,end-this.now()));}this.check(task);}
 recover(task,error){
  this.check(task);if(!['PLANNER_INVALID','NATIVE_FOCUS_CHANGED','NATIVE_WINDOW_UNAVAILABLE'].includes(error.code)||task.recoveries>=2)return false;
  task.recoveries++;task.feedback='Önceki işlem uygulanmadı: '+error.message+'. Güncel gözlemi incele; geçerli tek bir işlem seç. Başarı iddia etme.';
  task.message='Ekran değişti; yeniden inceleniyor…';this.emit();return true;
 }
 complete(task,message){this.check(task);task.status='completed';task.message=message;this.memory.archiveConversation({id:task.id,title:task.goal.slice(0,100),localSource:'computer'},[{id:randomUUID(),role:'assistant',content:message}]);this.memory.log('computer-task',message,{details:{taskId:task.id,steps:task.steps.length}});this.emit();this.onFinish();return this.state();}
 async loop(task,start=false){
  try{
   if(start){task.initialCompletion=await this.verifyCompletion(task);this.check(task);if(task.initialCompletion?.verified===true)return this.complete(task,task.initialCompletion.message);await this.onStart();this.check(task);this.emit();}
   if(!task.conversation){const created=await this.api('/site/chat/conversations',{source:task.model.source,modelId:task.model.id,title:'Umay bilgisayar görevi: '+task.goal.slice(0,110),requestId:randomUUID()});this.check(task);task.conversation=created.conversation;}
   while(task.steps.length<120&&this.now()-task.createdAt<30*60000){
    this.check(task);task.message='Ekran inceleniyor…';this.emit();
    let observed;try{observed=await this.control.observe({image:true});}catch(error){if(this.recover(task,error))continue;throw error;}this.check(task);this.onObservation(task,observed);
    const images=observed.screenshots;
    const selected=images.find(s=>s.displayId===task.selectedDisplay)||images.find(s=>observed.elements.some(e=>{const p=this.control.screen.screenToDipPoint?.({x:Math.round(e.bounds.x+e.bounds.width/2),y:Math.round(e.bounds.y+e.bounds.height/2)})||e.bounds;return this.control.screen.getDisplayNearestPoint?.(p)?.id==s.displayId;}))||images[0];
    task.inspectedDisplays??=new Set();if(selected&&visionModel(task.model))task.inspectedDisplays.add(selected.displayId);
    const prompt={session:this.sessionContext(),proposedGoal:task.goal,originalUserRequest:task.origin?task.origin.userRequest:task.goal,userAuthorization:task.userAuthorization?.slice(-6)||[],step:task.steps.length+1,previousSteps:task.steps.slice(-6),userFeedback:task.feedback||null,capabilities:{actions:[...INPUT_ACTIONS,'observe','done','ask','confirm'],windowsShortcuts:{showDesktop:['WIN','D'],runDialog:['WIN','R'],addressBar:['CTRL','L'],newFolderOnDesktopOrExplorer:['CTRL','SHIFT','N'],rename:['F2']},scrollAxes:['vertical','horizontal'],windowAction:'focus_window with windowHandle from observation.windows',dragEnd:'endDisplayId is optional; inspect the destination monitor first'},observation:{id:observed.id,title:observed.title,windows:observed.windows||[],displayId:selected?.displayId,screenshotSize:selected?{width:selected.width,height:selected.height}:null,displays:observed.displays,elements:observed.elements.slice(0,100).map(e=>({...e,name:e.name.slice(0,160)}))},hasImage:visionModel(task.model)&&!!selected};
    task.feedback=null;
    while(JSON.stringify(prompt).length>11200&&prompt.observation.elements.length>5)prompt.observation.elements.pop();
    while(JSON.stringify(prompt).length>11700&&prompt.observation.windows.length>1)prompt.observation.windows.pop();
    if(JSON.stringify(prompt).length>11900)throw Error('Görev açıklaması çok uzun. Daha kısa ve tek bir görev olarak yazın.');
    // Keep the existing site's per-user write rate instead of changing it for
    // all chats. Wait cooperatively; F8 remains available during this interval.
    task.messageTimes=task.messageTimes.filter(t=>this.now()-t<61000);if(task.messageTimes.length>=10)await this.wait(task,61000-(this.now()-task.messageTimes[0]));
    const request={content:JSON.stringify(prompt),requestId:randomUUID(),expectedVersion:Number(task.conversation.version),kind:'CHAT',desktopMode:'computer',desktopContext:JSON.stringify({clock:new Date(this.now()).toISOString(),memory:this.memory.context(task.goal)}).slice(0,12000),...(prompt.hasImage?{desktopImage:selected.image}:{})};
    task.message='Modelin işlem yanıtı bekleniyor…';this.emit();const posted=await this.api('/site/chat/conversations/'+task.conversation.id+'/messages',request);task.lastRun=posted.run.id;task.messageTimes.push(this.now());
    if(task.sequence!==this.sequence){await this.api('/site/chat/runs/'+task.lastRun+'/cancel',{}).catch(()=>{});throw Error('Bilgisayar görevi durduruldu.');}this.check(task);
    const deadline=this.now()+180000;let retryPlanner=false;
    while(true){this.check(task);const {run}=await this.api('/site/chat/runs/'+task.lastRun);this.check(task);if(!['QUEUED','RUNNING'].includes(run.status)){if(!['COMPLETED','SUCCEEDED'].includes(run.status)){const error=Error(run.errorCode||'MODEL_UNAVAILABLE');if(['ANSWER_QUALITY_FAILED','INVALID_PROVIDER_RESPONSE'].includes(run.errorCode)){error.code='PLANNER_INVALID';retryPlanner=this.recover(task,error);if(retryPlanner)break;}throw error;}break;}if(this.now()>deadline)throw Error('MODEL_TIMEOUT');await this.wait(task,300);}
    task.lastRun=null;const detail=await this.api('/site/chat/conversations/'+task.conversation.id);this.check(task);task.conversation=detail.conversation;if(retryPlanner)continue;
    const response=[...detail.messages].reverse().find(m=>String(m.role).toLowerCase()==='assistant');let action;try{action=parseAction(response?.content);}catch(error){error.code='PLANNER_INVALID';if(this.recover(task,error))continue;throw error;}
    task.message=String(action.summary||'İşlem uygulanıyor…').slice(0,500);this.emit();
    if(action.action==='done'){
     const verified=await this.verifyCompletion(task);this.check(task);if(verified?.verified===false){const error=Object.assign(Error(verified.message),{code:'PLANNER_INVALID'});if(this.recover(task,error))continue;throw error;}
     return this.complete(task,verified?.verified===true?verified.message:action.message);
    }
    if(['ask','confirm'].includes(action.action)){task.status=action.action==='ask'?'question':'confirmation';task.requiresInput=action.action==='confirm'?{summary:action.summary,nextAction:action.nextAction}:action.message;task.message=action.message||action.summary;this.emit();this.onFinish();return this.state();}
    // Only one screenshot is sent in this model turn. Coordinates without an
    // explicit monitor belong to that exact image, never another display. Keep
    // explicit IDs, freshness, bounds and the text-only restriction intact.
    if(prompt.hasImage&&action.displayId==null&&Number.isFinite(action.x)&&Number.isFinite(action.y)&&['click','double_click','right_click','middle_click','move','drag','scroll'].includes(action.action))action.displayId=selected.displayId;
    try{
    if(action.action==='observe'&&!observed.displays.some(d=>d.id===String(action.displayId)))throw Error('Model geçersiz bir ekran istedi.');
    if((['click','double_click','right_click','middle_click','move','drag'].includes(action.action)||action.action==='scroll'&&(action.x!==undefined||action.y!==undefined))&&(!Number.isInteger(action.elementId)||action.action==='drag')&&(!prompt.hasImage||String(action.displayId)!==selected?.displayId))throw Object.assign(Error('Koordinat işlemi için görsel destekli modelin ilgili ekranı önce incelemesi gerekiyor.'),{code:prompt.hasImage?'PLANNER_INVALID':'MODEL_VISION_REQUIRED'});
    if(action.action==='drag'&&action.endDisplayId&&action.endDisplayId!==selected?.displayId&&!task.inspectedDisplays?.has(String(action.endDisplayId)))throw Error('Sürüklemenin hedef ekranı önce incelenmeli.');
    }catch(error){error.code??='PLANNER_INVALID';if(this.recover(task,error))continue;throw error;}
    if(action.action==='observe'){task.selectedDisplay=String(action.displayId);task.steps.push({action:'observe',displayId:task.selectedDisplay});continue;}
    const fingerprint=createHash('sha256').update(JSON.stringify([action.action,action.elementId,action.x,action.y,action.displayId,action.windowHandle,action.text,action.keys,action.amount,observed.title,observed.elements,selected?.image])).digest('hex');
    task.repeated=task.lastFingerprint===fingerprint?(task.repeated||0)+1:1;task.lastFingerprint=fingerprint;
    if(task.repeated>3){task.status='question';task.message='Aynı işlem ekranda ilerleme olmadan tekrarlandı. Nasıl devam etmemi istersin?';task.requiresInput=task.message;this.emit();this.onFinish();return this.state();}
    this.check(task);try{await this.control.perform(action,observed.id);}catch(error){if(this.recover(task,error))continue;throw error;}this.check(task);task.recoveries=0;
    const record={action:action.action,summary:task.message,...(action.action==='type'?{characters:action.text.length}:{})};task.steps.push(record);this.memory.log('computer-step',task.message,{details:{taskId:task.id,step:task.steps.length,action:action.action,characters:record.characters}});await this.wait(task,250);
    if(task.initialCompletion?.verified===false){const verified=await this.verifyCompletion(task);this.check(task);if(verified?.verified===true)return this.complete(task,verified.message);}
   }
   throw Error('Görev adım veya süre sınırına ulaştı. Son yapılanlar işlem günlüğüne kaydedildi.');
  }catch(error){
   if(task.sequence===this.sequence&&task.epoch===this.memory.epoch&&['NATIVE_ELEVATION_REQUIRED','NATIVE_INPUT_DENIED'].includes(error.code)){task.status='permission';task.message='Bu işlem için Windows yönetici izni gerekiyor. Onayladıktan sonra aynı göreve devam edeceğim.';task.requiresInput={reason:error.message};this.emit();this.onFinish();return this.state();}
   if(task.sequence===this.sequence&&task.epoch===this.memory.epoch){task.status='failed';task.message=String(error.message);this.memory.log('computer-task',task.message,{status:'failed',details:{taskId:task.id}});this.emit();}
   if(task.lastRun)await this.api('/site/chat/runs/'+task.lastRun+'/cancel',{}).catch(()=>{});if(this.task===task&&task.sequence===this.sequence)this.onFinish();return this.state();
  }
 }
}
module.exports={ComputerAgent,parseAction,visionModel};

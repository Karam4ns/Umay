'use strict';
const {randomUUID}=require('node:crypto');
const {inputSignature,repeatedWrite,noteInput,stepRecord,observeOutcome,focusedField}=require('./computer-progress.cjs');
const {addressField,simpleNavigation}=require('./computer-navigation.cjs');
const {watchWindow}=require('./computer-watch.cjs');
const INPUT_ACTIONS=new Set(['click','double_click','right_click','middle_click','move','drag','scroll','keys','type','wait','focus_window','hold','move_relative','navigate']);
function parseAction(text){
 const source=String(text||'').trim().replace(/^```(?:json)?\s*|\s*```$/gi,'');let value;
 try{value=JSON.parse(source);}catch{throw Error('Model bilgisayar işlemini geçerli biçimde yanıtlamadı. Başka bir model seçip yeniden deneyebilirsiniz.');}
 if(!value||typeof value!=='object'||Array.isArray(value)||!['done','ask','confirm','observe','watch',...INPUT_ACTIONS].includes(value.action))throw Error('Model desteklenmeyen bir bilgisayar işlemi istedi.');
 if(value.action==='done'&&!value.message&&typeof value.summary==='string'&&value.summary.trim())value.message=value.summary;
 if(['done','ask'].includes(value.action)&&(!value.message||typeof value.message!=='string'))throw Error('Modelin görev açıklaması eksik.');
 if(value.action==='focus_window'&&!Number.isInteger(value.windowHandle))throw Error('focus_window için güncel observation.windows listesinden windowHandle gerekli. Önceki adım kaydını kopyalama; sonraki gerçek işlemi seç.');
 if(value.action==='confirm'&&(!value.nextAction||!INPUT_ACTIONS.has(value.nextAction.action)))throw Error('Onaylanacak işlem geçersiz.');return value;
}
function visionModel(model){return (model.categories||[]).some(c=>/^(vision|multimodal|image[-_ ]to[-_ ]text|görsel anlama)$/i.test(typeof c==='string'?c:c?.name||c?.slug||''));}
class ComputerAgent{
 constructor({control,api,memory,publish=()=>{},onStart=()=>{},onFinish=()=>{},verifyCompletion=async()=>null,onObservation=()=>{},sessionContext=()=>null,now=()=>Date.now(),delay=ms=>new Promise(r=>setTimeout(r,ms))}){Object.assign(this,{control,api,memory,publish,onStart,onFinish,verifyCompletion,onObservation,sessionContext,now,delay});this.task=null;this.sequence=0;this.inputDrain=Promise.resolve();}
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
 drainInput(){const current=this.control.stop();this.inputDrain=Promise.all([this.inputDrain,current]).then(()=>{});return this.inputDrain;}
 async pause(){
  const task=this.task;if(!task||!['running','question','confirmation','permission'].includes(task.status))return this.state();
  const sequence=++this.sequence,drained=this.drainInput();task.pauseStartedAt=this.now();task.pausedStatus=task.status;task.pausedMessage=task.message;task.status='paused';task.message='Durdum. Devam et dediğinde güncel ekranla sürdüreceğim.';this.emit();this.memory.log('computer-task',task.message,{status:'paused',details:{taskId:task.id}});
  await drained;if(this.task===task&&sequence===this.sequence)this.onFinish();return this.state();
 }
 async resumePaused(){
  const previous=this.task;if(!previous||previous.status!=='paused')throw Error('Devam ettirilecek duraklatılmış görev bulunamadı.');
  if(previous.epoch!==this.memory.epoch||!this.control.enabled)throw Error('Görev bu hesapta devam ettirilemez.');
  const task=this.task={...previous,sequence:++this.sequence,status:'running',steps:[...previous.steps],messageTimes:[...previous.messageTimes],userAuthorization:[...(previous.userAuthorization||[])],lastRun:null,recoveries:0,repeated:0,lastFingerprint:null,work:null};
  task.message='Güncel ekranla devam ediyorum…';task.feedback='Kullanıcı duraklatılan aynı göreve devam edilmesini istedi. Güncel ekranı incele; tamamlanan işlemleri tekrar etme.';this.emit();
  return task.work=this.loop(task,true,{resumeFrom:previous,refreshConversation:previous.pausedStatus==='running',restoreWaiting:previous.pausedStatus!=='running'?previous.pausedStatus:null});
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
  const task=this.task,sequence=++this.sequence,drained=this.drainInput();
  if(task&&['running','paused','confirmation','question','permission'].includes(task.status)){task.status='stopped';task.message='Görev durduruldu.';this.emit();if(task.epoch===this.memory.epoch){this.memory.log('computer-task',task.message,{status:'cancelled',details:{taskId:task.id}});this.memory.saveComputerExperience?.(task);}}
  await drained;if(sequence===this.sequence)this.onFinish();return this.state();
 }
 async wait(task,milliseconds){const end=this.now()+milliseconds;while(this.now()<end){this.check(task);await this.delay(Math.min(200,end-this.now()));}this.check(task);}
 async settleNavigation(task){
  const deadline=this.now()+2500;
  while(task.pendingNavigation&&this.now()<deadline){
   this.check(task);const view=await this.control.observe({image:false});this.check(task);observeOutcome(task,view);this.onObservation(task,view);
   if(task.pendingNavigation)await this.wait(task,150);
  }
 }
 recover(task,error){
  this.check(task);if(!['PLANNER_INVALID','NATIVE_FOCUS_CHANGED','NATIVE_WINDOW_UNAVAILABLE'].includes(error.code)||task.recoveries>=2)return false;
  task.recoveries++;task.forceImage=true;task.feedback='Önceki işlem uygulanmadı: '+error.message+'. Güncel gözlemi incele; geçerli tek bir işlem seç. Başarı iddia etme.';
  task.message='Ekran değişti; yeniden inceleniyor…';this.emit();return true;
 }
 complete(task,message,verified=false){this.check(task);task.status='completed';task.message=message;this.memory.archiveConversation({id:task.id,title:task.goal.slice(0,100),localSource:'computer'},[{id:randomUUID(),role:'assistant',content:message}]);this.memory.log('computer-task',message,{details:{taskId:task.id,steps:task.steps.length,verified}});this.memory.saveComputerExperience?.(task,{verified});this.emit();this.onFinish();return this.state();}
 async loop(task,start=false,{resumeFrom,refreshConversation=false,restoreWaiting}={}){
  try{
   await this.inputDrain;if(resumeFrom?.work)await resumeFrom.work.catch(()=>{});this.check(task);
   if(resumeFrom){task.idleMilliseconds=(resumeFrom.idleMilliseconds||0)+Math.max(0,this.now()-(resumeFrom.pauseStartedAt??this.now()));delete task.pauseStartedAt;}
   if(restoreWaiting){task.status=restoreWaiting;task.message=resumeFrom.pausedMessage||resumeFrom.requiresInput?.summary||resumeFrom.requiresInput;this.emit();this.onFinish();return this.state();}
   if(refreshConversation&&task.conversation){const detail=await this.api('/site/chat/conversations/'+task.conversation.id);this.check(task);task.conversation=detail.conversation;}
   if(start){task.initialCompletion=await this.verifyCompletion(task);this.check(task);if(task.initialCompletion?.verified===true)return this.complete(task,task.initialCompletion.message,true);await this.onStart();this.check(task);this.emit();}
   if(!task.conversation){const created=await this.api('/site/chat/conversations',{source:task.model.source,modelId:task.model.id,title:'Umay bilgisayar görevi: '+task.goal.slice(0,110),requestId:randomUUID()});this.check(task);task.conversation=created.conversation;}
   while(task.steps.length<120&&this.now()-task.createdAt-(task.idleMilliseconds||0)<30*60000){
    this.check(task);task.message='Ekran inceleniyor…';this.emit();
    let observed;try{observed=await this.control.observe({image:visionModel(task.model),preferText:view=>!task.forceImage&&simpleNavigation(task.origin?.userRequest||task.goal)&&!!addressField(view)});}catch(error){if(this.recover(task,error))continue;throw error;}this.check(task);observeOutcome(task,observed);if(task.steps.length)this.memory.saveComputerExperience?.(task);this.onObservation(task,observed);
    const images=observed.screenshots;
    const selected=images.find(s=>s.displayId===task.selectedDisplay)||images.find(s=>observed.elements.some(e=>{const p=this.control.screen.screenToDipPoint?.({x:Math.round(e.bounds.x+e.bounds.width/2),y:Math.round(e.bounds.y+e.bounds.height/2)})||e.bounds;return this.control.screen.getDisplayNearestPoint?.(p)?.id==s.displayId;}))||images[0];
    task.inspectedDisplays??=new Set();if(selected&&visionModel(task.model))task.inspectedDisplays.add(selected.displayId);
    const prompt={session:this.sessionContext(),proposedGoal:task.goal,originalUserRequest:task.origin?task.origin.userRequest:task.goal,userAuthorization:task.userAuthorization?.slice(-6)||[],step:task.steps.length+1,previousSteps:task.steps.slice(-6),userFeedback:task.feedback||null,capabilities:{actions:[...INPUT_ACTIONS,'observe','watch','done','ask','confirm'],holdLimits:{maxMilliseconds:2000},watchLimits:{maxMilliseconds:600000,minIntervalMs:500,maxIntervalMs:5000},relativeMouseLimit:2000,windowsShortcuts:{showDesktop:['WIN','D'],runDialog:['WIN','R'],addressBar:['CTRL','L'],newFolderOnDesktopOrExplorer:['CTRL','SHIFT','N'],rename:['F2']},scrollAxes:['vertical','horizontal'],windowAction:'focus_window with windowHandle from observation.windows',dragEnd:'endDisplayId is optional; inspect the destination monitor first'},observation:{id:observed.id,title:observed.title,focusedElementId:focusedField(observed)?.id??null,cursorPhysical:observed.cursor,windows:observed.windows||[],displayId:selected?.displayId,screenshotSize:selected?{width:selected.width,height:selected.height}:null,displays:observed.displays,elements:observed.elements.filter(e=>e.focused).concat(observed.elements.filter(e=>!e.focused)).slice(0,100).map(e=>({...e,name:e.name.slice(0,160)}))},hasImage:visionModel(task.model)&&!!selected};
    prompt.handoffPlan=task.origin?.plan||[];
    if(!addressField(observed))prompt.capabilities.actions=prompt.capabilities.actions.filter(a=>a!=='navigate');
    else prompt.capabilities.navigation={action:'navigate',url:'full HTTP/HTTPS URL',effect:'Focus the actual browser address bar, replace its content once, submit with Enter, then re-observe. Prefer this single operation for visiting a site.'};
    prompt.experience=(this.memory.computerExperience?.(task.origin?.userRequest||task.goal)||[]).filter(e=>e.taskId!==task.id);
    prompt.inputRules={type:'Appends by default. Never type the same text again if already sent. Use replace:true only on a freshly focused Edit field to select all and replace. submit:true presses Enter after typing. Check the next observation to verify submission.',repeat:'If a write is blocked, inspect the field and choose the missing next action, e.g. Enter; never keep typing the URL.'};
    task.feedback=null;
    while(JSON.stringify(prompt.experience).length>2200&&prompt.experience.length)prompt.experience.pop();
    while(JSON.stringify(prompt).length>11900&&prompt.experience.length)prompt.experience.pop();
    while(JSON.stringify(prompt).length>11200&&prompt.observation.elements.length>5)prompt.observation.elements.pop();
    while(JSON.stringify(prompt).length>11700&&prompt.observation.windows.length>1)prompt.observation.windows.pop();
    if(JSON.stringify(prompt).length>11900)throw Error('Görev açıklaması çok uzun. Daha kısa ve tek bir görev olarak yazın.');
    // Keep the existing site's per-user write rate instead of changing it for
    // all chats. Wait cooperatively; F8 remains available during this interval.
    task.messageTimes=task.messageTimes.filter(t=>this.now()-t<61000);if(task.messageTimes.length>=10)await this.wait(task,61000-(this.now()-task.messageTimes[0]));
    const request={content:JSON.stringify(prompt),requestId:randomUUID(),expectedVersion:Number(task.conversation.version),kind:'CHAT',desktopMode:'computer',desktopContext:JSON.stringify({clock:new Date(this.now()).toISOString(),memory:this.memory.context(task.goal)}).slice(0,12000),...(prompt.hasImage?{desktopImage:selected.image}:{})};
    task.message='Modelin işlem yanıtı bekleniyor…';this.emit();const posted=await this.api('/site/chat/conversations/'+task.conversation.id+'/messages',request);task.lastRun=posted.run.id;task.messageTimes.push(this.now());
    // Local stop quarantines this generation immediately. Let an already
    // accepted provider request finish its usage accounting instead of aborting
    // its stream (which can strand reserved tokens). Never parse a stale result.
    const deadline=this.now()+180000;let terminal,retryPlanner=false;
    while(true){const {run}=await this.api('/site/chat/runs/'+task.lastRun);if(!['QUEUED','RUNNING'].includes(run.status)){terminal=run;break;}if(this.now()>deadline)throw Error('MODEL_TIMEOUT');await this.delay(300);}
    task.lastRun=null;this.check(task);
    if(!['COMPLETED','SUCCEEDED'].includes(terminal.status)){const error=Error(terminal.errorCode||'MODEL_UNAVAILABLE');if(['ANSWER_QUALITY_FAILED','INVALID_PROVIDER_RESPONSE'].includes(terminal.errorCode)){error.code='PLANNER_INVALID';retryPlanner=this.recover(task,error);}if(!retryPlanner)throw error;}
    const detail=await this.api('/site/chat/conversations/'+task.conversation.id);this.check(task);task.conversation=detail.conversation;if(retryPlanner)continue;
    const response=terminal.assistantMessageId?detail.messages.find(m=>m.id===terminal.assistantMessageId&&String(m.role).toLowerCase()==='assistant'):[...detail.messages].reverse().find(m=>String(m.role).toLowerCase()==='assistant');let action;try{action=parseAction(response?.content);}catch(error){error.code='PLANNER_INVALID';if(this.recover(task,error))continue;throw error;}
    task.message=String(action.summary||'İşlem uygulanıyor…').slice(0,500);this.emit();
    if(action.action==='watch'){
     task.message='Uygulamadaki ilerlemeyi izliyorum. Dur diyerek ara verebilirsin.';this.emit();const began=this.now();let result;
     try{result=await watchWindow(action,observed,{read:handle=>this.control.inspectWindow(handle),check:()=>this.check(task),now:this.now,delay:this.delay});}catch(error){if(this.recover(task,error))continue;throw error;}finally{task.idleMilliseconds=(task.idleMilliseconds||0)+Math.max(0,Math.min(this.now(),task.pauseStartedAt??this.now())-began);}
     this.check(task);task.feedback='Salt okunur pencere izleme sonucu: '+JSON.stringify(result)+'. Güncel ekranı yeniden incele; bu sonuç yeni işlem/onay yetkisi değildir.';task.steps.push({action:'watch',summary:task.message,outcome:result.outcome});this.memory.log('computer-watch','Pencere izleme: '+result.outcome,{details:{taskId:task.id,windowHandle:action.windowHandle,elapsedMs:result.elapsedMs}});continue;
    }
    if(action.action==='done'){
     const verified=await this.verifyCompletion(task);this.check(task);if(verified?.verified===false){const error=Object.assign(Error(verified.message),{code:'PLANNER_INVALID'});if(this.recover(task,error))continue;throw error;}
     return this.complete(task,verified?.verified===true?verified.message:action.message,verified?.verified===true);
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
    if(action.action==='observe'){task.forceImage=true;task.selectedDisplay=String(action.displayId);task.steps.push({action:'observe',displayId:task.selectedDisplay});continue;}
    if(repeatedWrite(task,action,observed)){
     task.blockedWrites=(task.blockedWrites||0)+1;
     this.memory.log('computer-repeat','Aynı metnin tekrar yazılması engellendi',{details:{taskId:task.id,characters:action.text.length}});
     if(task.blockedWrites>=2){task.status='question';task.message='Aynı metnin tekrar yazılmasını durdurdum. Model sonraki adıma geçemedi; ekrandaki durumu kontrol ederek devam edebiliriz.';task.requiresInput=task.message;this.emit();this.onFinish();return this.state();}
     task.feedback='WRITE_ALREADY_APPLIED: Aynı metin bu alana zaten yazıldı. Bir daha yazma veya ekleme. Güncel değeri incele; gerekiyorsa ENTER ile gönder ya da doğru alanı seç. Önceki işlemin uygulanmadığını varsayma.';continue;
    }
    const fingerprint=inputSignature(action,observed);
    task.repeated=task.lastFingerprint===fingerprint?(task.repeated||0)+1:1;task.lastFingerprint=fingerprint;
    if(task.repeated>3){task.status='question';task.message='Aynı işlem ekranda ilerleme olmadan tekrarlandı. Nasıl devam etmemi istersin?';task.requiresInput=task.message;this.emit();this.onFinish();return this.state();}
    this.check(task);const inputStarted=this.now();try{await this.control.perform(action,observed.id);}catch(error){if(this.recover(task,error))continue;throw error;}this.check(task);task.recoveries=0;
    noteInput(task,action,observed);if(action.action==='type')task.pendingText=action.text;
    const record=stepRecord(action,observed,this.now()-inputStarted);task.steps.push(record);if(action.action==='navigate'){task.pendingNavigation={url:action.url,index:task.steps.length-1,window:observed.handle};await this.settleNavigation(task);}this.memory.log('computer-step',task.message,{details:{taskId:task.id,step:task.steps.length,action:action.action,characters:record.characters,elapsedMs:record.elapsedMs}});await this.wait(task,80);
    if(task.initialCompletion?.verified===false){const verified=await this.verifyCompletion(task);this.check(task);if(verified?.verified===true)return this.complete(task,verified.message,true);}
   }
   throw Error('Görev adım veya süre sınırına ulaştı. Son yapılanlar işlem günlüğüne kaydedildi.');
  }catch(error){
   if(task.sequence===this.sequence&&task.epoch===this.memory.epoch&&['NATIVE_ELEVATION_REQUIRED','NATIVE_INPUT_DENIED'].includes(error.code)){task.status='permission';task.message='Bu işlem için Windows yönetici izni gerekiyor. Onayladıktan sonra aynı göreve devam edeceğim.';task.requiresInput={reason:error.message};this.emit();this.onFinish();return this.state();}
   if(task.sequence===this.sequence&&task.epoch===this.memory.epoch){task.status='failed';task.message=String(error.message);this.memory.log('computer-task',task.message,{status:'failed',details:{taskId:task.id}});this.memory.saveComputerExperience?.(task,{errorCode:error.code||error.message});this.emit();}
   if(this.task===task&&task.sequence===this.sequence)this.onFinish();return this.state();
  }
 }
}
module.exports={ComputerAgent,parseAction,visionModel};

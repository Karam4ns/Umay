'use strict';
const path=require('node:path'),fs=require('node:fs');
const {LocalMemory}=require('./local-memory.cjs');
const {EnvironmentService}=require('./environment-service.cjs');
const {NativeDesktop,ComputerControl}=require('./computer-control.cjs');
const {ComputerAgent}=require('./computer-agent.cjs');
const {chatComputerTask}=require('./chat-computer-task.cjs');
const {verifyComputerCompletion}=require('./computer-completion.cjs');
const {ComputerSession}=require('./computer-session.cjs');
const {BrowserMcp}=require('./browser-mcp.cjs');
const {SystemTools}=require('./system-tools.cjs');
const {SystemWorkerClient}=require('./system-worker-client.cjs');
const {MemoryPlugin}=require('./memory-plugin.cjs');
const {WorkspaceContext}=require('./workspace-context.cjs');
const {isSocialTurn,screenContextRequested}=require('./conversation-context.cjs');
class DeviceServices{
 constructor({directory,api,encrypt,decrypt,screen,capture,captureWorkspace,notify,publish=()=>{},onComputerStart=()=>{},onComputerFinish=()=>{},excludedWindowHandles=()=>[],chooseRoots,saveFile,openSource=()=>{},openExternal=()=>{},defaultRoots=[],native=new NativeDesktop(),background=true,browser,system,trashItem,openPath}){
  Object.assign(this,{api,publish,chooseRoots,saveFile,openSource,defaultRoots,background});this.indexCancelled=false;this.indexing=null;this.bridgeSupported=null;
  this.memory=new LocalMemory(path.join(directory,'memory'),{encrypt,decrypt});
  this.environment=new EnvironmentService({memory:this.memory,locate:()=>native.request('location'),notify,publish});
  this.control=new ComputerControl({native,capture,screen,excludedWindowHandles});
  this.browser=browser||new BrowserMcp({directory:path.join(directory,'browser'),...(__dirname.includes('app.asar')?{entry:path.join(process.resourcesPath,'browser','chrome-devtools-mcp','build','src','bin','chrome-devtools-mcp.js')}:{})});
  const roots=[require('node:os').homedir(),...defaultRoots];
  this.system=system===null?null:system||new SystemTools({roots,trash:trashItem,openPath,publish:event=>{if(event.event==='system-artifacts'&&this.memory.account&&this.agent?.task?.id===event.taskId){this.memory.rememberSystemArtifacts(event.artifacts);this.plugins?.rememberArtifacts(event.artifacts);}publish(event);},remote:new SystemWorkerClient({native,roots})});
  this.browserSessions=new (require('./browser-sessions.cjs').BrowserSessions)({memory:this.memory});
  this.computerSession=new ComputerSession();
  this.browser.focusWindow=async({processId,title,check})=>{
   const actual=await native.request('foreground');check();const matches=(actual.windows||[]).filter(w=>w.processId===processId&&String(w.title).replace(/ - (?:Google )?Chrome$/i,'')===title&&!excludedWindowHandles().includes(w.handle));
   if(matches.length!==1)throw Object.assign(Error('Chrome görevinin penceresi kesin olarak eşlenemedi. İlgili Chrome penceresini öne getirip devam et.'),{code:'BROWSER_TARGET_REQUIRED'});
   const target=matches[0];if(actual.handle!==target.handle){await native.request('window_manage',{handle:target.handle,processId,operation:'focus'});check();}
   const foreground=await native.request('foreground');check();if(foreground.handle!==target.handle||foreground.processId!==processId)throw Object.assign(Error('Windows Chrome penceresini öne getirmeyi reddetti.'),{code:'NATIVE_FOCUS_DENIED'});
   this.workspace?.rememberForeground(foreground);
  };
  this.agent=new ComputerAgent({control:this.control,browser:this.browser,system:this.system,api,memory:this.memory,onObservation:(_task,view)=>{this.computerSession.observe(view);if(!view.browser&&!view.system)this.workspace?.rememberForeground(view);},sessionContext:()=>this.computerSession.context(true,{conversationId:this.agent?.task?.origin?.conversationId}),verifyCompletion:task=>verifyComputerCompletion(task.origin?task.origin.userRequest:task.goal,{desktop:this.defaultRoots[0]}),publish:event=>{if(event.event==='computer-task'){const task=this.agent.task;this.computerSession.update(task);if(task&&task.status!=='running')this.recordComputerLine(task,'assistant',task.message);}publish(event);},onStart:onComputerStart,onFinish:()=>{const status=this.agent.task?.status;if(!status||['completed','failed','stopped'].includes(status))void (native.finishTask?native.finishTask():native.release?.());onComputerFinish();}});
  this.workspace=new WorkspaceContext({session:this.computerSession,publish,isBusy:()=>this.agent.task?.status==='running',readForeground:async({reason}={})=>{const view=await native.request(reason==='timer'?'observe':'foreground');return {...view,processId:view.processId||(view.windows||[]).find(w=>w.handle===view.handle)?.processId};},readTarget:({handle,processId})=>native.request('observe_window',{handle,expectedProcessId:processId}),readBrowser:async({view,reason}={})=>{if(reason==='timer')return this.browser.browser?.ownsProcess?.(view?.processId)?this.browser.passiveState?.():{connected:false};return this.browser.syncForeground?this.browser.syncForeground(view):{connected:false};},isSensitive:view=>!!view?.requiresElevation||!!this.secretBroker?.active||!!this.secretBroker?.protected.size||this.waits?.state()?.kind==='otp'||/1password|keepass|bitwarden|parola|password|kimlik doğrulama/i.test(view?.title||'')});
  this.plugins=new MemoryPlugin({directory:path.join(directory,'plugins'),memory:this.memory,encrypt,decrypt,openExternal,publish,workspace:this.workspace});
  if(captureWorkspace){const {PassiveAnalysis}=require('./passive-analysis.cjs');this.passiveAnalysis=new PassiveAnalysis({api,publish,resolveModel:async()=>{const model=await this.modelRoles('resolve',{role:'computer'});if(!require('./computer-agent.cjs').visionModel(model))throw Error('Ekran özeti için görsel model gerekiyor.');return model;}});this.workspace.capture=captureWorkspace;this.workspace.analyze=async input=>this.secretBroker.redact(await this.passiveAnalysis.analyze(input));}
  const browserIdentity=async()=>{const current=this.browser.passiveState?.();if(!current?.connected)return null;const listed=require('./browser-mcp.cjs').parsePages(await this.browser.call('list_pages'));const page=listed.find(p=>p.selected),actual=this.browser.passiveState?.();if(!actual?.connected||actual.connectionId!==current.connectionId||actual.profileKey!==current.profileKey||!page||page.id!==current.pageId||actual.pageId!==current.pageId)return null;try{return {...actual,origin:new URL(page.url).origin};}catch{return null;}};
  this.browserIdentity=browserIdentity;
  this.secretBroker=new (require('./secret-broker.cjs').SecretBroker)({store:this.plugins.store,publish,identity:browserIdentity,authorize:async({taskId,recordId,target})=>{const task=this.agent.task;if(task?.id!==taskId||task.epoch!==this.memory.epoch)return false;const entry=(await this.plugins.store.list()).find(r=>r.id===recordId);return entry?.public?.origin===target.origin&&/giriş|hesap|parola|şifre|kart|ödeme|satın|alışveriş|login|sign in/i.test(task.origin?.userRequest||task.goal);},fill:async({target,fields,secret,submitTarget})=>{this.checkout?.guard('secret_fill');const view=this.browser.observation;if(!view||view.browser.pageId!==target.pageId)throw Error('Gizli alan için güncel sekme gerekiyor.');for(const uid of [...Object.values(fields),...(submitTarget?[submitTarget]:[])])if(typeof uid!=='string'||!this.browser.fullSnapshot.includes('uid='+uid+' '))throw Error('Gizli alan kimliği güncel değil.');for(const [field,uid]of Object.entries(fields)){if(typeof secret[field]!=='string')throw Error('Kasadaki alan bulunamadı.');await this.browser.call('fill',{pageId:target.pageId,uid,value:secret[field]});}if(submitTarget)await this.browser.call('click',{pageId:target.pageId,uid:submitTarget});this.browser.lastResult='Gizli alanlar yerelde uygulandı; gizli değerler döndürülmedi.';this.browser.resultSource=null;this.browser.fullSnapshot='';}});
  this.browser.secretBroker=this.secretBroker;
  this.control.allowCapture=view=>this.waits?.state()?.kind!=='otp'&&!this.secretBroker.active&&(!this.secretBroker.protected.size||!/(?:chrome|tarayıcı)/i.test(view.title||''));this.control.sanitize=value=>this.secretBroker.redact(value);this.plugins.secretFinish=()=>this.secretBroker.invalidate();
  this.waits=new (require('./interaction-waits.cjs').InteractionWaits)();
  this.checkout=new (require('./checkout-flow.cjs').CheckoutFlow)({memory:this.memory,publish,observe:async()=>{await this.browser.observe();const target=await browserIdentity();return {target,snapshot:this.browser.fullSnapshot};}});
  this.checkoutTools=new (require('./checkout-tools.cjs').CheckoutTools)({flow:this.checkout,waits:this.waits,catalog:this.plugins.catalog,submit:async({target,submitUid},context)=>{const actual=await browserIdentity();context.check();if(!require('./checkout-flow.cjs').sameTarget(actual,target))throw Error('Sipariş sekmesi değişti; gönderim tekrarlanmadı.');await this.browser.call('click',{pageId:target.pageId,uid:submitUid});this.browser.fullSnapshot='';this.browser.observation=null;}});
  this.agent.beforeComplete=task=>{if(this.checkout.list().some(i=>i.taskId===task.id&&['review','approved','submitting','uncertain','user-resolved'].includes(i.status)))throw Object.assign(Error('Siparişin tamamlandığı doğrulanmadı. Sohbetteki sipariş kaydını incele; yeniden ödeme yapma.'),{code:'CHECKOUT_REVIEW_REQUIRED'});};
  this.browser.guard=(name,args)=>this.checkout.guard(name,args);
  this.control.guard=name=>this.checkout.guard(name);
  this.checkpoints=new (require('./task-workspace.cjs').TaskWorkspace)({memory:this.memory});
  this.agent.pendingInteraction=()=>this.waits.state();
  this.plugins.savedTasks=()=>this.checkpoints.list();this.plugins.restoreTask=async id=>{const existing=this.watchers.state().find(w=>w.taskId===id&&['watching','ready','paused','expired'].includes(w.status));if(existing&&this.agent.suspended?.has(id)){if(existing.status==='watching')return {id,status:'watching',goal:existing.goal,message:existing.message,watchId:existing.id};return this.computer('watch-continue',{id:existing.id});}if(this.agent.task?.id===id&&this.agent.task.status==='paused'&&!this.agent.task.stopUnconfirmed)return this.agent.resumePaused();const epoch=this.memory.epoch,lease={};this.foregroundIntent=lease;try{for(const item of this.watchers.state())if(item.taskId===id&&['watching','ready','paused'].includes(item.status))this.watchers.cancel(item.id);await this.checkpoints.pauseForNewTask(this.agent);this.agent.suspended?.delete(id);this.memory.check(epoch);const previous=this.checkpoints.restore(id),model=await this.modelRoles('resolve',{role:'computer'});this.memory.check(epoch);this.control.enable(true);return await this.agent.run(previous.goal,model,{...(previous.origin||{}),userRequest:previous.origin?.userRequest||previous.goal,checkpoint:previous,anchorMessageId:previous.origin?.anchorMessageId||'local-resume'});}finally{if(this.foregroundIntent===lease){this.foregroundIntent=null;this.watchers.arm();}}};
  const originalPublish=this.agent.publish;this.agent.publish=event=>{if(event.event==='computer-task'&&this.memory.account){try{this.checkpoints.checkpoint(this.agent.task);}catch{}}originalPublish(event);const task=this.agent.task;if(event.event==='computer-task'&&task?.watchContinuation&&['completed','failed'].includes(task.status)&&!task.continuationAnnounced){task.continuationAnnounced=true;publish({event:'computer-background-complete',task:this.agent.state()});}};
  this.plugins.interactions={definitions:()=>[{name:'interaction_wait',description:'Wait for OTP/address/payment choice in this task. OTP is filled locally and never returned to the model. For final purchase/address confirmation use checkout_review. Use current field/submit UIDs; never provide a secret.',inputSchema:{type:'object',properties:{kind:{type:'string',enum:['otp','address','shipping-confirm','payment-choice']},question:{type:'string'},uid:{type:'string'},submitUid:{type:'string'}},required:['kind','question'],additionalProperties:false}}],perform:async(name,args,context)=>{
   context.check();const target=await browserIdentity();context.check();if(!target?.profileTrusted)throw Error('Kullanıcı katkısı için doğru tarayıcı profilini seçin.');const binding={origin:target.origin,profileKey:target.profileKey,connectionId:target.connectionId,pageId:target.pageId};
   if(args.kind==='otp'){const {bindField}=require('./interaction-fields.cjs');binding.field=bindField(this.browser.fullSnapshot,args.uid);if(args.submitUid)binding.submit=bindField(this.browser.fullSnapshot,args.submitUid,{submit:true});for(const order of this.checkout.list())if(['review','approved'].includes(order.status)||['submitting','uncertain'].includes(order.status)&&binding.submit&&order.buttonKey===require('./checkout-flow.cjs').controlKey(binding.submit))throw Object.assign(Error('OTP son sipariş düğmesini gönderemez; önce sipariş teyidini ve sonucunu incele.'),{code:'CHECKOUT_REVIEW_REQUIRED'});}
   const result=this.waits.wait({taskId:context.taskId,kind:args.kind,target:binding,question:args.question});return {waiting:true,kind:result.kind,question:result.question};}};

  this.plugins.useSecret=async(args,context)=>{context.check();this.checkout.guard('secret_use');const target=await browserIdentity();const lease=await this.secretBroker.begin({taskId:context.taskId,...args,target});return this.secretBroker.perform(lease.id);};
  if(this.system){this.system.guard=(name,args)=>{this.checkout.guard(name,args);this.secretBroker.assertToolAllowed(name,args);if(name.startsWith('files_'))for(const key of ['path','source','destination'])if(args[key]){const normalize=p=>process.platform==='win32'?path.resolve(p).toLowerCase():path.resolve(p),target=normalize(args[key]),privateRoots=[path.join(directory,'plugins'),...this.plugins.bridge.protectedPaths()].map(normalize);if(privateRoots.some(privateRoot=>target===privateRoot||target.startsWith(privateRoot+path.sep)||['files_copy','files_move','files_rename','files_trash'].includes(name)&&privateRoot.startsWith(target+path.sep)))throw Error('Şifreli kasa dosyaları genel dosya aracından okunamaz; Eklentiler içindeki aktarımı kullan.');}};this.system.sanitize=value=>this.secretBroker.redact(value);}
  this.ssh=new (require('./ssh-tools.cjs').SshTools)({store:this.plugins.store,memory:this.memory});
  if(this.system){this.system.adapters.push(this.checkoutTools,this.plugins,this.plugins.interactions,this.ssh,new (require('./windows-tools.cjs').WindowsTools)({native,excluded:excludedWindowHandles}));this.system.authorization=()=>this.agent.task?.userAuthorization||[];}
  const {TaskWatchers}=require('./task-watchers.cjs'),{TaskWatchTools}=require('./task-watch-tools.cjs');
  this.watchers=new TaskWatchers({memory:this.memory,isBusy:()=>!!this.foregroundIntent||!!this.system?.stopError||['running','paused','question','confirmation','permission','failed'].includes(this.agent.task?.status),isReadBusy:target=>target.kind==='browser'&&this.agent.task?.status==='running'&&this.agent.task.mode==='browser',isSensitive:()=>!!this.secretBroker.active||!!this.secretBroker.protected.size||this.waits.state()?.kind==='otp',
   read:async(target)=>{if(target.kind==='process'){const result=await this.system.readTaskJobs(target);return {identity:result.identity,text:result.finished?'__UMAY_PROCESS_FINISHED__':'running',results:result.results};}if(target.kind==='browser')return this.browser.readWatchTarget(target);if(excludedWindowHandles().includes(target.handle))return {identity:false};const view=await native.request('observe_window',{handle:target.handle,expectedProcessId:target.processId});if(view.requiresElevation)throw Error('İzlenen pencere yönetici izni istiyor.');if(/1password|keepass|bitwarden|parola|password|kimlik doğrulama/i.test(view.title||''))return {busy:true};if(view.handle!==target.handle||view.processId!==target.processId||/^Umay(?:\s|$|—)/i.test(view.title||''))return {identity:false};return {identity:true,text:this.secretBroker.redact([view.title,...(view.elements||[]).filter(e=>e.type!=='ControlType.Edit').map(e=>e.name||'')].join('\n'))};},
   resume:async watcher=>{this.memory.require();if(!this.agent.suspended?.has(watcher.taskId))throw Error('Kaydedilen işe açıkça devam etmek gerekiyor.');this.control.enable(true);return this.agent.resumeSaved(watcher.taskId,watcher,{detached:true});},publish:event=>{publish(event);for(const item of event.watchers){if(item.status==='ready'&&!this.notifiedWatches?.has(item.id)){this.notifiedWatches??=new Set();this.notifiedWatches.add(item.id);notify?.({title:'Umay — İzlenen iş hazır',body:item.goal.slice(0,200)});}}}
  });
  this.agent.pendingWatch=taskId=>this.watchers.pending(taskId);
  const watchTools=this.watchTools=new TaskWatchTools({watchers:this.watchers,agent:this.agent,browser:this.browser,native});
  if(this.system)this.system.adapters.push(watchTools);
  this.agent.startWatch=async(task,action,view)=>{const window=(view.windows||[]).find(w=>w.handle===action.windowHandle)||(view.handle===action.windowHandle?view:null),args={kind:'desktop',windowHandle:action.windowHandle,processId:window?.processId,durationMs:action.milliseconds,intervalMs:action.intervalMs};for(const k of ['contains','absent','changed'])if(action[k]!==undefined)args[k]=action[k];const result=await watchTools.perform('task_watch_start',args,{taskId:task.id,check:()=>this.agent.check(task)});return this.watchers.state().find(w=>w.id===result.watchId);};
  this.agent.onStart=async()=>{const startingTask=this.agent.task;await onComputerStart();this.agent.check(startingTask);const watched=startingTask.watchContinuation;if(watched){this.agent.check(startingTask);const fresh=await this.watchers.read(watched.target);this.agent.check(startingTask);if(!fresh?.identity)throw Error('İzlenen hedef artık aynı değil; devam durduruldu.');if(watched.target.kind==='process'){this.system.store({toolName:'process_status',result:fresh.results});startingTask.mode='system';return;}if(watched.target.kind==='desktop')await native.request('window_manage',{handle:watched.target.handle,processId:watched.target.processId,operation:'focus'});else await this.browser.call('select_page',{pageId:watched.target.pageId,bringToFront:true});this.agent.check(startingTask);startingTask.mode=watched.target.kind==='browser'?'browser':'desktop';return;}await this.workspace.refresh({reason:'command'});this.agent.check(startingTask);const task=startingTask,reference=this.workspace.resolve(task?.origin?.userRequest||task?.goal||'');if(task&&reference.reference&&reference.needsTarget&&reference.reason)throw Object.assign(Error(reference.reason),{code:'BROWSER_TARGET_REQUIRED'});if(task&&reference.reference&&!reference.needsTarget){task.activeTarget=reference;task.mode=reference.executor==='browser'&&this.browser?'browser':'desktop';}};
 }
 recordComputerLine(task,role,content){
  const id=task?.origin?.conversationId;if(!id||!content||task.epoch!==this.memory.epoch||!this.memory.account)return;
  if(task.origin.anchorMessageId)this.memory.setSetting('computer.anchor:'+task.id,task.origin.anchorMessageId);
  if(task.lastChatLine===role+':'+content)return;task.lastChatLine=role+':'+content;task.chatCounter=(task.chatCounter||0)+1;
  const parent=this.memory.require().prepare('SELECT * FROM conversations WHERE id=?').get(id),latest=this.memory.require().prepare('SELECT max(created_at) AS date FROM messages WHERE conversation_id=?').get(id)?.date;
  task.lastChatAt=Math.max(Date.now(),(task.lastChatAt||0)+1,(Date.parse(latest)||0)+1);
  this.memory.archiveConversation({id,title:parent?.title||task.goal},[{id:'computer:'+task.id+':'+task.chatCounter,role,content,createdAt:new Date(task.lastChatAt).toISOString()}]);
 }
 activate(account){
  if(String(account??'')===String(this.memory.account??''))return;
  this.foregroundIntent=null;this.watchers?.activate(null);this.agent.suspended?.clear();this.notifiedWatches?.clear();this.secretBroker?.invalidate();this.ssh?.activate(null);this.plugins?.activate(null);this.workspace?.activate(null);
  this.indexCancelled=true;void this.agent.stop().catch(()=>{});this.agent.task=null;this.control.enable(false);void this.control.native.release?.()?.catch(()=>{});this.system?.activate(account);this.environment.stop();this.environment.cache.clear();this.environment.sourceState.clear();this.memory.activate(account);
  if(account&&!this.memory.setting('browserConnectionPreferenceVersion',0)){const profile=this.browserSessions.current();if(profile.id==='default'&&!profile.endpoint){this.memory.setSetting('browserMode','existing');this.browserSessions.save({...profile,name:'Kendi Chrome profilim',mode:'existing'});}this.memory.setSetting('browserConnectionPreferenceVersion',1);}
  this.browser.activate(account,account?(this.browserSessions.current().id==='default'?this.memory.setting('browserMode','existing'):this.browserSessions.current().mode):'managed',account?this.browserSessions.current():{id:'default'});this.computerSession.reset();this.bridgeSupported=null;
  this.workspace?.activate(account);this.plugins?.activate(account);this.ssh?.activate(account);if(account)this.checkpoints.activate();this.checkout.activate();this.watchers?.activate(account);this.waits.cancel();
  if(account&&this.background){this.environment.start();const epoch=this.memory.epoch;if(!this.memory.setting('location'))void this.environment.detectLocation().then(()=>{if(epoch===this.memory.epoch)this.publish({event:'environment-updated',state:this.environment.state()});}).catch(()=>{});void this.syncHistory(epoch).catch(()=>{});if(!this.memory.setting('indexInitialized',false))void Promise.resolve(this.indexing).catch(()=>{}).then(()=>{this.memory.check(epoch);return this.index(this.defaultRoots);}).then(result=>{if(!result.cancelled&&epoch===this.memory.epoch)this.memory.setSetting('indexInitialized',true);}).catch(error=>{if(epoch===this.memory.epoch)this.publish({event:'device-warning',message:error.message});});}
 }
 async syncHistory(epoch){
  const result=await this.api('/site/chat/conversations');this.memory.check(epoch);
  for(const conversation of (result.conversations||[])){
   this.memory.check(epoch);this.memory.archiveConversation(conversation);
   let cursor=null;const seen=new Set();
   do{const detail=await this.api('/site/chat/conversations/'+conversation.id+(cursor?'?before='+cursor:''));this.memory.check(epoch);this.memory.archiveConversation(detail.conversation,detail.messages);cursor=detail.hasMoreMessages?detail.nextBeforeId:null;if(cursor&&seen.has(cursor))break;if(cursor)seen.add(cursor);}while(cursor);
  }
  // Capture the central Veriussu profile in a separate, sourced local note.
  try{const remote=await this.api('/site/user-memory');this.memory.check(epoch);const text=JSON.stringify(remote);if(text!=='{}'&&text.length>2)this.memory.putNode({kind:'remote',key:'veriussu.memory',title:'Veriüssü hafızası',content:text.slice(0,10000),tags:['Veriüssü']});}catch(error){if(epoch!==this.memory.epoch)throw error;}
 }
 async rememberWorkspaceForeground(){
  if(!this.memory.account||this.agent.task?.status==='running'||this.secretBroker?.active||this.secretBroker?.protected.size||this.waits.state()?.kind==='otp')return false;
  const epoch=this.memory.epoch,view=await this.control.native.request('foreground');this.memory.check(epoch);
  return this.workspace.rememberForeground(view);
 }
 async prepareContext(query,{conversationId}={}){
  const epoch=this.memory.epoch;
  const social=isSocialTurn(query);
  const context={turn:{request:query,conversationId:conversationId||null,intent:social?'social':'request'},capabilities:{computerControl:true,protocol:'umay-computer-task-v1',chromeMcp:true,browserProtocol:'umay-browser-mcp-v1',controlPerformance:'v1',systemTools:'umay-system-tools-v1'},memory:this.memory.context(social?'':query),environment:this.environment.context(query),...(social?{}:{computerExperience:this.memory.computerExperience(query),browser:this.browser.state()})};
  if(social){context.memory={profile:context.memory.profile,notes:[],messages:[],lastOperations:[]};}
  else {await this.workspace.refresh({reason:'command',inspect:screenContextRequested(query)});this.memory.check(epoch);context.computer={...this.computerSession.context(false,{conversationId}),usage:'Historical task receipts only; activeWorkspace is the current read-only target. Only turn.request authorizes new work.'};context.activeWorkspace=this.workspace.resolve(query);}
  context.personalMemory=social?[]:this.plugins.catalog.context(query);
  if(/hava|sıcaklık|yağmur|kar yağ|şemsiye|rüzgâr|rüzgar/i.test(query)){
   try{context.environment.weather=await this.environment.weather();}catch(error){context.environment.weather={available:false,message:error.message};}
  }
  if(/dosya|klasör|yolu|nerede|\.pdf|\.docx|\.xlsx/i.test(query)){
   const filename=query.match(/[\p{L}\p{N}_() -]+\.[a-z0-9]{1,8}\b/iu)?.[0]?.trim();context.files=this.memory.findFiles(filename||query.split(/\s+/).filter(w=>w.length>3)[0]||'').slice(0,8);
  }
  let text=JSON.stringify(context);while(text.length>11500&&context.memory.messages.length){context.memory.messages.pop();text=JSON.stringify(context);}while(text.length>11500&&context.memory.profile.length){context.memory.profile.pop();text=JSON.stringify(context);}while(text.length>11500&&context.personalMemory.length>2){context.personalMemory.pop();text=JSON.stringify(context);}
  if(text.length>12000){const computer=context.computer?this.computerSession.context(true,{conversationId}):undefined;if(computer?.system){computer.system.artifacts=computer.system.artifacts.slice(-2);computer.system.roots=computer.system.roots.slice(0,2);}if(computer?.browser){computer.browser.pages=computer.browser.pages?.slice(0,3);computer.browser.summary=computer.browser.summary.slice(0,600);}const workspace=structuredClone(context.activeWorkspace);if(workspace?.target?.browser){workspace.target.browser.pages=workspace.target.browser.pages.slice(0,3);workspace.target.browser.summary=workspace.target.browser.summary.slice(0,700);}text=JSON.stringify({turn:context.turn,capabilities:context.capabilities,...(computer?{computer}:{}),activeWorkspace:workspace,personalMemory:context.personalMemory.slice(0,2).map(r=>({...r,content:r.content.slice(0,600),fields:{},fieldsOmitted:true})),environment:context.environment.clock,memory:{profile:[],messages:[],operations:context.memory.operations?.slice(0,2)||[]},truncated:true});}
  if(text.length>12000)throw Error('Güncel çalışma bağlamı çok büyük; açık görevi duraklatıp yeniden deneyin.');return text;
 }
 async siteApi(route,body){
  if(!this.memory.account)return this.api(route,body);const epoch=this.memory.epoch,match=route.match(/^\/site\/chat\/conversations\/([^/]+)\/messages$/);let payload=body;
  if(match&&body){
   const context=await this.prepareContext(body.content,{conversationId:match[1]});this.memory.check(epoch);this.memory.outgoing(match[1],body.requestId,body.content);
   payload={...body,desktopMode:'context',desktopContext:context};
  }
  let result;
  try{result=await this.api(route,payload);}
  catch(error){
   if(epoch===this.memory.epoch&&match&&body)this.memory.outgoing(match[1],body.requestId,body.content,'failed');
   if(error.message==='LOGIN_REQUIRED')this.activate(null);
   if(match&&payload!==body&&error.message==='INVALID_REQUEST')throw Error('DESKTOP_CAPABILITY_UNAVAILABLE');
   throw error;
  }
  this.memory.check(epoch);
  if(match&&body){this.memory.outgoing(match[1],body.requestId,body.content,'submitted');if(payload!==body&&this.bridgeSupported!==false)this.bridgeSupported=true;this.memory.log('chat-send','Kullanıcı mesajı kaydedildi',{details:{conversationId:match[1]}});}
  if(result.conversation)this.memory.archiveConversation(result.conversation,result.messages||[]);
  if(result.conversation&&Array.isArray(result.messages)&&!route.includes('?')){
   const earliest=Math.min(...result.messages.map(m=>Date.parse(m.createdAt||m.created_at)||0));
   const local=this.memory.conversation(result.conversation.id).filter(m=>m.id.startsWith('computer:')).map(m=>({id:m.id,role:m.role,content:m.content,createdAt:m.created_at,localComputerTask:true,parentMessageId:this.memory.setting('computer.anchor:'+m.id.split(':')[1])}));
   const ids=new Set(result.messages.map(m=>m.id)),merged=[];for(const message of result.messages){merged.push(message);merged.push(...local.filter(m=>!ids.has(m.id)&&m.parentMessageId===message.id));}
   merged.push(...local.filter(m=>!ids.has(m.id)&&!m.parentMessageId&&(!result.hasMoreMessages||Date.parse(m.createdAt)>=earliest)));result.messages=merged;
  }
  if(route==='/site/chat/conversations'&&!body)for(const c of result.conversations||[])this.memory.archiveConversation(c);
  if(/\/site\/chat\/runs\//.test(route)&&result.run&&!['QUEUED','RUNNING'].includes(result.run.status))this.memory.log('chat-run','Model yanıt işlemi '+result.run.status.toLocaleLowerCase('tr'),{status:result.run.status,details:{runId:result.run.id,errorCode:result.run.errorCode||null}});
  return result;
 }
 async index(roots){if(this.indexing)throw Error('Dosya yolu taraması zaten sürüyor.');this.memory.require();this.indexCancelled=false;this.indexing=this.memory.indexFiles(roots,{cancelled:()=>this.indexCancelled,onProgress:progress=>this.publish({event:'file-index',progress})});try{const result=await this.indexing;this.publish({event:'file-index',progress:{...result,done:true}});return result;}finally{this.indexing=null;}}
 async local(method,input={}){
  this.memory.require();
  switch(method){
   case 'snapshot':return this.memory.snapshot(input);
   case 'conversation':return this.memory.conversation(input.id);
   case 'save':{const id=this.memory.putNode(input);this.memory.log('memory','Hafıza kaydı kaydedildi',{details:{id}});return {id};}
   case 'archive':return this.memory.archiveNode(input.id);
   case 'files':return this.memory.findFiles(String(input.query||''));
   case 'private-list':return this.memory.privateAccounts();
   case 'private-save':return this.memory.savePrivate(input);
   case 'private-delete':return this.memory.deletePrivate(input.id);
   case 'index':{const epoch=this.memory.epoch,chosen=await this.chooseRoots();this.memory.check(epoch);if(!chosen?.length)return null;return this.index([...new Set([...this.memory.setting('indexRoots',[]),...chosen])]);}
   case 'reindex':return this.index(this.memory.setting('indexRoots',this.defaultRoots));
   case 'cancel-index':this.indexCancelled=true;return true;
   case 'export':{const epoch=this.memory.epoch,text=this.memory.exportMarkdown(),file=await this.saveFile();this.memory.check(epoch);if(!file)return null;await fs.promises.writeFile(file,text,'utf8');this.memory.log('memory-export','Hafıza Markdown olarak dışa aktarıldı',{details:{file}});return {path:file};}
   default:throw Error('Hafıza işlemi geçersiz.');
  }
 }
 async environmentAction(method,input={}){
  this.memory.require();switch(method){
   case 'state':return this.environment.state();
   case 'location':return this.environment.detectLocation();
   case 'search-city':return this.environment.searchCity(input.query);
   case 'set-location':return this.environment.setLocation(input);
   case 'weather':return this.environment.weather(input);
   case 'check':await this.environment.poll({force:true});return this.environment.state();
   case 'settings':return this.environment.saveSettings(input);
   case 'add-feed':return this.environment.addFeed(input);
   case 'remove-feed':this.memory.setSetting('customFeeds',this.memory.setting('customFeeds',[]).filter(s=>s.id!==input.id));return true;
   case 'read':this.memory.require().prepare('UPDATE alerts SET read=1 WHERE id=?').run(input.id);return true;
   case 'open-source':{const url=input.id==='weather'?'https://www.met.no/en/free-meteorological-data/Licensing-and-crediting':this.memory.require().prepare('SELECT url FROM alerts WHERE id=?').get(input.id)?.url;if(!url||!/^https:\/\//.test(url))throw Error('Kaynak bağlantısı bulunamadı.');return this.openSource(url);}
   default:throw Error('Konum/bildirim işlemi geçersiz.');
  }
 }
 async modelRoles(method,input={}){
  this.memory.require();const epoch=this.memory.epoch,result=await this.api('/site/chat/models');this.memory.check(epoch);
  const models=result.models||[],roles={chat:null,computer:null,...this.memory.setting('modelRoles',{})};
  const find=value=>value&&models.find(m=>m.id===value.id&&m.source===value.source);
  if(method==='state')return {roles,models};
  if(method==='save'){
   for(const role of ['chat','computer'])if(Object.hasOwn(input,role)){
    const value=input[role];if(value!==null&&!find(value))throw Error('Seçilen modele erişilemiyor. Modelleri yenileyip tekrar seçin.');
    roles[role]=value?{id:value.id,source:value.source}:null;
   }
   this.memory.setSetting('modelRoles',roles);this.memory.log('model-roles','Sohbet ve bilgisayar model rolleri güncellendi');return {roles,models};
  }
  if(method==='resolve'){
   if(!['chat','computer'].includes(input.role))throw Error('Model rolü geçersiz.');
   const assigned=roles[input.role],selected=find(assigned||input.model);
   if(assigned&&!selected)throw Error((input.role==='computer'?'Bilgisayar kontrolüne':'Sohbete')+' atanan modele erişilemiyor. Ayarlar / Modeller sayfasından yeniden atayın.');
   if(selected)return selected;
   if(input.model)throw Error('Seçilen modele erişilemiyor.');
   const fallback=input.role==='computer'?models.find(m=>require('./computer-agent.cjs').visionModel(m))||models[0]:models[0];
   if(!fallback)throw Error('Kullanılabilir model bulunamadı. Veriüssü hesabınıza model ekleyin.');return fallback;
  }
  throw Error('Model rolü işlemi geçersiz.');
 }
 async computer(method,input={}){
  this.memory.require();switch(method){
   case 'pause-for-new-task':{if(typeof input.requestId==='string')this.foregroundIntent=input.requestId;try{const task=this.agent.task,pending=task?this.system?.pendingForTask(task.id):[];if(task&&['running','failed'].includes(task.status)&&pending?.length){try{const epoch=this.memory.epoch,jobIds=await this.system.parkTask(task.id);this.memory.check(epoch);if(this.agent.task!==task)throw Error('Arka plan görevi değişti.');this.agent.suspended??=new Map();this.agent.suspended.set(task.id,task);await this.agent.pause({keepBackground:true});if(task.stopUnconfirmed)throw Error('Süreç sahipliği bırakılamadı.');const watcher=await this.watchers.create({taskId:task.id,goal:task.goal,origin:task.origin,target:{kind:'process',taskId:task.id,jobIds},condition:{contains:'__UMAY_PROCESS_FINISHED__'},check:()=>{this.memory.check(epoch);if(!this.system.parked.has(task.id)||task.stopUnconfirmed)throw Error('Arka plan süreç izni durduruldu.');}});task.status='watching';task.watchId=watcher.id;task.watchStartedAt=task.pauseStartedAt||this.agent.now();task.message='Süreç işini arka planda takip ediyorum.';this.checkpoints.checkpoint(task);if(this.agent.task===task){this.agent.emit();this.agent.onFinish();}return {watching:true,task:{id:task.id,status:task.status,goal:task.goal}};}catch(e){throw e;}}const previous=await this.checkpoints.pauseForNewTask(this.agent);this.waits.cancel();this.checkout.invalidate();return {paused:!!previous,task:previous};}catch(e){if(this.foregroundIntent===input.requestId)this.foregroundIntent=null;throw e;}}
   case 'message-finished':if(this.foregroundIntent===input.requestId){this.foregroundIntent=null;this.watchers.arm();}return {released:true};
   case 'checkouts':return this.checkout.list();
   case 'checkout-resolve':{const item=this.checkout.resolve(input);this.waits.cancel();if(this.agent.task?.id===item.taskId)await this.agent.stop();return item;}
   case 'watchers':return this.watchers.state();
   case 'watch-pause':{const result=this.watchers.pause(input.id),task=this.agent.task;if(task?.id===result.taskId&&task.status==='watching'){task.pausedStatus='watching';task.status='paused';task.message='Arka plan izlemesini duraklattım.';this.agent.emit();this.agent.onFinish();}else if(task?.id===result.taskId&&task.status==='running'&&task.watchContinuation?.id===input.id)await this.agent.pause({keepBackground:true});return result;}
   case 'watch-cancel':{const item=this.watchers.pause(input.id);await this.system?.cancelParkedTask(item.taskId);if(this.agent.task?.id===item.taskId&&['running','watching','paused'].includes(this.agent.task.status))await this.agent.stop({keepBackground:true});return this.watchers.cancel(input.id);}
   case 'watch-continue':{const item=this.watchers.state().find(w=>w.id===input.id);if(!item)throw Error('İzlenen iş bulunamadı.');if(item.status==='target-lost'||!this.agent.suspended?.has(item.taskId))return this.plugins.restoreTask(item.taskId);if(this.system?.stopError||this.agent.task?.stopUnconfirmed)throw Error('Önce işlemin durduğunu doğrulayın.');const result=await this.watchers.continue(input.id);const current=this.agent.task;if(current&&current.id!==item.taskId&&['paused','failed'].includes(current.status)&&!this.system?.pendingForTask(current.id).length){this.checkpoints.checkpoint(current);this.agent.task=null;}if(this.agent.task?.id===item.taskId&&['paused','stopped','watching'].includes(this.agent.task.status)){this.agent.task.status='watching';this.agent.task.message='Arka plan izlemesine devam ediyorum.';this.agent.emit();this.agent.onFinish();}return result;}
   case 'emergency-stop':return this.emergencyStop();
   case 'saved-tasks':return this.checkpoints.list();
   case 'state':return {enabled:this.control.enabled,task:this.agent.state(),access:this.control.native.state?.()||{administrator:false,pending:false}};
   case 'secure-answer':{
    const epoch=this.memory.epoch,task=this.agent.task,pending=this.waits.state();if(!task||pending?.taskId!==task.id||task.id!==input.id||pending.id!==input.waitId)throw Error('Yanıt bekleyen soru veya görev değişti.');const target=await this.browserIdentity();this.memory.check(epoch);if(pending.kind==='checkout-review'&&!/^(?:onayliyorum|evet onayliyorum|bu adresi ve siparisi onayliyorum|evet|tamam|olur)$/.test(require('./local-memory.cjs').fold(input.value).replace(/[.,!?]/g,'').trim()))throw Error('Sipariş için onaylıyorum veya vazgeç diyebilirsin.');
    const stillTask=()=>{this.memory.check(epoch);if(this.agent.task!==task||!['question','running'].includes(task.status))throw Error('Yanıt bekleyen görev durduruldu.');};
    await this.waits.answer({taskId:task.id,waitId:input.waitId,value:input.value,target},async(text,wait,check)=>{
     check();stillTask();
     if(wait.kind==='checkout-review'){
      const folded=require('./local-memory.cjs').fold(text).replace(/[.,!?]/g,'').trim();if(!/^(?:onayliyorum|evet onayliyorum|bu adresi ve siparisi onayliyorum|evet|tamam|olur)$/.test(folded))throw Error('Sipariş için “onaylıyorum” veya “vazgeç” diyebilirsin.');
      this.checkout.confirm({id:wait.checkout.id,taskId:task.id,reviewId:wait.checkout.reviewId,accepted:true});task.feedback='Kullanıcı yerel sipariş özetindeki adresi, toplamı ve ödeme yöntemini teyit etti. Yalnız checkout_submit kullan; güncel sayfa değişirse yeniden teyit et.';
     }else if(wait.kind==='otp'){
      await this.browser.observe();check();stillTask();const actual=await this.browserIdentity();check();stillTask();if(!require('./checkout-flow.cjs').sameTarget(actual,wait.target))throw Error('OTP sekmesi veya bağlantısı değişti.');const {resolveField}=require('./interaction-fields.cjs'),uid=resolveField(this.browser.fullSnapshot,wait.target.field),submitUid=wait.target.submit?resolveField(this.browser.fullSnapshot,wait.target.submit):null;
      this.secretBroker.values.add(text);this.secretBroker.protected.add(actual.profileKey+':'+actual.pageId);check();await this.browser.call('fill',{pageId:actual.pageId,uid,value:text});check();stillTask();
      if(submitUid){const final=await this.browserIdentity();check();stillTask();if(!require('./checkout-flow.cjs').sameTarget(final,wait.target))throw Error('OTP sonrası sekme değişti; onay uygulanmadı.');await this.browser.call('click',{pageId:actual.pageId,uid:submitUid});check();stillTask();}
      this.browser.lastResult='Tek kullanımlık kod yerelde uygulandı; sonucu güncel sayfadan doğrula.';this.browser.fullSnapshot='';task.feedback='Tek kullanımlık kod yerelde uygulandı; değer saklanmadı. Sonucu gözlemle; yanlışsa yeni kod için yeni interaction_wait kullan. Siparişi/ödemeyi yeniden gönderme.';
     }else if(wait.kind==='address'){
      const key='address:'+require('node:crypto').createHash('sha256').update(text.trim()).digest('hex');this.plugins.catalog.upsert({key,type:'address',title:'Kullanıcının verdiği kargo adresi',content:text,source:{kind:'user',id:task.id}});task.feedback='Kullanıcı adresi yerelde kaydetti; kaydı checkout_addresses ile oku. Siteye uyguladıktan sonra checkout_review ile bu siparişin adresini ve toplamını teyit et.';
     }else task.feedback='Kullanıcının bu görev için yanıtı: '+text;
    });this.memory.check(epoch);stillTask();task.requiresInput=null;task.status='question';return this.agent.resume(task.id,{answer:task.feedback});
   }
   case 'pause':this.waits.cancel();this.checkout.invalidate();this.watchers.pauseAll();if(this.agent.task&&input.userReply)this.recordComputerLine(this.agent.task,'user',input.userReply);if(this.agent.task&&['running','watching','question','confirmation','permission'].includes(this.agent.task.status))return this.agent.pause();await this.agent.stop();return {status:'paused',message:'Arka plan izlemesini durdurdum; başlattığım süreçler sonlandırıldı.'};
   case 'continue':if(this.agent.task?.pausedStatus==='watching'&&this.agent.task.watchId)return this.computer('watch-continue',{id:this.agent.task.watchId});if(input.id&&input.id!==this.agent.task?.id)throw Error('Devam ettirilecek görev değişti.');if(this.agent.task&&input.userReply)this.recordComputerLine(this.agent.task,'user',input.userReply);return this.agent.resumePaused();
   case 'enable':if(!input.enabled)await this.emergencyStop();this.memory.log('computer-permission',input.enabled?'Bilgisayar kontrolü açıldı':'Bilgisayar kontrolü kapatıldı');return {enabled:this.control.enable(input.enabled)};
   case 'preview':return this.control.observe({image:true});
   case 'run':{const sequence=this.agent.sequence,model=await this.modelRoles('resolve',{role:'computer',...(input.modelId?{model:{id:input.modelId,source:input.source}}:{})});if(sequence!==this.agent.sequence)throw Error('Bilgisayar görevi durduruldu.');return this.agent.run(input.goal,model);}
   case 'dispatch':{
    const epoch=this.memory.epoch,sequence=this.agent.sequence,{run}=await this.api('/site/chat/runs/'+String(input.runId));this.memory.check(epoch);
    if(sequence!==this.agent.sequence)throw Error('Bilgisayar görevi durduruldu.');
    const task=chatComputerTask(run?.mediaOptions?.desktopChatTask);
    if(!task||run.id!==input.runId||run.conversationId!==input.conversationId||!['COMPLETED','SUCCEEDED'].includes(run.status))throw Error('Bu sohbet için doğrulanmış bilgisayar görevi bulunamadı.');
    const age=Date.now()-Date.parse(run.createdAt);if(!Number.isFinite(age)||age< -60000||age>15*60000)throw Error('Bilgisayar görevi güncel değil. İsteğini yeniden yazabilirsin.');
    const key='computer.dispatch:'+run.id;if(this.memory.setting(key))throw Error('Bu sohbet görevi zaten başlatıldı.');
    const model=await this.modelRoles('resolve',{role:'computer'});this.memory.check(epoch);if(sequence!==this.agent.sequence)throw Error('Bilgisayar görevi durduruldu.');
    if(this.memory.setting(key))throw Error('Bu sohbet görevi zaten başlatıldı.');
    if(this.agent.task&&['running','question','confirmation','permission'].includes(this.agent.task.status))throw Error('Önce etkin bilgisayar görevini bitirin veya durdurun.');
    this.memory.setSetting(key,{startedAt:new Date().toISOString()});this.control.enable(true);
    return this.agent.run(task.goal,model,{conversationId:run.conversationId,runId:run.id,userRequest:task.userRequest,anchorMessageId:task.anchorMessageId,plan:task.plan,executor:task.executor});
   }
   case 'release-admin':await this.emergencyStop();this.system?.releaseAdministrator();await this.control.native.release?.();return {administrator:false,pending:false};
   case 'elevate':{const task=this.agent.task;if(!task||task.id!==input.id||task.status!=='permission')throw Error('Yönetici izni bekleyen etkin görev bulunamadı.');this.agent.check(task);if(!this.control.native.elevate)throw Error('Windows yönetici izni bu ortamda kullanılamıyor.');this.recordComputerLine(task,'user',input.userReply||'Windows yönetici onayını aç');await this.control.native.elevate();this.memory.check(task.epoch);this.control.native.retainAdministrator?.();this.agent.check(task);this.memory.log('computer-elevation','Kullanıcı Windows yönetici onayını verdi',{details:{taskId:task.id}});if(this.system)await this.system.elevate();this.memory.check(task.epoch);this.agent.check(task);return this.agent.resume(task.id,{approved:true,elevated:true});}
   case 'stop':{this.watchers.pauseAll();this.waits.cancel();this.checkout.invalidate();if(this.agent.task?.id===input.id&&input.userReply)this.recordComputerLine(this.agent.task,'user',input.userReply);const result=await this.agent.stop();if(/^(?:vazgec|iptal|iptal et|hayir|onaylamiyorum)$/.test(require('./local-memory.cjs').fold(input.userReply||'').trim()))for(const order of this.checkout.list())if(order.taskId===input.id&&['review','approved'].includes(order.status))this.checkout.resolve({id:order.id,resolution:'cancel-unsent'});return result;}
   case 'resume':{const task=this.agent.task;if(task?.id===input.id)this.recordComputerLine(task,'user',input.userReply||input.answer||(input.approved?'Onaylıyorum.':'Vazgeçtim.'));return this.agent.resume(input.id,input);}
   default:throw Error('Bilgisayar kontrol işlemi geçersiz.');
  }
 }
 async browserAction(method,input={}){
  this.memory.require();const epoch=this.memory.epoch;
  if(method==='state')return {...this.browser.state(),sessions:this.browserSessions.state()};
  if(this.agent.task&&['running','paused','confirmation','question','permission'].includes(this.agent.task.status))throw Error('Tarayıcı bağlantısını değiştirmeden önce etkin görevi durdurun.');
  if(method==='profiles-save'){const result=this.browserSessions.save(input);return result;}
  if(method==='profile-select'){await this.browser.stop();this.memory.check(epoch);const profile=this.browserSessions.select(input.id);this.browser.activate(this.memory.account,profile.mode,profile);return this.browser.state();}
  if(method==='settings'){
   if(!['managed','existing'].includes(input.mode))throw Error('Chrome bağlantı seçimi geçersiz.');await this.browser.stop();this.memory.check(epoch);this.memory.setSetting('browserMode',input.mode);this.memory.setSetting('browserConnectionPreferenceVersion',1);const profile=this.browserSessions.current();this.browserSessions.save({...profile,mode:input.mode});this.browser.activate(this.memory.account,input.mode,{...profile,mode:input.mode});return this.browser.state();
  }
  if(method==='connect'){await this.browser.observe();this.memory.check(epoch);return this.browser.state();}
  if(method==='open-url'){const view=await this.browser.observe();this.memory.check(epoch);await this.browser.perform({toolName:'new_page',toolArguments:JSON.stringify({url:input.url,background:false})},view.id);return this.browser.state();}
  throw Error('Chrome işlemi geçersiz.');
 }
 hasBackgroundWork(){return this.watchers.hasActive()||!!this.system?.parked.size;}
 async emergencyStop(){this.watchers.pauseAll();this.waits.cancel();this.checkout.invalidate();return this.agent.stop();}
 async shutdown(){this.watchers.close();this.indexCancelled=true;this.waits.cancel();this.secretBroker.invalidate();this.ssh.close();this.plugins.close();this.workspace.stop();this.environment.stop();await this.agent.stop();this.system?.close();await this.browser.stop();this.browser.close();this.control.close();this.memory.close();}
 close(){this.watchers.close();this.indexCancelled=true;this.waits.cancel();this.secretBroker.invalidate();this.ssh.close();this.plugins.close();this.workspace.stop();this.environment.stop();void this.agent.stop().catch(()=>{});this.system?.close();this.browser.close();this.control.close();this.memory.close();}
}
module.exports={DeviceServices};

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
class DeviceServices{
 constructor({directory,api,encrypt,decrypt,screen,capture,notify,publish=()=>{},onComputerStart=()=>{},onComputerFinish=()=>{},excludedWindowHandles=()=>[],chooseRoots,saveFile,openSource=()=>{},defaultRoots=[],native=new NativeDesktop(),background=true,browser}){
  Object.assign(this,{api,publish,chooseRoots,saveFile,openSource,defaultRoots,background});this.indexCancelled=false;this.indexing=null;this.bridgeSupported=null;
  this.memory=new LocalMemory(path.join(directory,'memory'),{encrypt,decrypt});
  this.environment=new EnvironmentService({memory:this.memory,locate:()=>native.request('location'),notify,publish});
  this.control=new ComputerControl({native,capture,screen,excludedWindowHandles});
  this.browser=browser||new BrowserMcp({directory:path.join(directory,'browser'),...(__dirname.includes('app.asar')?{entry:path.join(process.resourcesPath,'browser','chrome-devtools-mcp','build','src','bin','chrome-devtools-mcp.js')}:{})});
  this.computerSession=new ComputerSession();
  this.agent=new ComputerAgent({control:this.control,browser:this.browser,api,memory:this.memory,onObservation:(_task,view)=>this.computerSession.observe(view),sessionContext:()=>this.computerSession.context(true),verifyCompletion:task=>verifyComputerCompletion(task.origin?task.origin.userRequest:task.goal,{desktop:this.defaultRoots[0]}),publish:event=>{if(event.event==='computer-task'){const task=this.agent.task;this.computerSession.update(task);if(task&&task.status!=='running')this.recordComputerLine(task,'assistant',task.message);}publish(event);},onStart:onComputerStart,onFinish:()=>{const status=this.agent.task?.status;if(!status||['completed','failed','stopped'].includes(status))void native.release?.();onComputerFinish();}});
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
  this.indexCancelled=true;void this.agent.stop();this.agent.task=null;this.control.enable(false);this.environment.stop();this.environment.cache.clear();this.environment.sourceState.clear();this.memory.activate(account);this.browser.activate(account,account?this.memory.setting('browserMode','managed'):'managed');this.computerSession.reset();this.bridgeSupported=null;
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
 async prepareContext(query){
  const epoch=this.memory.epoch;
  const context={capabilities:{computerControl:true,protocol:'umay-computer-task-v1',chromeMcp:true,browserProtocol:'umay-browser-mcp-v1',controlPerformance:'v1'},memory:this.memory.context(query),environment:this.environment.context(query),computerExperience:this.memory.computerExperience(query),browser:this.browser.state()};
  if(this.control.enabled){try{const foreground=await this.control.native.request('foreground');this.memory.check(epoch);this.computerSession.observe(foreground);}catch(error){if(epoch!==this.memory.epoch)throw error;}context.computer=this.computerSession.context();}
  if(/hava|sıcaklık|yağmur|kar yağ|şemsiye|rüzgâr|rüzgar/i.test(query)){
   try{context.environment.weather=await this.environment.weather();}catch(error){context.environment.weather={available:false,message:error.message};}
  }
  if(/dosya|klasör|yolu|nerede|\.pdf|\.docx|\.xlsx/i.test(query)){
   const filename=query.match(/[\p{L}\p{N}_() -]+\.[a-z0-9]{1,8}\b/iu)?.[0]?.trim();context.files=this.memory.findFiles(filename||query.split(/\s+/).filter(w=>w.length>3)[0]||'').slice(0,8);
  }
  let text=JSON.stringify(context);while(text.length>11500&&context.memory.messages.length){context.memory.messages.pop();text=JSON.stringify(context);}while(text.length>11500&&context.memory.profile.length){context.memory.profile.pop();text=JSON.stringify(context);}if(text.length>12000)text=JSON.stringify({capabilities:context.capabilities,...(context.computer?{computer:context.computer}:{}),environment:context.environment.clock,memory:{profile:[],messages:[],operations:context.memory.operations?.slice(0,3)||[]},truncated:true});return text;
 }
 async siteApi(route,body){
  if(!this.memory.account)return this.api(route,body);const epoch=this.memory.epoch,match=route.match(/^\/site\/chat\/conversations\/([^/]+)\/messages$/);let payload=body;
  if(match&&body){
   const context=await this.prepareContext(body.content);this.memory.check(epoch);this.memory.outgoing(match[1],body.requestId,body.content);
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
   case 'state':return {enabled:this.control.enabled,task:this.agent.state(),access:this.control.native.state?.()||{administrator:false,pending:false}};
   case 'pause':if(this.agent.task&&input.userReply)this.recordComputerLine(this.agent.task,'user',input.userReply);return this.agent.pause();
   case 'continue':if(input.id&&input.id!==this.agent.task?.id)throw Error('Devam ettirilecek görev değişti.');if(this.agent.task&&input.userReply)this.recordComputerLine(this.agent.task,'user',input.userReply);return this.agent.resumePaused();
   case 'enable':if(!input.enabled)await this.agent.stop();this.memory.log('computer-permission',input.enabled?'Bilgisayar kontrolü açıldı':'Bilgisayar kontrolü kapatıldı');return {enabled:this.control.enable(input.enabled)};
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
   case 'elevate':{const task=this.agent.task;if(!task||task.id!==input.id||task.status!=='permission')throw Error('Yönetici izni bekleyen etkin görev bulunamadı.');this.agent.check(task);if(!this.control.native.elevate)throw Error('Windows yönetici izni bu ortamda kullanılamıyor.');this.recordComputerLine(task,'user',input.userReply||'Windows yönetici onayını aç');await this.control.native.elevate();this.memory.check(task.epoch);this.agent.check(task);this.memory.log('computer-elevation','Kullanıcı Windows yönetici onayını verdi',{details:{taskId:task.id}});return this.agent.resume(task.id,{approved:true,elevated:true});}
   case 'stop':if(this.agent.task?.id===input.id&&input.userReply)this.recordComputerLine(this.agent.task,'user',input.userReply);return this.agent.stop();
   case 'resume':{const task=this.agent.task;if(task?.id===input.id)this.recordComputerLine(task,'user',input.userReply||input.answer||(input.approved?'Onaylıyorum.':'Vazgeçtim.'));return this.agent.resume(input.id,input);}
   default:throw Error('Bilgisayar kontrol işlemi geçersiz.');
  }
 }
 async browserAction(method,input={}){
  this.memory.require();const epoch=this.memory.epoch;
  if(method==='state')return this.browser.state();
  if(this.agent.task&&['running','paused','confirmation','question','permission'].includes(this.agent.task.status))throw Error('Tarayıcı bağlantısını değiştirmeden önce etkin görevi durdurun.');
  if(method==='settings'){
   if(!['managed','existing'].includes(input.mode))throw Error('Chrome bağlantı seçimi geçersiz.');await this.browser.stop();this.memory.check(epoch);this.memory.setSetting('browserMode',input.mode);this.browser.activate(this.memory.account,input.mode);return this.browser.state();
  }
  if(method==='connect'){await this.browser.observe();this.memory.check(epoch);return this.browser.state();}
  if(method==='open-url'){const view=await this.browser.observe();this.memory.check(epoch);await this.browser.perform({toolName:'new_page',toolArguments:JSON.stringify({url:input.url,background:false})},view.id);return this.browser.state();}
  throw Error('Chrome işlemi geçersiz.');
 }
 async shutdown(){this.indexCancelled=true;this.environment.stop();await this.agent.stop();await this.browser.stop();this.browser.close();this.control.close();this.memory.close();}
 close(){this.indexCancelled=true;this.environment.stop();void this.agent.stop();this.browser.close();this.control.close();this.memory.close();}
}
module.exports={DeviceServices};

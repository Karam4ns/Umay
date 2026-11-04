'use strict';
const path=require('node:path'),fs=require('node:fs');
const {LocalMemory}=require('./local-memory.cjs');
const {EnvironmentService}=require('./environment-service.cjs');
const {NativeDesktop,ComputerControl}=require('./computer-control.cjs');
const {ComputerAgent}=require('./computer-agent.cjs');
class DeviceServices{
 constructor({directory,api,encrypt,decrypt,screen,capture,notify,publish=()=>{},onComputerStart=()=>{},onComputerFinish=()=>{},chooseRoots,saveFile,openSource=()=>{},defaultRoots=[],native=new NativeDesktop(),background=true}){
  Object.assign(this,{api,publish,chooseRoots,saveFile,openSource,defaultRoots,background});this.indexCancelled=false;this.indexing=null;this.bridgeSupported=null;
  this.memory=new LocalMemory(path.join(directory,'memory'),{encrypt,decrypt});
  this.environment=new EnvironmentService({memory:this.memory,locate:()=>native.request('location'),notify,publish});
  this.control=new ComputerControl({native,capture,screen});
  this.agent=new ComputerAgent({control:this.control,api,memory:this.memory,publish,onStart:onComputerStart,onFinish:onComputerFinish});
 }
 activate(account){
  if(String(account??'')===String(this.memory.account??''))return;
  this.indexCancelled=true;void this.agent.stop();this.agent.task=null;this.control.enable(false);this.environment.stop();this.environment.cache.clear();this.environment.sourceState.clear();this.memory.activate(account);this.bridgeSupported=null;
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
  const context={memory:this.memory.context(query),environment:this.environment.context(query)};
  if(/hava|sıcaklık|yağmur|kar yağ|şemsiye|rüzgâr|rüzgar/i.test(query)){
   try{context.environment.weather=await this.environment.weather();}catch(error){context.environment.weather={available:false,message:error.message};}
  }
  if(/dosya|klasör|yolu|nerede|\.pdf|\.docx|\.xlsx/i.test(query)){
   const filename=query.match(/[\p{L}\p{N}_() -]+\.[a-z0-9]{1,8}\b/iu)?.[0]?.trim();context.files=this.memory.findFiles(filename||query.split(/\s+/).filter(w=>w.length>3)[0]||'').slice(0,8);
  }
  let text=JSON.stringify(context);while(text.length>11500&&context.memory.messages.length){context.memory.messages.pop();text=JSON.stringify(context);}while(text.length>11500&&context.memory.profile.length){context.memory.profile.pop();text=JSON.stringify(context);}if(text.length>12000)text=text.slice(0,11900)+' [bağlam kısaltıldı]';return text;
 }
 async siteApi(route,body){
  if(!this.memory.account)return this.api(route,body);const epoch=this.memory.epoch,match=route.match(/^\/site\/chat\/conversations\/([^/]+)\/messages$/);let payload=body;
  if(match&&body){
   const context=await this.prepareContext(body.content);this.memory.check(epoch);this.memory.outgoing(match[1],body.requestId,body.content);
   if(this.bridgeSupported!==false)payload={...body,desktopMode:'context',desktopContext:context};
  }
  let result;
  try{result=await this.api(route,payload);}
  catch(error){
   if(match&&payload!==body&&error.message==='INVALID_REQUEST'){
    this.memory.check(epoch);this.bridgeSupported=false;this.publish({event:'device-warning',message:'Yerel hafıza kaydı çalışıyor; modele cihaz bağlamı aktarmak için sunucu güncellemesi gerekiyor.'});result=await this.api(route,body);
   }else{if(epoch===this.memory.epoch&&match&&body)this.memory.outgoing(match[1],body.requestId,body.content,'failed');if(error.message==='LOGIN_REQUIRED')this.activate(null);throw error;}
  }
  this.memory.check(epoch);
  if(match&&body){this.memory.outgoing(match[1],body.requestId,body.content,'submitted');if(payload!==body&&this.bridgeSupported!==false)this.bridgeSupported=true;this.memory.log('chat-send','Kullanıcı mesajı kaydedildi',{details:{conversationId:match[1]}});}
  if(result.conversation)this.memory.archiveConversation(result.conversation,result.messages||[]);
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
 async computer(method,input={}){
  this.memory.require();switch(method){
   case 'state':return {enabled:this.control.enabled,task:this.agent.state()};
   case 'enable':if(!input.enabled)await this.agent.stop();this.memory.log('computer-permission',input.enabled?'Bilgisayar kontrolü açıldı':'Bilgisayar kontrolü kapatıldı');return {enabled:this.control.enable(input.enabled)};
   case 'preview':return this.control.observe({image:true});
   case 'run':{const epoch=this.memory.epoch,sequence=this.agent.sequence,result=await this.api('/site/chat/models');this.memory.check(epoch);if(sequence!==this.agent.sequence)throw Error('Bilgisayar görevi durduruldu.');const model=(result.models||[]).find(m=>m.id===input.modelId&&m.source===input.source);if(!model)throw Error('Seçilen modele erişilemiyor.');return this.agent.run(input.goal,model);}
   case 'stop':return this.agent.stop();
   case 'resume':return this.agent.resume(input.id,input);
   default:throw Error('Bilgisayar kontrol işlemi geçersiz.');
  }
 }
 close(){this.indexCancelled=true;this.environment.stop();void this.agent.stop();this.control.close();this.memory.close();}
}
module.exports={DeviceServices};

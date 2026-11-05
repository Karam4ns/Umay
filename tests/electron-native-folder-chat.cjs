// Controlled provider, REAL packaged/source chat, IPC, screenshots, Windows
// keyboard input and read-only filesystem completion. No real account or billing.
const {app,session}=require('electron'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
app.setPath('userData',fs.mkdtempSync(path.join(os.tmpdir(),'umay-native-folder-chat-')));
const folder=process.env.UMAY_NATIVE_FOLDER||'Umay Son Kontrol 05112026',target=path.join(app.getPath('desktop'),folder);
if(/[\\/:*?"<>|]/.test(folder)||folder==='.'||folder==='..'||fs.existsSync(target))throw Error('Choose a new, single Desktop folder name');
require(process.env.UMAY_TEST_MAIN||'../src/main.cjs');let window,timer;
async function finish(code){clearTimeout(timer);if(window&&!window.isDestroyed())await window.webContents.executeJavaScript("api.computer('stop')").catch(()=>{});app.quit();if(code)app.exit(code);}
timer=setTimeout(()=>{console.error('FAIL native chat deadline');void finish(1);},120000);
app.on('browser-window-created',(_e,w)=>w.webContents.once('did-finish-load',async()=>{
 if(!w.webContents.getURL().endsWith('/index.html'))return;window=w;
 try{
  const chats=new Map(),runs=new Map(),modelId=randomUUID();let inputs=0;
  const actions=[{action:'keys',keys:['WIN','R']},{action:'keys',keys:['CTRL','A']},{action:'type',text:'explorer.exe shell:Desktop'},{action:'keys',keys:['ENTER']},{action:'wait',milliseconds:1000},{action:'keys',keys:['CTRL','SHIFT','N']},{action:'type',text:folder},{action:'keys',keys:['ENTER']}];
  await w.webContents.executeJavaScript('refresh()');
  const transport=async(url,options={})=>{
   const route=new URL(url).pathname,body=options.body?JSON.parse(options.body):undefined;let value;
   if(route==='/site/auth/me')value={id:'native-folder-fixture',email:'fixture@example.test'};
   else if(route==='/site/chat/models')value={models:[{id:modelId,source:'PERSONAL',name:'Controlled Windows planner',categories:['vision','chat']}]};
   else if(route.startsWith('/site/user-memory'))value={summary:'',notes:[]};
   else if(route==='/site/chat/conversations'){
    if(!body)value={conversations:[]};else{const conversation={id:randomUUID(),version:1,title:body.title},chat={conversation,messages:[],computer:body.title.startsWith('Umay bilgisayar görevi:')};chats.set(conversation.id,chat);value={conversation};}
   }else if(route.includes('/runs/'))value={run:runs.get(route.split('/')[4])};
   else{
    const id=route.split('/')[4],chat=chats.get(id);assert.ok(chat,route);
    if(route.endsWith('/messages')){
     assert.equal(body.expectedVersion,chat.conversation.version);let text,task;
     if(chat.computer){const prompt=JSON.parse(body.content);assert.match(prompt.originalUserRequest,/klasör oluştur/);const action=actions.shift();assert.ok(action,'filesystem verification should finish without a guessed done');if(action.keys?.join(',')==='CTRL,SHIFT,N')assert.match(prompt.observation.title,/Desktop|Masaüstü/iu,'Only create inside the opened Desktop explorer');text=JSON.stringify(action);inputs++;}
     else{text='Klasörü oluşturuyorum.';task={version:1,goal:body.content,userRequest:body.content,acknowledgement:text};}
     chat.messages.push({id:randomUUID(),role:'user',content:body.content},{id:randomUUID(),role:'assistant',content:text});chat.conversation.version++;
     if(task)task.anchorMessageId=chat.messages.at(-1).id;
     const run={id:randomUUID(),conversationId:id,status:'COMPLETED',createdAt:new Date().toISOString(),mediaOptions:task?{desktopChatTask:task}:{}};runs.set(run.id,run);value={run};
    }else value={conversation:chat.conversation,messages:chat.messages};
   }
   return {ok:true,status:200,json:async()=>structuredClone(value)};
  };
  session.fromPartition('persist:veriussu').protocol.handle('https',async request=>{
   const response=await transport(request.url,{body:request.method==='POST'?await request.text():undefined});return new Response(JSON.stringify(await response.json()),{status:response.status,headers:{'Content-Type':'application/json'}});
  });
  const js=code=>w.webContents.executeJavaScript(code);await js('refresh()');await js("document.getElementById('speak').checked=false");await js('send('+JSON.stringify('Selam masaüstüne '+folder+' adında yeni klasör oluştur')+')');const result=await js("api.computer('state')");
  assert.equal(result.task.status,'completed',result.task.message);assert.ok(fs.statSync(target).isDirectory());assert.equal(inputs,8);console.log('PASS controlled provider -> ordinary chat -> actual Windows keys/type -> actual Desktop folder -> filesystem-verified completion without extra model call:',target);await finish(0);
 }catch(e){console.error(e);await finish(1);}
}));

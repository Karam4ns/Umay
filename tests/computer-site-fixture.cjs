// Test transport only. Real application/device/native layers stay unchanged.
const {randomUUID}=require('node:crypto'),assert=require('node:assert/strict');
async function computerSiteFixture(session,chooseAction){
 const chats=new Map(),runs=new Map(),modelId=randomUUID(),posts=[];
 await session.protocol.handle('https',async request=>{
  const route=new URL(request.url).pathname,body=request.method==='POST'?JSON.parse(await request.text()):undefined;let value;
  if(route==='/site/auth/me')value={id:'general-control-fixture',email:'fixture@example.test'};
  else if(route==='/site/chat/models')value={models:[{id:modelId,source:'PERSONAL',name:'Controlled general planner',categories:['vision','chat']}]};
  else if(route.startsWith('/site/user-memory'))value={summary:'',notes:[]};
  else if(route==='/site/chat/conversations'){
   if(!body)value={conversations:[]};else{const conversation={id:randomUUID(),version:1,title:body.title},chat={conversation,messages:[],computer:body.title.startsWith('Umay bilgisayar görevi:')};chats.set(conversation.id,chat);value={conversation};}
  }else if(route.includes('/runs/'))value=route.endsWith('/cancel')?{ok:true}:{run:runs.get(route.split('/')[4])};
  else{
   const id=route.split('/')[4],chat=chats.get(id);assert.ok(chat,route);
   if(route.endsWith('/messages')){
    assert.equal(body.expectedVersion,chat.conversation.version);let content,task;
    if(chat.computer){const prompt=JSON.parse(body.content);posts.push(prompt);content=JSON.stringify(await chooseAction(prompt,body,chat));}
    else{content='Görevine başlıyorum.';task={version:1,goal:body.content,userRequest:body.content,acknowledgement:content};}
    chat.messages.push({id:randomUUID(),role:'user',content:body.content},{id:randomUUID(),role:'assistant',content});chat.conversation.version++;
    if(task)task.anchorMessageId=chat.messages.at(-1).id;
    const run={id:randomUUID(),conversationId:id,status:'COMPLETED',createdAt:new Date().toISOString(),mediaOptions:task?{desktopChatTask:task}:{}};runs.set(run.id,run);value={run};
   }else value={conversation:chat.conversation,messages:chat.messages};
  }
  return new Response(JSON.stringify(value),{status:200,headers:{'Content-Type':'application/json'}});
 });
 return {posts,chats,runs};
}
module.exports={computerSiteFixture};

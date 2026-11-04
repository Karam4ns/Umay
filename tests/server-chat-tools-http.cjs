// Real Nest/Fastify + worker + isolated PostgreSQL database + synthetic provider.
const assert=require('node:assert/strict'),path=require('node:path');
const {createRequire}=require('node:module'),{randomUUID,randomBytes,createHash}=require('node:crypto');
const {spawnSync}=require('node:child_process'),{createServer}=require('node:http');
const req=createRequire(path.join(path.resolve(process.argv[2]||'.'),'package.json'));
const {createPool}=req('./dist/database'),{createApp}=req('./dist/app'),{encryptServerKey}=req('./dist/server-secret');
(async()=>{
 const original={...process.env},control=createPool(),name='umay_tools_'+randomBytes(8).toString('hex');
 let db,app,server,calls=0,toolChoice;
 try{
  await control.query(`CREATE DATABASE "${name}"`);process.env.DB_NAME=name;process.env.FRONTEND_UI='true';process.env.CHAT_WORKER_ENABLED='true';
  db=createPool();const migrate=spawnSync(process.execPath,[req.resolve('./dist/migrate')],{env:process.env,encoding:'utf8'});assert.equal(migrate.status,0,migrate.stderr);
  server=createServer((request,response)=>{let body='';request.on('data',part=>body+=part);request.on('end',()=>{
   const payload=JSON.parse(body);calls++;const results=payload.messages.filter(m=>m.role==='tool');
   if(results.length){const result=JSON.parse(results[0].content);assert.equal(result.executed,false);toolChoice=payload.tool_choice;}
   response.writeHead(200,{'Content-Type':'text/event-stream'});
   const direct=results.length||payload.tool_choice==='none';
   const delta=direct?{content:'Merhaba, iyiyim. Seni dinliyorum.'}:{tool_calls:[{index:0,id:'call_search',type:'function',function:{name:'search_web',arguments:'{"q":"hello"}'}}]};
   response.end('data: '+JSON.stringify({choices:[{index:0,delta,finish_reason:results.length?'stop':'tool_calls'}]})+'\n\n'+'data: '+JSON.stringify({choices:[{index:0,delta:{},finish_reason:'stop'}],usage:{prompt_tokens:10,completion_tokens:5}})+'\n\n'+'data: [DONE]\n\n');
  });});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url='http://127.0.0.1:'+server.address().port+'/v1';process.env.SERVER_TRUSTED_BASE_URLS=url;
  const user=(await db.query("INSERT INTO users(email,password_hash,role_id) VALUES($1,'unused',1) RETURNING id",['fixture@example.test'])).rows[0];
  const token=randomBytes(32).toString('hex');await db.query("INSERT INTO web_sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '1 hour')",[createHash('sha256').update(token).digest('hex'),user.id]);
  const serverId=randomUUID();await db.query("INSERT INTO user_servers(id,name,url,encrypted_api_key,created_by,request_id,payload_hash,enabled) VALUES($1,'Fixture',$2,$3,$4,$5,$6,true)",[serverId,url,encryptServerKey(serverId,'fixture-secret'),user.id,randomUUID(),'a'.repeat(64)]);
  const model=(await db.query("INSERT INTO user_server_models(id,server_id,model_key,selected_at) VALUES(gen_random_uuid(),$1,'fixture',now()) RETURNING id",[serverId])).rows[0];
  app=await createApp();await app.init();let ip=1;
  const call=(route,body)=>app.inject({method:body?'POST':'GET',url:'/site/chat/'+route,headers:{cookie:'veriussu_web='+token,origin:'http://localhost:10203'},remoteAddress:'127.0.71.'+ip++,...(body?{payload:body}:{})});
  let response=await call('conversations',{source:'PERSONAL',modelId:model.id,title:'Isolated recovery test',requestId:randomUUID()});assert.equal(response.statusCode,201,response.body);const chat=response.json().conversation;
  response=await call('conversations/'+chat.id+'/messages',{content:'Selam nasılsın?',expectedVersion:chat.version,requestId:randomUUID(),kind:'CHAT'});assert.equal(response.statusCode,201,response.body);const id=response.json().run.id;
  let run;for(let i=0;i<100;i++){run=(await call('runs/'+id)).json().run;if(!['QUEUED','RUNNING'].includes(run.status))break;await new Promise(r=>setTimeout(r,50));}
  assert.equal(run.status,'COMPLETED',JSON.stringify(run));assert.equal(calls,2);assert.equal(toolChoice,'none');
  const detail=(await call('conversations/'+chat.id)).json();assert.equal(detail.messages.at(-1).content,'Merhaba, iyiyim. Seni dinliyorum.');
  response=await call('conversations/'+chat.id+'/messages',{content:'Tekrar selam.',expectedVersion:chat.version,requestId:randomUUID(),kind:'CHAT'});assert.equal(response.statusCode,201,response.body);const second=response.json().run.id;
  for(let i=0;i<100;i++){run=(await call('runs/'+second)).json().run;if(!['QUEUED','RUNNING'].includes(run.status))break;await new Promise(r=>setTimeout(r,50));}
  assert.equal(run.status,'COMPLETED',JSON.stringify(run));assert.equal(calls,3,'Next turn should make one direct provider call');
  console.log('PASS real HTTP -> worker -> unsolicited search tool -> explicit unavailable result -> one bounded continuation -> stored assistant reply; isolated DB');
 }finally{
  if(app)await app.close();if(server)await new Promise(r=>server.close(r));if(db)await db.end();
  if(!/^umay_tools_[a-f0-9]{16}$/.test(name))throw Error('Invalid isolated database name');await control.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);await control.end();process.env=original;
 }
})().catch(error=>{console.error(error);process.exitCode=1;});

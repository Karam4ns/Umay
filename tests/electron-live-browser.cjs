// Real authenticated models + bundled MCP + an isolated Chrome profile.
// Native desktop access is forbidden, including on the test setup path.
const {app,screen}=require('electron');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto'),{createServer}=require('node:http');
const {DeviceServices}=require('../src/device-services.cjs'),{BrowserMcp}=require('../src/browser-mcp.cjs');
if(!process.env.UMAY_LIVE_SESSION_FILE)throw Error('A short-lived authorized verification session is required.');
const token=JSON.parse(fs.readFileSync(process.env.UMAY_LIVE_SESSION_FILE,'utf8')).token;
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'umay-live-browser-'));app.setPath('userData',path.join(directory,'electron'));
let service,timer,server;const form=process.env.UMAY_LIVE_BROWSER_FORM==='1';let fixtureUrl;const calls=[],nativeCalls=[];
async function finish(code){clearTimeout(timer);if(service){await service.browser.stop();service.browser.close({closeBrowser:true});service.close();}server?.close();app.exit(code);}
app.whenReady().then(async()=>{try{
 timer=setTimeout(()=>{console.error('FAIL real browser deadline');void finish(1);},180000);
 if(form){server=createServer((_req,res)=>res.end('<!doctype html><meta charset="utf-8"><title>UMAY live MCP form</title><label>Deneme metni<input aria-label="Deneme metni"></label><button onclick="document.querySelector(\'p\').textContent=document.querySelector(\'input\').value">Kaydet</button><p role="status">Hazır</p>'));await new Promise(r=>server.listen(0,'127.0.0.1',r));fixtureUrl='http://127.0.0.1:'+server.address().port;}
 const api=async(route,body)=>{const response=await fetch('https://veriussu.com'+route,{method:body?'POST':'GET',headers:{cookie:'veriussu_web='+token,origin:'https://veriussu.com','content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const value=await response.json();if(!response.ok)throw Error(value.message||'HTTP_'+response.status);return value;};
 const mcp=new BrowserMcp({directory:path.join(directory,'browser')}),call=mcp.call.bind(mcp);
 mcp.call=async(name,args,generation)=>{calls.push(name);return call(name,args,generation);};
 service=new DeviceServices({directory,api,screen,browser:mcp,background:false,native:{async request(method){nativeCalls.push(method);throw Error('Native desktop access is forbidden in the MCP acceptance test');},cancel(){},close(){}},capture:async()=>{throw Error('Native screen capture is forbidden in the MCP acceptance test');}});
 service.activate((await api('/site/auth/me')).id);const {models}=await api('/site/chat/models');
 if(process.env.UMAY_LIVE_CHROME_RECONNECT==='1'){
  await mcp.observe();const child=mcp.browser.child;assert.ok(child,'the disposable Chrome is owned by this test');
  mcp.browser.close();if(child.exitCode===null)await new Promise(r=>child.once('exit',r));
  console.log('Closed only the test-owned Chrome; the existing MCP client is intentionally retained');
 }
 const chat=models.find(m=>m.id===(process.env.UMAY_LIVE_CHAT_MODEL_ID||'9076520e-1151-4fcc-9f5a-109f0c651bea')),computer=models.find(m=>m.id===(process.env.UMAY_LIVE_COMPUTER_MODEL_ID||'eadbac23-9cbf-4d94-9a89-13fe0bd54d97'));assert.ok(chat&&computer,'current assigned models available');console.log(JSON.stringify({chat:chat.name,computer:computer.name,categories:computer.categories}));await service.modelRoles('save',{chat,computer});
 const start=Date.now(),{conversation}=await service.siteApi('/site/chat/conversations',{source:chat.source,modelId:chat.id,title:'Umay Chrome MCP acceptance',requestId:randomUUID()});
 const request=form?fixtureUrl+' adresindeki Deneme metni alanına UMAY_CANLI_060 yaz ve Kaydet düğmesine bas. Sonucu doğrula.':'Yalnızca Umay için açılan Chrome profilinde https://www.netflix.com adresini aç. Diğer pencerelere dokunma.';
 const posted=await service.siteApi('/site/chat/conversations/'+conversation.id+'/messages',{content:request,requestId:randomUUID(),expectedVersion:conversation.version,kind:'CHAT'});
 let run;do{run=(await service.siteApi('/site/chat/runs/'+posted.run.id)).run;if(['QUEUED','RUNNING'].includes(run.status))await new Promise(r=>setTimeout(r,200));}while(['QUEUED','RUNNING'].includes(run.status));
 assert.equal(run.status,'COMPLETED',run.errorCode);assert.ok(run.mediaOptions?.desktopChatTask,'the chat must hand off the real web task');const handoffMs=Date.now()-start;
 const state=await service.computer('dispatch',{runId:run.id,conversationId:conversation.id});
 assert.equal(state.status,'completed',JSON.stringify(state));assert.equal(service.agent.task.mode,'browser','the actual execution must use the browser even if a compatibility handoff omitted its optional executor field');
 const read=await mcp.call('evaluate_script',{pageId:mcp.pageId,function:'() => ({title:document.title,url:location.href,value:document.querySelector(\"input\")?.value,status:document.querySelector(\"p\")?.textContent})'}),body=read.content.filter(c=>c.type==='text').map(c=>c.text).join('\n'),json=body.match(/```(?:json)?\s*([\s\S]*?)```/);assert.ok(json,body);const page=JSON.parse(json[1]);
 if(form){assert.match(page.title,/UMAY live MCP form/);assert.equal(page.value,'UMAY_CANLI_060');assert.equal(page.status,'UMAY_CANLI_060');}else{assert.match(page.title,/netflix/i);assert.match(page.url,/^https?:\/\/(?:www\.)?netflix\.com(?:[/?]|$)/i);assert.doesNotMatch(page.url,/netflix\.comnetflix/i);}
 assert.deepEqual(nativeCalls,[]);assert.ok(calls.includes('navigate_page')||calls.includes('new_page'),'real navigation uses MCP');const experience=service.memory.computerExperience(request);assert.ok(experience.length);
 console.log(JSON.stringify({scenario:form?'form':'netflix',handoffMs,totalMs:Date.now()-start,plan:run.mediaOptions.desktopChatTask.plan,mcpCalls:calls,status:state.status,title:page.title,experienceRecords:experience.length}));console.log('PASS actual site chat -> assigned cloud model -> bundled Chrome MCP -> '+(form?'form input and click verified':'Netflix title/address verified')+'; zero native access');await finish(0);
}catch(error){console.error(error);await finish(1);}});

// Real website JS/HTML/CSS with synthetic account/API. Other public assets are read-only.
const {app,BrowserWindow}=require('electron'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http'),assert=require('node:assert/strict');
const upstream=process.env.UMAY_CHAT_TEST_ORIGIN;if(!upstream)throw Error('Set UMAY_CHAT_TEST_ORIGIN to the existing public chat origin.');
app.setPath('userData',fs.mkdtempSync(path.join(os.tmpdir(),'umay-web-errors-')));
const timeout=setTimeout(()=>{console.error('FAIL web warning timeout');app.exit(1);},60000);
app.whenReady().then(async()=>{
 let window,server;let denied=false;const id='11111111-1111-4111-8111-111111111111',runId='22222222-2222-4222-8222-222222222222';
 try{
  server=http.createServer(async(request,response)=>{
   const url=new URL(request.url,'http://localhost'),route=url.pathname;
   const json=value=>{response.writeHead(200,{'Content-Type':'application/json'});response.end(JSON.stringify(value));};
   if(route==='/chat-config.json')return json({frontendUrl:'http://127.0.0.1:'+server.address().port});
   if(route.startsWith('/site/')){
    if(route==='/site/auth/me')return json({id:'fixture',firstName:'Deniz',email:'deniz@example.test',language:'tr'});
    if(route==='/site/chat/models')return json({generationEnabled:true,models:[{id:'fixture-model',source:'PERSONAL',name:'Test modeli',serverName:'Test',categories:['chat']}]});
    if(route==='/site/chat/conversations')return json(request.method==='POST'?{conversation:{id,version:1,modelName:'Test modeli'}}:{conversations:[]});
    if(route.endsWith('/messages')){denied=true;return json({run:{id:runId,status:'FAILED',errorCode:'INSUFFICIENT_TOKENS'}});}
    if(route==='/site/chat/runs/'+runId+'/events'){response.writeHead(200,{'Content-Type':'text/event-stream'});return response.end('event: snapshot\ndata: '+JSON.stringify({run:{id:runId,status:'FAILED',errorCode:'INSUFFICIENT_TOKENS'}})+'\n\n');}
    if(route==='/site/chat/runs/'+runId)return json({run:{id:runId,status:'FAILED',errorCode:'INSUFFICIENT_TOKENS'}});
    if(route==='/site/chat/conversations/'+id)return json({conversation:{id,version:1,modelName:'Test modeli'},messages:denied?[{id:'message',role:'user',content:'Merhaba'}]:[],run:denied?{id:runId,status:'FAILED',errorCode:'INSUFFICIENT_TOKENS'}:null});
    return json({});
   }
   if(route==='/'||['/chat.js','/chat.css'].includes(route)){
    const file=route==='/'?'chat.html':route.slice(1);response.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html'});return response.end(fs.readFileSync(path.join('server/web',file)));
   }
   try{const remote=await fetch(new URL(route,upstream),{signal:AbortSignal.timeout(15000)});response.writeHead(remote.status,{'Content-Type':remote.headers.get('content-type')||'application/octet-stream'});response.end(Buffer.from(await remote.arrayBuffer()));}catch{response.writeHead(404);response.end();}
  });await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  window=new BrowserWindow({width:1280,height:900,show:false,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true}});
  await window.loadURL('http://127.0.0.1:'+server.address().port+'/');const js=code=>window.webContents.executeJavaScript(code,true);
  await js(`new Promise((resolve,reject)=>{const end=Date.now()+20000;const poll=()=>{if(document.getElementById('model').options.length)return resolve();if(Date.now()>end)return reject(Error('No fixture model'));setTimeout(poll,30)};poll()})`);
  await js("document.getElementById('message').value='Merhaba';document.getElementById('message').dispatchEvent(new Event('input'));document.getElementById('send').click()");
  await js(`new Promise((resolve,reject)=>{const end=Date.now()+10000;const poll=()=>{if(!document.getElementById('chat-error').hidden)return resolve();if(Date.now()>end)return reject(Error('No visible warning'));setTimeout(poll,20)};poll()})`);
  assert.equal(denied,true);assert.equal(await js("document.getElementById('chat-error-title').textContent"),'Token limitiniz yetersiz');assert.doesNotMatch(await js("document.getElementById('chat-error').textContent"),/INSUFFICIENT_TOKENS/);
  fs.mkdirSync('.superpowers',{recursive:true});await js("document.documentElement.dataset.theme='light'");await js('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');fs.writeFileSync('.superpowers/errors-web-light.png',(await window.capturePage()).toPNG());
  await js("document.documentElement.dataset.theme='dark'");window.setContentSize(390,820);await js('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
  assert.equal(await js('document.documentElement.scrollWidth<=innerWidth'),true);assert.equal(await js("document.getElementById('chat-error').hidden"),false);assert.equal(await js("(()=>{const r=document.getElementById('chat-error').getBoundingClientRect();return r.top>=0&&r.bottom<innerHeight;})()"),true);fs.writeFileSync('.superpowers/errors-web-mobile-dark.png',(await window.capturePage()).toPNG());
  console.log('PASS real website message -> failed run -> visible Turkish alert, desktop/light and mobile/dark');clearTimeout(timeout);window.destroy();server.closeAllConnections();server.close(()=>app.quit());
 }catch(error){console.error(error);clearTimeout(timeout);app.exit(1);}
});

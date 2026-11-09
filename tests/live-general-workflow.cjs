// Real Chrome MCP, real filesystem and processes; only planner decisions are fixtures.
// Every web identity, order and file is disposable. No real merchant/account is used.
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),{createHash}=require('node:crypto'),{createServer}=require('node:http');
const {BrowserMcp}=require('../src/browser-mcp.cjs'),{SystemTools}=require('../src/system-tools.cjs'),{ComputerAgent}=require('../src/computer-agent.cjs');
const tool=(toolName,args)=>({action:'browser_tool',toolName,toolArguments:JSON.stringify(args),summary:toolName}),sys=(toolName,args)=>({action:'system_tool',toolName,toolArguments:JSON.stringify(args),summary:toolName});
(async()=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'umay-general-flow-')),downloads=path.join(directory,'downloads'),browserDirectory=path.join(directory,'browser');await fs.mkdir(downloads);
 const profile=path.join(browserDirectory,'profiles',createHash('sha256').update('fixture').digest('hex'),'Default');await fs.mkdir(profile,{recursive:true});await fs.writeFile(path.join(profile,'Preferences'),JSON.stringify({download:{default_directory:downloads,prompt_for_download:false}}));
 const browser=new BrowserMcp({directory:browserDirectory}),system=new SystemTools({roots:[directory]}),records={register:[],login:[],order:[],upload:[]};let server,agent,actions=[],next,version=1,index=0;
 const began=Date.now();try{
  const page=(title,body)=>'<!doctype html><meta charset="utf-8"><title>'+title+'</title><h1>'+title+'</h1>'+body;
  const fields=names=>names.map(name=>'<label>'+name+'<input name="'+name+'" aria-label="'+name+'"></label>').join('');
  const form=(names,button,route,next)=>'<form>'+fields(names)+'<button>'+button+'</button></form><script>document.querySelector("form").onsubmit=async e=>{e.preventDefault();await fetch("'+route+'",{method:"POST",body:JSON.stringify(Object.fromEntries(new FormData(e.target)))});location.href="'+next+'"}</script>';
  server=createServer(async(req,res)=>{
   if(req.method==='POST'){let body='';for await(const chunk of req)body+=chunk;if(req.url==='/upload')records.upload.push(body);else records[req.url.slice(1)]?.push(JSON.parse(body));res.end('ok');return;}
   if(req.url==='/download'){res.writeHead(200,{'Content-Type':'text/plain; charset=utf-8','Content-Disposition':'attachment; filename="report.txt"'});res.end('Teklif: sentetik ürün, adet 2, toplam 120 TL.');return;}
   res.setHeader('Content-Type','text/html;charset=utf-8');
   if(req.url==='/login')res.end(page('İstasyon giriş',form(['Kullanıcı','Parola'],'Oturum aç','/login','/order')));
   else if(req.url==='/order')res.end(page('İstasyon test siparişi',form(['Ürün','Adet','Adres'],'Test siparişini oluştur','/order','/receipt')));
   else if(req.url==='/receipt')res.end(page('İstasyon işlem sonucu','<a href="/download" download="report.txt">Rapor indir</a><label>Dosya yükle<input type="file" aria-label="Dosya yükle"></label><button id="upload">Düzenlenmiş raporu gönder</button><p id="status">Bekliyor</p><script>upload.onclick=async()=>{const file=document.querySelector("input").files[0];await fetch("/upload",{method:"POST",body:await file.text()});status.textContent="Dosya alındı"}</script>'));
   else res.end(page('İstasyon kayıt',form(['Ad','Eposta','Şehir','Kurum'],'Kayıt oluştur','/register','/login')));
  });await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
  browser.activate('fixture','managed');system.activate('fixture');
  const uid=(p,role,name)=>{const line=p.observation.browser.snapshot.split('\n').find(line=>line.includes(role)&&line.includes('"'+name+'"'));assert.ok(line,role+' '+name+' missing in '+p.observation.browser.snapshot);return line.match(/uid=(\S+)/)[1];};
  const fill=(p,values)=>tool('fill_form',{elements:Object.entries(values).map(([name,value])=>({uid:uid(p,'textbox',name),value}))});
  const click=(p,name)=>tool('click',{uid:uid(p,'button',name)});
  const api=async(route,body)=>{if(route==='/site/chat/conversations')return {conversation:{id:'fixture',version}};if(route.endsWith('/messages')){const prompt=JSON.parse(body.content);assert.ok(actions[index],'fixture step exists');next=await actions[index++](prompt);return {run:{id:'fixture-run'}};}if(route.includes('/runs/'))return {run:{status:'COMPLETED'}};return {conversation:{id:'fixture',version:++version},messages:[{role:'assistant',content:JSON.stringify(next)}]};};
  agent=new ComputerAgent({browser,system,api,control:{enabled:true,screen:{},stop(){},observe(){throw Error('No native input in web/files acceptance');}},memory:{epoch:1,context:()=>({}),archiveConversation(){},log(){}}});
  const execute=async(request,executor,steps)=>{actions=steps;index=0;const result=await agent.run(request,{id:'fixture',source:'PERSONAL'},{userRequest:request,executor});assert.equal(result.status,'completed',result.message);assert.equal(index,steps.length);};
  await execute('Test sitesinde kayıt ol, giriş yap ve sentetik ürün için belirtilen test siparişini oluştur. Gerçek mağaza veya hesap kullanma.','browser',[
   ()=>tool('navigate_page',{url}),p=>fill(p,{Ad:'Örnek kişi',Eposta:'fixture@example.test',Şehir:'Deneme',Kurum:'İstasyon'}),p=>click(p,'Kayıt oluştur'),p=>fill(p,{Kullanıcı:'fixture@example.test',Parola:'fixture-only'}),p=>click(p,'Oturum aç'),p=>fill(p,{Ürün:'Sentetik ürün',Adet:'2',Adres:'Yalnız test konumu'}),p=>click(p,'Test siparişini oluştur'),p=>{assert.match(p.observation.browser.snapshot,/İstasyon işlem sonucu/);return {action:'done',message:'Test siparişi oluştu.'};}
  ]);
  assert.equal(records.register[0].Ad,'Örnek kişi');assert.equal(records.login[0].Kullanıcı,'fixture@example.test');assert.equal(records.order[0].Adet,'2');
  const downloaded=path.join(downloads,'report.txt'),edited=path.join(directory,'düzenlenmiş-rapor.txt');
  await execute('Raporumuzu indir, geçici çalışma klasörüne kopyala, belirtildiği gibi güncelle ve aynı siteye geri yükle.','browser',[
   p=>tool('click',{uid:uid(p,'link','Rapor indir')}),async()=>{const end=Date.now()+5000;while(true){try{await fs.stat(downloaded);break;}catch{if(Date.now()>end)throw Error('Actual download missing');await new Promise(r=>setTimeout(r,20));}}return sys('files_read',{path:downloaded});},
   p=>{assert.match(p.observation.system.result,/sentetik ürün/);return sys('files_copy',{source:downloaded,destination:edited});},
   p=>{const result=JSON.parse(p.observation.system.result).result;return sys('files_stat',{path:edited});},
   p=>{const version=JSON.parse(p.observation.system.result).result.version;return sys('files_write',{path:edited,expectedVersion:version,content:'Düzenlenmiş rapor: teslimat yarın. ığüşöç'});},
   ()=>({action:'browser_start'}),p=>tool('upload_file',{uid:uid(p,'button','Dosya yükle'),filePaths:[edited]}),p=>click(p,'Düzenlenmiş raporu gönder'),()=>({action:'done',message:'İndirme, düzenleme ve geri yükleme tamamlandı.'})
  ]);
  assert.equal(await fs.readFile(edited,'utf8'),'Düzenlenmiş rapor: teslimat yarın. ığüşöç');assert.equal(records.upload[0],'Düzenlenmiş rapor: teslimat yarın. ığüşöç');
  const script=path.join(directory,'summary.cjs'),summary=path.join(directory,'sonuç.txt');await fs.writeFile(script,"require('node:fs').writeFileSync(process.argv[2],require('node:fs').readFileSync(process.argv[3],'utf8').toUpperCase())");
  await execute('Geçici test raporunu bu test için sağlanan Node aracıyla işle, gerçek süreç sonucunu bekle ve dosyayı doğrula.','desktop',[
   ()=>sys('process_run',{executable:process.execPath,args:[script,summary,edited]}),p=>sys('process_wait',{jobId:JSON.parse(p.observation.system.result).result.jobId,timeoutMs:10000}),p=>{assert.match(p.observation.system.result,/"exitCode":0/);return sys('files_read',{path:summary});},p=>{assert.match(p.observation.system.result,/DÜZENLENMİŞ|DÜZENLENMIŞ/);return {action:'done',message:'Gerçek süreç ve sonuç dosyası doğrulandı.'};}
  ]);
  assert.equal(await fs.readFile(summary,'utf8'),(await fs.readFile(edited,'utf8')).toUpperCase());console.log(JSON.stringify({elapsedMs:Date.now()-began,register:records.register.length,login:records.login.length,orders:records.order.length,uploads:records.upload.length,artifacts:system.artifacts.length}));console.log('PASS real multi-page register/login/order -> Chrome download -> versioned local copy/edit -> MCP upload -> owned process/wait/readback; controlled planner, no real account/order');
 }finally{if(agent)await agent.stop().catch(()=>{});system.close();await browser.stop();browser.close({closeBrowser:true});server?.close();await fs.rm(directory,{recursive:true,force:true}).catch(()=>{});}
})().catch(error=>{console.error(error);process.exitCode=1});

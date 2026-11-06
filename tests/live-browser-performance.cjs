// Real Chrome/MCP execution; API is forbidden for this narrowly verified task.
const {BrowserMcp}=require('../src/browser-mcp.cjs'),{ComputerAgent}=require('../src/computer-agent.cjs'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),{createServer}=require('node:http');
(async()=>{
 const browser=new BrowserMcp({directory:fs.mkdtempSync(path.join(os.tmpdir(),'umay-browser-speed-'))});let server;
 try{
  server=createServer((_req,res)=>res.end('<!doctype html><meta charset="utf-8"><title>UMAY speed verification</title><h1>Hazır</h1>'));await new Promise(r=>server.listen(0,'127.0.0.1',r));browser.activate('speed');
  const agent=new ComputerAgent({browser,control:{enabled:true,stop(){},observe(){throw Error('No native access');}},api:async()=>{throw Error('The verified landing task must not call a planner');},memory:{epoch:1,archiveConversation(){},log(){}}});const request='http://127.0.0.1:'+server.address().port+' adresini aç';
  for(const state of ['cold','warm','closed']){
   if(state==='closed'){const child=browser.browser.child;assert.ok(child);browser.browser.close();if(child.exitCode===null)await new Promise(r=>child.once('exit',r));}
   const began=Date.now(),result=await agent.run('Sayfayı aç',{id:'fixture',source:'PERSONAL'},{userRequest:request,executor:'browser'});assert.equal(result.status,'completed',result.message);assert.equal(agent.task.timings.modelTurns,0);assert.equal(agent.task.steps.filter(s=>s.toolName==='navigate_page').length,1);
   console.log(JSON.stringify({state,elapsedMs:Date.now()-began,timings:agent.task.timings}));
  }
  console.log('PASS real direct MCP landing: cold, warm and closed-browser recovery; real snapshot verification and zero planner turns');
 }finally{await browser.stop();browser.close({closeBrowser:true});server?.close();}
})().catch(error=>{console.error(error);process.exitCode=1});

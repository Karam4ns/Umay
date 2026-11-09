// Real MCP + real Chrome + real ComputerAgent, only the cloud planner is controlled.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),{createServer}=require('node:http');
const {BrowserMcp}=require('../src/browser-mcp.cjs'),{ComputerAgent}=require('../src/computer-agent.cjs'),{LocalMemory}=require('../src/local-memory.cjs');
(async()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'umay-mcp-agent-')),browser=new BrowserMcp({directory}),memory=new LocalMemory(path.join(directory,'memory'));let server;
 try{
  memory.activate('fixture');browser.activate('fixture','managed');server=createServer((_req,res)=>res.end('<!doctype html><html lang="tr"><meta charset="utf-8"><title>UMAY agent acceptance</title><label>Deneme metni<input aria-label="Deneme metni"></label><button onclick="document.querySelector(\'p\').textContent=document.querySelector(\'input\').value">Kaydet</button><p role="status">Hazır</p></html>'));await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const url='http://127.0.0.1:'+server.address().port;let phase=0,version=1,next;const prompts=[];
  const api=async(route,body)=>{
   if(route==='/site/chat/conversations')return {conversation:{id:'fixture',version}};
   if(route.endsWith('/messages')){const prompt=JSON.parse(body.content);prompts.push(prompt);const view=prompt.observation.browser;assert.ok(view);const uid=role=>view.snapshot.match(new RegExp('uid=(\\S+)[^\\n]*'+role,'i'))?.[1];
    next=phase===0?{action:'browser_tool',toolName:'navigate_page',toolArguments:JSON.stringify({pageId:view.pageId,url})}:phase===1?{action:'browser_tool',toolName:'fill',toolArguments:JSON.stringify({pageId:view.pageId,uid:uid('textbox'),value:'Gerçek Türkçe test'})}:phase===2?{action:'browser_tool',toolName:'click',toolArguments:JSON.stringify({pageId:view.pageId,uid:uid('button')})}:{action:'done',message:'Türkçe metin kaydedildi.'};phase++;return {run:{id:'run'}};}
   if(route.includes('/runs/'))return {run:{status:'COMPLETED'}};return {conversation:{id:'fixture',version:++version},messages:[{role:'assistant',content:JSON.stringify(next)}]};
  };
  const agent=new ComputerAgent({browser,memory,api,control:{enabled:true,screen:{},stop(){},observe(){throw Error('Native control is forbidden in this test');},perform(){throw Error('Native input is forbidden in this test');}}});const began=Date.now();
  const result=await agent.run('Chrome’da deneme metnini yaz ve kaydet',{id:'fixture',source:'PERSONAL'},{userRequest:'Chrome’da deneme metnini yaz ve kaydet',executor:'browser'});assert.equal(result.status,'completed',result.message);
  let view=await browser.observe();assert.match(view.browser.snapshot,/Gerçek Türkçe test/);const evidence=memory.computerExperience('deneme metnini');assert.ok(evidence.some(e=>e.steps.some(s=>s.toolName==='fill')));assert.doesNotMatch(JSON.stringify(evidence),/toolArguments/);
  console.log(JSON.stringify({elapsedMs:Date.now()-began,steps:agent.task.steps.length,promptMaxCharacters:Math.max(...prompts.map(p=>JSON.stringify(p).length))}));
  const waiting=browser.perform({toolName:'wait_for',toolArguments:JSON.stringify({pageId:view.browser.pageId,text:['This status will never appear'],timeout:600000})},view.id);await new Promise(r=>setTimeout(r,200));const stopped=Date.now();await browser.stop();await assert.rejects(waiting);const stopMs=Date.now()-stopped;assert.ok(stopMs<2000,'MCP stop must not wait for the long page watch');
  view=await browser.observe();assert.match(view.browser.snapshot,/Gerçek Türkçe test/,'stop disconnects the executor without losing the browser page');console.log('PASS real Chrome agent: navigate/fill/click/readback, account memory and long-watch stop in '+stopMs+'ms, reconnect preserves page');
 }finally{browser.close({closeBrowser:true});memory.close();server?.close();}
})().catch(e=>{console.error(e);process.exitCode=1});

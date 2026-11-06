// Real pinned MCP server + separate persistent Chrome profile, no personal tabs.
const {BrowserMcp}=require('../src/browser-mcp.cjs'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),{createServer}=require('node:http');
(async()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'umay-mcp-')),browser=new BrowserMcp({directory});let server;
 try{
  server=createServer((_req,res)=>res.end('<!doctype html><html lang="tr"><meta charset="utf-8"><title>UMAY MCP acceptance</title><label>Deneme metni<input aria-label="Deneme metni" id="input"></label><button onclick="document.querySelector(\'p\').textContent=document.querySelector(\'input\').value">Kaydet</button><p role="status">Hazır</p></html>'));await new Promise(r=>server.listen(0,'127.0.0.1',r));
  browser.activate('test');let view=await browser.observe();console.log(JSON.stringify({pages:view.browser.pages,tools:browser.tools.map(t=>t.name),snapshot:view.browser.snapshot.slice(0,150)}));
  const navigate=browser.tools.find(t=>t.name==='navigate_page');console.log(JSON.stringify({navigationSchema:navigate?.inputSchema}));
  await browser.perform({toolName:'navigate_page',toolArguments:JSON.stringify({pageId:view.browser.pageId,url:'http://127.0.0.1:'+server.address().port,timeout:10000})},view.id);
  view=await browser.observe();assert.match(view.browser.snapshot,/UMAY MCP acceptance/);assert.match(view.browser.snapshot,/Deneme metni/);
  const textbox=view.browser.snapshot.match(/uid=(\S+)[^\n]*textbox[^\n]*Deneme metni/i)?.[1];assert.ok(textbox,view.browser.snapshot);
  await browser.perform({toolName:'fill',toolArguments:JSON.stringify({pageId:view.browser.pageId,uid:textbox,value:'Gerçek Türkçe MCP testi'})},view.id);
  view=await browser.observe();const button=view.browser.snapshot.match(/uid=(\S+)[^\n]*button[^\n]*Kaydet/i)?.[1];assert.ok(button,view.browser.snapshot);
  await browser.perform({toolName:'click',toolArguments:JSON.stringify({pageId:view.browser.pageId,uid:button})},view.id);
  view=await browser.observe();assert.match(view.browser.snapshot,/Gerçek Türkçe MCP testi/);
  const result=await browser.call('evaluate_script',{pageId:view.browser.pageId,function:'() => document.title'});assert.match(JSON.stringify(result),/UMAY MCP acceptance/);
  console.log('PASS real Chrome MCP: initialize, tools discovery, visible Chrome, navigation, current-UID form fill/click/readback and evaluate');
 }finally{browser.close({closeBrowser:true});server?.close();}
})().catch(e=>{console.error(e);process.exitCode=1});

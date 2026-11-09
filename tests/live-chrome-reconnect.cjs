// Real close/reopen regression; only this test's own disposable Chrome profile.
const {BrowserMcp}=require('../src/browser-mcp.cjs'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'umay-chrome-reconnect-')),browser=new BrowserMcp({directory});
 try{
  browser.activate('reconnect-test','managed');let view=await browser.observe();const previous=browser.client,endpoint=await browser.browser.ensure();
  browser.browser.close();for(let i=0;i<100;i++){let alive=false;try{alive=(await fetch(endpoint+'/json/version',{signal:AbortSignal.timeout(300)})).ok;}catch{}if(!alive)break;await new Promise(r=>setTimeout(r,50));if(i===99)throw Error('Owned test Chrome did not close');}
  view=await browser.observe();assert.notEqual(browser.client,previous,'closed Chrome requires a new MCP connection');assert.ok(browser.state().connected);
  await browser.perform({toolName:'navigate_page',toolArguments:JSON.stringify({pageId:view.browser.pageId,url:'https://www.netflix.com',timeout:15000})},view.id);
  view=await browser.observe();assert.match(view.browser.pages.find(p=>p.id===view.browser.pageId).url,/^https:\/\/(?:www\.)?netflix\.com\//);assert.match(view.browser.snapshot,/Netflix/i);
  console.log('PASS real owned Chrome close -> existing MCP replaced -> Chrome reopened -> Netflix URL/title verified');
 }finally{await browser.stop();browser.close({closeBrowser:true});}
})().catch(error=>{console.error(error);process.exitCode=1});

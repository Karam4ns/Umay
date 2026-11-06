// Runs the packaged Umay executable as the MCP Node host; no system Node/npm.
const {app}=require('electron'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),{createServer}=require('node:http');
const resources=path.resolve(process.argv[2]||'dist/chrome-mcp-0.6.0/win-unpacked/resources'),directory=fs.mkdtempSync(path.join(os.tmpdir(),'umay-packaged-mcp-'));app.setPath('userData',path.join(directory,'electron'));
const isolated=path.join(directory,'resources');let browser,server;
const timeout=setTimeout(()=>{console.error('FAIL packaged MCP deadline');browser?.close({closeBrowser:true});app.exit(1);},60000);
app.whenReady().then(async()=>{try{
 fs.mkdirSync(isolated);require('original-fs').copyFileSync(path.join(resources,'app.asar'),path.join(isolated,'app.asar'));fs.cpSync(path.join(resources,'browser'),path.join(isolated,'browser'),{recursive:true});const {BrowserMcp}=require(path.join(isolated,'app.asar/src/browser-mcp.cjs'));

 server=createServer((_req,res)=>res.end('<!doctype html><meta charset="utf-8"><title>Packaged Umay MCP</title><button onclick="document.querySelector(\'p\').textContent=\'Tamamlandı\'">Dene</button><p>Hazır</p>'));await new Promise(r=>server.listen(0,'127.0.0.1',r));
 browser=new BrowserMcp({directory:path.join(directory,'browser'),command:path.join(resources,'../Umay.exe'),entry:path.join(isolated,'browser/chrome-devtools-mcp/build/src/bin/chrome-devtools-mcp.js')});browser.activate('packaging');let view=await browser.observe();assert.equal(browser.client.getServerVersion().version,'1.12.0');
 await browser.perform({toolName:'navigate_page',toolArguments:JSON.stringify({pageId:view.browser.pageId,url:'http://127.0.0.1:'+server.address().port})},view.id);view=await browser.observe();assert.match(view.browser.snapshot,/Packaged Umay MCP/);
 const uid=view.browser.snapshot.match(/uid=(\S+)[^\n]*button[^\n]*Dene/i)?.[1];assert.ok(uid,view.browser.snapshot);await browser.perform({toolName:'click',toolArguments:JSON.stringify({pageId:view.browser.pageId,uid})},view.id);view=await browser.observe();assert.match(view.browser.snapshot,/Tamamlandı/);
 const pid=browser.transport.pid;assert.ok(Number.isInteger(pid));await browser.stop();assert.throws(()=>process.kill(pid,0),'the packaged helper must exit instead of holding the installer executable open');
 const outside=Object.keys(require.cache).filter(file=>file.includes(path.sep+'node_modules'+path.sep)&&!file.startsWith(isolated));assert.deepEqual(outside,[],'the packaged SDK must not fall back to workspace dependencies');
 console.log('PASS isolated package: actual Umay.exe hosts pinned Chrome MCP without external Node/npm; ASAR SDK and dependencies load outside the workspace; real Chrome navigate/click/readback and helper exit verified');browser.close({closeBrowser:true});server.close();clearTimeout(timeout);app.quit();
}catch(error){console.error(error);browser?.close({closeBrowser:true});server?.close();clearTimeout(timeout);app.exit(1);}});

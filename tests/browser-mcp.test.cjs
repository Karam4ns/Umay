const {test}=require('node:test'),assert=require('node:assert/strict');
const {BrowserMcp,safeUrl,parsePages}=require('../src/browser-mcp.cjs');
const text=value=>({content:[{type:'text',text:value}]});
test('page lists retain canonical URLs when MCP includes a title before the address',()=>{
 assert.deepEqual(parsePages(text('## Pages\n1: Netflix Türkiye - İzle (https://www.netflix.com/tr/) [selected]\n2: about:blank')),[{id:1,url:'https://www.netflix.com/tr/',selected:true},{id:2,url:'about:blank',selected:false}]);
 assert.equal(parsePages(text('1: Örnek (https://example.org/a(b)?token=secret) [selected]'))[0].url,'https://example.org/a(b)?token=%5Bgizli%5D');
});
function fixture(){
 const calls=[],tools=['list_pages','take_snapshot','navigate_page','click','fill','type_text','press_key','new_page','select_page','evaluate_script','wait_for'].map(name=>({name,inputSchema:{type:'object',properties:name==='list_pages'?{}:{pageId:{type:'number'},...(name==='wait_for'?{timeout:{type:'integer'}}:{})}}}));
 let active=true,custom=null,closed=0,options;
 const browser=new BrowserMcp({directory:'unused',browser:{activate(){},ensure:async()=> 'http://127.0.0.1:1234',cancelPending(){},close(){}},clientFactory:()=>({async connect(){},async listTools(){return {tools};},async callTool(input){calls.push(input);if(custom)return custom(input);if(input.name==='list_pages')return text('## Pages\n1: https://example.org/ [selected]\n2: https://other.org/');if(input.name==='take_snapshot')return text('uid=1_0 RootWebArea "Fixture"\nuid=1_1 textbox "Name"\nuid=1_2 button "Save"');return text('Done');},async close(){closed++;}}),transportFactory:input=>(options=input,{async close(){closed++;}})});
 browser.activate('alice');return {browser,calls,options:()=>options,closed:()=>closed,set:fn=>custom=fn};
}
test('pinned MCP starts without npx and exposes actual tools, snapshots and redacted URLs',async()=>{
 const f=fixture(),view=await f.browser.observe();assert.equal(view.browser.pageId,1);assert.match(view.browser.snapshot,/textbox/);assert.ok(f.browser.capabilities().availableTools.includes('fill'));assert.equal(f.options().env.ELECTRON_RUN_AS_NODE,'1');assert.ok(f.options().args.includes('--no-usage-statistics'));assert.ok(!f.options().args.includes('npx'));assert.doesNotMatch(safeUrl('https://user:pass@example.org/?code=private&query=hello'),/private|user:pass/);await f.browser.stop();
});
test('a closed owned Chrome is rechecked and its stale MCP endpoint replaced before the next observation',async()=>{
 const f=fixture();let endpoint='http://127.0.0.1:1234',checks=0;f.browser.browser.ensure=async()=>{checks++;return endpoint;};
 const old=await f.browser.observe();endpoint='http://127.0.0.1:4321';const next=await f.browser.observe();
 assert.ok(checks>=2,'cached MCP must not skip the Chrome endpoint health check');assert.ok(f.options().args.includes('--browser-url='+endpoint));assert.ok(f.closed(),'old MCP helper must close');
 await assert.rejects(f.browser.perform({toolName:'click',toolArguments:'{"uid":"1_2"}'},old.id),/güncel değil/);assert.notEqual(next.id,old.id);await f.browser.stop();
});
test('Chrome reconnection never replays a page mutation and stop cancels a health check in flight',async()=>{
 const f=fixture();const view=await f.browser.observe();let checked;const checking=new Promise(r=>checked=r);let release;
 f.browser.browser.ensure=async()=>{checked();return new Promise(r=>release=r);};
 const read=f.browser.observe();await Promise.race([checking,new Promise((_,reject)=>setTimeout(()=>reject(Error('health check skipped')),100))]);await f.browser.stop();release('http://127.0.0.1:4321');
 await assert.rejects(read,/durduruldu/);await assert.rejects(f.browser.perform({toolName:'click',toolArguments:'{"uid":"1_2"}'},view.id),/güncel değil/);assert.equal(f.calls.filter(c=>c.name==='click').length,0);
});
test('a healthy endpoint reuses its helper and a disconnected mutation is never retried',async()=>{
 const f=fixture();await f.browser.observe();const before=f.options();let view=await f.browser.observe();assert.equal(f.options(),before);assert.equal(f.closed(),0);
 f.set(()=>({isError:true,...text('Could not connect to Chrome: ECONNREFUSED')}));
 await assert.rejects(f.browser.perform({toolName:'click',toolArguments:'{"pageId":1,"uid":"1_2"}'},view.id),{code:'BROWSER_CONNECTION_LOST'});assert.equal(f.calls.filter(c=>c.name==='click').length,1);await f.browser.stop();
});
test('stale/cross-tab element ids and concurrent mutations never reach the MCP server',async()=>{
 const f=fixture(),view=await f.browser.observe();await assert.rejects(f.browser.perform({toolName:'click',toolArguments:'{"pageId":2,"uid":"1_2"}'},view.id),/güncel sekme/);assert.equal(f.calls.filter(c=>c.name==='click').length,0);
 await assert.rejects(f.browser.perform({toolName:'click',toolArguments:'{"uid":"old_2"}'},view.id),/güncel sekme/);
 let finish;f.set(input=>input.name==='click'?new Promise(r=>finish=r):text('Done'));const running=f.browser.perform({toolName:'click',toolArguments:'{"pageId":1,"uid":"1_2"}'},view.id);await new Promise(r=>setImmediate(r));await assert.rejects(f.browser.observe(),/Önceki Chrome/);await f.browser.stop();finish(text('late'));await assert.rejects(running,/durduruldu/);assert.equal(f.calls.filter(c=>c.name==='click').length,1);assert.ok(f.closed());
});
test('repeated append is blocked, while fill remains an idempotent field replacement',async()=>{
 const f=fixture();let view=await f.browser.observe();await f.browser.perform({toolName:'type_text',toolArguments:'{"text":"example.org"}'},view.id);view=await f.browser.observe();await assert.rejects(f.browser.perform({toolName:'type_text',toolArguments:'{"text":"example.org"}'},view.id),/WRITE_ALREADY_APPLIED/);await f.browser.perform({toolName:'fill',toolArguments:'{"uid":"1_1","value":"Name"}'},view.id);assert.equal(f.calls.filter(c=>c.name==='type_text').length,1);await f.browser.stop();
});
test('settings/account switch invalidates old browser observations and unsafe URL schemes',async()=>{
 const f=fixture(),view=await f.browser.observe();await assert.rejects(f.browser.perform({toolName:'navigate_page',toolArguments:'{"url":"javascript:alert(1)"}'},view.id),/adres türü/);f.browser.activate('bob');await assert.rejects(f.browser.perform({toolName:'click',toolArguments:'{"uid":"1_2"}'},view.id),/güncel değil/);await f.browser.stop();
});
test('wait_for keeps bounded long-watch support while stop retains a separate cancellation path',async()=>{
 const f=fixture(),view=await f.browser.observe();await f.browser.perform({toolName:'wait_for',toolArguments:'{"text":["Done"],"timeout":6000000}'},view.id);assert.equal(f.calls.at(-1).arguments.timeout,600000);await f.browser.stop();
});
test('stop during browser startup cannot spawn a late MCP helper',async()=>{
 const f=fixture();let finish,started;const ready=new Promise(r=>started=r);f.browser.browser.ensure=async()=>{started();return new Promise(r=>finish=r);};let spawned=0;f.browser.transportFactory=()=>{spawned++;throw Error('late spawn');};
 const opening=f.browser.observe();await ready;await f.browser.stop();finish('http://127.0.0.1:1234');await assert.rejects(opening,/durduruldu/);assert.equal(spawned,0);
});
test('long MCP output is read in bounded chunks and cleared on account change',async()=>{
 const f=fixture();await f.browser.observe();f.browser.lastResult='a'.repeat(3000)+'article ending';f.browser.resultSource={url:'https://example.org/article'};
 const chunk=f.browser.readResult('{"source":"result","offset":2990,"length":100}');assert.equal(chunk.offset,2990);const view=await f.browser.observe();assert.match(view.browser.lastResult.text,/article ending/);assert.equal(view.browser.lastResult.offset,2990);
 f.browser.activate('bob');const other=await f.browser.observe();assert.equal(other.browser.lastResult.text,'');assert.equal(other.browser.lastResult.source,null);await f.browser.stop();
});
test('duplicate-write protection is scoped to the task and resets after a focus-changing key',async()=>{
 const f=fixture();let view=await f.browser.observe();await f.browser.perform({toolName:'type_text',toolArguments:'{"text":"same"}'},view.id);f.browser.beginTask();view=await f.browser.observe();await f.browser.perform({toolName:'type_text',toolArguments:'{"text":"same"}'},view.id);view=await f.browser.observe();await f.browser.perform({toolName:'press_key',toolArguments:'{"key":"Tab"}'},view.id);view=await f.browser.observe();await f.browser.perform({toolName:'type_text',toolArguments:'{"text":"same"}'},view.id);assert.equal(f.calls.filter(c=>c.name==='type_text').length,3);await f.browser.stop();
});

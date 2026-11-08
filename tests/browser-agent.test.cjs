const {test}=require('node:test'),assert=require('node:assert/strict');
const {ComputerAgent}=require('../src/computer-agent.cjs');
function fixture(actions){
 let clock=0,index=0,version=1;const posted=[],executed=[],native=[];
 const browser={stop:async()=>{},capabilities:()=>({availableTools:['navigate_page','click'],tools:[]}),observe:async()=>({id:'b'+index,title:'Chrome test',elements:[],windows:[],displays:[{id:'browser'}],screenshots:[],browser:{pageId:1,pages:[{id:1,url:'about:blank'}],snapshot:'uid=1_0 RootWebArea'}}),perform:async(action,id)=>(executed.push({action,id}),{toolName:action.toolName,outcome:'mcp_confirmed'}),describe:name=>({name,inputSchema:{type:'object'}})};
 const control={enabled:true,stop(){},screen:{},async observe(){native.push('observe');throw Error('Native observe must not run for browser task');},async perform(){native.push('input');}};
 const api=async(route,body)=>{if(route==='/site/chat/conversations')return {conversation:{id:'chat',version}};if(route.endsWith('/messages')){posted.push(JSON.parse(body.content));return {run:{id:'run'}};}if(route.includes('/runs/'))return {run:{status:'COMPLETED'}};return {conversation:{id:'chat',version:++version},messages:[{role:'assistant',content:JSON.stringify(actions[index++])}]};};
 const memory={epoch:1,context:()=>({}),log(){},archiveConversation(){}};
 return {browser,control,posted,executed,native,agent:new ComputerAgent({control,browser,api,memory,now:()=>clock,delay:async ms=>clock+=ms})};
}
const model={id:'model',source:'PERSONAL'};
test('short browser work survives accumulated workspace context without mutating current observations or user authority',async()=>{
 const f=fixture([{action:'done',message:'Güncel sonucu okudum.'}]);
 const view=await f.browser.observe();view.browser.snapshot='uid=1_0 RootWebArea "Sonuç"\n'+('uid=1_2 link "Sonuç satırı"\n'.repeat(100));view.browser.lastResult={text:'gerçek sonuç '.repeat(120),offset:0,length:1560,source:{tool:'click',status:'completed'}};
 f.browser.observe=async()=>view;
 const session={browser:{pageId:1,summary:'eski sekme özeti '.repeat(400)},task:{goal:'önceki görev',message:'durum '.repeat(400)},previous:{goal:'önceki arama',message:'eski sonuç '.repeat(400)}};
 f.agent.sessionContext=()=>session;
 f.agent.onObservation=task=>{task.activeTarget={executor:'browser',target:{handle:14,processId:81,browser:{pageId:1,summary:'aktif hedef '.repeat(400)}}};};
 const saved=JSON.stringify({session,view});
 const original='Arama sonuçlarında üçüncü olanı aç; sorguyu değiştirme.';
 const result=await f.agent.run('Sonucu aç',model,{userRequest:original,executor:'browser'});
 assert.equal(result.status,'completed',result.message);assert.equal(f.posted.length,1);assert.equal(f.posted[0].originalUserRequest,original);assert.deepEqual(f.posted[0].userAuthorization,[]);assert.equal(f.posted[0].observation.browser.pageId,1);assert.match(f.posted[0].observation.browser.snapshot,/uid=1_0/);assert.ok(JSON.stringify(f.posted[0]).length<=11900);assert.equal(JSON.stringify({session,view}),saved);
});
test('verified standalone navigation bypasses planner turns but still observes and checks the actual landing page',async()=>{
 const f=fixture([]);let observed=0;f.browser.observe=async()=>({id:'nav'+(++observed),title:'Chrome',elements:[],windows:[],displays:[],screenshots:[],browser:{pageId:1,pages:[{id:1,url:observed===1?'about:blank':'https://www.netflix.com/tr/'}],snapshot:'uid=1_0 RootWebArea "Netflix Türkiye"'}});
 const result=await f.agent.run('Onerilen farklı görev',model,{userRequest:'chrome kullanarak netflix açar mısın',executor:'browser'});
 assert.equal(result.status,'completed');assert.equal(f.posted.length,0);assert.equal(f.executed.length,1);assert.equal(f.executed[0].action.toolName,'navigate_page');assert.equal(observed,2);assert.equal(f.agent.task.timings.modelTurns,0);assert.deepEqual(f.native,[]);
});
test('a compound request stays with the general planner and a stopped direct navigation cannot finish late',async()=>{
 const f=fixture([{action:'done',message:'Sonuç incelendi.'}]);await f.agent.run('Netflix',model,{userRequest:'netflix aç ve hesabıma gir',executor:'browser'});assert.equal(f.posted.length,1);assert.equal(f.executed.length,0);
 const g=fixture([]);let entered,finish;const ready=new Promise(r=>entered=r);g.browser.perform=async()=>{entered();return new Promise(r=>finish=()=>r({toolName:'navigate_page',outcome:'mcp_confirmed'}));};
 const work=g.agent.run('Netflix',model,{userRequest:'netflix aç',executor:'browser'});await ready;await g.agent.stop();finish();await work;assert.equal(g.agent.state().status,'stopped');assert.equal(g.agent.task.steps.length,0);assert.equal(g.posted.length,0);
});
test('a partially applied fast navigation is re-observed by the general planner and never replayed automatically',async()=>{
 const f=fixture([{action:'done',message:'Güncel sayfa doğrulandı.'}]);let attempts=0,observations=0;const observe=f.browser.observe;
 f.browser.observe=async()=>{observations++;return observe();};f.browser.perform=async()=>{attempts++;throw Object.assign(Error('Navigation timed out; page may have loaded'),{code:'BROWSER_TOOL_FAILED'});};
 const result=await f.agent.run('Netflix',model,{userRequest:'netflix aç',executor:'browser'});assert.equal(result.status,'completed');assert.equal(attempts,1);assert.ok(observations>=2);assert.equal(f.posted.length,1);assert.match(f.posted[0].userFeedback,/kısmen uygulanmış olabilir/);assert.equal(f.agent.task.fastNavigationAttempted,true);
});
test('a native Chrome address shortcut is redirected to MCP even after a desktop assignment',async()=>{
 const f=fixture([{action:'keys',keys:['CTRL','L']},{action:'browser_tool',toolName:'navigate_page',toolArguments:'{"url":"https://example.org"}'},{action:'done',message:'Açıldı.'}]);
 f.control.observe=async()=>({id:'native',title:'Fixture - Google Chrome',windows:[],elements:[],screenshots:[],displays:[]});
 assert.equal((await f.agent.run('İşi yap',model,{executor:'desktop',userRequest:'İşi yap'})).status,'completed');assert.equal(f.native.includes('input'),false);assert.equal(f.executed.length,1);assert.match(f.posted[1].userFeedback,/Windows girişi uygulanmadı/);
});
test('chat browser assignment uses the real browser tool contract without native typing',async()=>{
 const f=fixture([{action:'browser_tool',toolName:'navigate_page',toolArguments:'{"url":"https://example.org"}',summary:'Açılıyor'},{action:'done',message:'Site açıldı.'}]);
 const result=await f.agent.run('Siteyi aç',model,{userRequest:'Siteyi aç',executor:'browser',plan:['Sayfayı aç','Sonucu doğrula']});
 assert.equal(result.status,'completed');assert.equal(f.executed.length,1);assert.deepEqual(f.native,[]);assert.ok(f.posted[0].capabilities.actions.includes('browser_tool'));assert.equal(f.posted[0].capabilities.actions.includes('type'),false);assert.deepEqual(f.posted[0].handoffPlan,['Sayfayı aç','Sonucu doğrula']);assert.equal(f.posted[1].previousSteps[0].toolName,'navigate_page');
});
test('a browser task rejects Windows keyboard attempts and recovers through MCP',async()=>{
 const f=fixture([{action:'keys',keys:['CTRL','L']},{action:'browser_tool',toolName:'navigate_page',toolArguments:'{"url":"https://example.org"}'},{action:'done',message:'Açıldı.'}]);
 assert.equal((await f.agent.run('Chrome ile https://example.org üzerinde ilerle',model)).status,'completed');assert.deepEqual(f.native,[]);assert.match(f.posted[1].userFeedback,/browser_tool/);
});
test('stop while a browser tool is in flight rejects its late continuation',async()=>{
 const f=fixture([{action:'browser_tool',toolName:'click',toolArguments:'{}'},{action:'done',message:'Wrong late result'}]);let finish,entered;
 const ready=new Promise(r=>entered=r);f.browser.perform=async()=>{entered();return new Promise(r=>finish=()=>r({toolName:'click',outcome:'mcp_confirmed'}));};let stopped=0;f.browser.stop=async()=>stopped++;
 const work=f.agent.run('Chrome sayfasında ilerle',model);await ready;await f.agent.stop();finish();await work;assert.equal(f.agent.state().status,'stopped');assert.equal(f.agent.task.steps.length,0);assert.equal(f.posted.length,1);assert.equal(stopped,1);
});

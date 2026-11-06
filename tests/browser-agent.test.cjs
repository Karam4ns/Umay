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
 assert.equal((await f.agent.run('Chrome ile https://example.org aç',model)).status,'completed');assert.deepEqual(f.native,[]);assert.match(f.posted[1].userFeedback,/browser_tool/);
});
test('stop while a browser tool is in flight rejects its late continuation',async()=>{
 const f=fixture([{action:'browser_tool',toolName:'click',toolArguments:'{}'},{action:'done',message:'Wrong late result'}]);let finish,entered;
 const ready=new Promise(r=>entered=r);f.browser.perform=async()=>{entered();return new Promise(r=>finish=()=>r({toolName:'click',outcome:'mcp_confirmed'}));};let stopped=0;f.browser.stop=async()=>stopped++;
 const work=f.agent.run('Chrome sayfasında ilerle',model);await ready;await f.agent.stop();finish();await work;assert.equal(f.agent.state().status,'stopped');assert.equal(f.agent.task.steps.length,0);assert.equal(f.posted.length,1);assert.equal(stopped,1);
});

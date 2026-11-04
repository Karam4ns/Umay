const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const errors=require('../src/ui/user-errors.js'),source=fs.readFileSync('server/web/chat.js','utf8');
function harness(fetch){
 const nodes=new Map();const el=id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',hidden:true,replaceChildren(){}});return nodes.get(id);};
 const document={getElementById:el,documentElement:{lang:'tr'}};
 const context=vm.createContext({window:{UmayErrors:errors},document,el,fetch,AbortSignal,epoch:1,clear(){},paint(){},renderDraft(){},notice(key){el('status').textContent=key;}});
 for(const [start,end]of [['  function showRequestError(','  function notice('],['  function renderRun(','  function schedulePoll('],['  async function api(','  function selected(']])vm.runInContext(source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start))),context);
 return {el,run:code=>vm.runInContext(code,context)};
}
test('web run failure stays visible near the conversation and clears on a new run',()=>{
 const app=harness();app.run('renderRun({status:"FAILED",errorCode:"INSUFFICIENT_TOKENS"})');assert.equal(app.el('chat-error').hidden,false);assert.equal(app.el('chat-error-title').textContent,'Token limitiniz yetersiz');
 assert.doesNotMatch(app.el('status').textContent,/INSUFFICIENT_TOKENS/);app.run('renderRun({status:"RUNNING",phase:"generating"})');assert.equal(app.el('chat-error').hidden,true);
});
test('web POST errors retain the cause and do not show raw server text',async()=>{
 const app=harness(async()=>({ok:false,status:409,json:async()=>({message:'INSUFFICIENT_TOKENS'})}));
 await assert.rejects(app.run('api("/site/chat/conversations/x/messages",{})'),/INSUFFICIENT_TOKENS/);assert.equal(app.el('chat-error-title').textContent,'Token limitiniz yetersiz');
 const unknown=harness(async()=>({ok:false,status:500,json:async()=>({message:'SQL secret'})}));await assert.rejects(unknown.run('api("/site/chat/models")'),/SERVER_UNAVAILABLE/);assert.doesNotMatch(unknown.el('chat-error-detail').textContent,/SQL|secret/);
});
test('web connection failures show an actionable warning',async()=>{
 const app=harness(async()=>{throw TypeError('Failed to fetch internal-host');});await assert.rejects(app.run('api("/site/chat/models")'),/NETWORK_ERROR/);assert.equal(app.el('chat-error-title').textContent,'Sunucuya bağlanılamadı');
});
test('website and Windows use the exact same error catalogue',()=>{
 const shared=fs.readFileSync('src/ui/user-errors.js','utf8').replace(/\r\n/g,'\n');assert.ok(source.replace(/\r\n/g,'\n').startsWith(shared+'\n/* Chat application */'));
 assert.match(fs.readFileSync('server/web/chat.html','utf8'),/id="chat-error"[^>]*role="alert"/);
});

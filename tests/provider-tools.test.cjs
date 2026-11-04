const {test}=require('node:test');
const assert=require('node:assert/strict');
const {unavailableToolResults,rememberUnavailableTools,unavailableToolsKnown}=require('../server/chat-tool-recovery.ts');
test('an unrequested search call becomes an explicit failed tool result, never an empty retry',()=>{
 const call={id:'call-search',type:'function',function:{name:'search_web',arguments:'{"q":"weather"}'}};
 const next=unavailableToolResults({content:null,tool_calls:[call]});
 assert.equal(next.length,2);assert.deepEqual(next[0],{role:'assistant',content:null,tool_calls:[call]});
 assert.equal(next[1].role,'tool');assert.equal(next[1].tool_call_id,'call-search');
 assert.equal(JSON.parse(next[1].content).status,'unavailable');assert.equal(JSON.parse(next[1].content).executed,false);
 assert.match(JSON.parse(next[1].content).instruction,/never claim/i);
});
test('ordinary text is unchanged and malformed or excessive tool calls fail explicitly',()=>{
 assert.equal(unavailableToolResults({content:'Merhaba.'}),null);
 assert.throws(()=>unavailableToolResults({tool_calls:[{id:'x',type:'custom'}]}),/PROVIDER_TOOL_UNAVAILABLE/);
 assert.throws(()=>unavailableToolResults({tool_calls:Array(17).fill({})}),/PROVIDER_TOOL_UNAVAILABLE/);
});
test('learned tool capability is isolated to the same provider/model/credential key and expires',()=>{
 const now=Date.now;let time=1000;Date.now=()=>time;
 try{rememberUnavailableTools('provider-model-key');assert.equal(unavailableToolsKnown('provider-model-key'),true);assert.equal(unavailableToolsKnown('different-model-key'),false);time+=300001;assert.equal(unavailableToolsKnown('provider-model-key'),false);}finally{Date.now=now;}
});

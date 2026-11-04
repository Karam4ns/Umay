const {test}=require('node:test'),assert=require('node:assert/strict');
const {readSiteResponse}=require('../src/site-response.cjs');
test('HTTP errors keep a known cause instead of replacing all conflicts with stale',async()=>{
 await assert.rejects(readSiteResponse({ok:false,status:409,json:async()=>({message:'INSUFFICIENT_TOKENS'})}),/^Error: INSUFFICIENT_TOKENS$/);
 await assert.rejects(readSiteResponse({ok:false,status:500,json:async()=>({message:'SQL secret detail'})}),/^Error: SERVER_UNAVAILABLE$/);
});
test('malformed JSON has a safe fallback and successful responses stay unchanged',async()=>{
 await assert.rejects(readSiteResponse({ok:true,status:200,json:async()=>{throw SyntaxError('raw body');}}),/^Error: SERVER_UNAVAILABLE$/);
 const value={run:{status:'RUNNING'}};assert.equal(await readSiteResponse({ok:true,json:async()=>value}),value);
});

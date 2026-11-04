const {test}=require('node:test'),assert=require('node:assert/strict');
const errors=require('../src/ui/user-errors.js');
test('token balance and pending usage have distinct actionable messages without debit promises',()=>{
 const low=errors.describe('INSUFFICIENT_TOKENS'),pending=errors.describe('TOKEN_USAGE_RECONCILIATION_REQUIRED');
 assert.equal(low.title,'Token limitiniz yetersiz');assert.match(low.message,/token/i);assert.notEqual(low.title,pending.title);
 assert.doesNotMatch(low.message+pending.message,/kesilmedi|iade edildi|INSUFFICIENT|RECONCILIATION/);
});
test('API errors preserve known causes while unknown provider content is never shown',()=>{
 assert.equal(errors.responseCode(409,{message:'INSUFFICIENT_TOKENS'}),'INSUFFICIENT_TOKENS');
 assert.equal(errors.responseCode(429,{}),'RATE_LIMITED');assert.equal(errors.responseCode(401,{}),'LOGIN_REQUIRED');
 const unknown=errors.describe('<script>secret API_KEY=123</script>');assert.doesNotMatch(unknown.title+unknown.message,/script|secret|API_KEY/);
 assert.doesNotMatch(errors.describe('PROVIDER_AUTH_FAILED').message,/anahtar|password|401/);
});
test('the same safe failure alert can be updated and cleared for run changes',()=>{
 const nodes=new Map();for(const id of ['chat-error','chat-error-title','chat-error-detail'])nodes.set(id,{hidden:true,textContent:''});
 const doc={getElementById:id=>nodes.get(id),documentElement:{lang:'tr'}};
 errors.render(doc,'INSUFFICIENT_TOKENS');assert.equal(nodes.get('chat-error').hidden,false);assert.equal(nodes.get('chat-error-title').textContent,'Token limitiniz yetersiz');
 errors.render(doc,'PROVIDER_TIMEOUT');assert.match(nodes.get('chat-error-title').textContent,/uzun/);
 errors.render(doc,null);assert.equal(nodes.get('chat-error').hidden,true);assert.equal(nodes.get('chat-error-detail').textContent,'');
});

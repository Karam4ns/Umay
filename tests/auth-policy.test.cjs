const {test}=require('node:test');const assert=require('node:assert/strict');
const {parameters,verify}=require('../server/desktop-auth-policy.ts');
const {createHash}=require('node:crypto');const verifier='v'.repeat(43);
const challenge=createHash('sha256').update(verifier).digest('base64url');
const redirectUri='http://127.0.0.1:34567/umay-auth/callback';
test('authorization refuses non-loopback, credentials and callback injection',()=>{
 for(const bad of ['https://evil.test/umay-auth/callback','http://127.0.0.1:34567/umay-auth/callback?extra=1','http://a@127.0.0.1:34567/umay-auth/callback','http://127.0.0.1:34567/other','http://localhost:34567/umay-auth/callback'])
  assert.throws(()=>parameters({redirectUri:bad,state:'s'.repeat(43),challenge}));
 assert.equal(parameters({redirectUri,state:'s'.repeat(43),challenge}).redirectUri,redirectUri);
});
test('grant refuses wrong verifier, expiry and redirected token redemption',()=>{
 const grant={redirectUri,challenge,expires:1000};
 assert.doesNotThrow(()=>verify(grant,{redirectUri,verifier},999));
 assert.throws(()=>verify(grant,{redirectUri,verifier},1000));
 assert.throws(()=>verify(grant,{redirectUri,verifier:'x'.repeat(43)},999));
 assert.throws(()=>verify(grant,{redirectUri:redirectUri.replace('34567','34568'),verifier},999));
});

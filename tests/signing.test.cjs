const {test}=require('node:test');
const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
test('signed build refuses to proceed without signing credentials',()=>{
 const env={...process.env};
 for(const key of ['CSC_LINK','WIN_CSC_LINK','UMAY_CERT_SHA1'])delete env[key];
 const result=spawnSync(process.execPath,['scripts/build-signed.cjs','--check-only'],{env,encoding:'utf8'});
 assert.equal(result.status,1);
 assert.match(result.stderr,/Kod imzalama sertifikası gerekli/);
});

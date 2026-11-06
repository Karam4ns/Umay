const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),{operatorHeaders}=require('../src/operator-channel.cjs'),{patchOperatorRate}=require('../server/patch-operator-rate.cjs');
test('only machine planning requests select a separate bounded channel; ordinary chat stays at 12/minute',()=>{
 assert.deepEqual(operatorHeaders({desktopMode:'context'}),{});assert.deepEqual(operatorHeaders({desktopMode:'computer'}),{'X-Umay-Operator':'umay-general-v1'});
 const src=patchOperatorRate('({rateLimit: { ...writeRate, max: 12 }})'),options=vm.runInNewContext(src,{writeRate:{max:12,timeWindow:60000},node_crypto_1:require('node:crypto')}).rateLimit,web={headers:{},cookies:{veriussu_web:'fixture'},ip:'127.0.0.1'},operator={...web,headers:{'x-umay-operator':'umay-general-v1'}};
 assert.equal(options.max(web),12);assert.equal(options.max(operator),90);assert.notEqual(options.keyGenerator(web),options.keyGenerator(operator));assert.equal(options.max({...operator,cookies:{}}),12);assert.equal(options.timeWindow,60000);assert.throws(()=>patchOperatorRate(src),/anchor changed/);
});

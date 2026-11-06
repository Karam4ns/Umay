'use strict';
function patchOperatorRate(source){const anchor='rateLimit: { ...writeRate, max: 12 }';if(source.split(anchor).length!==2)throw Error('Operator rate anchor changed');return source.replace(anchor,`rateLimit: {
 ...writeRate,
 max: request => request.headers['x-umay-operator']==='umay-general-v1' && typeof request.cookies.veriussu_web==='string' ? 90 : 12,
 keyGenerator: request => (0,node_crypto_1.createHash)('sha256').update((request.headers['x-umay-operator']==='umay-general-v1' && typeof request.cookies.veriussu_web==='string' ? 'umay-operator:' : '')+(request.cookies.veriussu_web ?? request.ip)).digest('hex')
 }`);}
module.exports={patchOperatorRate};

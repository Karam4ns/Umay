const {test}=require('node:test');
const assert=require('node:assert/strict');
const {BrowserAuth}=require('../src/browser-auth.cjs');

test('external browser callback exchanges a code using the matching PKCE verifier',async()=>{
 let opened,exchange;
 const auth=new BrowserAuth({openExternal:async url=>opened=new URL(url),exchange:async input=>{exchange=input;return {ok:true};}});
 const {completion}=await auth.start();
 try{
  const callback=new URL(opened.searchParams.get('redirectUri'));
  callback.searchParams.set('state',opened.searchParams.get('state'));callback.searchParams.set('code','one-time-code');
  const response=await fetch(callback);assert.equal(response.status,200);assert.deepEqual(await completion,{ok:true});
  const {createHash}=require('node:crypto');
  assert.equal(createHash('sha256').update(exchange.verifier).digest('base64url'),opened.searchParams.get('challenge'));
  assert.equal(exchange.code,'one-time-code');assert.ok(!opened.toString().includes(exchange.verifier));
 }finally{auth.cancel();}
});
test('invalid state cannot consume a pending browser login',async()=>{
 let opened,calls=0;
 const auth=new BrowserAuth({openExternal:async u=>opened=new URL(u),exchange:async()=>{calls++;return true;}});
 const {completion}=await auth.start();completion.catch(()=>{});
 try{
  const callback=new URL(opened.searchParams.get('redirectUri'));callback.searchParams.set('state','wrong');callback.searchParams.set('code','code');
  assert.equal((await fetch(callback)).status,400);assert.equal(calls,0);
  callback.searchParams.set('state',opened.searchParams.get('state'));assert.equal((await fetch(callback)).status,200);assert.equal(await completion,true);
 }finally{auth.cancel();}
});
test('cancelled browser login cannot complete after token exchange resolves',async()=>{
 let opened,release;const discarded=[];const delayed=new Promise(resolve=>release=resolve);
 const auth=new BrowserAuth({openExternal:async u=>opened=new URL(u),exchange:async()=>delayed,discard:async result=>discarded.push(result)});
 const {completion}=await auth.start();const rejected=assert.rejects(completion,/iptal/);
 const callback=new URL(opened.searchParams.get('redirectUri'));callback.searchParams.set('state',opened.searchParams.get('state'));callback.searchParams.set('code','code');
 const request=fetch(callback).catch(()=>{});await new Promise(r=>setTimeout(r,20));auth.cancel();release({sessionToken:'secret'});
 await rejected;await request;await new Promise(r=>setImmediate(r));assert.deepEqual(discarded,[{sessionToken:'secret'}]);
});
test('logout before the listener starts prevents the browser from opening',async()=>{
 let opens=0;
 const auth=new BrowserAuth({openExternal:async()=>{opens++;},exchange:async()=>true});
 const starting=auth.start();auth.cancel();const {completion}=await starting;
 await assert.rejects(completion,/iptal/);assert.equal(opens,0);
});
test('simultaneous login requests leave only the newest callback active',async()=>{
 const opened=[];const auth=new BrowserAuth({openExternal:async u=>opened.push(u),exchange:async()=>true});
 const [first,last]=await Promise.all([auth.start(),auth.start()]);
 try{await assert.rejects(first.completion,/iptal/);assert.equal(opened.length,1);
  const url=new URL(opened[0]);const callback=new URL(url.searchParams.get('redirectUri'));callback.searchParams.set('state',url.searchParams.get('state'));callback.searchParams.set('code','code');
  assert.equal((await fetch(callback)).status,200);assert.equal(await last.completion,true);
 }finally{auth.cancel();}
});

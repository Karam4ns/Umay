const {test}=require('node:test'),assert=require('node:assert/strict'),net=require('node:net'),{EventEmitter}=require('node:events'),{PassThrough}=require('node:stream');
const {DesktopAccess,createElevationTransport}=require('../src/desktop-access.cjs');
function launcher(){const child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();child.kill=()=>{};return child;}
test('named pipe authenticates only the one-use session token and requires an administrator hello',async()=>{
 let details;const tx=createElevationTransport({timeout:2000,launch:input=>{details=input;return launcher();}});await tx.listening;
 const bad=net.connect(details.pipeName);bad.on('error',()=>{});bad.write(JSON.stringify({event:'elevated-ready',token:'wrong',administrator:true})+'\n');await new Promise(r=>bad.once('close',r));
 const valid=net.connect(details.pipeName);valid.write(JSON.stringify({event:'elevated-ready',token:details.token,administrator:true})+'\n');const child=await tx.promise;assert.notEqual(child.stdin,valid);assert.ok(child.stdout);child.kill();valid.destroy();
});
test('UAC refusal and cancellation reject without accepting a late helper',async()=>{
 let child;const refused=createElevationTransport({timeout:1000,launch:()=>{child=launcher();setImmediate(()=>child.stdout.write('UAC_DENIED\n'));return child;}});await assert.rejects(refused.promise,error=>error.code==='UAC_DENIED');
 const cancelled=createElevationTransport({timeout:1000,launch:()=>launcher()});const result=cancelled.promise.catch(e=>e.code);await cancelled.listening;cancelled.cancel();assert.equal(await result,'NATIVE_CANCELLED');
});
test('non-elevated handshake cannot activate administrator access',async()=>{
 let details;const tx=createElevationTransport({timeout:1000,launch:input=>{details=input;return launcher();}});await tx.listening;const result=tx.promise.catch(e=>e.code),socket=net.connect(details.pipeName);socket.on('error',()=>{});socket.write(JSON.stringify({event:'elevated-ready',token:details.token,administrator:false})+'\n');assert.equal(await result,'UAC_NOT_ELEVATED');socket.destroy();
});
test('routing uses normal input until verified elevation and releases on cancellation',async()=>{
 const seen=[];const normal={request:async()=>{seen.push('normal');},cancel(){},close(){}},privileged={request:async method=>{seen.push(method);return {administrator:true};},cancel:async()=>{},close(){seen.push('closed');}};
 const access=new DesktopAccess({normal,nativeFactory:()=>privileged,transportFactory:()=>({promise:Promise.resolve(launcher()),cancel(){}})});
 await access.request('observe');await access.elevate();assert.equal(access.state().administrator,true);await access.request('observe');await access.cancel();assert.equal(access.state().administrator,false);await access.request('observe');assert.deepEqual(seen,['normal','privileges','observe','closed','normal']);access.close();
});
test('a grant completed after stop never replaces a newer permission session',async()=>{
 let finish;const access=new DesktopAccess({normal:{cancel(){},close(){}},transportFactory:()=>({promise:new Promise(r=>finish=r),cancel(){}})});
 const grant=access.elevate();await access.cancel();let killed=false;const child=launcher();child.kill=()=>killed=true;finish(child);await assert.rejects(grant,error=>error.code==='NATIVE_CANCELLED');assert.equal(access.state().administrator,false);assert.equal(killed,true);access.close();
});
test('unverified helper is never advertised or used as an administrator',async()=>{
 let finish;const seen=[];const access=new DesktopAccess({normal:{request:async()=>seen.push('normal'),cancel(){},close(){}},transportFactory:()=>({promise:Promise.resolve(launcher()),cancel(){}}),nativeFactory:()=>({request:()=>new Promise(r=>finish=r),cancel(){},close(){}})});
 const grant=access.elevate();await new Promise(r=>setImmediate(r));assert.equal(access.state().administrator,false);await access.request('observe');assert.deepEqual(seen,['normal']);finish({administrator:true});await grant;await access.cancel();
});

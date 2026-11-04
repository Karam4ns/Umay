const {test}=require('node:test');const assert=require('node:assert/strict');
const {LiveTranscriber}=require('../src/ui/live-transcription.js');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
test('partials arrive while audio keeps flowing; only final text is submitted once',async()=>{
 const partials=[],finals=[];const live=new LiveTranscriber({speech:async()=>true,onPartial:t=>partials.push(t),onFinal:t=>finals.push(t),onError:e=>{throw e;}});
 await live.start('microphone');live.accept(new Float32Array(1600));
 live.receive({streamId:'microphone',generation:0,utterance:0,text:'merhaba',final:false});
 assert.deepEqual(partials,['merhaba']);assert.deepEqual(finals,[]);
 const event={streamId:'microphone',generation:0,utterance:0,text:'Merhaba Umay.',final:true};live.receive(event);live.receive(event);
 assert.deepEqual(finals,['Merhaba Umay.']);await live.close();
});
test('in-flight recognition does not discard subsequent microphone samples',async()=>{
 let release,active=0,maxActive=0,samples=0;const blocked=new Promise(resolve=>release=resolve);
 const live=new LiveTranscriber({speech:async(method,p)=>{if(method==='stt_feed'){active++;maxActive=Math.max(maxActive,active);samples+=Buffer.from(p.audio,'base64').length/2;await blocked;active--;}return true;},onError:e=>{throw e;}});
 await live.start('microphone');live.accept(new Float32Array(1600));await flush();
 for(let i=0;i<8;i++)live.accept(new Float32Array(1600));
 release();await flush();await flush();assert.equal(samples,14400);assert.equal(maxActive,1);await live.close();
});
test('reset and closed sessions reject late partial and final results',async()=>{
 const received=[];const live=new LiveTranscriber({speech:async()=>true,onPartial:t=>received.push(t),onFinal:t=>received.push(t)});
 await live.start('old');await live.reset();
 live.receive({streamId:'old',generation:0,utterance:0,text:'stale',final:true});
 live.receive({streamId:'old',generation:1,utterance:0,text:'current',final:false});
 await live.close();live.receive({streamId:'old',generation:1,utterance:0,text:'closed',final:true});
 assert.deepEqual(received,['current']);
});
test('an overloaded decoder fails visibly rather than dropping speech silently',async()=>{
 const errors=[];let release;const blocked=new Promise(resolve=>release=resolve);
 const live=new LiveTranscriber({speech:async method=>method==='stt_feed'?blocked:true,maxQueuedSamples:3200,onError:e=>errors.push(e.message)});
 await live.start('microphone');live.accept(new Float32Array(1600));await flush();live.accept(new Float32Array(4000));
 assert.equal(errors.length,1);assert.match(errors[0],/yetişemiyor/);release();await flush();
});

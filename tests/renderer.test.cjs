const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {randomUUID}=require('node:crypto');
const {LiveTranscriber}=require('../src/ui/live-transcription.js');

const source=fs.readFileSync(path.join(__dirname,'../src/ui/renderer.js'),'utf8');
function deferred(){let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};}
function element(){return {value:'',checked:false,textContent:'',dataset:{},children:[],
  append(...children){this.children.push(...children);},addEventListener(name,fn){this['on'+name]=fn;},
  replaceChildren(...children){this.children=children;},scrollIntoView(){},
  classList:{contains:()=>false,toggle(){},remove(){}}};}
function renderer(overrides={}){
  const nodes=new Map();let eventListener;
  const node=id=>{if(!nodes.has(id))nodes.set(id,element());return nodes.get(id);};
  const bridge={
    onEvent(callback){eventListener=callback;},busy:async()=>{},
    speech:async method=>method==='status'?{stt:{installed:false},tts:{installed:false}}:true,
    api:async()=>{throw Error('No account in test');},
    ...overrides
  };
  const context=vm.createContext({
    window:{umay:bridge,LiveTranscriber,UmayErrors:require('../src/ui/user-errors.js')},
    document:{getElementById:node,querySelectorAll:()=>[],createElement:element,body:element()},
    localStorage:{getItem:()=>null,setItem(){}},crypto:{randomUUID},
    atob,btoa,Uint8Array,Int16Array,Float32Array,setTimeout,
    AudioContext:overrides.AudioContext,navigator:overrides.navigator,AudioWorkletNode:overrides.AudioWorkletNode
  });
  vm.runInContext(source,context,{filename:'renderer.js'});
  return {node,run:code=>vm.runInContext(code,context),emit:event=>eventListener(event)};
}
test('historical uppercase USER messages retain the user appearance',()=>{
 const app=renderer();app.run("message('USER','earlier question')");assert.equal(app.node('messages').children[0].className,'message user');
});
test('a stale failed account lookup cannot overwrite the connected account status',async()=>{
 let rejectEarlier,checks=0;const earlier=new Promise((_yes,no)=>rejectEarlier=no);
 const app=renderer({api:async route=>{
  if(route==='/site/auth/me')return ++checks===1?earlier:{id:'new-account',email:'new@example.test'};
  if(route==='/site/chat/models')return {models:[]};return {conversations:[]};
 }});
 await app.run('refresh()');rejectEarlier(Error('Old disconnected account'));await new Promise(r=>setImmediate(r));
 assert.equal(app.node('status').textContent,'Bağlı hesap: new@example.test');
});
test('expired account cleanup cannot hide a newer successful login',async()=>{
 let checks=0,block=false;const cancels=[];
 const app=renderer({api:async route=>{
  if(route==='/site/auth/me'){checks++;if(checks===2)throw Error('Oturum doğrulaması gerekli.');return {id:checks===1?'old':'new',email:checks===1?'old@example.test':'new@example.test'};}
  return route==='/site/chat/models'?{models:[]}:{conversations:[]};
 },speech:async method=>{
  if(method==='status')return {stt:{installed:false},tts:{installed:false}};
  if(method==='cancel'&&block){const wait=deferred();cancels.push(wait);return wait.promise;}return true;
 }});
 await new Promise(r=>setImmediate(r));block=true;const expired=app.run('refresh()');await new Promise(r=>setImmediate(r));block=false;
 await app.run('refresh()');cancels.forEach(wait=>wait.resolve());await expired;
 assert.equal(app.node('status').textContent,'Bağlı hesap: new@example.test');assert.equal(app.run('accountId'),'new');
});

test('overlapping sends only post the newest question after cancellation resolves',async()=>{
  const cancels=[],requests=[];
  const app=renderer({
    speech:async method=>{
      if(method==='status')return {stt:{installed:false},tts:{installed:false}};
      if(method==='cancel'){const wait=deferred();cancels.push(wait);return wait.promise;}
      return true;
    },
    api:async(route,body)=>{
      if(route==='/site/auth/me')throw Error('No account in test');
      requests.push({route,body});
      if(route==='/site/chat/conversations')return {conversation:{id:'conversation',version:0}};
      if(route.endsWith('/messages'))return {run:{id:'run'}};
      if(route==='/site/chat/runs/run')return {run:{status:'COMPLETED'}};
      return {conversation:{id:'conversation',version:1},messages:[]};
    }
  });
  app.node('models').value='model';
  app.run("models=[{id:'model',source:'site'}]");
  const first=app.run("send('first question')");
  const second=app.run("send('second question')");
  assert.equal(cancels.length,2);
  cancels.forEach(wait=>wait.resolve());
  await Promise.all([first,second]);
  assert.equal(requests.filter(r=>r.route==='/site/chat/conversations').length,1);
  const posts=requests.filter(r=>r.route.endsWith('/messages'));
  assert.equal(posts.length,1);
  assert.equal(posts[0].body.content,'second question');
  assert.deepEqual(app.node('messages').children.map(n=>n.textContent),['second question']);
});

test('quiet residual output does not interrupt Umay',async()=>{
 const app=renderer();await new Promise(r=>setImmediate(r));
 app.run('listening=true; interrupted=0; sources=[{stop(){interrupted++}}]');
 for(let i=0;i<60;i++)await app.run('onFrame(new Float32Array(320).fill(0.004))');
 assert.equal(app.run('interrupted'),0);assert.equal(app.run('recording'),false);
});

test('microphone can stop and restart without registering the worklet twice',async()=>{
 let modules=0,tracksStopped=0;
 class Context {
  constructor(){this.audioWorklet={addModule:async()=>{if(++modules>1)throw Error('Processor already registered');}};}
  async resume(){} createMediaStreamSource(){return {connect(){},disconnect(){}};}
  createGain(){return {gain:{value:0},connect(){return {connect(){}};},disconnect(){}};}
 }
 class Worklet {constructor(){this.port={};}connect(){return {connect(){}};}disconnect(){}}
 const app=renderer({AudioContext:Context,AudioWorkletNode:Worklet,
  navigator:{mediaDevices:{getUserMedia:async()=>({getTracks:()=>[{stop(){tracksStopped++;},label:'Test microphone'}]})}},
  speech:async method=>method==='status'?{stt:{installed:true},tts:{installed:false}}:true});
 await app.node('listen').onclick();assert.equal(app.run('listening'),true);
 await app.node('listen').onclick();assert.equal(tracksStopped,1);
 await app.node('listen').onclick();assert.equal(app.run('listening'),true);assert.equal(modules,1);
});

test('logout during microphone permission does not reopen capture',async()=>{
 const permission=deferred();let stopped=0;
 class Context {
  constructor(){this.audioWorklet={addModule:async()=>{}};}
  async resume(){}createMediaStreamSource(){return {connect(){},disconnect(){}};}
  createGain(){return {gain:{value:0},connect(){},disconnect(){}};}
 }
 class Worklet {constructor(){this.port={};}connect(){}disconnect(){}}
 const app=renderer({AudioContext:Context,AudioWorkletNode:Worklet,logout:async()=>({revoked:true}),speech:async method=>method==='status'?{stt:{installed:true},tts:{installed:false}}:true,
  navigator:{mediaDevices:{getUserMedia:()=>permission.promise}}});
 const starting=app.node('listen').onclick();await new Promise(r=>setImmediate(r));
 await app.node('logout').onclick();
 permission.resolve({getTracks:()=>[{stop(){stopped++;}}]});await starting;
 assert.equal(stopped,1);assert.equal(app.run('listening'),false);assert.equal(app.run('stream'),null);
});

for(const pauseAt of ['resume','decode']){
  test(`Stop prevents an audio chunk from starting while ${pauseAt} is pending`,async()=>{
    const blocked=deferred(),decoding=deferred();let starts=0,decodes=0;
    class FakeAudioContext {
      constructor(){this.currentTime=0;this.destination={};}
      resume(){return pauseAt==='resume'?blocked.promise:Promise.resolve();}
      decodeAudioData(){decodes++;decoding.resolve();return pauseAt==='decode'?blocked.promise:Promise.resolve({duration:1});}
      createBufferSource(){return {connect(){},start(){starts++;},stop(){}};}
    }
    const app=renderer({AudioContext:FakeAudioContext});
    const playing=app.run("play('AA==')");
    if(pauseAt==='decode')await decoding.promise;
    await app.run('stop()');
    blocked.resolve({duration:1});
    await playing;
    assert.equal(starts,0);
    assert.equal(decodes,pauseAt==='decode'?1:0);
    // The harness must still let a fresh audio chunk play after Stop.
    await app.run("play('AA==')");
    assert.equal(starts,1);
  });
}

for(const cancelled of [false,true]){
 test(cancelled?'Stop rejects late streaming text':'streaming text appears before the final sentence is submitted',async()=>{
  const app=renderer();await new Promise(r=>setImmediate(r));
  app.run('received=[];send=async text=>received.push(text);listening=true;liveRecognizer=createLiveRecognizer()');
  await app.run("liveRecognizer.start('session')");
  app.emit({event:'transcript',streamId:'session',generation:0,utterance:0,text:'merhaba',final:false});
  assert.equal(app.node('input').value,'merhaba');assert.equal(app.run('received.length'),0);
  if(cancelled)await app.run('stop()');
  app.emit({event:'transcript',streamId:'session',generation:0,utterance:0,text:'Merhaba Umay.',final:true});
  assert.equal(app.run('received.length'),cancelled?0:1);
 });
}

test('streaming text does not overwrite or auto-send a manually edited message',async()=>{
 const app=renderer();await new Promise(r=>setImmediate(r));app.run('received=[];send=async text=>received.push(text);listening=true;liveRecognizer=createLiveRecognizer()');await app.run("liveRecognizer.start('session')");
 app.emit({event:'transcript',streamId:'session',generation:0,utterance:0,text:'merhaba',final:false});app.node('input').value='Benim düzenlemem';
 app.emit({event:'transcript',streamId:'session',generation:0,utterance:0,text:'merhaba umay',final:false});app.emit({event:'transcript',streamId:'session',generation:0,utterance:0,text:'Merhaba Umay.',final:true});
 assert.equal(app.node('input').value,'Benim düzenlemem');assert.equal(app.run('received.length'),0);
});
test('deleting a voice draft to empty prevents its final text from being sent',async()=>{
 const app=renderer();await new Promise(r=>setImmediate(r));app.run('received=[];send=async text=>received.push(text);listening=true;liveRecognizer=createLiveRecognizer()');await app.run("liveRecognizer.start('session')");
 app.emit({event:'transcript',streamId:'session',generation:0,utterance:0,text:'merhaba',final:false});app.node('input').value='';app.node('input').oninput?.();
 app.emit({event:'transcript',streamId:'session',generation:0,utterance:0,text:'Merhaba.',final:true});assert.equal(app.run('received.length'),0);
});
test('Stop clears its owned draft so the next utterance can submit',async()=>{
 const app=renderer();await new Promise(r=>setImmediate(r));app.run('received=[];send=async text=>received.push(text);listening=true;liveRecognizer=createLiveRecognizer()');await app.run("liveRecognizer.start('session')");
 app.emit({event:'transcript',streamId:'session',generation:0,utterance:0,text:'eski',final:false});await app.run('stop()');
 app.emit({event:'transcript',streamId:'session',generation:1,utterance:0,text:'yeni',final:false});app.emit({event:'transcript',streamId:'session',generation:1,utterance:0,text:'Yeni.',final:true});assert.equal(app.run('received[0]'),'Yeni.');
});
test('Stop cancels response audio before a slow STT reset completes',async()=>{
 const reset=deferred();let cancelled=0;const app=renderer({speech:async method=>{if(method==='status')return {stt:{installed:false},tts:{installed:false}};if(method==='stt_reset')return reset.promise;if(method==='cancel')cancelled++;return true;}});
 await new Promise(r=>setImmediate(r));app.run('listening=true;liveRecognizer=createLiveRecognizer()');await app.run("liveRecognizer.start('session')");
 const stopping=app.run('stop()');assert.equal(cancelled,1);reset.resolve();await stopping;
});
test('residual output below the barge gate is not passed into recognition',async()=>{
 const packets=[];const app=renderer({speech:async(method,p)=>{if(method==='status')return {stt:{installed:false},tts:{installed:false}};if(method==='stt_feed')packets.push(p.audio);return true;}});
 await new Promise(r=>setImmediate(r));app.run('listening=true;liveRecognizer=createLiveRecognizer();sources=[{stop(){}}]');await app.run("liveRecognizer.start('session')");
 for(let i=0;i<20;i++)await app.run('onFrame(new Float32Array(320).fill(.004))');await new Promise(r=>setImmediate(r));
 assert.ok(packets.length>0);assert.equal(packets.some(p=>Buffer.from(p,'base64').some(byte=>byte!==0)),false);
});

test('logout discards an earlier history detail response',async()=>{
  const detail=deferred();
  const app=renderer({
    logout:async()=>({revoked:true}),
    api:async route=>{
      if(route==='/site/auth/me')return {id:'account-a',email:'a@example.test'};
      if(route==='/site/chat/models')return {models:[]};
      if(route==='/site/chat/conversations')return {conversations:[{id:'old',title:'Old private conversation'}]};
      if(route==='/site/chat/conversations/old')return detail.promise;
      throw Error('Unexpected route '+route);
    }
  });
  await app.run('refresh()');
  const loading=app.node('history').children[0].onclick();
  await app.node('logout').onclick();
  detail.resolve({conversation:{id:'old',version:1},messages:[{role:'assistant',content:'Old private content'}]});
  await loading;
  assert.equal(app.node('messages').children.length,0);
  assert.equal(app.run('conversation'),null);
});
test('quiet microphone audio is streamed without waiting for silence',async()=>{
 const packets=[];const app=renderer({speech:async(method,params)=>{if(method==='status')return {stt:{installed:false},tts:{installed:false}};if(method==='stt_feed')packets.push(params.audio);return true;}});
 await new Promise(r=>setImmediate(r));app.run('listening=true;liveRecognizer=createLiveRecognizer()');await app.run("liveRecognizer.start('session')");
 for(let i=0;i<50;i++)await app.run('onFrame(new Float32Array(320).fill(0.004))');
 await new Promise(r=>setImmediate(r));
 assert.equal(packets.reduce((sum,p)=>sum+Buffer.from(p,'base64').length/2,0),16000);
 assert.ok(packets.length>1);
});

test('unrecognized microphone energy cannot cancel a pending answer or its speech',async()=>{
 const poll=deferred(),calls=[],spoken=[];
 const app=renderer({api:async(route,body)=>{
  if(route==='/site/auth/me')throw Error('No account in test');
  calls.push(route);
  if(route.endsWith('/messages'))return {run:{id:'pending'}};
  if(route==='/site/chat/runs/pending')return poll.promise;
  if(route.endsWith('/cancel'))return {ok:true};
  return {conversation:{id:'chat',version:1},messages:[{role:'assistant',content:'Merhaba, seni dinliyorum.'}]};
 },speech:async(method,p)=>{if(method==='status')return {stt:{installed:false},tts:{installed:false}};if(method==='speak')spoken.push(p.text);return true;}});
 await new Promise(r=>setImmediate(r));app.node('speak').checked=true;
 app.run("conversation={id:'chat',version:1};listening=true");
 const sending=app.run("send('Selam Umay',true)");await new Promise(r=>setImmediate(r));
 for(let i=0;i<6;i++)await app.run('onFrame(new Float32Array(320).fill(.004))');
 assert.equal(calls.some(route=>route.endsWith('/cancel')),false);
 poll.resolve({run:{status:'COMPLETED'}});await sending;
 assert.deepEqual(app.node('messages').children.map(n=>n.textContent),['Selam Umay','Merhaba, seni dinliyorum.']);
 assert.deepEqual(spoken,['Merhaba, seni dinliyorum.']);
});

test('soft speech after playback tail is displayed and submitted without a new energy gate',async()=>{
 const app=renderer();await new Promise(r=>setImmediate(r));
 app.run('received=[];send=async text=>received.push(text);listening=true;liveRecognizer=createLiveRecognizer();playbackSuppressed=true;echoGuardUntil=0');await app.run("liveRecognizer.start('session')");
 await app.run('onFrame(new Float32Array(320).fill(.001))');
 app.emit({event:'transcript',streamId:'session',generation:0,utterance:0,text:'sessiz konuşma',final:false});
 assert.equal(app.node('input').value,'sessiz konuşma');
 app.emit({event:'transcript',streamId:'session',generation:0,utterance:0,text:'Sessiz konuşma.',final:true});
 assert.equal(app.run('received[0]'),'Sessiz konuşma.');
});

test('failed runs do not speak an old assistant message and show the failure',async()=>{
 const spoken=[];const app=renderer({api:async(route)=>{
  if(route==='/site/auth/me')throw Error('No account');
  if(route.endsWith('/messages'))return {run:{id:'failed'}};
  if(route==='/site/chat/runs/failed')return {run:{status:'FAILED',errorCode:'PROVIDER_TIMEOUT'}};
  return {conversation:{id:'chat',version:1},messages:[{role:'assistant',content:'Old answer'}]};
 },speech:async(method,p)=>{if(method==='status')return {stt:{installed:false},tts:{installed:false}};if(method==='speak')spoken.push(p.text);return true;}});
 await new Promise(r=>setImmediate(r));app.node('speak').checked=true;app.run("conversation={id:'chat',version:1}");await app.run("send('Yeni soru')");
 assert.equal(spoken.length,0);assert.match(app.node('status').textContent,/beklenenden uzun/);assert.doesNotMatch(app.node('status').textContent,/PROVIDER_TIMEOUT/);
});

test('recognized new words still interrupt a pending response without resetting capture',async()=>{
 const calls=[];const app=renderer({api:async(route)=>{calls.push(route);return {};}});await new Promise(r=>setImmediate(r));calls.length=0;
 app.run('listening=true;liveRecognizer=createLiveRecognizer();responseActive=true;runId="pending"');await app.run("liveRecognizer.start('session')");
 app.emit({event:'transcript',streamId:'session',generation:0,utterance:0,text:'',final:false});assert.equal(calls.length,0);
 app.emit({event:'transcript',streamId:'session',generation:0,utterance:0,text:'bir dakika',final:false});
 assert.deepEqual(calls,['/site/chat/runs/pending/cancel']);assert.equal(app.run('listening'),true);assert.equal(app.run('liveRecognizer.generation'),0);assert.equal(app.node('input').value,'bir dakika');
});

test('the next voice turn waits for the interrupted server run to be cancelled',async()=>{
 const cancellation=deferred(),posts=[];const app=renderer({api:async(route,body)=>{
  if(route==='/site/auth/me')throw Error('No account');
  if(route.endsWith('/cancel'))return cancellation.promise;
  if(route.endsWith('/messages')){posts.push(body.content);return {run:{id:'next'}};}
  if(route==='/site/chat/runs/next')return {run:{status:'COMPLETED'}};
  return {conversation:{id:'chat',version:1},messages:[]};
 }});await new Promise(r=>setImmediate(r));
 app.run('conversation={id:"chat",version:1};listening=true;liveRecognizer=createLiveRecognizer();responseActive=true;runId="previous"');await app.run("liveRecognizer.start('session')");
 app.emit({event:'transcript',streamId:'session',generation:0,utterance:0,text:'yeni soru',final:false});
 app.emit({event:'transcript',streamId:'session',generation:0,utterance:0,text:'Yeni soru.',final:true});await new Promise(r=>setImmediate(r));
 assert.equal(posts.length,0);cancellation.resolve({ok:true});await new Promise(r=>setImmediate(r));assert.deepEqual(posts,['Yeni soru.']);
});

test('interrupting an in-flight message waits for its returned run to be cancelled before the next post',async()=>{
 const firstPost=deferred(),cancellation=deferred(),posts=[];const app=renderer({api:async(route,body)=>{
  if(route==='/site/auth/me')throw Error('No account');
  if(route.endsWith('/messages')){posts.push(body.content);return posts.length===1?firstPost.promise:{run:{id:'next'}};}
  if(route.endsWith('/cancel'))return cancellation.promise;
  if(route==='/site/chat/runs/next')return {run:{status:'COMPLETED'}};
  return {conversation:{id:'chat',version:1},messages:[]};
 }});await new Promise(r=>setImmediate(r));
 app.run('conversation={id:"chat",version:1};listening=true;liveRecognizer=createLiveRecognizer()');await app.run("liveRecognizer.start('session')");
 const first=app.run("send('first',true)");await new Promise(r=>setImmediate(r));
 app.emit({event:'transcript',streamId:'session',generation:0,utterance:0,text:'next',final:false});const next=app.run("send('next',true)");await new Promise(r=>setImmediate(r));
 assert.deepEqual(posts,['first']);firstPost.resolve({run:{id:'previous'}});await new Promise(r=>setImmediate(r));assert.deepEqual(posts,['first']);
 cancellation.resolve({ok:true});await Promise.all([first,next]);assert.deepEqual(posts,['first','next']);
});

test('text messages do not wait for a cold speech cancellation to reach the server',async()=>{
 const cold=deferred(),posts=[];const app=renderer({speech:async method=>{if(method==='status')return {stt:{installed:false},tts:{installed:false}};if(method==='cancel')return cold.promise;return true;},api:async(route,body)=>{
  if(route==='/site/auth/me')throw Error('No account');
  if(route.endsWith('/messages')){posts.push(body.content);return {run:{id:'run'}};}
  if(route==='/site/chat/runs/run')return {run:{status:'COMPLETED'}};
  return {conversation:{id:'chat',version:1},messages:[]};
 }});await new Promise(r=>setImmediate(r));app.run('conversation={id:"chat",version:1}');
 const sending=app.run("send('text only')");await new Promise(r=>setImmediate(r));
 assert.deepEqual(posts,['text only']);cold.resolve();await sending;
});

test('a provider failure appears in the chat instead of leaving only an unanswered question',async()=>{
 const app=renderer({api:async(route)=>{
  if(route==='/site/auth/me')throw Error('No account');
  if(route.endsWith('/messages'))return {run:{id:'run'}};
  if(route==='/site/chat/runs/run')return {run:{status:'FAILED',errorCode:'PROVIDER_TOOL_UNAVAILABLE'}};
 }});await new Promise(r=>setImmediate(r));app.run('conversation={id:"chat",version:1}');await app.run("send('Soru')");
 assert.equal(app.node('messages').children.length,2);assert.match(app.node('messages').children[1].textContent,/özellik/);assert.doesNotMatch(app.node('messages').children[1].textContent,/TOOL_UNAVAILABLE/);
});

test('token denial during message submission is shown in chat without its technical code',async()=>{
 const app=renderer({api:async(route)=>{if(route==='/site/auth/me')throw Error('No account');if(route.endsWith('/messages'))throw Error('INSUFFICIENT_TOKENS');}});
 await new Promise(r=>setImmediate(r));app.run('conversation={id:"chat",version:1}');await app.run("send('Soru')");
 assert.equal(app.node('messages').children.length,2);const text=app.node('messages').children[1].textContent;assert.match(text,/Token limitiniz yetersiz/);assert.doesNotMatch(text,/INSUFFICIENT_TOKENS/);
});

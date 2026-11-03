const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {randomUUID}=require('node:crypto');

const source=fs.readFileSync(path.join(__dirname,'../src/ui/renderer.js'),'utf8');
function deferred(){let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};}
function element(){return {value:'',checked:false,textContent:'',dataset:{},children:[],
  append(...children){this.children.push(...children);},
  replaceChildren(...children){this.children=children;},scrollIntoView(){},
  classList:{contains:()=>false,toggle(){}}};}
function renderer(overrides={}){
  const nodes=new Map();
  const node=id=>{if(!nodes.has(id))nodes.set(id,element());return nodes.get(id);};
  const bridge={
    onEvent(){},busy:async()=>{},
    speech:async method=>method==='status'?{stt:{installed:false},tts:{installed:false}}:true,
    api:async()=>{throw Error('No account in test');},
    ...overrides
  };
  const context=vm.createContext({
    window:{umay:bridge},
    document:{getElementById:node,querySelectorAll:()=>[],createElement:element,body:element()},
    localStorage:{getItem:()=>null,setItem(){}},crypto:{randomUUID},
    atob,btoa,Uint8Array,Int16Array,Float32Array,setTimeout,
    AudioContext:overrides.AudioContext,navigator:overrides.navigator,AudioWorkletNode:overrides.AudioWorkletNode
  });
  vm.runInContext(source,context,{filename:'renderer.js'});
  return {node,run:code=>vm.runInContext(code,context)};
}

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
test(cancelled?'Stop discards transcription that completes after cancellation':'current transcription submits the recognized question',async()=>{
  const transcription=deferred();let transcriptions=0;
  const app=renderer({speech:async method=>{
    if(method==='status')return {stt:{installed:false},tts:{installed:false}};
    if(method==='transcribe'){transcriptions++;return transcription.promise;}
    return true;
  }});
  app.run('received=[]; send=async text=>received.push(text); listening=true; recording=true; silence=29; frames=[new Float32Array(320)]');
  const processing=app.run('onFrame(new Float32Array(320))');
  assert.equal(transcriptions,1);
  if(cancelled)await app.run('stop()');
  transcription.resolve('cancelled utterance');
  await processing;
  assert.equal(app.run('received.length'),cancelled?0:1);
  if(!cancelled)assert.equal(app.run('received[0]'),'cancelled utterance');
  assert.equal(app.run('recording'),false);
  assert.equal(app.run('transcribing'),false);
});
}

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
test('quiet microphone speech followed by silence reaches STT',async()=>{
 const recordings=[];const app=renderer({speech:async(method,params)=>{
  if(method==='status')return {stt:{installed:false},tts:{installed:false}};
  if(method==='transcribe'){recordings.push(params.audio);return 'Sessiz konuşma';}return true;
 }});
 await new Promise(r=>setImmediate(r));
 app.run('listening=true; received=[]; send=async text=>received.push(text)');
 for(let i=0;i<50;i++)await app.run('onFrame(new Float32Array(320).fill(0.004))');
 for(let i=0;i<40;i++)await app.run('onFrame(new Float32Array(320))');
 assert.equal(recordings.length,1);assert.ok(Buffer.from(recordings[0],'base64').length>16000);
 assert.equal(app.run('received[0]'),'Sessiz konuşma');
});

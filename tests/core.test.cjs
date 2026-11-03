const {test}=require('node:test');
const assert=require('node:assert/strict');
const {TurnGate,MemoryStore,chooseDevice,validateReference,splitSpeech}=require('../src/core.cjs');
test('cancelled generation cannot leak audio into next turn',()=>{
  const g=new TurnGate();const first=g.begin();g.cancel();const second=g.begin();
  assert.equal(g.accepts(first),false);assert.equal(g.accepts(second),true);
});
test('GPU presence without successful backend probe falls back to CPU',()=>{
 assert.equal(chooseDevice([{backend:'cuda',available:true,healthy:false}]).backend,'cpu');
 assert.equal(chooseDevice([{backend:'cuda',available:true,healthy:true}]).backend,'cuda');
});
test('MP3 limit includes exactly 50 million bytes and checks the signature',()=>{
 assert.doesNotThrow(()=>validateReference('voice.mp3',50000000,Buffer.from('ID3')));
 assert.throws(()=>validateReference('voice.mp3',50000001,Buffer.from('ID3')));
 assert.throws(()=>validateReference('voice.mp3',5,Buffer.from('plain')));
});
test('account change discards memories and stale writes',()=>{
 const m=new MemoryStore();const generation=m.switchAccount('a');m.put(generation,{id:'1',text:'Tea'});
 m.switchAccount('b');assert.equal(m.put(generation,{id:'2',text:'secret'}),false);assert.deepEqual(m.values(),[]);
});
test('speech splitter preserves decimal and unfinished sentence',()=>{
 assert.deepEqual(splitSpeech('Saat 14.30. Merhaba! Son'),{chunks:['Saat 14.30.','Merhaba!'],rest:'Son'});
});

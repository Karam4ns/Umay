const {test}=require('node:test'),assert=require('node:assert/strict');
const {watchWindow}=require('../src/computer-watch.cjs');
function fixture(views){let time=0,reads=0,stopped=false;return {options:{now:()=>time,delay:async ms=>time+=ms,check:()=>{if(stopped)throw Error('stopped');},read:async()=>{reads++;return views.shift()||{title:'App',elements:[]};}},reads:()=>reads,stop:()=>stopped=true};}
test('watching a coding task waits locally for UI text without any model or input call',async()=>{
 const f=fixture([{title:'App',elements:[{name:'Working'}]},{title:'App',elements:[{name:'Task completed'}]}]);const result=await watchWindow({windowHandle:42,contains:'completed',milliseconds:5000,intervalMs:500},{handle:42,title:'App',elements:[]},f.options);assert.equal(result.outcome,'matched');assert.equal(f.reads(),2);assert.ok(result.elapsedMs>=500);
});
test('generic video/installer changes, absent text, closed windows and timeouts are data, never success claims',async()=>{
 const first={handle:42,title:'App',elements:[{name:'Busy'}]};let f=fixture([{handle:42,title:'App',elements:[{name:'Next episode'}]}]);assert.equal((await watchWindow({windowHandle:42,changed:true,milliseconds:1000},first,f.options)).outcome,'changed');
 f=fixture([{title:'App',elements:[]}]);assert.equal((await watchWindow({windowHandle:42,absent:'Busy',milliseconds:1000},first,f.options)).outcome,'matched');
 f=fixture([]);assert.equal((await watchWindow({windowHandle:42,contains:'never',milliseconds:1000},first,f.options)).outcome,'timeout');
 f=fixture([]);f.options.read=async()=>{throw Object.assign(Error('closed'),{code:'NATIVE_WINDOW_UNAVAILABLE'});};assert.equal((await watchWindow({windowHandle:42,changed:true,milliseconds:1000},first,f.options)).outcome,'closed');
});
test('stop/account changes interrupt local watch waits and invalid conditions never start polling',async()=>{
 const f=fixture([]);f.options.delay=async()=>f.stop();await assert.rejects(watchWindow({windowHandle:42,contains:'done',milliseconds:1000},{handle:42,title:'App',elements:[]},f.options),/stopped/);
 for(const action of [{milliseconds:600001},{intervalMs:1},{contains:'x'.repeat(501)},{contains:'yes',absent:'no'},{changed:false},{contains:'yes',changed:true},{}])await assert.rejects(watchWindow({windowHandle:42,milliseconds:1000,...action},{handle:42,elements:[]},fixture([]).options),/izleme/i);
});

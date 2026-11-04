const {test}=require('node:test'),assert=require('node:assert/strict');
const {PlaybackEcho}=require('../src/ui/playback-echo.js');
function signal(){return Float32Array.from({length:24000},(_,i)=>.1*Math.sin(i*.07+Math.sin(i*.002)*4)+.04*Math.sin(i*.13));}
function guard(samples){const echo=new PlaybackEcho();echo.add({sampleRate:24000,getChannelData:()=>samples},1,0);return echo;}
function frames(echo,now,delay,other=false){
 return Array.from({length:5},(_,f)=>Float32Array.from({length:320},(_,i)=>{
  const time=now-.1+(f*320+i)/16000-delay,part=echo.parts[0];
  const sample=part.samples[Math.floor((time-part.start)*2000)]||0;
  return -.55*sample+.001+(other?.07*Math.sin((f*320+i)*.183+Math.sin(i*.031)*3):0);
 }));
}
for(const delay of [.06,.2,.5])test(`playback echo matches ${delay}s delay with attenuation and reversed polarity`,()=>{
 const echo=guard(signal()),now=1.7;
 assert.equal(echo.matches(frames(echo,now,delay),now),true);
});
test('a person speaking over the reference is not suppressed',()=>{
 const echo=guard(signal()),now=1.7;
 assert.equal(echo.matches(frames(echo,now,.2,true),now),false);
});
test('independent capture clock with fractional-sample phase still matches playback',()=>{
 const echo=guard(signal()),now=1.7,part=echo.parts[0];
 const input=Array.from({length:5},(_,f)=>Float32Array.from({length:320},(_,i)=>{
  const index=Math.floor((now-.1+(f*320+i)/16000-.2-part.start)*2000);
  return .6*(.35*(part.samples[index]||0)+.65*(part.samples[index+1]||0));
 }));
 assert.equal(echo.matches(input,now),true);
});
test('stopped future audio and expired history cannot suppress a later user',()=>{
 const echo=guard(signal());echo.add({sampleRate:24000,getChannelData:signal},4,0);
 echo.stop(1.4);assert.equal(echo.parts.length,1);assert.ok(echo.parts[0].samples.length<=800);
 assert.equal(echo.matches(Array.from({length:5},()=>new Float32Array(320)),3),false);
 assert.equal(echo.parts.length,0);
});

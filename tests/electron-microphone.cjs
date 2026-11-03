const {app,ipcMain}=require('electron');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');

// Synthetic input exercises Chromium permissions, the real worklet and renderer.
// The speech backend is stubbed so this test needs neither downloaded models nor an account.
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'umay-microphone-'));
const wav=Buffer.alloc(44+48000*6*2);
wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);
wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);
wav.writeUInt32LE(48000,24);wav.writeUInt32LE(96000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);
wav.write('data',36);wav.writeUInt32LE(wav.length-44,40);
for(let i=48000;i<120000;i++)wav.writeInt16LE(Math.round(Math.sin(i*2*Math.PI*440/48000)*.006*32767),44+i*2);
const input=path.join(directory,'input.wav');fs.writeFileSync(input,wav);
app.commandLine.appendSwitch('use-fake-device-for-media-stream');
app.commandLine.appendSwitch('use-file-for-fake-audio-capture',input);
let transcriptions=0;
const finish=(code,error)=>{if(error)console.error(error);fs.rmSync(directory,{recursive:true,force:true});app.exit(code);};
const timeout=setTimeout(()=>finish(1,Error('Microphone test timed out')),30000);
require('../src/main.cjs');
app.on('browser-window-created',(_event,window)=>{
 window.webContents.once('did-finish-load',async()=>{
  try{
   ipcMain.removeHandler('speech');ipcMain.handle('speech',(_event,method,params)=>{
    if(method==='status')return {stt:{installed:true,resident:true},tts:{installed:false}};
    if(method==='transcribe'){
     const pcm=Buffer.from(params.audio,'base64');assert.ok(pcm.length>16000);
     assert.ok(pcm.some(byte=>byte!==0));transcriptions++;return 'Mikrofon denemesi';
    }
    return true;
   });
   await window.webContents.executeJavaScript(`(async()=>{
    // Isolate the capture path from network and response generation.
    received=[];send=async text=>received.push(text);
    await document.getElementById('listen').onclick();
    if(!listening)throw Error(document.getElementById('status').textContent);
   })()`);
   await window.webContents.executeJavaScript(`new Promise((resolve,reject)=>{
    const deadline=Date.now()+20000;const poll=()=>{
     if(received.length)return resolve();
     if(Date.now()>deadline)return reject(Error('No microphone transcription: '+document.getElementById('status').textContent));
     setTimeout(poll,50);
    };poll();
   })`);
   assert.ok(transcriptions>0);
   const result=await window.webContents.executeJavaScript(`(async()=>{
    const oldStream=stream;await document.getElementById('listen').onclick();
    if(oldStream.getTracks().some(track=>track.readyState!=='ended'))throw Error('Track was not released');
    await document.getElementById('listen').onclick();
    return {listening,text:received[0],status:document.getElementById('status').textContent};
   })()`);
   assert.equal(result.listening,true,result.status);assert.equal(result.text,'Mikrofon denemesi');
   console.log('PASS real Electron microphone -> worklet -> PCM -> STT request -> message; stop/restart');
   clearTimeout(timeout);finish(0);
  }catch(error){clearTimeout(timeout);finish(1,error);}
 });
});

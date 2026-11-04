class Capture extends AudioWorkletProcessor {
 constructor(){super();this.buffer=new Float32Array(320);this.offset=0;}
 process(inputs){const data=inputs[0]?.[0];if(!data)return true;
  // The dedicated input AudioContext performs native anti-aliased resampling to 16 kHz.
  for(let i=0;i<data.length;i++){this.buffer[this.offset++]=data[i];if(this.offset===320){this.port.postMessage(this.buffer,[this.buffer.buffer]);this.buffer=new Float32Array(320);this.offset=0;}}
  return true;
 }
}
registerProcessor('capture',Capture);

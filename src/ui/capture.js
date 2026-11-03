class Capture extends AudioWorkletProcessor {
 constructor(){super();this.buffer=[];this.position=0;}
 process(inputs){const data=inputs[0]?.[0];if(!data)return true;
  for(let i=0;i<data.length;i++){this.position+=16000;if(this.position>=sampleRate){this.position-=sampleRate;this.buffer.push(data[i]);}}
  if(this.buffer.length>=320){this.port.postMessage(new Float32Array(this.buffer));this.buffer=[];}return true;
 }
}
registerProcessor('capture',Capture);

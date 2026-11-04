(function(root){
 // Compare the actual playback signal with the microphone before energy alone
 // is allowed to cancel it. This supplements Chromium AEC; it is not a denoiser.
 const RATE=2000;
 function downsample(input,rate){
  const ratio=rate/RATE,out=new Float32Array(Math.floor(input.length/ratio));
  for(let i=0;i<out.length;i++){
   const start=Math.floor(i*ratio),end=Math.min(input.length,Math.floor((i+1)*ratio));let sum=0;
   for(let j=start;j<end;j++)sum+=input[j];out[i]=sum/Math.max(1,end-start);
  }
  return out;
 }
 class PlaybackEcho{
  constructor(){this.parts=[];}
  prune(now){this.parts=this.parts.filter(p=>p.start+p.samples.length/RATE>=now-1.1);}
  add(buffer,start,now){
   this.prune(now);
   if(typeof buffer.getChannelData!=='function'||!buffer.sampleRate)return;
   this.parts.push({start,samples:downsample(buffer.getChannelData(0),buffer.sampleRate)});
  }
  stop(now){
   this.prune(now);
   this.parts=this.parts.filter(p=>p.start<now).map(p=>({start:p.start,samples:p.samples.slice(0,Math.max(0,Math.ceil((now-p.start)*RATE)))}));
  }
  matches(frames,now){
   this.prune(now);if(!this.parts.length||frames.length<5)return false;
   const joined=new Float32Array(frames.reduce((n,f)=>n+f.length,0));let at=0;
   for(const frame of frames){joined.set(frame,at);at+=frame.length;}
   const mic=downsample(joined,16000),n=mic.length;
   let mean=0;for(const value of mic)mean+=value;mean/=n;
   let energy=0;for(let i=0;i<n;i++){mic[i]-=mean;energy+=mic[i]*mic[i];}
   if(energy<1e-8)return false;
   // Search a bounded hardware/room delay window, including capture dispatch
   // jitter. 100ms matching context avoids confusing individual vowel cycles.
   const origin=now-.85,reference=new Float32Array(Math.ceil(.87*RATE));
   for(const part of this.parts){
    const offset=Math.round((part.start-origin)*RATE);
    const lo=Math.max(0,-offset),hi=Math.min(part.samples.length,reference.length-offset);
    for(let i=lo;i<hi;i++)reference[offset+i]=part.samples[i];
   }
   const sums=new Float64Array(reference.length+1),powers=new Float64Array(reference.length+1),adjacent=new Float64Array(reference.length+1);
   for(let i=0;i<reference.length;i++){sums[i+1]=sums[i]+reference[i];powers[i+1]=powers[i]+reference[i]*reference[i];adjacent[i+1]=adjacent[i]+reference[i]*(reference[i+1]||0);}
   for(let offset=0;offset+n<reference.length;offset++){
    const sum=sums[offset+n]-sums[offset],power=powers[offset+n]-powers[offset]-sum*sum/n;
    if(power<1e-8)continue;
    let dot=0,nextDot=0;for(let i=0;i<n;i++){dot+=mic[i]*reference[offset+i];nextDot+=mic[i]*reference[offset+i+1];}
    let explained=dot*dot/power;
    // Output and capture have independent sample clocks. Fit a fractional-sample
    // delay between neighbouring reference samples, rather than misclassifying
    // resampling phase as a second speaker. Both gains must have the same sign.
    const nextSum=sums[offset+n+1]-sums[offset+1],nextPower=powers[offset+n+1]-powers[offset+1]-nextSum*nextSum/n;
    if(nextPower>1e-8){
     const cross=adjacent[offset+n]-adjacent[offset]-sum*nextSum/n,det=power*nextPower-cross*cross;
     explained=Math.max(explained,nextDot*nextDot/nextPower);
     if(det>power*nextPower*1e-6){
      const a=(dot*nextPower-nextDot*cross)/det,b=(nextDot*power-dot*cross)/det;
      if(a*b>=0)explained=Math.max(explained,a*dot+b*nextDot);
     }
    }
    const correlation=Math.sqrt(Math.min(1,explained/energy));
    // A substantial unexplained component can be a real person speaking over
    // Umay. Keep that interruption instead of suppressing all simultaneous sound.
    const residual=Math.sqrt(energy/n*Math.max(0,1-correlation*correlation));
    if(correlation>=.9&&residual<=Math.max(.003,Math.sqrt(energy/n)*.3))return true;
   }
   return false;
  }
 }
 if(typeof module!=='undefined')module.exports={PlaybackEcho};else root.PlaybackEcho=PlaybackEcho;
})(globalThis);

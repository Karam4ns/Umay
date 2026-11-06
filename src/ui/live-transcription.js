(function(root){
 function encode(parts){
  const length=parts.reduce((sum,p)=>sum+p.length,0),bytes=new Uint8Array(length*2),view=new DataView(bytes.buffer);let offset=0;
  for(const part of parts)for(const sample of part){view.setInt16(offset,Math.round(Math.max(-1,Math.min(1,sample))*32767),true);offset+=2;}
  let value='';for(let i=0;i<bytes.length;i+=8192)value+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(value);
 }
 class LiveTranscriber{
  constructor({speech,onPartial=()=>{},onFinal=()=>{},onError=()=>{},maxQueuedSamples=48000}){
   Object.assign(this,{speech,onPartial,onFinal,onError,maxQueuedSamples});this.session=null;this.generation=0;this.parts=[];this.samples=0;this.busy=false;this.lastFinal=-1;this.ready=Promise.resolve();
  }
  async start(streamId){
   this.session=streamId;this.generation=0;this.lastFinal=-1;this.parts=[];this.samples=0;
   this.ready=this.speech('stt_start',{streamId,generation:0});
   try{await this.ready;}catch(error){if(this.session===streamId)this.session=null;throw error;}
  }
  accept(frame){
   if(!this.session)return;this.parts.push(frame);this.samples+=frame.length;
   if(this.samples>this.maxQueuedSamples){this.fail(Error('Cihaz ses işlemeye yetişemiyor. Diğer yoğun işlemleri kapatıp konuşmayı yeniden başlat.'));return;}
   void this.pump();
  }
  async pump(){
   if(this.busy||!this.session||this.samples<640)return;this.busy=true;
   const session=this.session,generation=this.generation,parts=[];let size=0;
   while(this.parts.length&&size<3200){const part=this.parts.shift();parts.push(part);size+=part.length;this.samples-=part.length;}
   try{
    await this.ready;if(this.session!==session||this.generation!==generation)return;
    await this.speech('stt_feed',{streamId:session,generation,audio:encode(parts)});
   }catch(error){if(this.session===session&&this.generation===generation)this.fail(error);}
   finally{this.busy=false;if(this.session&&this.samples>=640)void this.pump();}
  }
  receive(event){
   if(!this.session||event.streamId!==this.session||event.generation!==this.generation||!Number.isInteger(event.utterance)||event.utterance<0||typeof event.text!=='string')return;
   if(event.utterance<=this.lastFinal)return;
   if(event.final){this.lastFinal=event.utterance;this.onFinal(event.text,event);}else this.onPartial(event.text,event);
  }
  async reset(){
   if(!this.session)return;this.generation++;this.lastFinal=-1;this.parts=[];this.samples=0;
   this.ready=this.speech('stt_reset',{streamId:this.session,generation:this.generation});await this.ready;
  }
  async close(){
   const streamId=this.session;this.session=null;this.generation++;this.parts=[];this.samples=0;this.lastFinal=-1;
   if(streamId)await this.speech('stt_stop',{streamId}).catch(()=>{});
  }
  fail(error){void this.close();this.onError(error);}
 }
 if(typeof module!=='undefined')module.exports={LiveTranscriber};else root.LiveTranscriber=LiveTranscriber;
})(globalThis);

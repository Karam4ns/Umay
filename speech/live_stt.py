"""Single-owner streaming session. The worker schedules these calls on the STT queue."""
import base64
import numpy as np

class LiveSTT:
    def __init__(self,emit):
        self.emit=emit;self.stream=None;self.session=None;self.generation=0;self.utterance=0;self.last=''

    def start(self,model,stream_id,generation):
        self.stream=model.stream();self.session=stream_id;self.generation=generation;self.utterance=0;self.last=''

    def reset(self,stream_id,generation):
        if self.session!=stream_id or generation<=self.generation:return False
        self.stream.reset();self.generation=generation;self.utterance=0;self.last='';return True

    def stop(self,stream_id):
        if self.session==stream_id:self.stream=None;self.session=None

    def feed(self,stream_id,generation,audio):
        if self.session!=stream_id or generation!=self.generation or self.stream is None:return {'skipped':True}
        raw=base64.b64decode(audio,validate=True)
        if len(raw)>16000 or len(raw)%2:raise ValueError('Canlı ses paketi geçersiz.')
        samples=np.frombuffer(raw,dtype='<i2').astype('float32')/32768
        partial=self.stream.accept(samples,sample_rate=16000)
        if partial!=self.last:
            self.last=partial;self.publish(partial,False)
        if self.stream.is_endpoint:
            # Capture continues queueing audio while this short final formatting step runs.
            text=self.stream.end_utterance();self.publish(text,True);self.utterance+=1;self.last=''
        return {'samples':len(samples)}

    def publish(self,text,final):
        self.emit({'event':'transcript','streamId':self.session,'generation':self.generation,'utterance':self.utterance,'text':text,'final':final})

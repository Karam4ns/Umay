import sys,base64
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parents[1]/'speech'))
from live_stt import LiveSTT

class Stream:
    def __init__(self): self.count=0; self.is_endpoint=False
    def accept(self,samples,sample_rate=16000):
        self.count+=len(samples);self.is_endpoint=self.count>=3200;return 'merhaba'
    def end_utterance(self): self.count=0;self.is_endpoint=False;return 'Merhaba.'
    def reset(self): self.count=0
class Model:
    def stream(self):return Stream()

def test_partial_before_endpoint_and_final_after_pause():
    events=[];live=LiveSTT(events.append);live.start(Model(),'session',0)
    audio=base64.b64encode(bytes(3200)).decode()
    live.feed('session',0,audio);assert events[-1]['final'] is False
    live.feed('session',0,audio);assert events[-1]['final'] is True
    assert events[-1]['text']=='Merhaba.'

def test_stale_audio_cannot_enter_a_replaced_stream():
    events=[];live=LiveSTT(events.append);live.start(Model(),'session',0)
    live.reset('session',1);live.feed('session',0,base64.b64encode(bytes(3200)).decode())
    assert events==[]
    live.stop('session');live.feed('session',1,base64.b64encode(bytes(3200)).decode());assert events==[]

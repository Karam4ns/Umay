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


def test_endpoint_inside_a_queued_packet_preserves_the_next_utterance():
    events=[];live=LiveSTT(events.append);live.start(Model(),'session',0)
    # Two utterances can cross an IPC packet while the decoder catches up.
    live.feed('session',0,base64.b64encode(bytes(6400*2)).decode())
    finals=[event for event in events if event['final']]
    assert [event['utterance'] for event in finals]==[0,1]


def test_known_assistant_name_in_a_greeting_is_not_a_different_name():
    events=[];live=LiveSTT(events.append);live.start(Model(),'session',0)
    live.publish('Selam Ummay',False);live.publish('Merhaba Hümay.',True)
    assert [event['text'] for event in events]==['Selam Umay','Merhaba Umay.']
    live.publish('Arkadaşım Hümay bugün geliyor.',True)
    assert events[-1]['text']=='Arkadaşım Hümay bugün geliyor.'

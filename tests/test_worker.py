import importlib.util
import sys
import pytest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parents[1]/'speech'))

spec = importlib.util.spec_from_file_location('worker', Path(__file__).parents[1] / 'speech' / 'worker.py')
worker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(worker)


def test_old_queued_job_is_rejected_after_cancellation():
    events = []
    original = worker.emit
    worker.emit = events.append
    try:
        worker.EPOCH = 3
        worker.run({'id': 'old', 'method': 'speak', '_epoch': 2, 'params': {'text': 'Must not speak'}})
        assert events == [{'id': 'old', 'error': 'Eski işlem iptal edildi.'}]
    finally:
        worker.emit = original


def test_package_removal_preserves_voice_profiles(tmp_path):
    original_root, original_emit = worker.ROOT, worker.emit
    worker.ROOT = tmp_path
    profile = tmp_path / 'voices' / 'reference.mp3'
    profile.parent.mkdir(); profile.write_bytes(b'ID3test')
    package = tmp_path / 'packages' / 'stt'
    package.mkdir(parents=True); (package / 'model.bin').write_bytes(b'data')
    events = []
    worker.emit = events.append
    try:
        worker.run({'id': 'remove', 'method': 'remove', 'params': {'kind': 'stt'}})
        assert not package.exists()
        assert profile.read_bytes() == b'ID3test'
        assert events[-1] == {'id': 'remove', 'result': True}
    finally:
        worker.ROOT, worker.emit = original_root, original_emit


def test_protocol_survives_library_stdout_redirection():
    import io
    from contextlib import redirect_stdout
    output, library_output = io.StringIO(), io.StringIO()
    original = worker.PROTOCOL_OUT
    worker.PROTOCOL_OUT = output
    try:
        with redirect_stdout(library_output):
            worker.emit({'event': 'audio', 'audio': 'example'})
        assert '"event": "audio"' in output.getvalue()
        assert library_output.getvalue() == ''
    finally:
        worker.PROTOCOL_OUT = original


@pytest.mark.parametrize('pause', [0, 180])
def test_speak_uses_turkish_pronunciation_with_selected_voice(monkeypatch,pause):
    import base64
    import io
    import wave
    import numpy as np

    calls, events = [], []

    class Model:
        sample_rate = 24000

        def stream(self, text, **options):
            calls.append((text, options))
            yield np.ones(24, dtype=np.float32) * .1

    monkeypatch.setattr(worker, 'load', lambda kind: None)
    monkeypatch.setattr(worker, 'MODELS', {'tts': (Model(), 'cpu')})
    monkeypatch.setattr(worker, 'emit', events.append)
    worker.run({'id': 'speak', 'method': 'speak', 'params': {
        'text': "TRT'de 4. adım hazır!", 'voice': 'personal-voice', 'pauseBeforeMs':pause,
    }})
    assert calls == [('teretede dördüncü adım hazır!', {
        'voice': 'personal-voice', 'sentence_gap_ms': 0,
    })]
    audio=[event for event in events if event.get('event')=='audio']
    if pause:
        with wave.open(io.BytesIO(base64.b64decode(audio[0]['audio']))) as wav:
            assert (wav.getframerate(),wav.getnframes())==(24000,4320)
            assert not any(wav.readframes(wav.getnframes()))
    assert len(audio)==(2 if pause else 1)
    with wave.open(io.BytesIO(base64.b64decode(audio[-1]['audio']))) as wav:
        assert (wav.getframerate(), wav.getnframes()) == (24000, 24)
    assert events[-1] == {'id': 'speak', 'result': {'cancelled': False}}


def test_stt_keeps_a_short_thinking_pause_inside_the_same_instruction(monkeypatch):
    import types
    import base64
    import numpy as np
    class Recognizer:
        def __init__(self, location, **options): self.pause = options['endpoint_silence']
        def stream(self):
            pause=self.pause
            class Stream:
                def __init__(self): self.silence=0;self.is_endpoint=False;self.speaking=False
                def accept(self,samples,sample_rate):
                    if np.any(samples): self.speaking=True;self.silence=0
                    elif self.speaking:self.silence+=len(samples)/sample_rate
                    self.is_endpoint=self.speaking and self.silence>=pause
                    return 'Chrome aç ve arama yap' if self.speaking else ''
                def end_utterance(self):self.silence=0;self.is_endpoint=False;self.speaking=False;return 'Chrome aç ve arama yap.'
            return Stream()
    monkeypatch.setitem(sys.modules,'sedalib',types.SimpleNamespace(Recognizer=Recognizer))
    monkeypatch.setattr(worker,'installed',lambda kind: True)
    monkeypatch.setattr(worker,'MODELS',{})
    events=[];live=worker.LiveSTT(events.append);worker.load('stt');live.start(worker.MODELS['stt'][0],'pause',0)
    def feed(samples):live.feed('pause',0,base64.b64encode(samples.astype('<i2').tobytes()).decode())
    feed(np.ones(320));feed(np.zeros(7200))  # 450ms hesitation, then user continues.
    assert not [event for event in events if event['final']]
    feed(np.ones(320));feed(np.zeros(8000));feed(np.zeros(3200))
    assert len([event for event in events if event['final']]) == 1

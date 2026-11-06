"""Opt-in actual Seda endpoint/throughput measurement; never uses the microphone."""
import contextlib, io, json, os, sys, time, wave
from pathlib import Path
import numpy as np
sys.path.insert(0, str(Path(__file__).parents[1] / 'speech'))
from live_stt import LiveSTT
from sedalib import Recognizer

with wave.open(str(Path(__file__).parent / 'fixtures/computer-command.wav'), 'rb') as wav:
    assert wav.getframerate() == 16000 and wav.getnchannels() == 1 and wav.getsampwidth() == 2
    samples = np.frombuffer(wav.readframes(wav.getnframes()), dtype='<i2').astype('float32') / 32768
samples = np.concatenate([samples, np.zeros(32000, dtype='float32')])
for silence in [.6, .35]:
    with contextlib.redirect_stdout(sys.stderr):
        model = Recognizer(Path(os.environ['APPDATA']) / 'Umay/speech/packages/stt-live', mode='balanced', chunk=16, punctuate=True, num_threads=2, endpoint_silence=silence)
    stream = model.stream()
    began = time.perf_counter(); first = None; finals = []; final_at = None
    for offset in range(0, len(samples), 320):
        text = stream.accept(samples[offset:offset + 320], sample_rate=16000)
        if text and first is None: first = (offset + 320) / 16
        if stream.is_endpoint:
            finals.append(stream.end_utterance()); final_at = (offset + 320) / 16
    elapsed = (time.perf_counter() - began) * 1000
    print(json.dumps(dict(endpointSilence=silence, firstPartialAudioMs=first, finalAudioMs=final_at, decodeMs=round(elapsed), audioMs=len(samples)/16, realTimeFactor=round(elapsed/(len(samples)/16), 3), finals=finals), ensure_ascii=True), flush=True)

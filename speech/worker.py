"""Resident speech worker. JSON lines are the only stdout protocol."""
import base64
import concurrent.futures
import contextlib
import gc
import io
import json
import os
from pathlib import Path
import shutil
import sys
import threading
import subprocess
import time
import wave
from live_stt import LiveSTT
from turkish_speech import stream_speech
from voice_cloning import create_profile, select_profile, delete_profile

ROOT = Path(os.environ.get('UMAY_DATA', Path.home() / '.umay'))
ROOT.mkdir(parents=True, exist_ok=True)
os.environ['HF_HOME'] = str(ROOT / 'hf')
LOCK = threading.Lock()
MODEL_LOAD_LOCK = threading.Lock()
PROTOCOL_OUT = sys.stdout
CANCEL = threading.Event()
EPOCH = 0
MODELS = {}
EXECUTOR = concurrent.futures.ThreadPoolExecutor(max_workers=1)
STT_EXECUTOR = concurrent.futures.ThreadPoolExecutor(max_workers=1)
IDS = {'stt': 'atasoglu/seda-v0.2', 'tts': 'wite-tech/pocket-tts-turkish'}
STT_REVISION = '62e2cc1615a63c433b6956214a548267ada5a774'
STT_READY = IDS['stt'] + '@' + STT_REVISION
LIVE_METHODS = {'stt_start','stt_feed','stt_reset','stt_stop'}

def package_path(kind):
    return ROOT / 'packages' / ('stt-live' if kind=='stt' else kind)

def installed(kind):
    ready=package_path(kind)/'.ready'
    return ready.exists() and (kind!='stt' or ready.read_text(encoding='utf-8')==STT_READY)


def emit(value):
    with LOCK:
        PROTOCOL_OUT.write(json.dumps(value, ensure_ascii=False) + '\n')
        PROTOCOL_OUT.flush()


def hardware():
    import platform
    import torch
    result = {'platform': platform.system(), 'arch': platform.machine(), 'devices': [], 'stt': 'cpu', 'tts': 'cpu'}
    if platform.system() == 'Windows':
        try:
            found = subprocess.run(['powershell', '-NoProfile', '-Command', 'Get-CimInstance Win32_VideoController | Select-Object Name,AdapterRAM | ConvertTo-Json -Compress'], capture_output=True, text=True, timeout=15, creationflags=0x08000000)
            devices = json.loads(found.stdout)
            result['detected'] = devices if isinstance(devices, list) else [devices]
        except (ValueError, OSError, subprocess.TimeoutExpired):
            result['detected'] = []
    result['note'] = 'Canlı Türkçe STT, CPU üzerinde Seda/sherpa-onnx kullanır. TTS yalnız gerçek yükleme testi geçen hızlandırmayı kullanır.'
    if torch.cuda.is_available():
        for i in range(torch.cuda.device_count()):
            free, total = torch.cuda.mem_get_info(i)
            result['devices'].append({'name': torch.cuda.get_device_name(i), 'index': i, 'free': free, 'total': total})
        # Each model performs a real load below; failed acceleration falls back to CPU.
        result['tts'] = 'cuda'
    return result


def load(kind):
    # Windows native DLL initializers (ONNX/SciPy/PyTorch) can deadlock when
    # imported concurrently on the independent STT and TTS executor threads.
    # Serialize cold initialization, while hot inference keeps separate queues.
    with MODEL_LOAD_LOCK:
        return _load(kind)


def _load(kind):
    if kind in MODELS:
        return {'device': MODELS[kind][1], 'resident': True}
    location = package_path(kind)
    if not installed(kind):
        raise ValueError('Ayarlar / Konuşma bölümünden canlı STT paketini indir veya güncelle.' if kind=='stt' else 'Önce konuşma paketini indirin.')
    if kind=='stt':
        from sedalib import Recognizer
        with contextlib.redirect_stdout(sys.stderr):
            model=Recognizer(location,mode='balanced',chunk=16,punctuate=True,num_threads=2,endpoint_silence=.6)
        MODELS[kind]=(model,'cpu')
        return {'device':'cpu','resident':True,'engine':'Seda v0.2'}
    selected = hardware()[kind]
    fallback = None
    for device in ([selected, 'cpu'] if selected != 'cpu' else ['cpu']):
        try:
            with contextlib.redirect_stdout(sys.stderr):
                from pocket_tts_turkish import TurkishTTS
                model = TurkishTTS.from_pretrained(str(location), device=device)
                model.generate('Merhaba.', voice='female_1')
            MODELS[kind] = (model, device)
            return {'device': device, 'resident': True, 'fallback': fallback}
        except Exception as exc:
            fallback = type(exc).__name__
            gc.collect()
            if device == 'cpu':
                raise


def install(kind, request_id):
    epoch=EPOCH
    from huggingface_hub import snapshot_download
    if kind not in IDS:
        raise ValueError('Bilinmeyen paket.')
    target = package_path(kind)
    emit({'event': 'progress', 'id': request_id, 'stage': 'İndiriliyor', 'kind': kind})
    # Library supports checksum-aware cached retries; no arbitrary remote URL is accepted.
    from tqdm.auto import tqdm
    class Progress(tqdm):
        def update(self, amount=1):
            if CANCEL.is_set() or epoch!=EPOCH:
                raise InterruptedError('İndirme iptal edildi.')
            value = super().update(amount)
            now = time.monotonic()
            if now - getattr(self, '_reported', 0) > 1:
                self._reported = now
                emit({'event': 'progress', 'id': request_id, 'kind': kind,
                      'stage': 'İndiriliyor', 'completed': self.n, 'total': self.total})
            return value
    options={'revision':STT_REVISION,'allow_patterns':['c16/*','lm/*','formatter/*','tokens.txt','vad/*','README.md']} if kind=='stt' else {}
    snapshot_download(IDS[kind], local_dir=target, tqdm_class=Progress,**options)
    if CANCEL.is_set() or epoch!=EPOCH:
        raise InterruptedError('İndirme iptal edildi; önbellekten tekrar denenebilir.')
    (target / '.ready').write_text(STT_READY if kind=='stt' else IDS[kind], encoding='utf-8')
    try:
        return load(kind)
    except Exception:
        (target / '.ready').unlink(missing_ok=True)
        raise


def run(request):
    request_id = request['id']
    try:
        method = request['method']
        p = request.get('params') or {}
        if method not in LIVE_METHODS and request.get('_epoch', EPOCH) != EPOCH:
            raise InterruptedError('Eski işlem iptal edildi.')
        if method not in LIVE_METHODS:CANCEL.clear()
        if method=='stt_start':
            load('stt');LIVE.start(MODELS['stt'][0],p['streamId'],p['generation']);result=True
        elif method=='stt_feed':result=LIVE.feed(p['streamId'],p['generation'],p['audio'])
        elif method=='stt_reset':result=LIVE.reset(p['streamId'],p['generation'])
        elif method=='stt_stop':LIVE.stop(p['streamId']);result=True
        elif method == 'hardware':
            result = hardware()
        elif method == 'status':
            result = {k: {'installed': installed(k), 'resident': k in MODELS,
                          'device': MODELS[k][1] if k in MODELS else None,'model':IDS[k]} for k in IDS}
            result['stt']['upgradeAvailable']=(ROOT/'packages'/'stt'/'.ready').exists() and not installed('stt')
        elif method == 'install':
            result = install(p['kind'], request_id)
        elif method == 'load':
            result = load(p['kind'])
        elif method == 'remove':
            kind = p['kind']
            if kind not in IDS:
                raise ValueError('Bilinmeyen paket.')
            MODELS.pop(kind, None)
            if kind=='stt':LIVE.stop(LIVE.session)
            gc.collect()
            if kind=='tts':
                import torch
                if torch.cuda.is_available():torch.cuda.empty_cache()
            for package in [package_path(kind)]+([ROOT/'packages'/'stt'] if kind=='stt' else []):
                if not package.resolve().is_relative_to((ROOT/'packages').resolve()):raise ValueError('Paket yolu geçersiz.')
                if package.exists():shutil.rmtree(package)
            result = True
        elif method == 'transcribe':
            load('stt')
            raw = base64.b64decode(p['audio'], validate=True)
            if len(raw) > 16_000 * 2 * 120:
                raise ValueError('Ses kaydı en fazla 120 saniye olabilir.')
            import numpy as np
            audio = np.frombuffer(raw, dtype='<i2').astype('float32') / 32768
            with contextlib.redirect_stdout(sys.stderr):
                result = MODELS['stt'][0].transcribe(audio,16000).strip()
        elif method == 'speak':
            load('tts')
            text = str(p['text'])[:4000]
            model = MODELS['tts'][0]
            with contextlib.redirect_stdout(sys.stderr):
                cancelled = lambda: CANCEL.is_set() or request.get('_epoch', EPOCH) != EPOCH
                for chunk in stream_speech(model, text, p.get('voice') or 'female_1', cancelled, pause_before_ms=p.get('pauseBeforeMs',0)):
                    if CANCEL.is_set() or request.get('_epoch',EPOCH)!=EPOCH:
                        break
                    import numpy as np
                    pcm = (np.clip(chunk, -1, 1) * 32767).astype('<i2')
                    output = io.BytesIO()
                    with wave.open(output, 'wb') as wav:
                        wav.setnchannels(1); wav.setsampwidth(2); wav.setframerate(model.sample_rate); wav.writeframes(pcm.tobytes())
                    emit({'event': 'audio', 'id': request_id, 'audio': base64.b64encode(output.getvalue()).decode()})
            result = {'cancelled': CANCEL.is_set()}
        elif method == 'clone':
            load('tts')
            emit({'event': 'progress', 'id': request_id, 'kind': 'Ses profili', 'stage': 'Ses örneği hazırlanıyor…'})
            with contextlib.redirect_stdout(sys.stderr):
                result = create_profile(ROOT / 'voices', MODELS['tts'][0], p['path'], p.get('name'),
                                        lambda: CANCEL.is_set() or request.get('_epoch', EPOCH) != EPOCH)
        elif method == 'voices':
            result = [dict(json.loads(f.read_text(encoding='utf-8')), id=f.stem) for f in (ROOT / 'voices').glob('*.json')]
        elif method == 'select_voice':
            load('tts')
            with contextlib.redirect_stdout(sys.stderr):
                result = select_profile(ROOT / 'voices', MODELS['tts'][0], p['id'],
                                        lambda: CANCEL.is_set() or request.get('_epoch', EPOCH) != EPOCH)
        elif method == 'delete_voice':
            delete_profile(ROOT / 'voices', p['id'])
            result = True
        else:
            raise ValueError('Bilinmeyen işlem.')
        emit({'id': request_id, 'result': result})
    except Exception as exc:
        emit({'id': request_id, 'error': str(exc)[:500]})


LIVE=LiveSTT(emit)

if __name__ == '__main__':
    # Load native extensions on the owning thread before either inference queue
    # starts. Windows DLL initialization across different executor threads can
    # otherwise stall in SciPy BLAS / ONNX Runtime even with model-load locking.
    with contextlib.redirect_stdout(sys.stderr):
        import scipy.signal
        import torch
        import onnxruntime
    emit({'event': 'ready'})
    for line in sys.stdin:
        try:
            request = json.loads(line)
            if request.get('method') == 'cancel':
                EPOCH += 1
                CANCEL.set()
                emit({'id': request['id'], 'result': True})
            else:
                request['_epoch'] = EPOCH
                stt_job=request.get('method') in LIVE_METHODS or (request.get('params',{}).get('kind')=='stt' and request.get('method') in {'install','load','remove'}) or request.get('method')=='transcribe'
                (STT_EXECUTOR if stt_job else EXECUTOR).submit(run, request)
        except (ValueError, KeyError):
            emit({'error': 'Geçersiz işçi isteği.'})
    EXECUTOR.shutdown(wait=True)
    STT_EXECUTOR.shutdown(wait=True)

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

ROOT = Path(os.environ.get('UMAY_DATA', Path.home() / '.umay'))
ROOT.mkdir(parents=True, exist_ok=True)
os.environ['HF_HOME'] = str(ROOT / 'hf')
LOCK = threading.Lock()
PROTOCOL_OUT = sys.stdout
CANCEL = threading.Event()
EPOCH = 0
MODELS = {}
EXECUTOR = concurrent.futures.ThreadPoolExecutor(max_workers=1)
IDS = {'stt': 'dropbox-dash/faster-whisper-large-v3-turbo', 'tts': 'wite-tech/pocket-tts-turkish'}


def emit(value):
    with LOCK:
        PROTOCOL_OUT.write(json.dumps(value, ensure_ascii=False) + '\n')
        PROTOCOL_OUT.flush()


def hardware():
    import platform
    import torch
    import ctranslate2
    result = {'platform': platform.system(), 'arch': platform.machine(), 'devices': [], 'stt': 'cpu', 'tts': 'cpu'}
    if platform.system() == 'Windows':
        try:
            found = subprocess.run(['powershell', '-NoProfile', '-Command', 'Get-CimInstance Win32_VideoController | Select-Object Name,AdapterRAM | ConvertTo-Json -Compress'], capture_output=True, text=True, timeout=15, creationflags=0x08000000)
            devices = json.loads(found.stdout)
            result['detected'] = devices if isinstance(devices, list) else [devices]
        except (ValueError, OSError, subprocess.TimeoutExpired):
            result['detected'] = []
    result['note'] = 'Yalnız gerçek yükleme testi geçen hızlandırma kullanılır; AMD/Intel GPU sağlayıcısı bu sürümde bağlı değil.'
    if torch.cuda.is_available():
        for i in range(torch.cuda.device_count()):
            free, total = torch.cuda.mem_get_info(i)
            result['devices'].append({'name': torch.cuda.get_device_name(i), 'index': i, 'free': free, 'total': total})
        # Each model performs a real load below; failed acceleration falls back to CPU.
        result['tts'] = 'cuda'
    try:
        if ctranslate2.get_cuda_device_count() > 0:
            result['stt'] = 'cuda'
    except RuntimeError:
        pass
    return result


def load(kind):
    if kind in MODELS:
        return {'device': MODELS[kind][1], 'resident': True}
    location = ROOT / 'packages' / kind
    if not (location / '.ready').exists():
        raise ValueError('Önce konuşma paketini indirin.')
    selected = hardware()[kind]
    fallback = None
    for device in ([selected, 'cpu'] if selected != 'cpu' else ['cpu']):
        try:
            with contextlib.redirect_stdout(sys.stderr):
                if kind == 'stt':
                    from faster_whisper import WhisperModel
                    model = WhisperModel(str(location), device=device, compute_type='int8_float16' if device == 'cuda' else 'int8', cpu_threads=4)
                    import numpy as np
                    list(model.transcribe(np.zeros(16000, dtype='float32'), language='tr')[0])
                else:
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
    from huggingface_hub import snapshot_download
    if kind not in IDS:
        raise ValueError('Bilinmeyen paket.')
    target = ROOT / 'packages' / kind
    emit({'event': 'progress', 'id': request_id, 'stage': 'İndiriliyor', 'kind': kind})
    # Library supports checksum-aware cached retries; no arbitrary remote URL is accepted.
    from tqdm.auto import tqdm
    class Progress(tqdm):
        def update(self, amount=1):
            if CANCEL.is_set():
                raise InterruptedError('İndirme iptal edildi.')
            value = super().update(amount)
            now = time.monotonic()
            if now - getattr(self, '_reported', 0) > 1:
                self._reported = now
                emit({'event': 'progress', 'id': request_id, 'kind': kind,
                      'stage': 'İndiriliyor', 'completed': self.n, 'total': self.total})
            return value
    snapshot_download(IDS[kind], local_dir=target, tqdm_class=Progress)
    if CANCEL.is_set():
        raise InterruptedError('İndirme iptal edildi; önbellekten tekrar denenebilir.')
    (target / '.ready').write_text(IDS[kind], encoding='utf-8')
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
        if request.get('_epoch', EPOCH) != EPOCH:
            raise InterruptedError('Eski işlem iptal edildi.')
        CANCEL.clear()
        if method == 'hardware':
            result = hardware()
        elif method == 'status':
            result = {k: {'installed': (ROOT / 'packages' / k / '.ready').exists(), 'resident': k in MODELS,
                          'device': MODELS[k][1] if k in MODELS else None} for k in IDS}
        elif method == 'install':
            result = install(p['kind'], request_id)
        elif method == 'load':
            result = load(p['kind'])
        elif method == 'remove':
            kind = p['kind']
            if kind not in IDS:
                raise ValueError('Bilinmeyen paket.')
            MODELS.pop(kind, None)
            gc.collect()
            import torch
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
            package = ROOT / 'packages' / kind
            if package.exists():
                shutil.rmtree(package)
            result = True
        elif method == 'transcribe':
            load('stt')
            raw = base64.b64decode(p['audio'], validate=True)
            if len(raw) > 16_000 * 2 * 120:
                raise ValueError('Ses kaydı en fazla 120 saniye olabilir.')
            import numpy as np
            audio = np.frombuffer(raw, dtype='<i2').astype('float32') / 32768
            with contextlib.redirect_stdout(sys.stderr):
                segments, _ = MODELS['stt'][0].transcribe(audio, language='tr', vad_filter=True, beam_size=1)
                result = ''.join(s.text for s in segments).strip()
        elif method == 'speak':
            load('tts')
            text = str(p['text'])[:4000]
            model = MODELS['tts'][0]
            with contextlib.redirect_stdout(sys.stderr):
                for chunk in model.stream(text, voice=p.get('voice') or 'female_1'):
                    if CANCEL.is_set():
                        break
                    import numpy as np
                    pcm = (np.clip(chunk, -1, 1) * 32767).astype('<i2')
                    output = io.BytesIO()
                    with wave.open(output, 'wb') as wav:
                        wav.setnchannels(1); wav.setsampwidth(2); wav.setframerate(model.sample_rate); wav.writeframes(pcm.tobytes())
                    emit({'event': 'audio', 'id': request_id, 'audio': base64.b64encode(output.getvalue()).decode()})
            result = {'cancelled': CANCEL.is_set()}
        elif method == 'clone':
            path = Path(p['path'])
            if path.suffix.lower() != '.mp3' or not 0 < path.stat().st_size <= 50_000_000:
                raise ValueError('En fazla 50 MB MP3 seçin.')
            import av
            with av.open(str(path)) as media:
                if not media.streams.audio or (media.duration or 0) > 600 * av.time_base:
                    raise ValueError('Referans en fazla 10 dakika ve geçerli ses olmalı.')
            load('tts')
            # The library performs reference cutting; profiles persist independently of packages.
            with contextlib.redirect_stdout(sys.stderr):
                name = MODELS['tts'][0].voice_from_file(path, name=p.get('name') or path.stem, cut=True)
            profiles = ROOT / 'voices'; profiles.mkdir(exist_ok=True)
            # Store the source to reconstruct the library's voice state after relaunch.
            from uuid import uuid4
            profile_id = str(uuid4()); destination = profiles / (profile_id + '.mp3')
            shutil.copyfile(path, destination)
            (profiles / (profile_id + '.json')).write_text(json.dumps({'name': name, 'path': str(destination)}, ensure_ascii=False), encoding='utf-8')
            result = {'id': profile_id, 'name': name}
        elif method == 'voices':
            result = [dict(json.loads(f.read_text(encoding='utf-8')), id=f.stem) for f in (ROOT / 'voices').glob('*.json')]
        elif method == 'select_voice':
            from uuid import UUID
            profile_id = str(UUID(p['id']))
            info = json.loads((ROOT / 'voices' / (profile_id + '.json')).read_text(encoding='utf-8'))
            load('tts')
            with contextlib.redirect_stdout(sys.stderr):
                name = MODELS['tts'][0].voice_from_file(info['path'], name=info['name'], cut=True)
            result = name
        elif method == 'delete_voice':
            from uuid import UUID
            profile_id = str(UUID(p['id']))
            for suffix in ('.json', '.mp3'):
                (ROOT / 'voices' / (profile_id + suffix)).unlink(missing_ok=True)
            result = True
        else:
            raise ValueError('Bilinmeyen işlem.')
        emit({'id': request_id, 'result': result})
    except Exception as exc:
        emit({'id': request_id, 'error': str(exc)[:500]})


if __name__ == '__main__':
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
                EXECUTOR.submit(run, request)
        except (ValueError, KeyError):
            emit({'error': 'Geçersiz işçi isteği.'})
    EXECUTOR.shutdown(wait=True)

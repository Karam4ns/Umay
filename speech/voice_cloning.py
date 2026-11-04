"""Local reference preparation and durable, independent cloned voice profiles.

Pocket Turkish expects a 3–5 second prompt ending BETWEEN words, not a complete
sentence. Energy measurements help choose a usable excerpt; they cannot prove
speaker identity, detect every music bed, or predict perceived voice similarity.
No denoising, pitch shift, time stretch or dynamic compression is applied.
"""
import json
import os
from pathlib import Path
import shutil
import tempfile
from uuid import UUID, uuid4
import wave
from bisect import bisect_left, bisect_right

import numpy as np

REFERENCE_VERSION = 1
MAX_BYTES = 50_000_000
MAX_SECONDS = 600
SAMPLE_RATE = 24000


def _check_cancel(cancelled):
    if cancelled():
        raise InterruptedError('Ses profili hazırlama iptal edildi.')


def decode_reference(path, cancelled=lambda: False):
    """Decode incrementally with actual sample-count limits, including unknown duration."""
    import av
    path = Path(path)
    if not path.is_file():
        raise ValueError('Ses örneği bulunamadı. MP3 dosyanı yeniden seçerek profil oluşturabilirsin.')
    if path.suffix.lower() != '.mp3' or not 0 < path.stat().st_size <= MAX_BYTES:
        raise ValueError('En fazla 50 MB büyüklüğünde bir MP3 seçin.')
    chunks, count = [], 0
    try:
        with av.open(str(path)) as media:
            if not media.streams.audio:
                raise ValueError('Dosyada okunabilir bir ses kaydı bulunamadı.')
            if (media.duration or 0) > (MAX_SECONDS + .2) * av.time_base:
                raise ValueError('Ses örneği en fazla 10 dakika olabilir.')
            stream = media.streams.audio[0]
            layout = 'mono' if len(stream.codec_context.layout.channels) == 1 else 'stereo'
            resampler = av.AudioResampler(format='fltp', layout=layout, rate=SAMPLE_RATE)
            for frame in media.decode(stream):
                _check_cancel(cancelled)
                for converted in resampler.resample(frame):
                    samples = converted.to_ndarray().T
                    count += len(samples)
                    if count > MAX_SECONDS * SAMPLE_RATE:
                        raise ValueError('Ses örneği en fazla 10 dakika olabilir.')
                    chunks.append(samples.copy())
            for converted in resampler.resample(None):
                samples = converted.to_ndarray().T
                count += len(samples)
                if count > MAX_SECONDS * SAMPLE_RATE:
                    raise ValueError('Ses örneği en fazla 10 dakika olabilir.')
                chunks.append(samples.copy())
    except InterruptedError:
        raise
    except (av.FFmpegError, EOFError, OSError) as exc:
        raise ValueError('MP3 okunamadı. Kaydı yeniden dışa aktarıp tekrar deneyin.') from exc
    if not chunks:
        raise ValueError('Ses örneği boş. Konuşma içeren bir MP3 seçin.')
    audio = np.concatenate(chunks, axis=0)
    if not np.all(np.isfinite(audio)):
        raise ValueError('Ses örneğinde bozuk veriler var. Başka bir kayıt seçin.')
    # Phase-inverted stereo can cancel the speaker when averaged. In that case,
    # use the stronger channel instead of manufacturing a near-silent prompt.
    channel_power = np.mean(audio ** 2, axis=0)
    mono = audio.mean(axis=1)
    if np.mean(mono ** 2) < float(channel_power.max()) * .1:
        mono = audio[:, int(np.argmax(channel_power))].copy()
    return mono.astype(np.float32, copy=False)


def _runs(mask):
    edges = np.diff(np.r_[False, mask, False].astype(np.int8))
    return zip(np.flatnonzero(edges == 1), np.flatnonzero(edges == -1))


def choose_reference(audio, sample_rate=SAMPLE_RATE):
    """Find a short excerpt with an internal word pause and enough active audio.

    A short pause needs voiced audio on both sides, avoiding trailing silence
    and long sentence breaks. Candidate scoring is acoustic, not a MOS score.
    """
    audio = np.asarray(audio, dtype=np.float32).reshape(-1)
    if not np.all(np.isfinite(audio)):
        raise ValueError('Ses örneğinde bozuk veriler var.')
    if len(audio) < sample_rate * 3.4:
        raise ValueError('Ses örneği çok kısa. Tek kişinin doğal konuştuğu 10–30 saniyelik bir kayıt seçin.')
    hop = max(1, round(sample_rate * .02))
    frames = audio[:len(audio) // hop * hop].reshape(-1, hop)
    # DC offset must not make a quiet gap appear to contain speech.
    centered = frames - np.mean(frames, axis=1, keepdims=True)
    rms = np.sqrt(np.mean(centered ** 2, axis=1))
    audible = rms[rms > max(.0002, float(np.percentile(rms, 99)) * .04)]
    level = float(np.percentile(audible, 75)) if len(audible) else 0
    if level < .002 or np.max(np.abs(audio)) < .008:
        raise ValueError('Konuşma sesi çok düşük veya kayıt sessiz. Mikrofona yakın, doğal sesle yeniden kaydedin.')
    threshold = max(.0005, min(.015, level * .16))
    silent = rms < threshold
    pauses = [(int(a), int(b)) for a, b in _runs(silent)]
    active = np.flatnonzero(~silent)
    if len(active) == 0:
        raise ValueError('Kayıtta yeterli konuşma bulunamadı. Başka bir ses örneği seçin.')
    # Start in a pause just before a phrase, never after blindly skipping N sec.
    starts = {max(0, int(active[0]) - 4)}
    starts.update(max(a, b - 4) for a, b in pauses if b < len(rms) and b - a >= 2)
    starts = sorted(starts)
    candidates = []
    for a, b in pauses:
        if not 2 <= b - a <= 16 or a == 0 or b >= len(rms) - 5:
            continue
        if not np.any(~silent[b:b + 20]):
            continue
        end = (a + b) // 2
        for start in starts[bisect_left(starts, end - 5 * sample_rate / hop):bisect_right(starts, end - 3 * sample_rate / hop)]:
            duration = (end - start) * hop / sample_rate
            if not 3 <= duration <= 5:
                continue
            region = rms[start:end]
            voiced = region[region >= threshold]
            if len(voiced) * hop / sample_rate < 2.2:
                continue
            clip = audio[start * hop:end * hop]
            clipping = float(np.mean(np.abs(clip) >= .985))
            if clipping > .01:
                continue
            occupancy = len(voiced) / len(region)
            # Prefer enough varied speech and a short word gap, not loudness.
            quiet = float(np.percentile(region, 10))
            contrast = min(30, 20 * np.log10((float(np.median(voiced)) + 1e-8) / (quiet + 1e-8)))
            score = min(occupancy, .85) * 4 + contrast * .025 - clipping * 100 - abs(duration - 4) * .1
            candidates.append((score, start, end, clipping, contrast))
    if not candidates:
        raise ValueError('Klonlama için uygun bir konuşma arası bulunamadı veya ses bozulmuş. Müziksiz, tek kişinin doğal konuştuğu 10–30 saniyelik bir kayıt deneyin.')
    _, start, end, clipping, contrast = max(candidates)
    selected = audio[start * hop:end * hop].copy()
    selected -= np.mean(selected)
    selected_rms = float(np.sqrt(np.mean(selected ** 2)))
    peak = float(np.max(np.abs(selected)))
    # One constant gain preserves breath, timing and intonation. Cap boost at
    # +9dB and leave headroom; do not amplify noise with an automatic compressor.
    gain = min(.09 / max(selected_rms, 1e-8), 10 ** (9 / 20), .92 / max(peak, 1e-8))
    selected *= gain
    # Only fade the quiet boundaries, not each spoken word.
    fade = min(round(sample_rate * .005), len(selected) // 2)
    selected[:fade] *= np.linspace(0, 1, fade, dtype=np.float32)
    selected[-fade:] *= np.linspace(1, 0, fade, dtype=np.float32)
    warnings = []
    if contrast < 12:
        warnings.append('Arka plan sesi duyuluyor olabilir. Daha sessiz bir kayıtla sesin daha doğal çıkabilir.')
    if selected_rms < .01:
        warnings.append('Kayıt düşük sesli. Mikrofona biraz daha yakın bir örnek daha iyi sonuç verebilir.')
    if clipping > .001:
        warnings.append('Kayıtta ses patlamaları olabilir. Mikrofon seviyesini azaltarak yeniden kaydedebilirsin.')
    info = {'version': REFERENCE_VERSION, 'start_seconds': round(start * hop / sample_rate, 2),
            'duration_seconds': round(len(selected) / sample_rate, 2), 'warnings': warnings}
    return selected, info


def prepare_reference(source, destination, cancelled=lambda: False):
    audio = decode_reference(source, cancelled)
    _check_cancel(cancelled)
    reference, info = choose_reference(audio)
    with wave.open(str(destination), 'wb') as wav:
        wav.setnchannels(1); wav.setsampwidth(2); wav.setframerate(SAMPLE_RATE)
        wav.writeframes((np.clip(reference, -1, 1) * 32767).astype('<i2').tobytes())
    return info


def _write_json(path, info):
    temporary = path.with_suffix('.json.tmp')
    try:
        temporary.write_text(json.dumps(info, ensure_ascii=False), encoding='utf-8')
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


def create_profile(directory, model, source, name, cancelled=lambda: False):
    directory = Path(directory); directory.mkdir(parents=True, exist_ok=True)
    profile_id = str(uuid4()); key = 'umay_' + profile_id
    final_source, final_reference = directory / (profile_id + '.mp3'), directory / (profile_id + '.wav')
    info = {'name': str(name or Path(source).stem).strip()[:160] or 'Sesim',
            'path': str(final_source), 'reference': final_reference.name}
    committed = False
    try:
        with tempfile.TemporaryDirectory(prefix='pending-', dir=directory) as temporary:
            staging = Path(temporary)
            info['quality'] = prepare_reference(source, staging / 'reference.wav', cancelled)
            _check_cancel(cancelled)
            model.voice_from_file(staging / 'reference.wav', name=key, cut=False)
            _check_cancel(cancelled)
            shutil.copyfile(source, staging / 'original.mp3')
            os.replace(staging / 'original.mp3', final_source)
            os.replace(staging / 'reference.wav', final_reference)
            _check_cancel(cancelled)
            _write_json(directory / (profile_id + '.json'), info)
            committed = True
    finally:
        if not committed:
            final_source.unlink(missing_ok=True); final_reference.unlink(missing_ok=True)
    return {'id': profile_id, 'name': info['name'], 'voice': key, 'quality': info['quality']}


def select_profile(directory, model, profile_id, cancelled=lambda: False):
    directory = Path(directory); profile_id = str(UUID(profile_id))
    metadata = directory / (profile_id + '.json')
    info = json.loads(metadata.read_text(encoding='utf-8'))
    source, reference = directory / (profile_id + '.mp3'), directory / (profile_id + '.wav')
    key = 'umay_' + profile_id
    # Upgrade old profiles from their own original MP3, preserving that file.
    if info.get('quality', {}).get('version') != REFERENCE_VERSION or not reference.is_file():
        with tempfile.TemporaryDirectory(prefix='pending-', dir=directory) as temporary:
            prepared = Path(temporary) / 'reference.wav'
            quality = prepare_reference(source, prepared, cancelled)
            _check_cancel(cancelled)
            model.voice_from_file(prepared, name=key, cut=False)
            _check_cancel(cancelled)
            os.replace(prepared, reference)
            info.update(reference=reference.name, quality=quality)
            _write_json(metadata, info)
    elif key not in model.voices:
        _check_cancel(cancelled)
        model.voice_from_file(reference, name=key, cut=False)
    _check_cancel(cancelled)
    return key


def delete_profile(directory, profile_id):
    directory = Path(directory); profile_id = str(UUID(profile_id))
    for suffix in ('.json', '.mp3', '.wav'):
        (directory / (profile_id + suffix)).unlink(missing_ok=True)

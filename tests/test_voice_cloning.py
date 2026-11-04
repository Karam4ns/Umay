import json
from pathlib import Path
import sys
from uuid import uuid4
import wave

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).parents[1] / 'speech'))
import voice_cloning as cloning


def speech_like(seconds=12, amplitude=.12):
    # Deterministic synthetic syllables test cut positions, NOT human similarity.
    rate = cloning.SAMPLE_RATE
    t = np.arange(int(seconds * rate)) / rate
    envelope = np.where(t % .64 < .5, np.maximum(0, np.sin(np.pi * (t % .64) / .5)) ** .3, 0)
    signal = np.sin(2 * np.pi * 170 * t) + .3 * np.sin(2 * np.pi * 340 * t)
    return (amplitude * envelope * signal).astype(np.float32)


def mp3(path, samples):
    import av
    samples = np.asarray(samples)
    if samples.ndim == 1:
        samples = samples[None, :]
    layout = 'mono' if len(samples) == 1 else 'stereo'
    with av.open(str(path), 'w') as output:
        stream = output.add_stream('libmp3lame', rate=cloning.SAMPLE_RATE)
        stream.layout = layout
        frame = av.AudioFrame.from_ndarray(samples.astype('float32'), format='fltp', layout=layout)
        frame.sample_rate = cloning.SAMPLE_RATE
        for packet in stream.encode(frame):
            output.mux(packet)
        for packet in stream.encode(None):
            output.mux(packet)


def test_excerpt_skips_long_intro_and_ends_between_active_syllables():
    audio = np.r_[np.zeros(40 * cloning.SAMPLE_RATE, dtype=np.float32), speech_like()]
    selected, info = cloning.choose_reference(audio)
    assert info['start_seconds'] >= 39.9
    assert 3 <= info['duration_seconds'] <= 5
    assert abs(selected[-1]) < .0001
    end = round((info['start_seconds'] + info['duration_seconds']) * cloning.SAMPLE_RATE)
    assert np.max(np.abs(audio[end:end + cloning.SAMPLE_RATE // 2])) > .05
    assert np.max(np.abs(selected)) <= .92001


@pytest.mark.parametrize('audio', [np.zeros(24000 * 8), speech_like(2), np.full(24000 * 8, np.nan)])
def test_unusable_reference_gets_actionable_error(audio):
    with pytest.raises(ValueError):
        cloning.choose_reference(audio)


def test_constant_audio_without_word_gaps_is_not_blindly_cut():
    t = np.arange(cloning.SAMPLE_RATE * 8) / cloning.SAMPLE_RATE
    with pytest.raises(ValueError, match='konuşma arası'):
        cloning.choose_reference((.1 * np.sin(2 * np.pi * 170 * t)).astype('float32'))


def test_clipped_intro_is_skipped_when_later_excerpt_is_usable():
    clipped = np.clip(speech_like(7, 3), -1, 1)
    audio = np.r_[clipped, speech_like(12)]
    selected, info = cloning.choose_reference(audio)
    assert info['start_seconds'] >= 6.5
    assert np.max(np.abs(selected)) < 1


def test_preparation_uses_pcm_and_preserves_source_bytes(tmp_path):
    source = tmp_path / 'reference.mp3'
    output = tmp_path / 'prepared.wav'
    mp3(source, np.r_[np.zeros(24000 * 6), speech_like()])
    original = source.read_bytes()
    quality = cloning.prepare_reference(source, output)
    assert source.read_bytes() == original
    assert quality['start_seconds'] >= 5.9
    with wave.open(str(output)) as wav:
        assert (wav.getframerate(), wav.getnchannels(), wav.getsampwidth()) == (24000, 1, 2)
        assert 3 <= wav.getnframes() / 24000 <= 5


def test_preparation_keeps_pitch_and_dynamics_without_compression():
    audio = speech_like()
    prepared, quality = cloning.choose_reference(audio)
    start = round(quality['start_seconds'] * cloning.SAMPLE_RATE)
    original = audio[start:start + len(prepared)]
    # Ignore the 5ms boundary fades; the entire excerpt has only a DC offset
    # correction and ONE constant gain. No time/pitch changes or robot filter.
    assert np.corrcoef(original[200:-200], prepared[200:-200])[0, 1] > .99999


def test_phase_inverted_stereo_does_not_cancel_voice(tmp_path):
    source = tmp_path / 'stereo.mp3'
    audio = speech_like()
    mp3(source, np.stack([audio, -audio]))
    decoded = cloning.decode_reference(source)
    assert np.sqrt(np.mean(decoded ** 2)) > .03


def test_decode_rejects_size_duration_and_cancel(tmp_path, monkeypatch):
    source = tmp_path / 'reference.mp3'
    mp3(source, speech_like())
    with pytest.raises(InterruptedError):
        cloning.decode_reference(source, lambda: True)
    monkeypatch.setattr(cloning, 'MAX_SECONDS', 1)
    with pytest.raises(ValueError, match='10 dakika'):
        cloning.decode_reference(source)
    monkeypatch.setattr(cloning, 'MAX_BYTES', 1)
    with pytest.raises(ValueError, match='50 MB'):
        cloning.decode_reference(source)


def test_unknown_container_duration_still_has_decoded_sample_limit(tmp_path, monkeypatch):
    import av
    source = tmp_path / 'reference.mp3'; mp3(source, speech_like(4))
    real_open = av.open

    class UnknownDuration:
        duration = None

        def __enter__(self):
            self.media = real_open(str(source))
            self.streams = self.media.streams
            return self

        def __exit__(self, *args):
            self.media.close()

        def decode(self, stream):
            return self.media.decode(stream)

    monkeypatch.setattr(av, 'open', lambda *args, **kwargs: UnknownDuration())
    monkeypatch.setattr(cloning, 'MAX_SECONDS', 1)
    with pytest.raises(ValueError, match='10 dakika'):
        cloning.decode_reference(source)


class Model:
    def __init__(self):
        self.calls = []
        self.voices = []

    def voice_from_file(self, path, name, cut):
        assert Path(path).is_file()
        assert cut is False  # The selected between-word boundary must not be recut.
        self.calls.append((Path(path), name))
        self.voices.append(name)
        return name


def prepare_stub(source, destination, cancelled):
    if cancelled():
        raise InterruptedError('cancel')
    Path(destination).write_bytes(b'prepared-reference')
    return {'version': cloning.REFERENCE_VERSION, 'duration_seconds': 4, 'warnings': []}


def test_duplicate_display_names_get_independent_cached_voices(tmp_path, monkeypatch):
    monkeypatch.setattr(cloning, 'prepare_reference', prepare_stub)
    source = tmp_path / 'source.mp3'; source.write_bytes(b'original')
    directory = tmp_path / 'voices'; model = Model()
    first = cloning.create_profile(directory, model, source, 'female_1')
    second = cloning.create_profile(directory, model, source, 'female_1')
    assert first['voice'] != second['voice']
    assert first['name'] == second['name'] == 'female_1'
    assert cloning.select_profile(directory, model, first['id']) == first['voice']
    assert len(model.calls) == 2  # No encoding on every selection or utterance.
    reloaded = Model()
    assert cloning.select_profile(directory, reloaded, first['id']) == first['voice']
    assert len(reloaded.calls) == 1
    assert reloaded.calls[0][0].suffix == '.wav'


def test_legacy_profile_upgrade_preserves_original_and_uses_unique_key(tmp_path, monkeypatch):
    monkeypatch.setattr(cloning, 'prepare_reference', prepare_stub)
    profile_id = str(uuid4())
    source = tmp_path / (profile_id + '.mp3'); source.write_bytes(b'original')
    metadata = tmp_path / (profile_id + '.json')
    metadata.write_text(json.dumps({'name': 'My voice', 'path': str(source)}))
    key = cloning.select_profile(tmp_path, Model(), profile_id)
    assert key == 'umay_' + profile_id
    assert source.read_bytes() == b'original'
    assert metadata.is_file() and source.with_suffix('.wav').is_file()
    assert json.loads(metadata.read_text())['name'] == 'My voice'


def test_failed_legacy_preparation_leaves_existing_profile_untouched(tmp_path, monkeypatch):
    profile_id = str(uuid4()); source = tmp_path / (profile_id + '.mp3')
    source.write_bytes(b'original'); metadata = source.with_suffix('.json')
    metadata.write_text(json.dumps({'name': 'My voice', 'path': str(source)}))
    previous = metadata.read_bytes()
    def fail(*args):
        raise ValueError('Kayıt uygun değil')
    monkeypatch.setattr(cloning, 'prepare_reference', fail)
    with pytest.raises(ValueError):
        cloning.select_profile(tmp_path, Model(), profile_id)
    assert metadata.read_bytes() == previous
    assert source.read_bytes() == b'original'
    assert not list(tmp_path.glob('pending-*'))


def test_failed_or_cancelled_clone_does_not_publish_half_a_profile(tmp_path, monkeypatch):
    monkeypatch.setattr(cloning, 'prepare_reference', prepare_stub)
    source = tmp_path / 'source.mp3'; source.write_bytes(b'original')
    directory = tmp_path / 'voices'
    class BrokenModel(Model):
        def voice_from_file(self, *args, **kwargs):
            raise RuntimeError('model failed')
    with pytest.raises(RuntimeError):
        cloning.create_profile(directory, BrokenModel(), source, 'voice')
    assert list(directory.iterdir()) == []
    with pytest.raises(InterruptedError):
        cloning.create_profile(directory, Model(), source, 'voice', lambda: True)
    assert list(directory.iterdir()) == []


def test_delete_removes_only_profile_and_validates_id(tmp_path):
    profile_id = str(uuid4())
    for suffix in ('.json', '.mp3', '.wav'):
        (tmp_path / (profile_id + suffix)).write_bytes(b'data')
    unrelated = tmp_path / 'keep.mp3'; unrelated.write_bytes(b'keep')
    cloning.delete_profile(tmp_path, profile_id)
    assert list(tmp_path.iterdir()) == [unrelated]
    with pytest.raises(ValueError):
        cloning.delete_profile(tmp_path, '../keep')

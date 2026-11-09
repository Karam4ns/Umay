import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).parents[1] / 'speech'))
from turkish_speech import speech_parts, stream_speech


def spoken(text):
    return ' '.join(part.text for part in speech_parts(text))


@pytest.mark.parametrize(('text', 'expected'), [
    ('4.', 'dördüncü'), ('1.', 'birinci'), ('2.', 'ikinci'),
    ('3.', 'üçüncü'), ('6.', 'altıncı'), ('8.', 'sekizinci'),
    ('10.', 'onuncu'), ('20.', 'yirminci'), ('40.', 'kırkıncı'),
    ('100.', 'yüzüncü'), ('1000.', 'bininci'), ('42.', 'kırk ikinci'),
    ('4. adımı aç.', 'dördüncü adımı aç.'),
    ('Bu 21. örneğimiz.', 'Bu yirmi birinci örneğimiz.'),
    ('8’inci ve 12’nci adımlar.', 'sekizinci ve on ikinci adımlar.'),
    ('Yarışta 4. oldu.', 'Yarışta dördüncü oldu.'),
    ('Lig sıralamasında 4. Devam edelim.', 'Lig sıralamasında dört. Devam edelim.'),
    ("TRT'den ve trt'de.", 'tereteden ve teretede.'),
    ('TRT’nin, TDK’den, THY’de.', 'teretenin, tedekeden, teheyede.'),
    ('TBMM ile PTT.', 'tebememe ile petete.'),
    ('PDF ve USB.', 'pedefe ve usebe.'),
    ('Dr. Ayşe, Prof. Ali.', 'Doktor Ayşe, Profesör Ali.'),
    ('4.11.2026 tarihinde.', 'dört Kasım iki bin yirmi altı tarihinde.'),
    ('4. Kasım 2026', 'dört Kasım iki bin yirmi altı'),
    ('Saat 09.15 oldu.', 'Saat dokuz on beş oldu.'),
    ('1.234 kişi, 3,14 puan.', 'bin iki yüz otuz dört kişi, üç virgül on dört puan.'),
    ('Sonuç 4. Devam edelim.', 'Sonuç dört. Devam edelim.'),
    ('**4.** adım: **TRT**.', 'dördüncü adım: terete.'),
    ('TÜBİTAK ve ASELSAN.', 'Tübitak ve Aselsan.'),
    ('etrt ve trtlik.', 'etrt ve trtlik.'),
])
def test_pronunciation_without_corrupting_dates_numbers_or_words(text, expected):
    assert spoken(text) == expected


def test_punctuation_keeps_clause_context_and_distinguishes_pauses():
    parts = speech_parts('Merhaba, Kazım; seni dinliyorum: hazır mısın? Harika! Düşünelim… Devam edelim.')
    assert [p.text for p in parts] == [
        'Merhaba, Kazım; seni dinliyorum: hazır mısın?', 'Harika!',
        'Düşünelim.', 'Devam edelim.',
    ]
    assert [p.pause_ms for p in parts] == [220, 200, 320, 0]


def test_list_items_and_paragraphs_do_not_run_together():
    parts = speech_parts('4. Dinle.\n5. Konuş.\n\nHazır mısın?')
    assert [p.text for p in parts] == ['dördüncü, Dinle.', 'beşinci, Konuş.', 'Hazır mısın?']
    assert [p.pause_ms for p in parts] == [260, 320, 0]


def test_streaming_is_immediate_preserves_clone_and_closes_on_barge_in():
    calls, closed = [], []
    stopped = False

    class Model:
        sample_rate = 24000

        def stream(self, text, **options):
            calls.append((text, options))
            try:
                yield np.ones(100, dtype=np.float32)
                yield np.ones(100, dtype=np.float32)
            finally:
                closed.append(text)

    stream = stream_speech(Model(), 'TRT hazır. 4. adımı aç.', 'cloned-voice', lambda: stopped)
    assert calls == []  # Lazy generation, no whole-answer synthesis.
    assert len(next(stream)) == 100
    assert calls == [('terete hazır.', {'voice': 'cloned-voice', 'sentence_gap_ms': 0})]
    stopped = True
    assert list(stream) == []
    assert closed == ['terete hazır.']


def test_pause_is_pcm_audio_without_leading_or_trailing_silence():
    class Model:
        sample_rate = 24000

        def stream(self, text, **options):
            yield np.ones(32, dtype=np.float32)

    chunks = list(stream_speech(Model(), 'Hazır mısın? Evet.', 'female_1', lambda: False))
    assert [len(c) for c in chunks] == [32, 5280, 32]
    assert np.all(chunks[1] == 0)
    assert chunks[1].dtype == np.float32


def test_empty_text_produces_no_audio():
    assert speech_parts('... !!!') == []


def test_separate_speech_request_prepends_only_the_requested_continuation_pause():
    class Model:
        sample_rate = 24000
        def stream(self, text, **options):
            yield np.ones(32, dtype=np.float32)
    first = list(stream_speech(Model(), 'Merhaba.', 'clone', lambda: False))
    continuation = list(stream_speech(Model(), 'Hazır mısın?', 'clone', lambda: False, pause_before_ms=180))
    assert [len(chunk) for chunk in first] == [32]
    assert [len(chunk) for chunk in continuation] == [4320, 32]
    assert np.all(continuation[0] == 0)
    assert list(stream_speech(Model(), 'Eski ses.', 'clone', lambda: True, pause_before_ms=180)) == []


@pytest.mark.parametrize('pause', [-1, 321, float('inf'), float('nan'), '180', True])
def test_continuation_pause_is_bounded(pause):
    with pytest.raises(ValueError):
        list(stream_speech(object(), 'Merhaba.', 'clone', lambda: False, pause_before_ms=pause))


def test_existing_supported_emotion_tag_is_not_spoken_as_a_word():
    assert [p.text for p in speech_parts('[sakin] TRT hazır. Başlayalım.')] == [
        '[sakin] terete hazır.', '[sakin] Başlayalım.',
    ]

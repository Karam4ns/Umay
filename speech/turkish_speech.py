"""Turkish pronunciation and punctuation for speech only; never rewrite chat text.

TDK describes the functions of punctuation, not pause lengths. Millisecond values
below are conservative playback choices. Commas, colons and semicolons stay in
the model's sentence so it can keep their intonation and grammatical context.
"""
from dataclasses import dataclass
import re


# Respellings, not expanded organisation names. Joining letter names also keeps
# an apostrophe suffix attached to the last spoken letter: TRT'den -> tereteden.
PRONUNCIATIONS = {
    'TRT': 'terete', 'TDK': 'tedeke', 'TBMM': 'tebememe', 'PTT': 'petete',
    'THY': 'teheye', 'ABD': 'abede', 'AB': 'abe', 'BM': 'beme',
    'BDT': 'bedete', 'BDDK': 'bededeke', 'TFF': 'tefefe', 'TV': 'teve',
    'TC': 'tece', 'CHP': 'cehepe', 'MHP': 'mehepe', 'AKP': 'akepe',
    'SGK': 'segeke', 'YKS': 'yekese', 'KPSS': 'kepesese', 'LGS': 'legese',
    'ÖSYM': 'öseyeme', 'MSB': 'mesebe', 'TSK': 'teseke',
    'HTML': 'hetemele', 'CSS': 'cesese', 'PDF': 'pedefe', 'USB': 'usebe',
}
_ACRONYM = re.compile(r'(?<!\w)(' + '|'.join(sorted(PRONUNCIATIONS, key=len, reverse=True)) + r')(?!\w)', re.I)
_ORDINAL_ENDINGS = dict(zip(
    'sıfır bir iki üç dört beş altı yedi sekiz dokuz on yirmi otuz kırk elli altmış yetmiş seksen doksan yüz bin milyon milyar trilyon'.split(),
    'sıfırıncı birinci ikinci üçüncü dördüncü beşinci altıncı yedinci sekizinci dokuzuncu onuncu yirminci otuzuncu kırkıncı ellinci altmışıncı yetmişinci sekseninci doksanıncı yüzüncü bininci milyonuncu milyarıncı trilyonuncu'.split(),
))
# A number followed by a period can also be a sentence end. Only clear ordinal
# contexts are changed; "Sonuç 4. Devam edelim." must remain a cardinal.
_ORDINAL_NOUNS = (
    'adım', 'sıra', 'sırada', 'kez', 'defa', 'gün', 'hafta', 'ay', 'yıl',
    'kat', 'bölüm', 'sezon', 'sınıf', 'madde', 'sayfa', 'paragraf', 'satır',
    'sütun', 'çeyrek', 'tur', 'etap', 'yarış', 'oyun', 'dakika', 'saniye',
    'sokak', 'cadde', 'bulvar', 'blok', 'daire', 'yüzyıl', 'kısım', 'bölge',
    'fıkra', 'derece', 'sürüm', 'örne[kğ]', 'soru', 'seçene[kğ]', 'kişi', 'öğe',
)
_ORDINAL_CONTEXT = re.compile(
    r'(?<![\w.,])(\d{1,12})\.\s+(?=(?:' + '|'.join(_ORDINAL_NOUNS) + r')[a-zçğıöşüâîû]*\b)', re.I)
_ORDINAL_SUFFIX = re.compile(r"\b(\d{1,12})\.?['’](?:[ıiuü]nc[ıiuü]|nc[ıiuü])\b", re.I)
_LIST = re.compile(r'(?m)^(\s*)(\d{1,12})[.)](?=\s+\S)')
_STANDALONE = re.compile(r'^\s*(\d{1,12})\.\s*$')
_RANK = re.compile(r'((?:sıralamada|yarışta|yarışmada|ligde|listede)\s+)(\d{1,12})\.(?!\d)', re.I)
_ELLIPSIS_TOKEN = 'umayüçnoktabeklemesi'
_MONTHS = 'ocak|şubat|mart|nisan|mayıs|haziran|temmuz|ağustos|eylül|ekim|kasım|aralık'


@dataclass(frozen=True)
class SpeechPart:
    text: str
    pause_ms: int = 0  # Silence AFTER this part, only when another part follows.


def _ordinal(digits, normalize):
    words = normalize(digits).split()
    words[-1] = _ORDINAL_ENDINGS[words[-1]]
    return ' '.join(words)


def _rank(match, normalize):
    following = match.string[match.end():].lstrip()
    ending = '.' if not following or following[0].isupper() else ''
    return match[1] + _ordinal(match[2], normalize) + ending


def _clean_markdown(text):
    # Presentation marks are not mathematical operators. Keep actual 2 * 3.
    text = re.sub(r'!\[([^\]]*)\]\([^\n)]*\)', r'\1', text)
    text = re.sub(r'\[([^\]]+)\]\([^\n)]*\)', r'\1', text)
    text = re.sub(r'(?m)^\s{0,3}#{1,6}\s+', '', text)
    text = re.sub(r'(?m)^\s*[-*•]\s+', '', text)
    text = re.sub(r'(\*\*|__)(.+?)\1', r'\2', text)
    text = re.sub(r'(?<!\w)([*_])([^\n]+?)\1(?!\w)', r'\2', text)
    return text.replace('`', '')


def speech_parts(text, normalize=None):
    """Prepare bounded speech chunks using the installed TTS number/date rules.

    Abbreviations, ordinals and dates are resolved BEFORE sentence splitting.
    No extra model or remote request is needed. Speech begins with the first
    streamed model chunk; we do not wait to synthesize the entire answer.
    """
    if normalize is None:
        from pocket_tts_turkish.normalizer import normalize
    emotion = re.match(r'^\s*\[(mutlu|üzgün|kızgın|şaşkın|sakin)\]\s*', str(text), re.I)
    tag = f'[{emotion[1].lower()}] ' if emotion else ''
    if emotion:
        text = str(text)[emotion.end():]
    text = _clean_markdown(str(text)).replace('\r\n', '\n').replace('\r', '\n')
    text = text.replace('’', "'")
    text = _ACRONYM.sub(lambda m: PRONUNCIATIONS[m[0].upper()], text)
    # A day before a written month is a date, including the common extra dot.
    text = re.sub(r'\b([0-3]?\d)\.\s+(?=(?:' + _MONTHS + r')\b)', r'\1 ', text, flags=re.I)
    # TDK uses a dot for clock times too. Convert only an explicit clock context;
    # the library already handles colon times, dates and thousands separators.
    text = re.sub(r'\b(saat\s+)([01]?\d|2[0-3])\.([0-5]\d)\b', r'\1\2:\3', text, flags=re.I)
    text = _ORDINAL_SUFFIX.sub(lambda m: _ordinal(m[1], normalize), text)
    text = _ORDINAL_CONTEXT.sub(lambda m: _ordinal(m[1], normalize) + ' ', text)
    text = _RANK.sub(lambda m: _rank(m, normalize), text)
    parts = []
    # Newlines are structural pauses, including list items. Do not flatten them.
    for line in text.split('\n'):
        line = line.strip()
        if not line:
            if parts:
                parts[-1] = SpeechPart(parts[-1].text, 320)
            continue
        alone = _STANDALONE.fullmatch(line)
        if alone:
            line = _ordinal(alone[1], normalize)
        line = _LIST.sub(lambda m: m[1] + _ordinal(m[2], normalize) + ',', line)
        # The dependency turns ellipses into a full stop; retain their distinct
        # pause here, passing a full stop to the actual model for compatibility.
        line = re.sub(r'\.{3,}|…', f' {_ELLIPSIS_TOKEN} ', line)
        line = normalize(line).replace(_ELLIPSIS_TOKEN, '…')
        line = re.sub(r'\s+([.,;:!?…])', r'\1', line)
        # Include punctuation in the model input. Question/exclamation intonation
        # belongs to the acoustic model, not a forced emotion or pitch shift.
        for match in re.finditer(r'[^.!?…]+(?:[.!?…]+|$)', line):
            sentence = match[0].strip()
            if not any(ch.isalnum() for ch in sentence):
                continue
            pause = 320 if sentence.endswith('…') else 220 if sentence.endswith('?') else 200 if sentence.endswith('!') else 180
            parts.append(SpeechPart(tag + sentence.replace('…', '.'), pause))
        if parts:
            parts[-1] = SpeechPart(parts[-1].text, max(parts[-1].pause_ms, 260))
    # Last part has no artificial trailing silence.
    if parts:
        parts[-1] = SpeechPart(parts[-1].text)
    return parts


def stream_speech(model, text, voice, cancelled, *, pause_before_ms=0):
    """Yield model audio and short punctuation pauses; close inference on barge-in."""
    import numpy as np
    if type(pause_before_ms) not in (int,float) or not 0 <= pause_before_ms <= 320:
        raise ValueError('Konuşma aralığı 0–320 ms olmalı.')
    parts=speech_parts(text)
    if parts and pause_before_ms and not cancelled():
        yield np.zeros(round(model.sample_rate * pause_before_ms / 1000), dtype=np.float32)
    for part in parts:
        if cancelled():
            return
        stream = model.stream(part.text, voice=voice, sentence_gap_ms=0)
        try:
            for chunk in stream:
                if cancelled():
                    return
                yield chunk
        finally:
            close = getattr(stream, 'close', None)
            if close:
                close()
        if part.pause_ms and not cancelled():
            yield np.zeros(round(model.sample_rate * part.pause_ms / 1000), dtype=np.float32)

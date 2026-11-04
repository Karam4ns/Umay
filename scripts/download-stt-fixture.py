"""Fetch the public, attributed Turkish FLEURS fixture; never extract archive paths."""
import hashlib
import io
import json
from pathlib import Path
import tarfile
from urllib.request import urlopen

EXPECTED = 'f507d1fa88b8cab1829732472c87fe51320ce180d7020c6fa621516404a1e751'
target = Path(__file__).resolve().parents[1] / '.superpowers' / 'stt-speech.wav'
if not target.exists() or hashlib.sha256(target.read_bytes()).hexdigest() != EXPECTED:
    with urlopen('https://pypi.org/pypi/sedalib/1.1.0/json', timeout=30) as response:
        release = json.load(response)
    source = next(item for item in release['urls'] if item['packagetype'] == 'sdist')
    with urlopen(source['url'], timeout=60) as response:
        data = response.read(20_000_000)
    if hashlib.sha256(data).hexdigest() != source['digests']['sha256']:
        raise ValueError('Source archive checksum mismatch')
    with tarfile.open(fileobj=io.BytesIO(data), mode='r:gz') as archive:
        member = next(item for item in archive.getmembers() if item.name.endswith('/tests/data/speech.wav'))
        if member.size > 2_000_000 or not member.isfile():
            raise ValueError('Invalid speech fixture')
        audio = archive.extractfile(member).read()
    if hashlib.sha256(audio).hexdigest() != EXPECTED:
        raise ValueError('Speech fixture checksum mismatch')
    target.parent.mkdir(exist_ok=True)
    target.write_bytes(audio)
print('Verified Turkish FLEURS dev recording, Google, CC BY 4.0. See speech/NOTICE.txt.')

import importlib.util
import sys
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

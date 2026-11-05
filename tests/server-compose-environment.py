"""Exercise the deployment's environment encoder through real Compose parsing."""
import ast
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
from uuid import uuid4

tree = ast.parse(Path(sys.argv[1]).read_text())
scope = {}
exec(compile(ast.Module(body=[node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == 'compose_environment'], type_ignores=[]), '<deployment environment>', 'exec'), scope)
encode = scope.get('compose_environment', lambda entries: dict(value.split('=', 1) for value in entries))
expected = {'UMAY_LITERAL': '$UMAY_DEPLOY_LITERAL_TEST:${UMAY_DEPLOY_LITERAL_TEST}:$', 'UMAY_PLAIN': 'Türkçe = value'}
with tempfile.TemporaryDirectory(prefix='umay-compose-test-') as directory:
    file = Path(directory) / 'compose.json'
    image = subprocess.check_output(['docker', 'inspect', '--format', '{{.Image}}', 'veriussu21-chat-worker-1'], text=True).strip()
    file.write_text(json.dumps({'services': {'fixture': {'image': image, 'environment': encode([key + '=' + value for key, value in expected.items()])}}}))
    env = {**os.environ, 'UMAY_DEPLOY_LITERAL_TEST': 'MUST_NOT_REPLACE'}
    compose = ['docker', 'compose', '-p', 'umay-env-test-' + uuid4().hex[:12], '-f', str(file)]
    try:
        subprocess.run(compose + ['create', '--no-build', 'fixture'], capture_output=True, text=True, check=True, env=env)
        container = subprocess.check_output(compose + ['ps', '-aq', 'fixture'], text=True, env=env).strip()
        actual = dict(entry.split('=', 1) for entry in json.loads(subprocess.check_output(['docker', 'inspect', container]))[0]['Config']['Env'] if entry.split('=', 1)[0] in expected)
        assert actual == expected, 'Compose reinterpreted literal runtime environment values'
    finally:
        subprocess.run(compose + ['down', '--volumes'], capture_output=True, text=True, check=True, env=env)
print('PASS actual Docker container environment preserves literal dollar signs and Unicode; isolated fixture removed')

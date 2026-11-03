$ErrorActionPreference = 'Stop'
$workspace = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $workspace
uv python install 3.12
if ($LASTEXITCODE -ne 0) { throw 'Python 3.12 kurulamadı.' }
if (!(Test-Path '.venv/Scripts/python.exe')) { uv venv --python 3.12 .venv }
uv pip sync --python .venv/Scripts/python.exe speech/requirements-lock.txt
if ($LASTEXITCODE -ne 0) { throw 'Ses bağımlılıkları kurulamadı.' }
$pythonPath = (& .venv/Scripts/python.exe -c 'import sys;print(sys.base_prefix)').Trim()
if (!(Test-Path -LiteralPath (Join-Path $pythonPath 'python.exe'))) { throw 'Python kaynağı bulunamadı.' }
New-Item -ItemType Directory -Force runtime | Out-Null
Copy-Item -Path (Join-Path $pythonPath '*') -Destination runtime -Recurse -Force
Copy-Item -Path '.venv/Lib/site-packages/*' -Destination 'runtime/Lib/site-packages' -Recurse -Force
& runtime/python.exe -c 'import torch,ctranslate2,pocket_tts_turkish;print(1)'
if ($LASTEXITCODE -ne 0) { throw 'Paketlenmiş Python doğrulaması başarısız.' }

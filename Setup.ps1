$ErrorActionPreference='Stop'
Push-Location $PSScriptRoot
try {
  & python -m venv .venv
  if($LASTEXITCODE){throw 'Environment creation failed'}
  & .\.venv\Scripts\python.exe -m pip install -r requirements.txt
  if($LASTEXITCODE){throw 'Python dependency installation failed'}
  & npm.cmd ci
  if($LASTEXITCODE){throw 'Node dependency installation failed'}
} finally { Pop-Location }

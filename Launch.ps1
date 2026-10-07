$ErrorActionPreference='Stop'
Push-Location $PSScriptRoot
$previousPython=$env:MACRODECK_PYTHON
try {
  $env:MACRODECK_PYTHON=Join-Path $PSScriptRoot '.venv\Scripts\python.exe'
  if (-not (Test-Path -LiteralPath $env:MACRODECK_PYTHON)) { throw 'Run Setup.ps1 first.' }
  & npm.cmd run dev
  if($LASTEXITCODE){throw 'Application failed to start'}
} finally { $env:MACRODECK_PYTHON=$previousPython; Pop-Location }

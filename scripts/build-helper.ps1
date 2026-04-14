$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$python = "C:\Users\alan\AppData\Local\Programs\Python\Python39\python.exe"
$helperScript = Join-Path $projectRoot "scripts\macropad_backend.py"
$releaseDir = Join-Path $projectRoot "release-helper"
$workDir = Join-Path $projectRoot "build-helper"
$specPath = Join-Path $projectRoot "macropad_backend.spec"
$libusbCandidates = @(
  $env:PYUSB_LIBUSB_PATH,
  "C:\Program Files\Elgato\StreamDeck\libusb-1.0.dll",
  "C:\Program Files (x86)\Steam\libusb-1.0.dll",
  "C:\Program Files (x86)\Logitech\LogiTune\data\drivers\RightSight\libusb-1.0.dll"
) | Where-Object { $_ -and (Test-Path -LiteralPath $_) }

if (-not (Test-Path -LiteralPath $python)) {
  throw "Python runtime not found at $python"
}

if (-not (Test-Path -LiteralPath $helperScript)) {
  throw "Helper script not found at $helperScript"
}

if (-not $libusbCandidates) {
  throw "Could not find libusb-1.0.dll. Set PYUSB_LIBUSB_PATH or install a compatible libusb runtime."
}

$libusbPath = $libusbCandidates[0]

Remove-Item -Recurse -Force $releaseDir -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force $workDir -ErrorAction SilentlyContinue
Remove-Item -Force $specPath -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path $releaseDir | Out-Null
New-Item -ItemType Directory -Path $workDir | Out-Null

& $python -m PyInstaller `
  --noconfirm `
  --clean `
  --onefile `
  --name macropad_backend `
  --distpath $releaseDir `
  --workpath $workDir `
  --specpath $projectRoot `
  $helperScript

Copy-Item -LiteralPath $libusbPath -Destination (Join-Path $releaseDir "libusb-1.0.dll") -Force

Write-Output "HELPER_READY:$releaseDir"

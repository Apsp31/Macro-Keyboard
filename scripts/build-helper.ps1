$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$python = if ($env:MACRODECK_PYTHON) { $env:MACRODECK_PYTHON } else { Join-Path $projectRoot ".venv\Scripts\python.exe" }
if (-not (Test-Path -LiteralPath $python)) { $python = (Get-Command python -ErrorAction Stop).Source }
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

$libusbPath = @($libusbCandidates)[0]

foreach ($directory in @($releaseDir, $workDir)) {
  $resolved = [IO.Path]::GetFullPath($directory)
  if (-not $resolved.StartsWith([IO.Path]::GetFullPath($projectRoot) + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw "Unsafe generated-output path: $resolved" }
  if (Test-Path -LiteralPath $resolved) { Remove-Item -LiteralPath $resolved -Recurse -Force }
  New-Item -ItemType Directory -Path $resolved | Out-Null
}
if (Test-Path -LiteralPath $specPath) { Remove-Item -LiteralPath $specPath -Force }

& $python -m PyInstaller `
  --noconfirm `
  --clean `
  --onefile `
  --name macropad_backend `
  --distpath $releaseDir `
  --workpath $workDir `
  --specpath $projectRoot `
  $helperScript
if ($LASTEXITCODE -ne 0) { throw "PyInstaller failed with exit code $LASTEXITCODE" }

Copy-Item -LiteralPath $libusbPath -Destination (Join-Path $releaseDir "libusb-1.0.dll") -Force

Write-Output "HELPER_READY:$releaseDir"

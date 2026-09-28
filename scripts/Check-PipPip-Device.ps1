param(
  [string]$Serial = '',
  [int]$ApiPort = 4174,
  [switch]$InstallDebugApks,
  [string]$CustomerApk = '',
  [string]$PartnerApk = ''
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot
if ($ApiPort -lt 1024 -or $ApiPort -gt 65535) {
  throw 'Choose a non-privileged local API port (1024-65535).'
}

# Use only the operator's explicit Android device; never reset an emulator or modify unrelated apps.
$adbTool = Get-Command adb -ErrorAction SilentlyContinue
if ($null -ne $adbTool) { $adb = $adbTool.Source }
elseif (Test-Path 'C:\Android\Sdk\platform-tools\adb.exe') { $adb = 'C:\Android\Sdk\platform-tools\adb.exe' }
elseif ($env:ANDROID_HOME -and (Test-Path (Join-Path $env:ANDROID_HOME 'platform-tools\adb.exe'))) {
  $adb = Join-Path $env:ANDROID_HOME 'platform-tools\adb.exe'
}
else { throw 'Android platform-tools (adb) not found. Install/configure Android SDK first.' }

try {
  $health = Invoke-RestMethod -Uri "http://127.0.0.1:$ApiPort/api/health" -TimeoutSec 5
} catch {
  throw "Local fictional API on 127.0.0.1:$ApiPort is not responding. In another PowerShell terminal run: cd C:\Projects\CargoX; " + '$env:PORT=' + "$ApiPort; npm.cmd run dev:demo"
}
if ($health.ok -ne $true -or $health.mode -ne 'local-only-demo' -or $health.readyForProduction -ne $false) {
  throw 'The selected endpoint is not the approved fictional loopback demo API. Refusing device setup.'
}

$lines = @(& $adb devices)
if ($LASTEXITCODE -ne 0) { throw 'adb devices failed.' }
$devices = @($lines | Where-Object { $_ -match '^([^\s]+)\s+device\s*$' } |
    ForEach-Object { [regex]::Match($_, '^([^\s]+)').Groups[1].Value })
if ($Serial) {
  if ($devices -notcontains $Serial) { throw "Device '$Serial' not authorized/connected. Check adb devices." }
} elseif ($devices.Count -eq 1) {
  $Serial = $devices[0]
} else {
  throw "Expected exactly one authorized device; found $($devices.Count). Use -Serial after verifying adb devices."
}

& $adb -s $Serial reverse "tcp:$ApiPort" "tcp:$ApiPort"
if ($LASTEXITCODE -ne 0) { throw 'adb reverse failed. Reconnect and authorize USB debugging.' }
$maps = @(& $adb -s $Serial reverse --list)
if ($LASTEXITCODE -ne 0 -or -not ($maps -match "tcp:$ApiPort\s+tcp:$ApiPort")) {
  throw "Port forwarding did not appear in adb reverse --list for $Serial."
}
Write-Host "PASS: $Serial can reach the test-host API using adb reverse tcp:$ApiPort." -ForegroundColor Green

if (-not $InstallDebugApks) {
  Write-Host 'No apps have been installed or modified. To install, rerun with -InstallDebugApks after reviewing the build.' -ForegroundColor Yellow
  exit 0
}

if (-not $CustomerApk) { $CustomerApk = Join-Path $repo 'apps\customer\build\app\outputs\flutter-apk\app-debug.apk' }
if (-not $PartnerApk) { $PartnerApk = Join-Path $repo 'apps\partner\build\app\outputs\flutter-apk\app-debug.apk' }
if (-not (Test-Path $CustomerApk -PathType Leaf)) { throw "Missing Customer APK: $CustomerApk" }
if (-not (Test-Path $PartnerApk -PathType Leaf)) { throw "Missing Partner APK: $PartnerApk" }

foreach ($entry in @(@('Customer', $CustomerApk), @('Partner', $PartnerApk))) {
  $label = $entry[0]
  $path = $entry[1]
  Write-Host "Installing $label debug APK on the explicitly selected device $Serial..."
  & $adb -s $Serial install -r $path
  if ($LASTEXITCODE -ne 0) { throw "$label APK install failed; do not assume either app is ready." }
}
Write-Host 'Both debug APK installs completed. This is not a completed on-device ride test.' -ForegroundColor Green
Write-Host 'Launch PIP PIP and PIP PIP Partner manually. Complete the exact checklist in docs/PIP_PIP_ANDROID_QA.md.'

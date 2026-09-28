param([switch]$SkipAndroid, [string]$DemoApi = 'http://127.0.0.1:4173')
$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot
function Invoke-Checked([string]$Tool, [string[]]$Arguments) {
  & $Tool @Arguments
  if ($LASTEXITCODE -ne 0) { throw "$Tool $Arguments failed with exit $LASTEXITCODE" }
}
Push-Location $repo
try {
  Invoke-Checked npm @('run','check:demo')
  Invoke-Checked npm @('test')
  Push-Location (Join-Path $repo 'apps/staging-api')
  try {
    Invoke-Checked npm @('ci')
    Invoke-Checked npm @('run','check')
    Invoke-Checked npm @('test')
  } finally { Pop-Location }
  foreach ($package in @('packages/cargox_demo','packages/cargox_ui','apps/customer','apps/partner')) {
    Push-Location (Join-Path $repo $package)
    try {
      Invoke-Checked flutter @('pub','get')
      Invoke-Checked flutter @('analyze')
      Invoke-Checked flutter @('test')
    } finally { Pop-Location }
  }
  Push-Location (Join-Path $repo 'apps/admin')
  try {
    Invoke-Checked npm @('ci')
    Invoke-Checked npm @('run','typecheck')
    Invoke-Checked npm @('run','check:sections')
    Invoke-Checked npm @('run','build')
  } finally { Pop-Location }
  if (-not $SkipAndroid) {
    $socketDir = Join-Path $repo '.local-tmp'
    New-Item -ItemType Directory -Path $socketDir -Force | Out-Null
    $previousJavaOptions = $env:JAVA_TOOL_OPTIONS
    try {
      # Windows JDK AF_UNIX failed with the default temporary path on this machine.
      $env:JAVA_TOOL_OPTIONS = ($previousJavaOptions + ' -Djdk.net.unixdomain.tmpdir="' + $socketDir + '"').Trim()
      foreach ($app in @('customer','partner')) {
        Push-Location (Join-Path $repo "apps/$app")
        try { Invoke-Checked flutter @('build','apk','--debug',"--dart-define=CARGOX_DEMO_API=$DemoApi") }
        finally { Pop-Location }
      }
    } finally { $env:JAVA_TOOL_OPTIONS = $previousJavaOptions }
  }
} finally { Pop-Location }

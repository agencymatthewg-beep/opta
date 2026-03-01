param(
  [string]$ArtifactsPath = "dist-artifacts",
  [int]$MinAliveSeconds = 5,
  [string]$LogFile = "dist-artifacts/windows-smoke.log"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Log {
  param([string]$Message)
  $line = "[{0}] {1}" -f (Get-Date -Format "s"), $Message
  Write-Host $line
  Add-Content -Path $LogFile -Value $line
}

New-Item -ItemType Directory -Force -Path (Split-Path -Parent $LogFile) | Out-Null
Set-Content -Path $LogFile -Value "Windows packaged smoke log"

$allExes = @(Get-ChildItem -Recurse -Path $ArtifactsPath -Filter *.exe -ErrorAction SilentlyContinue)
if ($allExes.Count -eq 0) {
  throw "No .exe artifacts found under '$ArtifactsPath'"
}

$preferred = $allExes | Where-Object { $_.Name -ieq "opta-code.exe" } | Select-Object -First 1
if (-not $preferred) {
  $candidateList = $allExes | ForEach-Object { $_.FullName } | Sort-Object
  throw "Unable to find packaged app executable 'opta-code.exe'. Available executables:`n$($candidateList -join "`n")"
}

$exePath = $preferred.FullName
Write-Log "Selected executable: $exePath"

$process = $null
try {
  $process = Start-Process -FilePath $exePath -PassThru -WindowStyle Hidden
  Write-Log "Started process PID=$($process.Id)"
  Start-Sleep -Seconds $MinAliveSeconds
  $process.Refresh()

  if ($process.HasExited) {
    throw "Process exited too early with code $($process.ExitCode)"
  }

  Write-Log "Process stayed alive for $MinAliveSeconds seconds."
} finally {
  if ($process -and -not $process.HasExited) {
    Write-Log "Stopping process PID=$($process.Id)"
    Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
  }
}

Write-Log "Packaged smoke test passed."

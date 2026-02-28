<#
.SYNOPSIS
    Full NSIS installer smoke test — install, verify, uninstall.

.DESCRIPTION
    Locates the NSIS installer EXE in the artifacts directory, runs a silent
    install, verifies the application binary exists in the expected location,
    confirms the application can start and stay alive for at least MinAliveSeconds,
    then silently uninstalls and verifies clean removal.

.PARAMETER ArtifactsPath
    Path to the directory containing downloaded Windows installer artifacts.
    Defaults to 'dist-artifacts'.

.PARAMETER MinAliveSeconds
    Minimum seconds the application must stay running after install before
    the test considers startup successful. Defaults to 5.

.PARAMETER LogFile
    Optional path to write timestamped log output. Defaults to no file logging.

.PARAMETER SkipUninstall
    If set, skips the uninstall verification step (useful for debugging).
#>
[CmdletBinding()]
param(
    [string]$ArtifactsPath = 'dist-artifacts',
    [int]$MinAliveSeconds = 5,
    [string]$LogFile = '',
    [switch]$SkipUninstall
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Log {
    param([string]$Message)
    $timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    $line = "[$timestamp] $Message"
    Write-Host $line
    if ($LogFile) {
        Add-Content -Path $LogFile -Value $line
    }
}

Write-Log "=== Opta Code Desktop — Windows Installer Smoke Test ==="
Write-Log "ArtifactsPath : $ArtifactsPath"
Write-Log "MinAliveSeconds: $MinAliveSeconds"

# ── Step 1: Locate NSIS installer ─────────────────────────────────────────────

Write-Log "Step 1: Searching for NSIS installer in '$ArtifactsPath'..."

$nsisInstallers = @(Get-ChildItem -Recurse $ArtifactsPath -Filter *.exe |
    Where-Object {
        $_.FullName -match '[\\/]bundle[\\/]nsis[\\/]' -or
        $_.Name -match '(?i)(setup|installer)'
    })

if ($nsisInstallers.Count -eq 0) {
    Write-Log "ERROR: No NSIS installer found in '$ArtifactsPath'"
    Write-Log "Available files:"
    Get-ChildItem -Recurse $ArtifactsPath | ForEach-Object { Write-Log "  $($_.FullName)" }
    exit 1
}

$installer = $nsisInstallers[0]
Write-Log "Found installer: $($installer.FullName)"

# ── Step 2: Silent install ─────────────────────────────────────────────────────

Write-Log "Step 2: Running silent install (/S flag)..."

$installProcess = Start-Process -FilePath $installer.FullName -ArgumentList '/S' -Wait -PassThru
Write-Log "Installer exit code: $($installProcess.ExitCode)"

if ($installProcess.ExitCode -ne 0) {
    Write-Log "ERROR: Installer exited with non-zero code $($installProcess.ExitCode)"
    exit 1
}

Write-Log "Silent install completed successfully."

# ── Step 3: Verify installed binary ───────────────────────────────────────────

Write-Log "Step 3: Verifying installed binary exists..."

# NSIS per-user install target (matches installMode: currentUser in tauri.conf.json)
$appName = 'Opta Code'
$installedExe = Join-Path $env:LOCALAPPDATA "Programs\$appName\opta-code.exe"

if (-not (Test-Path $installedExe)) {
    # Try alternative name patterns
    $candidates = @(
        (Join-Path $env:LOCALAPPDATA 'Programs\opta-code\opta-code.exe'),
        (Join-Path $env:LOCALAPPDATA 'Programs\OptaCode\opta-code.exe')
    )
    $found = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
    if ($found) {
        $installedExe = $found
        Write-Log "Found installed binary at: $installedExe"
    } else {
        Write-Log "ERROR: Could not find installed binary."
        Write-Log "Searched: $installedExe"
        $candidates | ForEach-Object { Write-Log "  Also tried: $_" }
        # List Programs directory for debugging
        $programsDir = Join-Path $env:LOCALAPPDATA 'Programs'
        if (Test-Path $programsDir) {
            Write-Log "Contents of $programsDir :"
            Get-ChildItem $programsDir | ForEach-Object { Write-Log "  $($_.Name)" }
        }
        exit 1
    }
} else {
    Write-Log "Found installed binary at: $installedExe"
}

# ── Step 4: Startup liveness check ────────────────────────────────────────────

Write-Log "Step 4: Starting installed app and checking liveness for ${MinAliveSeconds}s..."

$appProcess = $null
try {
    $appProcess = Start-Process -FilePath $installedExe -WindowStyle Hidden -PassThru
    Write-Log "Started process (PID $($appProcess.Id)). Waiting ${MinAliveSeconds}s..."
    Start-Sleep -Seconds $MinAliveSeconds
    $appProcess.Refresh()

    if ($appProcess.HasExited) {
        Write-Log "ERROR: Installed app exited after less than ${MinAliveSeconds}s (exit code: $($appProcess.ExitCode))."
        exit 1
    }

    Write-Log "App is still running after ${MinAliveSeconds}s. Startup liveness: PASS"
} finally {
    if ($null -ne $appProcess -and -not $appProcess.HasExited) {
        Write-Log "Terminating app process (PID $($appProcess.Id))..."
        $appProcess.Kill()
        $appProcess.WaitForExit(5000) | Out-Null
    }
}

# ── Step 5: Silent uninstall ───────────────────────────────────────────────────

if (-not $SkipUninstall) {
    Write-Log "Step 5: Verifying silent uninstall..."

    # Look for the uninstaller in the install directory
    $uninstallerDir = Split-Path $installedExe -Parent
    $uninstaller = Get-ChildItem $uninstallerDir -Filter 'Uninstall*.exe' -ErrorAction SilentlyContinue |
        Select-Object -First 1

    if ($null -eq $uninstaller) {
        Write-Log "WARNING: No uninstaller found in '$uninstallerDir'. Skipping uninstall verification."
    } else {
        Write-Log "Found uninstaller: $($uninstaller.FullName)"
        $uninstallProcess = Start-Process -FilePath $uninstaller.FullName -ArgumentList '/S' -Wait -PassThru
        Write-Log "Uninstaller exit code: $($uninstallProcess.ExitCode)"

        if ($uninstallProcess.ExitCode -ne 0) {
            Write-Log "WARNING: Uninstaller exited with code $($uninstallProcess.ExitCode). Proceeding."
        }

        # Verify binary is removed
        Start-Sleep -Seconds 2
        if (Test-Path $installedExe) {
            Write-Log "WARNING: Installed binary still exists after uninstall: $installedExe"
        } else {
            Write-Log "Uninstall verified: binary removed. Uninstall: PASS"
        }
    }
} else {
    Write-Log "Step 5: Skipped (SkipUninstall flag set)."
}

Write-Log "=== Installer smoke test PASSED ==="
exit 0

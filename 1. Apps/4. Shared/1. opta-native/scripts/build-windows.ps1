# Windows build script for Opta
# 
# This script builds Opta for Windows with DX12 backend support.
#
# Usage:
#   .\build-windows.ps1           # Release build
#   .\build-windows.ps1 -Debug    # Debug build
#   .\build-windows.ps1 -Sign     # Release build with code signing
#
# Requirements:
#   - Rust toolchain with x86_64-pc-windows-msvc target
#   - Visual Studio Build Tools (for MSVC linker)
#   - Windows SDK (for DX12 headers)

param(
    [switch]$Debug,
    [switch]$Sign,
    [switch]$Help
)

$ErrorActionPreference = "Stop"

# Colors for output
function Write-Info { Write-Host $args -ForegroundColor Cyan }
function Write-Success { Write-Host $args -ForegroundColor Green }
function Write-Warning { Write-Host $args -ForegroundColor Yellow }
function Write-Error { Write-Host $args -ForegroundColor Red }

if ($Help) {
    Write-Host @"
Opta Windows Build Script

Usage:
    .\build-windows.ps1 [options]

Options:
    -Debug    Build debug configuration instead of release
    -Sign     Sign the binary with available code signing certificate
    -Help     Show this help message

Requirements:
    - Rust toolchain (rustup)
    - Visual Studio Build Tools 2019+ or Visual Studio 2019+
    - Windows SDK 10.0.17763.0 or later

Examples:
    .\build-windows.ps1              # Standard release build
    .\build-windows.ps1 -Debug       # Debug build for development
    .\build-windows.ps1 -Sign        # Release build with code signing
"@
    exit 0
}

Write-Info "=========================================="
Write-Info "       Opta Windows Build Script          "
Write-Info "=========================================="
Write-Host ""

# Check Rust installation
Write-Info "Checking Rust installation..."
try {
    $rustVersion = rustc --version
    Write-Success "Found: $rustVersion"
} catch {
    Write-Error "Rust not found. Please install from https://rustup.rs"
    exit 1
}

# Check/add Windows MSVC target
Write-Info "Ensuring Windows MSVC target is installed..."
$targets = rustup target list --installed
if ($targets -notcontains "x86_64-pc-windows-msvc") {
    Write-Info "Adding x86_64-pc-windows-msvc target..."
    rustup target add x86_64-pc-windows-msvc
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to add Windows MSVC target"
        exit 1
    }
}
Write-Success "Target x86_64-pc-windows-msvc is available"

# Determine build configuration
$buildType = if ($Debug) { "debug" } else { "release" }
$buildFlags = if ($Debug) { @() } else { @("--release") }

Write-Host ""
Write-Info "Build Configuration:"
Write-Host "  Type: $buildType"
Write-Host "  Target: x86_64-pc-windows-msvc"
Write-Host "  Sign: $Sign"
Write-Host ""

# Build the project
Write-Info "Building Opta for Windows ($buildType)..."
$buildArgs = @("build") + $buildFlags + @("--target", "x86_64-pc-windows-msvc")

# Add feature flags
$buildArgs += @("--features", "dx12")

Write-Host "Running: cargo $($buildArgs -join ' ')"
Write-Host ""

cargo @buildArgs
if ($LASTEXITCODE -ne 0) {
    Write-Error "Build failed!"
    exit 1
}

Write-Success "Build completed successfully!"

# Determine output path
$outputDir = "target/x86_64-pc-windows-msvc/$buildType"
$exePath = "$outputDir/opta.exe"

# Check if binary exists (might be a library-only crate)
if (Test-Path $exePath) {
    Write-Host ""
    Write-Info "Output binary: $exePath"
    
    # Get file info
    $fileInfo = Get-Item $exePath
    $sizeMB = [math]::Round($fileInfo.Length / 1MB, 2)
    Write-Host "  Size: $sizeMB MB"
    Write-Host "  Modified: $($fileInfo.LastWriteTime)"
    
    # Code signing (if requested and certificate available)
    if ($Sign) {
        Write-Host ""
        Write-Info "Looking for code signing certificate..."
        
        $cert = Get-ChildItem -Path Cert:\CurrentUser\My -CodeSigningCert | Select-Object -First 1
        
        if ($cert) {
            Write-Info "Found certificate: $($cert.Subject)"
            Write-Info "Signing binary..."
            
            try {
                Set-AuthenticodeSignature -FilePath $exePath -Certificate $cert -TimestampServer "http://timestamp.digicert.com"
                
                $sig = Get-AuthenticodeSignature -FilePath $exePath
                if ($sig.Status -eq "Valid") {
                    Write-Success "Binary signed successfully!"
                } else {
                    Write-Warning "Signing completed but status is: $($sig.Status)"
                }
            } catch {
                Write-Warning "Failed to sign binary: $_"
            }
        } else {
            Write-Warning "No code signing certificate found in CurrentUser\My store"
            Write-Host "  To sign binaries, import a code signing certificate first."
        }
    }
} else {
    Write-Info "No executable produced (this is a library crate)"
    Write-Host "  Static library: $outputDir/opta_render.lib"
}

Write-Host ""
Write-Success "=========================================="
Write-Success "           Build Complete!                "
Write-Success "=========================================="

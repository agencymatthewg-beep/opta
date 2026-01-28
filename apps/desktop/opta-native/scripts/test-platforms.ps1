# Opta Cross-Platform Testing Script for Windows
# Tests all core functionality on Windows

$ErrorActionPreference = "Continue"

# Track test results
$TestsPassed = 0
$TestsFailed = 0

# Project paths
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir

# Set up Python path for MCP module imports
$env:PYTHONPATH = "$ProjectRoot\mcp-server\src;$env:PYTHONPATH"

Write-Host "=== Opta Platform Testing ===" -ForegroundColor Blue
Write-Host "Platform: Windows" -ForegroundColor Yellow
Write-Host ""

# Test function
function Run-Test {
    param(
        [string]$TestName,
        [scriptblock]$TestScript
    )

    Write-Host -NoNewline "Testing: $TestName... "

    try {
        & $TestScript | Out-Null
        Write-Host "PASS" -ForegroundColor Green
        $script:TestsPassed++
        return $true
    }
    catch {
        Write-Host "FAIL" -ForegroundColor Red
        $script:TestsFailed++
        return $false
    }
}

# Test function with output
function Run-TestVerbose {
    param(
        [string]$TestName,
        [scriptblock]$TestScript
    )

    Write-Host "Testing: $TestName" -ForegroundColor Blue

    try {
        $output = & $TestScript 2>&1
        Write-Host "PASS" -ForegroundColor Green
        Write-Host ($output | Select-Object -First 5 | Out-String)
        $script:TestsPassed++
        return $true
    }
    catch {
        Write-Host "FAIL" -ForegroundColor Red
        Write-Host $_.Exception.Message
        $script:TestsFailed++
        return $false
    }
}

# Change to MCP server directory
Set-Location "$ProjectRoot\mcp-server"

Write-Host "=== 1. MCP Server Tests ===" -ForegroundColor Blue

# Test hardware telemetry - CPU
Run-TestVerbose "CPU telemetry" {
    uv run python -c "from opta_mcp.telemetry import get_cpu_info; import json; print(json.dumps(get_cpu_info(), indent=2))"
}

# Test hardware telemetry - Memory
Run-TestVerbose "Memory telemetry" {
    uv run python -c "from opta_mcp.telemetry import get_memory_info; import json; print(json.dumps(get_memory_info(), indent=2))"
}

# Test hardware telemetry - Disk
Run-TestVerbose "Disk telemetry" {
    uv run python -c "from opta_mcp.telemetry import get_disk_info; import json; print(json.dumps(get_disk_info(), indent=2))"
}

# Test hardware telemetry - GPU
Run-TestVerbose "GPU telemetry (platform-dependent)" {
    uv run python -c "from opta_mcp.telemetry import get_gpu_info; import json; print(json.dumps(get_gpu_info(), indent=2))"
}

# Test system snapshot
Run-TestVerbose "System snapshot" {
    uv run python -c "from opta_mcp.telemetry import get_system_snapshot; import json; r = get_system_snapshot(); print(f'CPU: {r[`"cpu`"][`"percent`"]}%, Memory: {r[`"memory`"][`"percent`"]}%')"
}

Write-Host ""
Write-Host "=== 2. Process Management Tests ===" -ForegroundColor Blue

# Test process listing
Run-TestVerbose "Process listing" {
    uv run python -c "from opta_mcp.processes import get_process_list; procs = get_process_list(); print(f'Found {len(procs)} processes')"
}

# Test process categorization
Run-TestVerbose "Process categorization" {
    uv run python -c @"
from opta_mcp.processes import get_process_list
procs = get_process_list()
categories = {}
for p in procs:
    cat = p.get('category', 'unknown')
    categories[cat] = categories.get(cat, 0) + 1
print(f'Categories: {categories}')
"@
}

Write-Host ""
Write-Host "=== 3. Conflict Detection Tests ===" -ForegroundColor Blue

# Test conflict detection
Run-TestVerbose "Conflict detection" {
    uv run python -c "from opta_mcp.conflicts import get_conflict_summary; import json; r = get_conflict_summary(); print(f'Found {r[`"total_count`"]} conflicts')"
}

Write-Host ""
Write-Host "=== 4. Game Detection Tests ===" -ForegroundColor Blue

# Test game detection
Run-TestVerbose "Game detection" {
    uv run python -c @"
from opta_mcp.games import detect_all_games
import json
result = detect_all_games()
print(f'Total games: {result["total_games"]}')
for launcher in result['launchers']:
    status = 'installed' if launcher['installed'] else 'not found'
    print(f'  {launcher["name"]}: {launcher["game_count"]} games ({status})')
"@
}

Write-Host ""
Write-Host "=== 5. LLM Connectivity Tests ===" -ForegroundColor Blue

# Test Ollama status
Run-TestVerbose "Local LLM (Ollama) status" {
    uv run python -c @"
from opta_mcp.llm import check_ollama_status
import json
status = check_ollama_status()
print(f'Ollama available: {status.get("available", False)}')
if status.get('available'):
    print(f'Models: {status.get("models", [])}')
"@
}

Write-Host ""
Write-Host "=== 6. Frontend Build Test ===" -ForegroundColor Blue
Set-Location $ProjectRoot

# Test frontend build
Run-Test "Frontend build (npm run build)" {
    npm run build
}

Write-Host ""
Write-Host "=== 7. Platform-Specific Path Tests ===" -ForegroundColor Blue
Set-Location "$ProjectRoot\mcp-server"

# Test platform paths
Run-TestVerbose "Platform detection" {
    uv run python -c @"
from opta_mcp.games import get_platform, LAUNCHERS
import platform

plat = get_platform()
print(f'Detected platform: {plat}')
print(f'Python platform.system(): {platform.system()}')

# Verify paths are correct for this platform
for launcher_id, launcher in LAUNCHERS.items():
    paths = launcher.get('paths', {}).get(plat, [])
    print(f'  {launcher["name"]} paths: {len(paths)} configured')
"@
}

Write-Host ""
Write-Host "=== 8. Scoring System Tests ===" -ForegroundColor Blue

# Test scoring module
Run-TestVerbose "Scoring system" {
    uv run python -c @"
from opta_mcp.scoring import get_hardware_tier
import json
tier = get_hardware_tier()
print(f'Hardware tier: {tier.get("tier", "unknown")}')
print(f'Price range: {tier.get("price_range", "unknown")}')
"@
}

Write-Host ""
Write-Host "==================================================" -ForegroundColor Blue
Write-Host "=== Test Summary ===" -ForegroundColor Blue
Write-Host "==================================================" -ForegroundColor Blue
Write-Host "Platform: Windows" -ForegroundColor Yellow
Write-Host "Passed: $TestsPassed" -ForegroundColor Green
Write-Host "Failed: $TestsFailed" -ForegroundColor Red

if ($TestsFailed -eq 0) {
    Write-Host "All tests passed!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "Some tests failed. Review output above." -ForegroundColor Red
    exit 1
}

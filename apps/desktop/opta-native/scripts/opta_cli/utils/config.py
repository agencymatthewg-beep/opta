"""Configuration constants for Opta CLI."""

from pathlib import Path

# Project root directory
PROJECT_ROOT = Path(__file__).parent.parent.parent.parent.resolve()

# Development server ports
PORTS = {
    "vite": 1420,
    "hmr": 1421,
}

# Snapshot storage directory
SNAPSHOT_DIR = PROJECT_ROOT / ".opta" / "snapshots"

# Process patterns to match when killing
PROCESS_PATTERNS = [
    "tauri",
    "vite",
    "opta",
    "node.*opta",
]

# Directories to clean
CLEAN_DIRS = {
    "dist": PROJECT_ROOT / "dist",
    "rust_target": PROJECT_ROOT / "src-tauri" / "target",
}

# Deep clean directories (optional)
DEEP_CLEAN_DIRS = {
    "node_modules": PROJECT_ROOT / "node_modules",
    "mcp_venv": PROJECT_ROOT / "mcp-server" / ".venv",
}

# Required environment variables
REQUIRED_ENV_VARS = [
    "ANTHROPIC_API_KEY",
]

# Opta Development Task Runner
# Install: brew install just
# Usage: just <command>

# Default: show available commands
default:
    @just --list

# ============================================
# DEVELOPMENT
# ============================================

# Launch full Tauri desktop app
dev:
    ./scripts/opta dev

# Launch frontend only (browser at localhost:1420)
web:
    ./scripts/opta dev --web

# Restart: kill and relaunch desktop app
restart:
    ./scripts/opta nuke --keep-deps
    ./scripts/opta dev

# ============================================
# PROCESS MANAGEMENT
# ============================================

# Kill all processes + clean builds
nuke:
    ./scripts/opta nuke

# Kill processes only (keep build cache)
kill:
    ./scripts/opta nuke --keep-deps

# Deep clean (also removes node_modules/.venv)
clean:
    ./scripts/opta nuke --deep

# ============================================
# UPDATES & DEPENDENCIES
# ============================================

# Pull latest + install all dependencies
update:
    ./scripts/opta update

# Quick npm install
install:
    npm install

# ============================================
# SNAPSHOTS
# ============================================

# Create snapshot (usage: just snap <name>)
snap name:
    ./scripts/opta snap {{name}}

# Restore from snapshot (usage: just restore <name>)
restore name:
    ./scripts/opta restore {{name}}

# List available snapshots
snapshots:
    @ls -1 .opta/snapshots/*.json 2>/dev/null | xargs -I {} basename {} .json || echo "No snapshots found"

# ============================================
# BUILD & PRODUCTION
# ============================================

# Build production desktop app
build:
    npm run build
    npx tauri build

# Type check without emitting
check:
    npx tsc --noEmit

# ============================================
# UTILITIES
# ============================================

# Watch Rust backend for changes (requires cargo-watch)
watch-rust:
    cd src-tauri && cargo watch -x check

# Open project in VS Code
code:
    code .

# Show CLI help
help:
    ./scripts/opta --help

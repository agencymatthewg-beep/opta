#!/bin/bash
# Opta development aliases for macOS
#
# The main 'opta' command is now the Python CLI in scripts/opta
# These aliases provide quick shortcuts that use the CLI
#
# Add to your ~/.zshrc:
#   source /Users/matthewbyrden/Documents/Opta/scripts/opta-aliases.sh
#
# Then restart your terminal or run: source ~/.zshrc

OPTA_DIR="/Users/matthewbyrden/Documents/Opta"
OPTA_CLI="$OPTA_DIR/scripts/opta"

# ============================================
# CORE COMMANDS
# ============================================

# Main CLI access
alias o="$OPTA_CLI"
alias opta="$OPTA_CLI"

# ============================================
# DEVELOPMENT
# ============================================

# Start Tauri desktop app
alias o-dev="$OPTA_CLI dev"
alias opta-dev="$OPTA_CLI dev"

# Start frontend only (browser at localhost:1420)
alias o-web="$OPTA_CLI dev --web"
alias opta-web="$OPTA_CLI dev --web"

# Restart: kill and relaunch
alias o-restart="$OPTA_CLI nuke --keep-deps && $OPTA_CLI dev"
alias opta-restart="$OPTA_CLI nuke --keep-deps && $OPTA_CLI dev"

# ============================================
# PROCESS MANAGEMENT
# ============================================

# Kill all Opta processes + clean builds
alias o-nuke="$OPTA_CLI nuke"
alias opta-nuke="$OPTA_CLI nuke"

# Kill processes only (keep build cache)
alias o-kill="$OPTA_CLI nuke --keep-deps"
alias opta-kill="$OPTA_CLI nuke --keep-deps"

# Deep clean (also removes node_modules/.venv)
alias o-clean="$OPTA_CLI nuke --deep"
alias opta-clean="$OPTA_CLI nuke --deep"

# ============================================
# UPDATES & DEPENDENCIES
# ============================================

# Pull latest + install dependencies
alias o-update="$OPTA_CLI update"
alias opta-update="$OPTA_CLI update"

# Quick npm install
alias o-install="cd $OPTA_DIR && npm install"
alias opta-install="cd $OPTA_DIR && npm install"

# ============================================
# SNAPSHOTS
# ============================================

# Create snapshot
alias o-snap="$OPTA_CLI snap"
alias opta-snap="$OPTA_CLI snap"

# Restore from snapshot
alias o-restore="$OPTA_CLI restore"
alias opta-restore="$OPTA_CLI restore"

# ============================================
# BUILD & PRODUCTION
# ============================================

# Build production app
alias o-build="cd $OPTA_DIR && npm run build && npx tauri build"
alias opta-build="cd $OPTA_DIR && npm run build && npx tauri build"

# Type check
alias o-check="cd $OPTA_DIR && npx tsc --noEmit"
alias opta-check="cd $OPTA_DIR && npx tsc --noEmit"

# ============================================
# NAVIGATION
# ============================================

# Quick cd to project
alias o-cd="cd $OPTA_DIR"
alias opta-cd="cd $OPTA_DIR"

# Open project in VS Code
alias o-code="code $OPTA_DIR"
alias opta-code="code $OPTA_DIR"

# Open project in Finder
alias o-finder="open $OPTA_DIR"
alias opta-finder="open $OPTA_DIR"

# ============================================
# HELP
# ============================================

alias o-help="$OPTA_CLI --help"
alias opta-help="$OPTA_CLI --help"

echo "Opta aliases loaded. Commands: o, o-dev, o-web, o-nuke, o-kill, o-update, o-snap, o-restore, o-build, o-check, o-cd"

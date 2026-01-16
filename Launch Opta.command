#!/bin/bash
# Double-click this file to launch Opta
# =====================================

cd "$(dirname "$0")"

echo "🚀 Starting Opta..."
echo ""

# Check if just is installed
if command -v just &> /dev/null; then
    just dev
else
    echo "Note: 'just' not found, using npm directly..."
    echo ""
    npm run tauri dev
fi

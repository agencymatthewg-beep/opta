#!/bin/bash
# Double-click this file to stop all Opta processes
# =================================================

cd "$(dirname "$0")"

echo "🛑 Stopping Opta..."
echo ""

if command -v just &> /dev/null; then
    just kill
else
    pkill -f 'opta|tauri|vite' 2>/dev/null || true
fi

echo ""
echo "✓ Opta stopped"
echo ""
echo "Press any key to close..."
read -n 1

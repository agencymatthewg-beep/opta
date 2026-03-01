#!/bin/bash
set -e

echo "Starting macOS build and sign process for Opta Code Desktop (Universal)..."
cd "$(dirname "$0")/.."

# Build the Tauri app (this also signs it since we provide APPLE_SIGNING_IDENTITY)
echo "Building Tauri app..."
npm run tauri build

echo "Build complete!"

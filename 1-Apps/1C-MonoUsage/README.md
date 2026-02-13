# MonoUsage

macOS menubar app that displays AI API spend and provider status at a glance. Shows a running total (e.g. `$1.23 ¥50`) and expands to a dashboard with per-provider status, usage bars, and spend details.

## Contents
- **Sources/** - SwiftUI menubar app (SPM executable target)
- **backend/** - Node.js scripts that fetch API usage data

## Usage
```bash
# Build and run via SPM
swift build
swift run MonoUsage

# Or open in Xcode
open Package.swift
```

## Backend
```bash
cd backend && npm install
npm run refresh    # Sync keys + fetch all API data → data/latest.json
```

## Requirements
- Swift 5.9+ / Xcode 15+
- macOS 13+
- Node.js (for backend scripts)

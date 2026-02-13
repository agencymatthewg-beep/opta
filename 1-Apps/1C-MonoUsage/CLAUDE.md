# MonoUsage

Mac Studio resource monitoring - combines Swift Package with Python backend for device usage analytics.

## Tech Stack
- **Swift** 5.9+ (macOS executable target)
- **Python** 3.8+ (backend server)
- **macOS** 13+ minimum

## Key Commands
```bash
# Build Swift package
swift build
swift run MonoUsage

# Run with Xcode
open MonoUsage.xcodeproj

# Backend setup (see backend/README.md)
cd backend && python -m venv venv && source venv/bin/activate
```

## Architecture
```
MonoUsage/
├── Package.swift           # SPM package manifest (Swift 5.9)
├── Sources/MonoUsage/      # Swift executable source
│   └── main.swift
├── Resources/              # App resources & configs
└── backend/                # Python backend server
    ├── config/
    ├── scripts/
    └── data/
```

## Key Features
- Real-time system metrics collection
- Device performance analytics
- Usage pattern insights
- Cross-process monitoring

## Current Status
- Swift package structure established
- Backend framework ready
- Requires Xcode 15+ and Swift 5.9+
- macOS 14+ recommended for full feature set

## Build Notes
- Swift executable target compiles to standalone binary
- Resources processed via SPM
- Backend runs separately (Python)
- Platform target: macOS 13+ (Package.swift)

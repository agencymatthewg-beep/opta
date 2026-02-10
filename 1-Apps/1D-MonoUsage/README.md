# MonoUsage

## Quick Context
- Opta application source code and documentation
- Contains: iOS, macOS, web, CLI implementations
- Use for: building and extending Opta products


Device usage monitoring and analytics app. Tracks system metrics and provides insights into device performance and usage patterns.

## Contents
- **Sources/** - Swift source code
- **backend/** - Backend server (config, scripts, data)

## Usage
Open MonoUsage.xcodeproj in Xcode and build for target platform:
```bash
open MonoUsage.xcodeproj
```

Backend requires Python environment setup. See backend/README.md for backend-specific instructions.

Requires:
- Xcode 15+
- Swift 5.9+
- macOS 14+

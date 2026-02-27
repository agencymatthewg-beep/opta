# opta-mini

## Quick Context
- Opta application source code and documentation
- Contains: iOS, macOS, web, CLI implementations
- Use for: building and extending Opta products


Lightweight menubar companion app for macOS. Provides quick access to Opta features from the menu bar.

## Usage Integration
- Includes direct `Opta Usage` launch action to open `https://usage.optamize.biz`
- Usage analysis and provider connections live in the web dashboard, not inside the menubar UI

## Contents
- **OptaMini/** - Swift source code
- **OptaMini.xcodeproj/** - Xcode project file
- **build/** - Build artifacts

## Usage
Open in Xcode and build for macOS:
```bash
open OptaMini.xcodeproj
```

Or build from command line:
```bash
xcodebuild -scheme OptaMini -configuration Release
```

Requires:
- Xcode 15+
- macOS 14+ deployment target

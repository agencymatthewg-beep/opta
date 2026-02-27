# Opta Life iOS

SwiftUI-based life management companion app with 18 Siri Intent actions.

## Tech Stack
- **Swift** 5.9+ | **SwiftUI** | **iOS 17+**
- **Xcode** 15+ | **SPM** for dependencies
- **GoogleService** (Firebase integration)

## Key Commands
```bash
# Open project
open OptaLMiOS.xcodeproj

# Build & run
Cmd+B (build) | Cmd+R (run)

# Run tests
Cmd+U
```

## Architecture
```
OptaLMiOS/
├── Extensions/          # Siri Intent handlers + app extensions (18 intents)
├── Intents/             # Intent definitions & recognition
├── Models/              # Core data models, app state
├── Services/            # APIs, background tasks, notifications
├── Views/               # SwiftUI components & screens
├── Widgets/             # App Clips, widgets, watch extensions
└── Assets.xcassets/     # Images, colors, app icon
```

## Key Features
- 18 Siri Intents for voice control (task management, reminders, quick actions)
- Widgets for home screen & lock screen
- Real-time sync with backend
- Task automation & scheduling

## Current Status
- **Phase 4** - Implementation underway
- Intents framework integrated
- UI components built in SwiftUI
- Firebase config prepared (GoogleService.xcconfig)
- Requires Xcode 15+ with iOS 17+ SDK

## Build Notes
- Uses `project.yml` for Xcode project generation
- Run `add_files_to_project.rb` if adding new files
- Resources in Assets.xcassets

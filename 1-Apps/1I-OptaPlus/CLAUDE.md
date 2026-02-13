# OptaPlus

Cross-platform design system & productivity UI kit - SwiftUI Package for iOS and macOS with Obsidian Glassmorphism aesthetic.

## Tech Stack
- **Swift** 5.9+ | **SwiftUI** | **SPM**
- **iOS** 17+ | **macOS** 14+
- **Xcode** 15+

## Key Commands
```bash
# Open iOS target
open iOS/OptaPlusIOS.xcodeproj

# Open macOS target  
open macOS/OptaPlusMacOS.xcodeproj

# Build & run (per platform)
Cmd+B | Cmd+R
```

## Architecture
```
OptaPlus/
├── Shared/                 # Cross-platform Swift code & design tokens
│   ├── Tokens/            # Colors, typography, spacing (Obsidian theme)
│   ├── Components/        # Reusable UI components
│   └── Styles/            # Glassmorphism effects & animations
├── iOS/                    # iOS app target
│   └── OptaPlusIOS/
├── macOS/                  # macOS app target
│   └── OptaPlusMacOS/
└── ideas/                  # Feature proposals & design research
```

## Key Features
- Design system with consistent tokens across platforms
- Obsidian Glassmorphism aesthetic (dark theme, blur effects, neon accents)
- Reusable component library
- Cross-platform consistency (iOS 17+, macOS 14+)

## Current Status
- Design tokens finalized (Obsidian theme)
- Component library built in SwiftUI
- iOS & macOS targets configured
- Ready for feature development

## Build Notes
- Shared code compiled into both targets
- No external dependencies (pure SwiftUI)
- Platform-specific views use conditional compilation
- Build with deployment target: iOS 17+, macOS 14+

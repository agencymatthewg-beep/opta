# Opta Plus IOS Temp

Temporary iOS redesign sandbox for OptaPlus.

## Goal
- Mirror the **Saturday app layout pattern** (Home, Plan, Work, Chat, More).
- Re-skin it with **Opta visual language**.
- Append **current Opta iOS pages** after the new shell so feature comparison is possible in one build.

## Structure
- `OptaPlusIOSTemp/Features/Saturday/TempRootView.swift`
  - New Saturday-inspired shell and top-level tab routing.
- `OptaPlusIOSTemp/Core/TempTabRegistry.swift`
  - Defines tab order and legacy page append order.
- `OptaPlusIOSTemp/Features/Legacy/LegacyAppState.swift`
  - Imported/adapted app state bridge for legacy views.
- `OptaPlusIOSTemp/Imported/*`
  - Imported existing iOS view + manager files from the current Opta app.

## Run
```bash
cd "Opta Plus IOS Temp"
xcodegen generate
open OptaPlusIOSTemp.xcodeproj
```

## Verify
```bash
cd "Opta Plus IOS Temp"
xcodebuild -project OptaPlusIOSTemp.xcodeproj \
  -scheme OptaPlusIOSTemp \
  -destination 'platform=iOS Simulator,name=iPhone 17' \
  test
```

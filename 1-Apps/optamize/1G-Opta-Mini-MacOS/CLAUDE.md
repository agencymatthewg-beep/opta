# Opta Mini - Claude Instructions

## Design Philosophy

**CRITICAL CONSTRAINT**: Opta Mini must remain a **simple NSMenu dropdown**. This is non-negotiable.

### Do NOT Add
- Custom popovers or floating windows
- Advanced visualizations (graphs, charts, progress bars)
- Menu bar expansion/widgets
- Complex UI that deviates from standard macOS menu patterns
- Animations beyond standard menu behavior
- Health dashboards or metrics displays
- Menu bar icon color customization (REMOVED)

---

## Menu Structure (EXACT LAYOUT)

The menu MUST follow this exact structure. Do not deviate.

```
┌────────────────────────────┐
│ Opta Ecosystem v1.0        │  ← Header (always first)
├────────────────────────────┤
│ ● Opta AI              ▸   │  ← SECTION 1: All apps with submenus
│ ● Opta macOS           ▸   │     Each app has: status dot, name, submenu arrow
│ ● Opta LM              ▸   │     Submenu contains: Stop/Restart/Launch actions
│ (more apps...)             │
├────────────────────────────┤
│ X of Y running             │  ← Status indicator (keep this)
├────────────────────────────┤
│ Open All Opta Websites     │  ← SECTION 2: Website actions
│ Open Opta Usage            │     Opens usage.optamize.biz dashboard
│ Copy Website Link          │     "Open All" launches ALL Opta URLs in 1 click
├────────────────────────────┤
│ ✓ Notifications            │  ← SECTION 3: Settings (notifications only)
├────────────────────────────┤
│ Restart Opta Mini     ⌥⌘R  │  ← SECTION 4: ALWAYS AT BOTTOM
│ Quit All Opta Apps         │     These 3 items must always be last
│ Quit Opta Mini        ⌘Q   │
└────────────────────────────┘
```

---

## Key Rules

### Section 1: App List
- First section lists ALL Opta apps
- Each app row: status dot (●/○) + app name + submenu arrow (▸)
- Submenu contains actions: Stop, Restart, Launch, Open in Browser (if applicable)
- Add new apps here following same format

### Section 2: Status Indicator
- Show "X of Y running" as disabled text (info only)
- **REMOVED**: "Launch All Opta Apps" button - do not add bulk launch

### Section 3: Website Actions
- "Open All Opta Websites" - opens ALL Opta web URLs in browser with 1 click
  - optamize.biz
  - usage.optamize.biz
  - aicomp.optamize.biz
  - lm.optamize.biz
  - (any future Opta URLs)
- "Open Opta Usage" - opens usage dashboard where providers are connected for deep analysis
- "Copy Website Link" - copies main optamize.biz URL

### Section 4: Settings
- **REMOVED**: "Menu Bar Icon" color picker submenu - do not include
- **KEEP**: "Notifications" toggle only

### Section 5: Footer Actions (ALWAYS AT BOTTOM)
- "Restart Opta Mini" (⌥⌘R)
- "Quit All Opta Apps" - stops all running Opta apps before quitting
- "Quit Opta Mini" (⌘Q)
- These 3 items MUST always be the last items in the menu

---

## Allowed Enhancements
- Add more apps to Section 1 (same row format)
- Add more URLs to "Open All Opta Websites" action
- Add keyboard shortcuts to actions
- Improve status indicator accuracy
- Add app grouping via separators within Section 1

## NOT Allowed
- "Launch All" bulk action (removed)
- Menu bar icon color customization (removed)
- Any items after the footer actions
- Popovers, visualizations, or non-standard UI

---

## Tech Stack
- Pure Swift + SwiftUI
- **NSMenu** (NOT NSPopover)
- NSStatusItem for menu bar icon
- Standard macOS menu bar conventions

## Key Files
- `AppDelegate.swift` - Menu structure and actions
- `Models/OptaApp.swift` - App registry
- `Services/ProcessMonitor.swift` - Status tracking

## Current Apps Managed
1. Opta AI (`com.clawdbot.gateway`) - launchd service
2. Opta macOS (`com.opta.native`) - regular app
3. Opta LM (`com.opta.life-manager`) - launchd service

## When Adding New Apps
1. Add to `OptaApp.allApps` array in `Models/OptaApp.swift`
2. Menu rebuilds automatically via ProcessMonitor observation
3. Follow existing pattern: bundleId, name, icon, type (app or launchdService)

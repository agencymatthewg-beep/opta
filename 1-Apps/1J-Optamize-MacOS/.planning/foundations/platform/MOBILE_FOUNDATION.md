# Mobile Platform Foundation

> Reference this document when any phase involves mobile-ready architecture. Mobile support is **future scope** but architecture should be prepared.

## Overview

While Opta is desktop-first, the architecture should be mobile-ready for future iOS and Android support. This document outlines considerations for mobile-compatible design.

---

## 1. Mobile-Ready Architecture Principles

### 1.1 Abstraction Layer
All platform-specific code should go through abstractions.

```rust
pub trait PlatformCapabilities {
    fn supports_background_execution(&self) -> bool;
    fn supports_system_tray(&self) -> bool;
    fn get_telemetry_interval(&self) -> Duration;
    fn request_permission(&self, permission: Permission) -> bool;
}
```

### 1.2 Responsive UI
Design UI to work across screen sizes.

**Considerations:**
- Use relative sizing (%, rem, vh/vw)
- Design mobile breakpoints even for desktop
- Touch-friendly tap targets (44x44 minimum)
- Avoid hover-dependent interactions

### 1.3 Touch-First Interactions
Design interactions that work with touch.

| Desktop | Mobile Equivalent |
|---------|-------------------|
| Hover | Long press for tooltips |
| Right-click | Long press menu |
| Drag | Swipe gestures |
| Scroll wheel | Touch scroll |

---

## 2. iOS Considerations (Future)

### 2.1 App Store Guidelines
Apple has strict requirements.

**Key Restrictions:**
- No background process monitoring
- No system-level optimization
- No direct hardware access
- App Review required

**Viable Features:**
- Game tracking (user-entered data)
- Cloud sync of settings
- Companion app for desktop
- Remote monitoring dashboard

### 2.2 iOS-Specific APIs
Future mobile features would use:

| Feature | iOS API |
|---------|---------|
| Notifications | UNUserNotificationCenter |
| Background | BGTaskScheduler |
| Storage | FileManager + App Groups |
| Network | URLSession |

### 2.3 Privacy Requirements
iOS requires privacy disclosures.

**Info.plist Keys:**
- `NSUserTrackingUsageDescription`
- `NSLocalNetworkUsageDescription`
- Other usage descriptions as needed

---

## 3. Android Considerations (Future)

### 3.1 Play Store Guidelines
Google has requirements for system apps.

**Key Restrictions:**
- Limited background execution (Doze mode)
- Battery optimization affects services
- Accessibility service restrictions
- Device admin requirements for some features

**Viable Features:**
- Game tracking
- Performance monitoring (limited)
- Cloud sync
- Companion functionality

### 3.2 Android-Specific APIs
Future mobile features would use:

| Feature | Android API |
|---------|-------------|
| Notifications | NotificationManager |
| Background | WorkManager |
| Storage | Context.filesDir / external |
| Network | OkHttp / Retrofit |

### 3.3 Permissions
Android requires explicit permission requests.

**Potential Permissions:**
- `INTERNET`
- `POST_NOTIFICATIONS` (Android 13+)
- `RECEIVE_BOOT_COMPLETED` (if autostart)
- `FOREGROUND_SERVICE` (if monitoring)

---

## 4. Tauri Mobile Support

### 4.1 Tauri Mobile (Alpha)
Tauri has experimental mobile support.

**Current Status:**
- iOS: Alpha quality
- Android: Alpha quality
- Not recommended for production yet

**Configuration:**
```json
{
  "tauri": {
    "bundle": {
      "iOS": {
        "developmentTeam": "TEAM_ID"
      },
      "android": {
        "minSdkVersion": 24
      }
    }
  }
}
```

### 4.2 Shared Codebase Strategy
How to share code between desktop and mobile:

**Shared:**
- UI components (React)
- Business logic (TypeScript)
- API interfaces
- Data models

**Platform-Specific:**
- Native capabilities (Rust per-platform)
- Permission handling
- Background execution
- Push notifications

---

## 5. Battery & Performance

### 5.1 Battery-Conscious Design
Mobile apps must preserve battery.

**Guidelines:**
- Reduce polling frequency on battery
- Batch network requests
- Avoid wake locks
- Use push instead of poll where possible

### 5.2 Mobile Performance
Optimize for mobile constraints.

| Constraint | Desktop | Mobile |
|------------|---------|--------|
| CPU | Abundant | Limited |
| RAM | 8GB+ | 2-4GB |
| Storage | 500GB+ | 32-128GB |
| Network | Stable WiFi | Variable cellular |

---

## 6. Data Sync Architecture

### 6.1 Cloud-First for Mobile
Mobile apps should sync through cloud.

**Architecture:**
```
Desktop Opta ──→ Cloud Backend ←── Mobile Opta
     │                                    │
     └── Full telemetry               Dashboard only
         + optimization
```

### 6.2 Sync Strategy
What to sync for mobile companion:

| Data | Sync Direction | Frequency |
|------|---------------|-----------|
| System status | Desktop → Cloud → Mobile | Real-time |
| Optimization results | Desktop → Cloud → Mobile | On change |
| Settings | Bidirectional | On change |
| Game library | Desktop → Cloud → Mobile | Manual |

---

## 7. Mobile-Ready Code Patterns

### 7.1 Feature Flags
Use feature flags for mobile-specific code.

```rust
pub fn get_telemetry_interval() -> Duration {
    #[cfg(any(target_os = "ios", target_os = "android"))]
    return Duration::from_secs(60); // Battery-friendly

    #[cfg(not(any(target_os = "ios", target_os = "android")))]
    return Duration::from_secs(2); // Desktop frequency
}
```

### 7.2 Capability Detection
Check capabilities before using features.

```typescript
const capabilities = usePlatform();

if (capabilities.backgroundExecution) {
  // Show background monitoring options
} else {
  // Show manual refresh UI
}
```

### 7.3 Graceful Degradation
Provide alternatives when features unavailable.

| Desktop Feature | Mobile Alternative |
|-----------------|-------------------|
| System tray | Push notifications |
| Background monitoring | Manual refresh |
| Process termination | Information only |
| GPU telemetry | Not available |

---

## 8. UI/UX for Mobile

### 8.1 Mobile Navigation
Different navigation patterns for mobile.

**Desktop:**
- Sidebar navigation
- Multiple panels visible
- Keyboard shortcuts

**Mobile:**
- Bottom tab bar
- Single panel with navigation
- Gesture-based actions

### 8.2 Component Adaptations
Components that need mobile variants:

| Component | Desktop | Mobile |
|-----------|---------|--------|
| Sidebar | Fixed left | Bottom sheet or tab bar |
| Chat | Side panel | Full screen |
| Settings | Multi-column | Single column |
| Process list | Table | Card list |

---

## 9. Testing Strategy

### 9.1 Mobile Testing Matrix

**iOS:**
- iPhone SE (small screen)
- iPhone 14/15 (standard)
- iPad (tablet)

**Android:**
- Pixel (stock Android)
- Samsung Galaxy (One UI)
- Budget device (performance testing)

### 9.2 Simulator Testing
Test on simulators before real devices.

- Xcode Simulator (iOS)
- Android Emulator (Android)

---

## 10. Checklist for Mobile-Ready Code

When writing any code, verify:

- [ ] No desktop-only assumptions (hover, system tray)
- [ ] Touch-friendly tap targets
- [ ] Responsive layout considerations
- [ ] Battery-conscious polling intervals
- [ ] Platform capabilities checked before use
- [ ] Graceful degradation for missing features
- [ ] Data sync architecture compatible
- [ ] No hardcoded paths (use platform APIs)
- [ ] Permission handling abstracted
- [ ] Network requests are efficient

---

## 11. Current Status

| Platform | Status | Timeline |
|----------|--------|----------|
| macOS | Production | Now |
| Windows | Production | Now |
| Linux | Production | Now |
| iOS | Not Started | Post v1.0 |
| Android | Not Started | Post v1.0 |

**Recommendation:** Build mobile-ready architecture now, implement mobile apps after desktop is mature.

---

## References

- [Tauri Mobile (Alpha)](https://tauri.app/blog/2022/12/09/tauri-mobile-alpha/)
- [iOS Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)
- [Android Material Design](https://material.io/design)
- [Responsive Web Design Principles](https://web.dev/responsive-web-design-basics/)

# macOS Platform Foundation

> Reference this document when any phase involves macOS-specific functionality.

## Overview

macOS provides unique native APIs and behaviors that Opta leverages for optimal performance and user experience. This document outlines key considerations for macOS development.

---

## 1. App Lifecycle & Power Management

### 1.1 App Nap
macOS automatically throttles apps that aren't visible to save battery.

**Considerations:**
- Telemetry polling may be affected when app is backgrounded
- Active optimizations must disable App Nap temporarily
- Use `NSProcessInfo.processInfo.beginActivity()` to prevent throttling

**Implementation:**
```rust
#[cfg(target_os = "macos")]
fn disable_app_nap() {
    // Use objc crate to call NSProcessInfo
    // beginActivityWithOptions:reason:
}
```

### 1.2 Sudden Termination
macOS may terminate apps suddenly during logout/shutdown.

**Considerations:**
- Save state before critical operations
- Register for `NSApplicationWillTerminate` notification
- Avoid long-running operations during shutdown

---

## 2. GPU & Metal

### 2.1 Metal Framework
macOS uses Metal for GPU access (not OpenGL/Vulkan by default).

**Considerations:**
- GPU telemetry must use IOKit or system_profiler
- Metal Performance Shaders available for GPU compute
- Apple Silicon has unified memory architecture

**GPU Detection:**
```rust
#[cfg(target_os = "macos")]
fn get_gpu_info() {
    // Use system_profiler SPDisplaysDataType
    // Or IOKit for direct hardware access
}
```

### 2.2 Apple Silicon vs Intel
Different approaches needed for M1/M2/M3 vs Intel Macs.

| Aspect | Apple Silicon | Intel |
|--------|--------------|-------|
| Architecture | arm64 | x86_64 |
| GPU | Integrated (powerful) | Discrete or integrated |
| Memory | Unified | Separate |
| Rosetta | Apps may run translated | Native |

---

## 3. User Interface Integration

### 3.1 Menu Bar (System Tray)
macOS uses the menu bar for always-visible app access.

**Implementation:**
- Use `NSStatusItem` for menu bar icon
- Support both icon-only and icon+text modes
- Implement dropdown menu with quick actions

**Best Practices:**
- Use template images (auto dark/light mode)
- Keep menu items minimal and relevant
- Support keyboard shortcuts in menu

### 3.2 Dock Integration
The Dock provides app launching and status indication.

**Features:**
- Badge count (e.g., conflict count)
- Progress indicator (for long operations)
- Bounce for attention (notifications)

**Implementation:**
```rust
#[cfg(target_os = "macos")]
fn set_dock_badge(count: u32) {
    // Use NSApp.dockTile.badgeLabel
}
```

### 3.3 Spotlight Integration
macOS Spotlight can index app content.

**Opportunities:**
- Index game names for quick search
- Index optimization profiles
- Deep link to specific app sections

---

## 4. Notifications

### 4.1 User Notification Center
macOS uses `UNUserNotificationCenter` for notifications.

**Requirements:**
- Request notification permission
- Support notification actions (buttons)
- Handle notification responses

**Best Practices:**
- Use notification categories for different alert types
- Support critical alerts for important warnings
- Respect user notification preferences

---

## 5. Security & Permissions

### 5.1 App Sandbox
macOS apps should be sandboxed for security.

**Entitlements Needed:**
- `com.apple.security.network.client` - Network access
- `com.apple.security.files.user-selected.read-write` - File access
- Custom entitlements for hardware access

### 5.2 Gatekeeper & Notarization
Apps must be signed and notarized for distribution.

**Requirements:**
- Developer ID certificate
- Notarization via Apple
- Stapled ticket for offline verification

### 5.3 Hardened Runtime
Required for notarization.

**Flags:**
- `--options runtime` during signing
- Specific entitlements for JIT, debugging, etc.

---

## 6. File System

### 6.1 Standard Paths
macOS uses specific locations for app data.

| Purpose | Path |
|---------|------|
| App Support | `~/Library/Application Support/Opta/` |
| Preferences | `~/Library/Preferences/com.opta.optimizer.plist` |
| Caches | `~/Library/Caches/com.opta.optimizer/` |
| Logs | `~/Library/Logs/Opta/` |

### 6.2 Bookmarks & Security-Scoped Access
For accessing user-selected files outside sandbox.

---

## 7. Process Management

### 7.1 System Processes
Critical macOS processes that should NEVER be terminated:

```
windowserver, loginwindow, coreaudiod, airportd,
bluetoothd, mds, mds_stores, diskarbitrationd,
configd, launchd, kernel_task, UserEventAgent
```

### 7.2 Activity Monitor Parity
Opta's process list should match Activity Monitor behavior.

---

## 8. Testing on macOS

### 8.1 Test Matrix
- macOS 11 (Big Sur) - Minimum supported
- macOS 12 (Monterey)
- macOS 13 (Ventura)
- macOS 14 (Sonoma)
- macOS 15 (Sequoia)

### 8.2 Hardware Targets
- Apple Silicon (M1, M2, M3, M4)
- Intel (both discrete and integrated GPU)

---

## 9. Checklist for macOS Features

When implementing macOS-specific features, verify:

- [ ] Works on both Apple Silicon and Intel
- [ ] Respects App Nap behavior (or properly disables)
- [ ] Uses correct standard paths
- [ ] Signed and notarized for distribution
- [ ] Menu bar icon uses template image
- [ ] Dock badge updates correctly
- [ ] Notifications follow UNUserNotificationCenter patterns
- [ ] Critical system processes protected

---

## References

- [Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/macos)
- [Tauri macOS Guide](https://tauri.app/guides/building/macos/)
- [App Sandbox Design Guide](https://developer.apple.com/library/archive/documentation/Security/Conceptual/AppSandboxDesignGuide/)

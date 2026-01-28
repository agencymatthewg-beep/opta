# Windows Platform Foundation

> Reference this document when any phase involves Windows-specific functionality.

## Overview

Windows provides rich native APIs for taskbar integration, notifications, and system management. This document outlines key considerations for Windows development.

---

## 1. App Lifecycle & Power Management

### 1.1 Background Execution
Windows allows background apps but respects battery saver mode.

**Considerations:**
- Register for power notifications (`WM_POWERBROADCAST`)
- Reduce polling frequency on battery
- Support Modern Standby / Connected Standby

### 1.2 Windows Service
For always-running background functionality.

**Options:**
- System tray app (recommended for Opta)
- Windows Service (for enterprise deployment)
- Startup registration via registry

---

## 2. GPU & Graphics

### 2.1 GPU Detection
Windows supports multiple GPU vendors with different APIs.

**Detection Methods:**
- DXGI for DirectX-capable GPUs
- WMI `Win32_VideoController`
- NVIDIA NVML for detailed NVIDIA stats
- AMD ADL for AMD GPU stats

**Implementation:**
```rust
#[cfg(target_os = "windows")]
fn get_gpu_info() {
    // Use WMI or DXGI enumeration
    // Support NVIDIA, AMD, Intel
}
```

### 2.2 Multi-GPU Systems
Windows gaming PCs often have multiple GPUs.

**Considerations:**
- Detect all GPUs (integrated + discrete)
- Identify active GPU for games
- Support NVIDIA Optimus / AMD Switchable Graphics

---

## 3. User Interface Integration

### 3.1 Taskbar Jump Lists
Quick access to app functions from taskbar icon.

**Implementation:**
- Use `ICustomDestinationList` API
- Register common tasks (Optimize, Stealth Mode)
- Show recent games list

**Categories:**
- Tasks: Fixed actions (always shown)
- Recent: Recently accessed items
- Custom: App-defined categories

```rust
#[cfg(target_os = "windows")]
fn setup_jump_list() {
    // Create ICustomDestinationList
    // Add tasks and recent items
}
```

### 3.2 Taskbar Progress
Show progress in taskbar button.

**States:**
- `TBPF_NOPROGRESS` - No progress
- `TBPF_INDETERMINATE` - Spinning
- `TBPF_NORMAL` - Green progress bar
- `TBPF_ERROR` - Red (error state)
- `TBPF_PAUSED` - Yellow (paused)

**Implementation:**
```rust
#[cfg(target_os = "windows")]
fn set_taskbar_progress(progress: f32, state: ProgressState) {
    // Use ITaskbarList3::SetProgressValue
    // Use ITaskbarList3::SetProgressState
}
```

### 3.3 System Tray
Always-visible icon in notification area.

**Features:**
- Icon with tooltip
- Left-click: Show/hide window
- Right-click: Context menu
- Balloon notifications (legacy)

**Best Practices:**
- Use high-DPI aware icons
- Keep context menu concise
- Support notification area overflow

---

## 4. Notifications

### 4.1 Toast Notifications
Windows 10/11 use Toast notifications.

**Features:**
- Rich content (text, images, progress)
- Action buttons
- Quick reply
- Scheduled notifications

**Requirements:**
- App must have AppUserModelID
- Register notification activator (for actions)
- XML notification template

**Implementation:**
```rust
#[cfg(target_os = "windows")]
fn send_toast(title: &str, body: &str) {
    // Use Windows.UI.Notifications
    // or windows-rs ToastNotification
}
```

### 4.2 Notification Permissions
Windows 11 has Focus Assist / Do Not Disturb.

**Considerations:**
- Respect Focus Assist settings
- Support priority notifications (if enabled)
- Fallback to system tray balloon

---

## 5. Security & Permissions

### 5.1 User Account Control (UAC)
Elevation required for system modifications.

**Considerations:**
- Most Opta features don't need elevation
- Some optimizations may require admin
- Use `ShellExecute` with `runas` for elevation

### 5.2 Windows Defender
May flag unknown executables.

**Solutions:**
- Code signing with EV certificate
- Submit to Microsoft SmartScreen
- Include clear publisher information

### 5.3 Firewall
Windows Firewall may block network access.

**Considerations:**
- Prompt for firewall exception on first run
- Document required ports for MCP server

---

## 6. File System

### 6.1 Standard Paths
Windows uses specific locations for app data.

| Purpose | Path |
|---------|------|
| App Data | `%APPDATA%\Opta\` |
| Local App Data | `%LOCALAPPDATA%\Opta\` |
| Program Data | `%PROGRAMDATA%\Opta\` |
| Temp | `%TEMP%\Opta\` |

### 6.2 Registry
For settings and startup registration.

**Keys:**
- Settings: `HKCU\Software\Opta`
- Startup: `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`

**Best Practices:**
- Use HKCU for user settings (no admin needed)
- Clean up registry on uninstall
- Support Group Policy for enterprise

---

## 7. Process Management

### 7.1 System Processes
Critical Windows processes that should NEVER be terminated:

```
csrss.exe, smss.exe, services.exe, lsass.exe,
svchost.exe, wininit.exe, winlogon.exe, dwm.exe,
explorer.exe (carefully), System, Registry
```

### 7.2 Process Termination
Use `TerminateProcess` or `taskkill` equivalent.

**Considerations:**
- Some processes require elevation to terminate
- Service processes need `StopService` API
- Protected processes cannot be terminated

---

## 8. High-DPI Support

### 8.1 DPI Awareness
Windows supports multiple DPI scaling modes.

**Recommended:**
- Per-Monitor DPI Awareness v2
- Declare in manifest: `<dpiAwareness>PerMonitorV2</dpiAwareness>`

**Considerations:**
- Scale UI elements properly
- Use vector icons or provide multiple resolutions
- Test on 100%, 125%, 150%, 200% scaling

---

## 9. WebView2 Runtime

### 9.1 Tauri on Windows
Tauri uses WebView2 (Chromium-based).

**Distribution Options:**
- Evergreen (requires runtime download)
- Fixed Version (bundle specific version)
- Embed Bootstrapper (auto-install)

**Recommendation:** Embed Bootstrapper for best user experience.

---

## 10. Testing on Windows

### 10.1 Test Matrix
- Windows 10 (1909+) - Minimum supported
- Windows 11 21H2
- Windows 11 22H2
- Windows 11 23H2

### 10.2 Hardware Targets
- NVIDIA GPU systems
- AMD GPU systems
- Intel integrated graphics
- Multi-GPU configurations

---

## 11. Checklist for Windows Features

When implementing Windows-specific features, verify:

- [ ] Works on Windows 10 and 11
- [ ] High-DPI aware (Per-Monitor v2)
- [ ] Jump List properly configured
- [ ] System tray icon and menu working
- [ ] Toast notifications functional
- [ ] Respects Focus Assist settings
- [ ] Code signed for SmartScreen
- [ ] WebView2 bundling configured
- [ ] Registry cleanup on uninstall
- [ ] Critical system processes protected

---

## References

- [Windows App Development](https://docs.microsoft.com/en-us/windows/apps/)
- [Tauri Windows Guide](https://tauri.app/guides/building/windows/)
- [Windows UI Guidelines](https://docs.microsoft.com/en-us/windows/apps/design/)
- [ITaskbarList3 Interface](https://docs.microsoft.com/en-us/windows/win32/api/shobjidl_core/nn-shobjidl_core-itaskbarlist3)

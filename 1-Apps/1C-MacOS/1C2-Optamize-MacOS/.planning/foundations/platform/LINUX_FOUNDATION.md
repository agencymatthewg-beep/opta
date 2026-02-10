# Linux Platform Foundation

> Reference this document when any phase involves Linux-specific functionality.

## Overview

Linux has diverse desktop environments and distributions. This document outlines key considerations for Linux development, focusing on common standards like freedesktop.org.

---

## 1. Desktop Environments

### 1.1 Major Desktop Environments
Linux users may use various DEs.

| DE | Display Server | System Tray | Notifications |
|----|---------------|-------------|---------------|
| GNOME | Wayland/X11 | AppIndicator/SNI | GNotification |
| KDE Plasma | Wayland/X11 | SNI | KNotification |
| XFCE | X11 | SNI | freedesktop |
| Cinnamon | X11 | AppIndicator | freedesktop |
| MATE | X11 | AppIndicator | freedesktop |

### 1.2 Detection
Detect DE for appropriate feature support.

```rust
#[cfg(target_os = "linux")]
fn detect_desktop_env() -> DesktopEnv {
    // Check XDG_CURRENT_DESKTOP
    // Check XDG_SESSION_TYPE (wayland vs x11)
}
```

---

## 2. Display Server

### 2.1 X11 vs Wayland
Linux is transitioning from X11 to Wayland.

| Feature | X11 | Wayland |
|---------|-----|---------|
| Screen capture | Easy | Restricted |
| Global hotkeys | Supported | Limited |
| System tray | Native | Via XDG portal |
| Window positioning | Full control | Compositor controlled |

**Considerations:**
- Test on both X11 and Wayland
- Use XDG Desktop Portals for restricted features
- Graceful degradation when features unavailable

### 2.2 XDG Desktop Portals
Standard interface for sandboxed apps.

**Portals Used:**
- `org.freedesktop.portal.Notification`
- `org.freedesktop.portal.Background`
- `org.freedesktop.portal.Settings` (dark mode)

---

## 3. User Interface Integration

### 3.1 System Tray (Status Notifier)
Linux uses StatusNotifierItem (SNI) protocol.

**Implementation:**
- Use `libappindicator` or `ksni` crate
- Fall back to XEmbed for legacy support
- Some GNOME setups need extension

**Best Practices:**
- Detect tray support before showing icon
- Provide alternative without tray
- Use symbolic icons for consistency

### 3.2 Desktop Entry
Standard `.desktop` file for app launchers.

**Location:** `~/.local/share/applications/opta.desktop`

**Content:**
```ini
[Desktop Entry]
Type=Application
Name=Opta
GenericName=PC Optimizer
Comment=AI-powered PC optimization
Exec=/usr/bin/opta %U
Icon=opta
Terminal=false
Categories=Utility;System;
Keywords=optimization;gaming;performance;
StartupWMClass=opta
```

### 3.3 XDG Autostart
For starting with desktop session.

**Location:** `~/.config/autostart/opta.desktop`

---

## 4. Notifications

### 4.1 freedesktop Notifications
Standard D-Bus notification service.

**Service:** `org.freedesktop.Notifications`

**Features:**
- Basic notifications (title, body, icon)
- Actions (buttons)
- Urgency levels
- Expiration timeout

**Implementation:**
```rust
#[cfg(target_os = "linux")]
fn send_notification(title: &str, body: &str) {
    // Use zbus to call org.freedesktop.Notifications.Notify
}
```

### 4.2 Notification Servers
Different DEs have different servers.

| DE | Server |
|----|--------|
| GNOME | gnome-shell (built-in) |
| KDE | plasma-notify |
| XFCE | xfce4-notifyd |
| Others | dunst, mako, etc. |

---

## 5. D-Bus Integration

### 5.1 Session Bus
For user-level services and communication.

**Common Services:**
- Notifications
- Power management (UPower)
- Network status (NetworkManager)
- Secrets (Secret Service)

### 5.2 System Bus
For system-level services (requires permissions).

**Common Services:**
- `org.freedesktop.login1` - Session management
- `org.freedesktop.UPower` - Battery/power
- `org.freedesktop.systemd1` - Systemd control

---

## 6. Power Management

### 6.1 UPower
D-Bus service for power information.

**Features:**
- Battery percentage and state
- Power source (AC/battery)
- Estimated time remaining

**Implementation:**
```rust
#[cfg(target_os = "linux")]
fn get_power_status() {
    // Connect to org.freedesktop.UPower
    // Query /org/freedesktop/UPower/devices/battery_BAT0
}
```

### 6.2 Power Profiles
Some systems support power profiles.

**Service:** `org.freedesktop.UPower.PowerProfiles`

---

## 7. File System

### 7.1 XDG Base Directory
Standard paths for app data.

| Purpose | Variable | Default |
|---------|----------|---------|
| Config | `$XDG_CONFIG_HOME` | `~/.config/` |
| Data | `$XDG_DATA_HOME` | `~/.local/share/` |
| Cache | `$XDG_CACHE_HOME` | `~/.cache/` |
| Runtime | `$XDG_RUNTIME_DIR` | `/run/user/$UID/` |

**Opta Paths:**
- Config: `~/.config/opta/`
- Data: `~/.local/share/opta/`
- Cache: `~/.cache/opta/`

### 7.2 Game Locations
Common game installation paths.

| Launcher | Path |
|----------|------|
| Steam | `~/.steam/steam/` or `~/.local/share/Steam/` |
| Heroic (Epic/GOG) | `~/.config/heroic/` |
| Lutris | `~/.local/share/lutris/` |

---

## 8. Process Management

### 8.1 System Processes
Critical Linux processes that should NEVER be terminated:

```
systemd (PID 1), init, kthreadd, kernel threads [kworker/*],
dbus-daemon, journald, udevd, NetworkManager,
Xorg/Xwayland (display), gnome-shell/kwin (compositor)
```

### 8.2 Process Termination
Standard signals for process control.

| Signal | Purpose |
|--------|---------|
| SIGTERM (15) | Graceful termination |
| SIGKILL (9) | Force kill (last resort) |
| SIGINT (2) | Interrupt (Ctrl+C) |

---

## 9. Distribution Considerations

### 9.1 Package Formats
Multiple package formats exist.

| Format | Distributions |
|--------|--------------|
| .deb | Debian, Ubuntu, Mint |
| .rpm | Fedora, RHEL, openSUSE |
| AppImage | Universal (recommended) |
| Flatpak | Universal (sandboxed) |
| Snap | Ubuntu ecosystem |

**Recommendation:** AppImage for easiest distribution.

### 9.2 Dependency Differences
Libraries may have different names/versions.

**Common Issues:**
- libssl versions
- glibc versions
- GTK/Qt versions

**Solution:** Bundle dependencies or use AppImage.

---

## 10. GPU & Graphics

### 10.1 GPU Detection
Linux has varied GPU drivers.

| Vendor | Driver | Detection |
|--------|--------|-----------|
| NVIDIA | nvidia (proprietary) | `nvidia-smi` |
| AMD | amdgpu (open) | `radeontop`, sysfs |
| Intel | i915 (open) | sysfs |

**Implementation:**
```rust
#[cfg(target_os = "linux")]
fn get_gpu_info() {
    // Check /sys/class/drm/
    // Use lspci for identification
    // Vendor-specific tools for temps
}
```

### 10.2 Proton/Wine Gaming
Many games run through compatibility layers.

**Considerations:**
- Detect Wine/Proton processes
- Understand game vs compatibility layer
- Steam Play/Proton games in Steam library

---

## 11. Testing on Linux

### 11.1 Test Matrix
- Ubuntu 22.04 LTS (GNOME)
- Fedora (latest, GNOME)
- Arch Linux (various DEs)
- Linux Mint (Cinnamon)

### 11.2 Display Server Testing
- X11 sessions
- Wayland sessions
- Both on same distro

---

## 12. Checklist for Linux Features

When implementing Linux-specific features, verify:

- [ ] Works on GNOME, KDE, and XFCE
- [ ] Works on both X11 and Wayland
- [ ] Uses XDG paths for data storage
- [ ] D-Bus services properly connected
- [ ] System tray works (or gracefully degrades)
- [ ] freedesktop notifications functional
- [ ] Desktop entry properly formatted
- [ ] AppImage bundles all dependencies
- [ ] Critical system processes protected
- [ ] Respects user's DE theme (dark/light)

---

## References

- [freedesktop.org Specifications](https://www.freedesktop.org/wiki/Specifications/)
- [XDG Base Directory](https://specifications.freedesktop.org/basedir-spec/basedir-spec-latest.html)
- [Desktop Entry Specification](https://specifications.freedesktop.org/desktop-entry-spec/latest/)
- [StatusNotifierItem](https://www.freedesktop.org/wiki/Specifications/StatusNotifierItem/)
- [Tauri Linux Guide](https://tauri.app/guides/building/linux/)

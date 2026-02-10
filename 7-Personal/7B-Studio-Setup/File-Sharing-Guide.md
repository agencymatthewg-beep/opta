# Mac Studio File Sharing Guide
## Accessing Files from Any Device

This guide explains how to access files on your Mac Studio from MacBook, iPhone, iPad, or any device on your network.

---

## Quick Reference

| Command | What it does |
|---------|--------------|
| `mount-studio` | Opens ~/Shared in Finder |
| `mount-sync` | Opens ~/Sync in Finder |
| `unmount-studio` | Disconnects the share |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     MAC STUDIO                               │
│                                                              │
│  ~/Projects/Opta/     ← Code (access via VS Code SSH)       │
│  ~/Shared/            ← Large files, assets (SMB share)     │
│  ~/Sync/              ← Notes, ideas (Syncthing optional)   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                              │
              SMB File Sharing (Port 445)
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
   ┌─────────┐          ┌─────────┐          ┌─────────┐
   │ MacBook │          │ iPhone  │          │ Windows │
   │         │          │  iPad   │          │   PC    │
   │ Finder  │          │ Files   │          │ Explorer│
   └─────────┘          └─────────┘          └─────────┘
```

---

## What Goes Where

| Directory | Access Method | Use For |
|-----------|---------------|---------|
| `~/Projects/Opta/` | VS Code SSH | Code editing (Claude needs local access) |
| `~/Shared/` | SMB mount | Large files, assets, exports, builds |
| `~/Sync/` | Syncthing | Notes, ideas, research (auto-synced) |

**Why this split?**
- **Code** stays on Mac Studio so Claude/LLM can read at 7GB/s
- **Shared** is for files you access occasionally (no sync overhead)
- **Sync** is for files you need everywhere, even offline

---

## Setup on Mac Studio (One Time)

### 1. Create the Directories

```bash
ssh mac-studio

# Create shared directories
mkdir -p ~/Shared
mkdir -p ~/Sync
```

### 2. Enable File Sharing

1. Open **System Settings**
2. Go to **General** → **Sharing**
3. Turn ON **File Sharing**
4. Click the **ⓘ** info button
5. Under "Shared Folders", click **+**
6. Add `~/Shared` (and optionally `~/Sync`)
7. Set permissions:
   - Your user: **Read & Write**
   - Everyone: **No Access** (for security)

### 3. Note the Network Address

The sharing panel will show:
```
smb://mac-studio.local
  or
smb://192.168.1.100
```

---

## Accessing from MacBook

### Method 1: Terminal Alias (Recommended)

```bash
mount-studio    # Opens ~/Shared in Finder
```

The share appears at `/Volumes/Shared` after connecting.

### Method 2: Finder Connect

1. Open Finder
2. Press **Cmd+K** (Connect to Server)
3. Enter: `smb://mac-studio/Shared`
4. Click **Connect**
5. Enter Mac Studio password if prompted

### Method 3: Sidebar Shortcut

After connecting once:
1. In Finder sidebar, you'll see "mac-studio"
2. Click it to browse all shared folders
3. Drag folders to sidebar for quick access

---

## Accessing from iPhone / iPad

### Using the Files App

1. Open **Files** app
2. Tap **...** (more menu) → **Connect to Server**
3. Enter: `smb://192.168.1.100`
4. Tap **Connect**
5. Enter credentials:
   - Name: `matthewbyrden`
   - Password: Your Mac Studio password
6. Select the folder to access

### Save for Quick Access

After connecting, the server appears under "Shared" in Files app sidebar.

---

## Accessing from Windows PC

1. Open **File Explorer**
2. In address bar, type: `\\192.168.1.100\Shared`
3. Press Enter
4. Enter Mac Studio credentials when prompted

### Map as Network Drive (Permanent)

1. Right-click "This PC" → "Map network drive"
2. Choose a drive letter (e.g., Z:)
3. Folder: `\\192.168.1.100\Shared`
4. Check "Reconnect at sign-in"
5. Click "Connect using different credentials"
6. Enter Mac Studio username/password

---

## Accessing from Linux

```bash
# Temporary mount
sudo mount -t cifs //192.168.1.100/Shared /mnt/studio \
  -o user=matthewbyrden,uid=$(id -u),gid=$(id -g)

# Or in file manager
# Enter: smb://192.168.1.100/Shared
```

---

## Recommended Folder Structure

```
Mac Studio ~/Shared/
├── Assets/           ← Images, videos, design files
├── Builds/           ← App builds, exports
├── Downloads/        ← Large downloads
├── Exports/          ← Project exports
└── Transfer/         ← Quick file transfers

Mac Studio ~/Sync/    (if using Syncthing)
├── Ideas/            ← Quick ideas, notes
├── Research/         ← Articles, references
├── Drafts/           ← Work in progress
└── Templates/        ← Reusable templates
```

---

## Performance Notes

| Operation | Expected Speed |
|-----------|----------------|
| SMB copy (Gigabit) | ~100 MB/s |
| SMB copy (Wi-Fi 6) | ~50 MB/s |
| SMB copy (Wi-Fi 5) | ~30 MB/s |
| AirDrop | ~40 MB/s |

**Tip:** For large files (>1GB), use wired ethernet for fastest transfers.

---

## Troubleshooting

### "Connection failed"
- Check Mac Studio is awake: `ssh mac-studio "echo ok"`
- Verify File Sharing is enabled
- Check firewall allows SMB (port 445)

### "Permission denied"
- Verify your user has Read & Write access in Sharing settings
- Try disconnecting and reconnecting

### Slow performance
- Use ethernet instead of Wi-Fi for large transfers
- Check for network congestion
- Avoid transferring during heavy LLM usage

### Share doesn't appear
- Wait a few seconds for network discovery
- Try direct IP: `smb://192.168.1.100/Shared`

---

## Security Considerations

1. **Keep "Everyone" at No Access** - Only your user should have access
2. **Use strong password** on Mac Studio account
3. **Firewall** - macOS firewall allows File Sharing by default
4. **VPN for remote** - If accessing from outside home, use Tailscale

---

## Commands Summary

```bash
# Mount shares
mount-studio          # Open ~/Shared in Finder
mount-sync            # Open ~/Sync in Finder

# Disconnect
unmount-studio        # Unmount the share

# Check connection
ssh mac-studio "ls ~/Shared"   # Verify access via SSH
```

---

*Part of the Opta Nexus documentation - January 2026*

# Opta Nexus - Mac Studio Claude Instructions

> **Copy this file to `~/Projects/Opta/CLAUDE.md` on Mac Studio**
> Claude Code automatically reads CLAUDE.md from the project root.

---

## You Are Running On: Mac Studio (Opta Nexus)

This is a **Mac Studio M3 Ultra** serving as the central development hub for all Opta projects. You have:

- **256GB Unified Memory** - Large context, fast operations
- **80-core GPU** - Running DeepSeek-70B locally
- **8TB SSD** - All projects stored locally at 7GB/s read speed
- **64GB RAM Disk** - `/Volumes/OptaBuilds` for instant builds

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     THIS MACHINE (Mac Studio)                │
│                                                              │
│  DeepSeek-70B (llama-server)  →  LiteLLM Proxy  →  You      │
│       Port 8080                    Port 4000                 │
│                                                              │
│  Projects:     ~/Projects/Opta/                              │
│  Shared:       ~/Shared/           (SMB accessible)          │
│  Sync:         ~/Sync/             (Syncthing)               │
│  Models:       /Users/Shared/Models/                         │
│  Builds:       /Volumes/OptaBuilds/ (RAM disk)               │
└─────────────────────────────────────────────────────────────┘
                              │
                    Local Network (LAN)
                              │
        ┌─────────────────────┴─────────────────────┐
        │                                           │
   MacBook Pro                              Other Devices
   (VS Code SSH)                            (SMB/Syncthing)
```

---

## Available System Commands

These commands are available in the terminal:

| Command | Description |
|---------|-------------|
| `opta-start` | Start LLM server + LiteLLM proxy + RAM disk |
| `opta-stop` | Stop all services |
| `opta-status` | Check what's running |
| `opta-ai` | View AI engine logs (screen session) |
| `opta-proxy` | View proxy logs (screen session) |

**Check system status before heavy operations:**
```bash
opta-status
```

---

## Project Structure

```
~/Projects/Opta/
├── Opta MacOS/          ← Desktop app (Swift, native macOS)
│   ├── OptaNative/      ← Xcode project
│   └── .planning/       ← Roadmap, phases, state
│
├── Opta iOS/            ← iOS app (SwiftUI)
│   ├── Opta/            ← Main app
│   ├── Opta Scan/       ← Vision features
│   └── .planning/
│
├── Opta Mini/           ← Menu bar app (Swift)
│
├── OptaLMiOS/           ← Life Manager iOS app
│
├── opta-native/         ← Rust core library
│   ├── opta-core/       ← Core logic
│   └── opta-render/     ← GPU rendering
│
└── CLAUDE.md            ← This file
```

---

## Key File Locations

| What | Path |
|------|------|
| Projects | `~/Projects/Opta/` |
| Shared files (SMB) | `~/Shared/` |
| Synced files | `~/Sync/` |
| AI Models | `/Users/Shared/Models/` |
| RAM Disk (builds) | `/Volumes/OptaBuilds/` |
| LiteLLM Config | `~/config.yaml` |
| Startup Script | `~/start_opta_server.sh` |

---

## Building Projects

### Opta MacOS (Swift)
```bash
cd ~/Projects/Opta/Opta\ MacOS
xcodebuild -project OptaNative.xcodeproj -scheme OptaNative -configuration Release
```

### Opta iOS (Swift)
```bash
cd ~/Projects/Opta/Opta\ iOS
xcodebuild -project Opta.xcodeproj -scheme Opta -configuration Release -sdk iphoneos
```

### opta-native (Rust)
```bash
cd ~/Projects/Opta/opta-native
cargo build --release
```

**Use RAM disk for faster builds:**
```bash
export CARGO_TARGET_DIR=/Volumes/OptaBuilds/rust
cargo build --release
```

---

## Working with the User

The user (Matthew) typically connects via:
1. **VS Code Remote SSH** - Editing code directly on this machine
2. **Terminal SSH** - Running commands
3. **SMB** - Accessing ~/Shared for file transfers

When the user is working:
- Files are LOCAL to you (7GB/s access)
- No network latency for file reads
- You have full filesystem access
- Build artifacts go to RAM disk when possible

---

## Performance Considerations

### Memory Allocation
| Component | RAM |
|-----------|-----|
| DeepSeek-70B model | ~78 GB |
| Draft model (speculative) | ~3 GB |
| RAM disk | 64 GB |
| KV Cache | ~40 GB |
| Available for builds | ~70 GB |

### When to Use RAM Disk
- Rust builds: Set `CARGO_TARGET_DIR=/Volumes/OptaBuilds/rust`
- Swift builds: Build products in `/Volumes/OptaBuilds/xcode`
- Temporary files: Use `/Volumes/OptaBuilds/tmp`

**Note:** RAM disk is volatile - contents lost on restart.

---

## MCP Servers Available

These MCP servers are configured and available:

| Server | Purpose |
|--------|---------|
| Serena | Code intelligence, symbolic editing |
| Context7 | Library documentation lookup |
| Playwright | Browser automation |
| Gmail | Email management |
| Google Drive | File access |
| Google Calendar | Event management |
| Greptile | PR code review |
| Gemini | Google search |
| YouTube | Video data |

---

## Common Tasks

### Check if LLM is running
```bash
curl http://localhost:8080/health
```

### Restart LLM services
```bash
opta-stop && opta-start
```

### View LLM logs
```bash
screen -r ai-engine
# Ctrl+A then D to detach
```

### Check disk usage
```bash
df -h /Volumes/OptaBuilds
df -h ~
```

### Monitor memory
```bash
vm_stat | head -10
```

---

## Session Protocol

At the START of each session:
1. Run `opta-status` to verify services
2. Check `.planning/STATE.md` for current project state
3. Review recent git commits for context

At the END of each session:
1. Commit changes with descriptive message
2. Update `.planning/STATE.md` if significant progress
3. Note any pending tasks

---

## Troubleshooting

### LLM not responding
```bash
opta-status           # Check services
screen -r ai-engine   # View logs
opta-stop && opta-start  # Restart
```

### Out of memory
```bash
# Check what's using RAM
top -l 1 -s 0 | head -20

# Clear RAM disk if needed
rm -rf /Volumes/OptaBuilds/*
```

### Build failures
```bash
# Clean and rebuild
cd ~/Projects/Opta/opta-native
cargo clean
cargo build --release
```

---

## Important Notes

1. **You ARE the LLM** - DeepSeek-70B running locally on this machine
2. **Files are local** - No network latency, read at 7GB/s
3. **RAM disk is fast but volatile** - Don't store important data there
4. **User connects remotely** - Via VS Code SSH from MacBook
5. **Commit often** - Git is the backup mechanism

---

*Opta Nexus Configuration - January 2026*

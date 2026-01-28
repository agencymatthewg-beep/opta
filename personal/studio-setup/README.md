# Studio Food
## Complete Mac Studio Setup Package for Opta Nexus

This folder contains everything needed to transform a new Mac Studio into your **local AI development cloud** - a headless server running DeepSeek-70B that powers Claude Code across all your devices.

---

## What is This?

**"Studio Food"** = Everything the Mac Studio needs to eat to become your AI-powered development hub.

After setup, your Mac Studio will:
- Run a **local 70B parameter LLM** (DeepSeek-R1) with GPU acceleration
- Route all **Claude Code requests** through the local model (zero API costs)
- Provide a **64GB RAM disk** for instant Rust/Swift builds
- Serve as the **canonical source** for all your Opta projects
- Host **9 MCP servers** for code intelligence, browser automation, email, calendar, and more
- Support **2 concurrent developers** via VS Code Remote SSH

---

## Files in This Folder

| File | Purpose | When to Use |
|------|---------|-------------|
| `README.md` | This guide | Read first |
| `QUICK-REFERENCE.md` | Cheat sheet with key commands | Daily reference |
| `pre-install.sh` | Automated prerequisites installer | Run first on Mac Studio |
| `claude-code-full-setup.tar.gz` | Claude Code config export | Extract & run install.sh |
| `CLAUDE-STUDIO.md` | Instructions for Claude on Mac Studio | Auto-read by Claude Code |
| `install-claude-context.sh` | Installs CLAUDE.md to project root | Run after setup |
| `File-Sharing-Guide.md` | SMB/Syncthing setup guide | Reference |

---

## Quick Start (TL;DR)

```bash
# 1. Transfer this folder to Mac Studio
scp -r "Studio Food" macstudio:~/

# 2. On Mac Studio - Run pre-install
cd ~/Studio\ Food
./pre-install.sh

# 3. Extract and install Claude Code config
tar -xzvf claude-code-full-setup.tar.gz
cd claude-code-export
./install.sh

# 4. Source environment and start server
source ~/.zshrc
opta-start

# 5. Verify everything works
opta-status
```

---

## Detailed Setup Guide

### Phase 1: Physical Setup

1. **Unbox Mac Studio** and connect to power + ethernet
2. **Complete macOS setup** (create user: `matthewbyrden`)
3. **Enable Screen Sharing** (System Settings → General → Sharing)
4. **Note the IP address**: `ipconfig getifaddr en0`

### Phase 2: Transfer Files

From your MacBook:
```bash
# Option A: SCP (over network)
scp -r ~/Documents/Opta/Studio\ Food matthewbyrden@192.168.1.100:~/

# Option B: AirDrop
# Open Finder → AirDrop → drag "Studio Food" folder

# Option C: USB Drive
# Copy folder to USB → plug into Mac Studio → copy to ~/
```

### Phase 3: Run Pre-Install Script

SSH into Mac Studio (or use Screen Sharing):
```bash
ssh matthewbyrden@192.168.1.100

cd ~/Studio\ Food
chmod +x pre-install.sh
./pre-install.sh
```

**What pre-install.sh does:**
1. Installs Homebrew (if missing)
2. Installs dependencies: screen, cmake, python3, pipx, node, git, wget
3. Builds llama.cpp with Metal GPU acceleration
4. Downloads AI models (~80GB total):
   - DeepSeek-R1-Distill-Llama-70B-Q8 (78GB)
   - Llama-3.2-3B-Instruct (2GB) for speculative decoding
5. Creates directory structure
6. Creates startup/stop scripts
7. Configures LiteLLM proxy
8. Installs MCP server dependencies
9. Enables SSH remote access

**Skip models for faster setup:**
```bash
./pre-install.sh --skip-models
# Download models later when you have time
```

### Phase 4: Install Claude Code Configuration

```bash
cd ~/Studio\ Food
tar -xzvf claude-code-full-setup.tar.gz
cd claude-code-export
./install.sh
```

**What install.sh does:**
1. Installs remaining dependencies (Node.js, Python, Rust, Bun)
2. Installs all 9 MCP servers
3. Installs cloud CLIs (Vercel, Netlify, Wrangler)
4. Copies 40+ skills to `~/.claude/commands/`
5. Sets up configuration files

### Phase 5: Start the Server

```bash
source ~/.zshrc
opta-start
```

**Verify with:**
```bash
opta-status
```

Expected output:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  OPTA NEXUS STATUS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  AI Engine:    ✓ Running (Port 8080)
  LiteLLM:      ✓ Running (Port 4000)
  RAM Disk:     ✓ Mounted (0B used, 64G free)
```

### Phase 6: Configure Your MacBook

Add to `~/.zshrc` on your MacBook:
```bash
# Opta Nexus - Route Claude to Mac Studio
export ANTHROPIC_BASE_URL="http://192.168.1.100:4000"
export ANTHROPIC_API_KEY="sk-local-opta"

# Quick switching
alias claude-local='export ANTHROPIC_BASE_URL="http://192.168.1.100:4000" && export ANTHROPIC_API_KEY="sk-local-opta"'
alias claude-cloud='unset ANTHROPIC_BASE_URL && export ANTHROPIC_API_KEY="your-anthropic-key"'

# VS Code shortcut
alias code-studio='code --remote ssh-remote+mac-studio ~/Projects/Opta'
```

Add to `~/.ssh/config`:
```
Host mac-studio
    HostName 192.168.1.100
    User matthewbyrden
    ForwardAgent yes
```

Test the connection:
```bash
source ~/.zshrc
claude "Hello, are you running locally on my Mac Studio?"
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     MAC STUDIO (Opta Nexus)                      │
│                     192.168.1.100                                │
│                                                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │  DeepSeek-70B   │  │  LiteLLM Proxy  │  │   RAM Disk      │  │
│  │  (llama-server) │→ │  (translator)   │  │  /OptaBuilds    │  │
│  │  Port 8080      │  │  Port 4000      │  │  64GB           │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
│                              ↑                                   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  ~/Projects/Opta/          (Your code - canonical source)   ││
│  │  ~/Shared/                 (Syncthing - syncs to devices)   ││
│  │  /Users/Shared/Models/     (AI models - local only)         ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                               │
            ┌──────────────────┼──────────────────┐
            │                  │                  │
            ▼                  ▼                  ▼
     ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
     │  MacBook    │    │  Windows    │    │   Other     │
     │  Pro        │    │  PC         │    │   Device    │
     │             │    │             │    │             │
     │ Claude Code │    │ Claude Code │    │ Claude Code │
     │     ↓       │    │     ↓       │    │     ↓       │
     │ VS Code SSH │    │ VS Code SSH │    │ VS Code SSH │
     └─────────────┘    └─────────────┘    └─────────────┘
```

---

## Memory Allocation (256GB)

| Component | Allocation | Type |
|-----------|------------|------|
| DeepSeek-70B (Q8) | 78 GB | Wired |
| Llama-3B Draft Model | 3 GB | Wired |
| RAM Disk (Builds) | 64 GB | Wired |
| KV Cache (4 agents) | ~40 GB | Dynamic |
| OS Overhead | ~20 GB | System |
| Linker Buffer | ~51 GB | Reserved |

---

## MCP Servers Included

| Server | Purpose | Auth Required |
|--------|---------|---------------|
| Serena | Code intelligence & symbolic editing | None |
| Context7 | Library documentation lookup | None |
| Playwright | Browser automation & testing | None |
| Gmail | Email management | OAuth (re-auth on Studio) |
| Google Drive | File access | OAuth (re-auth on Studio) |
| Google Calendar | Event management | OAuth (re-auth on Studio) |
| Greptile | PR code review | API key |
| Gemini | Google search & AI | Google login |
| YouTube | Video data & transcripts | API key |

---

## Skills Included (40+)

| Category | Skills |
|----------|--------|
| Session | `/start`, `/end`, `/pause`, `/status` |
| Development | `/build`, `/commit`, `/perfect`, `/improve`, `/bug` |
| Ideas | `/ideas`, `/aideas`, `/runidea`, `/cone`, `/100` |
| Optimization | `/opta`, `/atpo`, `/optamize` |
| Documentation | `/gu`, `/guphase`, `/release-notes`, `/design` |
| GSD Framework | `/gsd:plan-phase`, `/gsd:execute-phase`, `/gsd:progress` |
| Ralph Agent | `/ralph`, `/ralph-plan`, `/ralph-task`, `/ralph-status` |

---

## Daily Workflow

**Morning:**
```bash
# On MacBook
code-studio                    # Opens VS Code connected to Mac Studio
# Claude Code automatically uses local LLM
```

**During the day:**
- Edit code via VS Code Remote SSH
- Claude reads files at 800GB/s (local disk)
- Builds use RAM disk (instant)
- Git push for checkpoints

**End of day:**
```bash
# Commit and push
git add . && git commit -m "Daily progress" && git push
```

---

## Troubleshooting

### LLM not responding
```bash
ssh mac-studio
opta-status          # Check what's running
screen -r ai-engine  # View AI engine logs
# Ctrl+A then D to detach
```

### Rebuild LLM server
```bash
opta-stop
cd ~/llama.cpp
git pull
cmake --build build --config Release -j$(sysctl -n hw.ncpu)
cp build/bin/llama-server ~/
opta-start
```

### Reset everything
```bash
opta-stop
rm -rf ~/llama.cpp
./pre-install.sh
```

### Switch back to Anthropic Cloud
```bash
# On MacBook
claude-cloud         # Uses alias from ~/.zshrc
```

---

## File Locations Reference

| What | Where |
|------|-------|
| AI Models | `/Users/Shared/Models/` |
| Projects | `~/Projects/Opta/` |
| Shared Files | `~/Shared/` |
| Build Artifacts | `/Volumes/OptaBuilds/` |
| LiteLLM Config | `~/config.yaml` |
| Startup Script | `~/start_opta_server.sh` |
| Claude Skills | `~/.claude/commands/` |
| MCP Config | `~/.claude/.mcp.json` |

---

## Cost Savings

Running locally vs Anthropic API:

| Metric | Cloud API | Local (Mac Studio) |
|--------|-----------|-------------------|
| Cost per 1M tokens | ~$15 | $0 |
| Monthly (heavy use) | $500-2000 | $0 |
| Privacy | Data sent to Anthropic | 100% local |
| Speed (prefill) | ~50 tokens/sec | ~200 tokens/sec |
| Availability | Depends on internet | Always on |

**Break-even**: Mac Studio M3 Ultra pays for itself in 3-6 months of heavy Claude usage.

---

## Support

If something breaks:
1. Check `opta-status` on Mac Studio
2. View logs: `screen -r ai-engine` or `screen -r proxy`
3. Restart: `opta-stop && opta-start`
4. Full reset: Re-run `./pre-install.sh`

---

*Generated for Opta Nexus setup - January 2026*

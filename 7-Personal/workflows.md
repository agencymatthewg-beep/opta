# Workflows

## Device Ecosystem Philosophy

**Core Principle:** Each device has ONE primary purpose. If you're unsure which device to use, the primary purpose guides you.

---

## Device Roles

### 🖥️ Mac Studio M3 Ultra — "The AI Brain"
**Location:** Bedroom
**Primary Purpose:** Local LLM inference & heavy AI compute

| Do This Here | Don't Do This Here |
|--------------|-------------------|
| Run GLM 4.7 and other large models | Day-to-day coding |
| AI model experimentation | Web browsing, email |
| Heavy batch processing | Gaming |
| Training/fine-tuning runs | Casual work |

**Why:** 256GB unified memory is wasted on anything but large models. This machine exists to run what nothing else can.

**Access:** Headless (SSH only from MacBook)

**Typical Session:**
- SSH/remote into it from MacBook
- Start long-running inference jobs
- Let it work while you do other things

---

### 💻 MacBook Pro M4 Max — "The Daily Driver"
**Location:** Living room dock (focused work) or mobile
**Primary Purpose:** All daily work - coding, writing, research, communication

| Do This Here | Don't Do This Here |
|--------------|-------------------|
| Software development | Heavy LLM inference (>48GB models) |
| Writing & documentation | Gaming |
| Research & browsing | Long batch jobs (use Mac Studio) |
| Video calls & meetings | |
| Light AI work (<48GB models) | |
| Opta development | |

**Why:** M4 Max with 48GB handles 90% of work. The 38" ultrawide with Aerospace gives you a powerful tiled workspace.

**Aerospace Workspace Layout (Suggested):**
- Workspace 1: Code (IDE + terminal)
- Workspace 2: Browser (research/docs)
- Workspace 3: Communication (Slack, email, calendar)
- Workspace 4: Misc/overflow

---

### 🎮 Gaming PC — "The Gaming Rig"
**Location:** Bedroom (dual monitors)
**Primary Purpose:** Gaming & Windows-exclusive tasks

| Do This Here | Don't Do This Here |
|--------------|-------------------|
| Gaming (RTX 5080 + 180Hz ultrawide) | macOS development |
| Windows-only software | Daily work (use MacBook) |
| CUDA-specific compute | Web browsing (use MacBook) |
| Game streaming/recording | |

**Why:** RTX 5080 is overkill for anything but gaming and CUDA work. Don't waste it on browsing.

**Monitor Setup:**
- Left (34" 180Hz): Primary gaming display
- Right (32" 4K): Discord, guides, Apple TV when not gaming

---

### 🖧 Server PC — "The Always-On Worker"
**Location:** Living room
**Primary Purpose:** Background services that run 24/7

| Do This Here | Don't Do This Here |
|--------------|-------------------|
| Home Assistant / automation | Interactive work |
| Plex / Jellyfin media server | Gaming |
| Docker containers | Development |
| CI/CD runners | Anything requiring a display |
| File/backup server | |
| Lightweight inference (RTX 5060) | |

**Why:** Efficient, always-on. Does the boring work so other machines stay responsive.

**Hypervisor:** Proxmox

**Planned Services (Priority Order):**
1. [ ] Docker host (VM or LXC)
2. [ ] Ollama instance for quick inference (leverages RTX 5060)
3. [ ] Syncthing node (file sync hub)
4. [ ] Home Assistant
5. [ ] Media server (Plex/Jellyfin)
6. [ ] Local DNS (Pi-hole or AdGuard)
7. [ ] Backup target

---

## File Sync Strategy: Syncthing

**Architecture:**
```
MacBook Pro ←→ Server (Syncthing hub) ←→ Mac Studio
                    ↓
              Gaming PC (optional)
```

**What to Sync:**
| Folder | Devices | Notes |
|--------|---------|-------|
| Projects/Code | MacBook ↔ Mac Studio | Active development |
| Documents | All | General files |
| .personal | MacBook only | Stays local |

**What NOT to Sync:**
- node_modules, .venv, build artifacts (use .stignore)
- Large model weights (download on each device)
- Game installs

---

## Cross-Device Workflow Patterns

### Pattern: "Heavy AI Task"
1. Start job from MacBook via SSH → Mac Studio
2. Mac Studio runs inference/training
3. Results sync back or query via API
4. MacBook stays responsive for other work

### Pattern: "End of Day"
1. Commit & push from MacBook
2. CI runs on Server
3. Walk to bedroom, results ready

### Pattern: "Gaming Session"
1. Walk to bedroom
2. Gaming PC is for gaming ONLY
3. Don't check email, don't code
4. When done, walk back to MacBook

### Pattern: "Deep Focus Work"
1. MacBook docked to 38" in living room
2. Aerospace full-screen on active workspace
3. Other devices not touched
4. Phone in another room

---

## Daily Routine
<!-- How you structure your day -->


## Communication Preferences
- Concise, direct communication
- No unnecessary praise or fluff
- Show me the data/evidence

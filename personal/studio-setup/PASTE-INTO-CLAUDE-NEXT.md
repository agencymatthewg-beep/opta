# Opta Nexus - Continue Setup
## Paste this into Claude Code on Mac Studio

---

**Copy everything below and paste into Claude:**

---

# Context: Mac Studio Setup In Progress

Studio Food folder has been transferred and initial setup completed. Here's what's done and what's next:

## ✅ Completed
- Studio Food folder transferred
- pre-install.sh executed
- Claude Code config installed
- Basic dependencies installed

## 🔲 Still Need To Do

### 1. Install Claude Context (if not done)
```bash
cd ~/Studio\ Food
./install-claude-context.sh
```

### 2. Source Environment
```bash
source ~/.zshrc
```

### 3. Start the LLM Server
```bash
opta-start
```

Verify it's running:
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
  RAM Disk:     ✓ Mounted
```

### 4. Enable Remote Access
Go to **System Settings → General → Sharing**:
- [x] **Screen Sharing** - ON
- [x] **Remote Login** - ON (for SSH)
- [x] **File Sharing** - ON → Add ~/Shared folder

### 5. Create Directories
```bash
mkdir -p ~/Projects/Opta
mkdir -p ~/Shared
mkdir -p ~/Sync
```

### 6. Clone/Transfer Projects
The Opta projects need to be on this Mac Studio. Either:

**Option A: Clone from GitHub**
```bash
cd ~/Projects/Opta
git clone <your-repo-url>
```

**Option B: Transfer from MacBook**
Projects will come via VS Code SSH editing (code stays here)

### 7. Get This Mac's IP
```bash
ipconfig getifaddr en0
```
Note this - MacBook needs it to connect.

### 8. Test LLM
```bash
curl http://localhost:4000/health
```
Should return: `{"status":"healthy"}`

---

## Commands Available After Setup

| Command | What it does |
|---------|--------------|
| `opta-start` | Start LLM + proxy + RAM disk |
| `opta-stop` | Stop everything |
| `opta-status` | Check status |
| `opta-ai` | View AI logs |
| `opta-proxy` | View proxy logs |

---

## Architecture Summary

This Mac Studio is now:
- **LLM Server**: DeepSeek-70B running locally
- **Code Host**: All projects live in ~/Projects/Opta
- **File Server**: ~/Shared accessible via SMB
- **Build Server**: RAM disk at /Volumes/OptaBuilds

MacBook connects via:
- VS Code Remote SSH (code editing)
- SSH terminal
- SMB file sharing

---

**Run `opta-status` and tell me what you see.**

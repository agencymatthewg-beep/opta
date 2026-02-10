# Opta Nexus Setup Briefing
## Paste this into Claude Code on Mac Studio

---

**Copy everything below this line and paste into Claude:**

---

# Context: You are running on Mac Studio (Opta Nexus)

This Mac Studio is being set up as the central AI development hub. Here's what needs to happen:

## Current State
- Mac Studio M3 Ultra (or M2 Ultra) with 256GB RAM
- Fresh macOS install, signed into Apple ID: matthew@optamize.biz
- Need to install local LLM (DeepSeek-70B) and development tools

## Setup Files Location
All setup files are in a folder called "Studio Food" that needs to be transferred from MacBook.

**On MacBook, run:**
```bash
scp -r ~/Documents/Opta/Studio\ Food matthewbyrden@192.168.188.144:~/
```

**Or use AirDrop** to send the "Studio Food" folder to this Mac Studio.

## Once Studio Food is on Mac Studio, run:

```bash
cd ~/Studio\ Food
chmod +x pre-install.sh
./pre-install.sh
```

This will:
1. Install Homebrew
2. Install dependencies (cmake, python3, node, etc.)
3. Build llama.cpp with Metal GPU support
4. Download AI models (~80GB) - takes time
5. Create startup scripts (opta-start, opta-stop, opta-status)
6. Configure LiteLLM proxy

## After pre-install completes:

```bash
# Extract Claude Code config
tar -xzvf claude-code-full-setup.tar.gz
cd claude-code-export
./install.sh

# Install Claude context
cd ~/Studio\ Food
./install-claude-context.sh

# Start the LLM server
source ~/.zshrc
opta-start
```

## Enable Remote Access

Go to **System Settings → General → Sharing** and enable:
- [x] Screen Sharing
- [x] Remote Login (SSH)
- [x] File Sharing (add ~/Shared folder)

## Create Project Directories

```bash
mkdir -p ~/Projects/Opta
mkdir -p ~/Shared
mkdir -p ~/Sync
```

## Network Info
- This Mac Studio IP: Run `ipconfig getifaddr en0`
- MacBook will connect via SSH and VS Code Remote

## End Goal
When complete, this Mac Studio will:
1. Run DeepSeek-70B locally (zero API costs)
2. Route all Claude Code requests through local LLM
3. Host all Opta projects (code lives here)
4. Provide 64GB RAM disk for fast builds
5. Be accessible from MacBook via VS Code SSH

---

**Ask me if anything is unclear or if you need help with any step.**

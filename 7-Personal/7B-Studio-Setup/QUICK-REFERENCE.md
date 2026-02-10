# Quick Reference Card
## Mac Studio Setup Cheat Sheet

---

## Transfer to Mac Studio

```bash
scp -r ~/Documents/Opta/Studio\ Food matthewbyrden@IP_ADDRESS:~/
```

---

## On Mac Studio (in order)

```bash
# 1. Run pre-install
cd ~/Studio\ Food
./pre-install.sh

# 2. Install Claude config
tar -xzvf claude-code-full-setup.tar.gz
cd claude-code-export
./install.sh

# 3. Activate and start
source ~/.zshrc
opta-start
opta-status
```

---

## On MacBook (add to ~/.zshrc)

```bash
export ANTHROPIC_BASE_URL="http://MAC_STUDIO_IP:4000"
export ANTHROPIC_API_KEY="sk-local-opta"
```

---

## Daily Commands

| Command | What it does |
|---------|--------------|
| `opta-start` | Start LLM + proxy + RAM disk |
| `opta-stop` | Stop everything |
| `opta-status` | Check if running |
| `opta-ai` | View AI engine logs |
| `opta-proxy` | View proxy logs |
| `code-studio` | Open VS Code → Mac Studio |
| `claude-local` | Use local LLM |
| `claude-cloud` | Use Anthropic API |

---

## Ports

| Service | Port |
|---------|------|
| AI Engine (llama-server) | 8080 |
| LiteLLM Proxy | 4000 |
| SSH | 22 |

---

## Key Paths on Mac Studio

```
~/Projects/Opta/           ← Your code
~/Shared/                  ← Synced files
/Users/Shared/Models/      ← AI models (80GB)
/Volumes/OptaBuilds/       ← RAM disk (64GB, volatile)
~/start_opta_server.sh     ← Startup script
~/config.yaml              ← LiteLLM config
```

---

## If Something Breaks

```bash
ssh mac-studio
opta-status              # What's running?
screen -r ai-engine      # View AI logs (Ctrl+A D to exit)
opta-stop && opta-start  # Restart everything
```

---

## Re-authenticate Google Services

Gmail, Calendar, and Drive need OAuth re-authentication on first use:
- Just run a command that uses them
- Follow the browser prompt to log in
- Tokens saved for future use

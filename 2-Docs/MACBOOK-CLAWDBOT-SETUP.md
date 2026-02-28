# Clawdbot Remote Connection Setup
## For MacBook Pro to connect to Mac Studio (Opta Nexus)

---

## Mac Studio Details
- **IP Address:** 192.168.188.144
- **Gateway Port:** 18789
- **LLM Proxy:** 4000

---

## Option 1: SSH Tunnel (Recommended)

On your MacBook Pro, create a persistent SSH tunnel:

```bash
# One-time tunnel
ssh -N -L 18789:127.0.0.1:18789 opta@192.168.188.144

# Or add to ~/.ssh/config for easy access:
Host nexus
    HostName 192.168.188.144
    User opta
    LocalForward 18789 127.0.0.1:18789
    LocalForward 4000 127.0.0.1:4000
```

Then install Clawdbot on MacBook and configure remote mode:

```bash
npm install -g clawdbot@latest
clawdbot setup
```

Edit `~/.clawdbot/clawdbot.json` on MacBook:
```json
{
  "gateway": {
    "mode": "remote",
    "remote": {
      "url": "ws://127.0.0.1:18789"
    }
  }
}
```

---

## Option 2: Tailscale (Best for mobile)

1. Install Tailscale on both machines
2. Enable Tailscale on Mac Studio: `tailscale up`
3. Configure Clawdbot to allow Tailscale auth:
   ```bash
   clawdbot config set gateway.auth.allowTailscale true
   ```
4. Connect from any device on your Tailnet

---

## Telegram Access (Already Working!)

You can already text your Clawdbot via Telegram:
- Bot: @mono_slavebot
- Your Telegram ID is allowlisted: 7799095654

Just message the bot from your phone!

---

## Test the Connection

From Mac Studio:
```bash
opta-status                    # Check LLM is running
clawdbot gateway status        # Check gateway is up
clawdbot doctor                # Full health check
```

From MacBook (after SSH tunnel):
```bash
clawdbot gateway status        # Should connect via tunnel
```

---

## Environment Variables for MacBook

Add to `~/.zshrc` on MacBook Pro:
```bash
# Route Claude Code to Mac Studio
export ANTHROPIC_BASE_URL="http://192.168.188.144:4000"
export ANTHROPIC_API_KEY="sk-local-opta"

# Clawdbot remote gateway
export CLAWDBOT_GATEWAY_URL="ws://127.0.0.1:18789"

# Quick aliases
alias nexus='ssh opta@192.168.188.144'
alias nexus-tunnel='ssh -N -L 18789:127.0.0.1:18789 -L 4000:127.0.0.1:4000 opta@192.168.188.144'
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                MAC STUDIO (Opta Nexus)                       │
│                192.168.188.144                               │
│                                                              │
│  ┌─────────────────┐  ┌─────────────────┐                   │
│  │  DeepSeek-70B   │  │  Clawdbot       │                   │
│  │  (llama-server) │──│  Gateway        │◄── Telegram       │
│  │  Port 8080      │  │  Port 18789     │                   │
│  └────────┬────────┘  └─────────────────┘                   │
│           │                                                  │
│  ┌────────┴────────┐                                        │
│  │  LiteLLM Proxy  │                                        │
│  │  Port 4000      │                                        │
│  └─────────────────┘                                        │
└─────────────────────────────────────────────────────────────┘
              │ SSH Tunnel
              ▼
┌─────────────────────────────────────────────────────────────┐
│                  MACBOOK PRO                                 │
│                                                              │
│  ┌─────────────────┐  ┌─────────────────┐                   │
│  │  Claude Code    │  │  VS Code        │                   │
│  │  (CLI)          │  │  Remote SSH     │                   │
│  └─────────────────┘  └─────────────────┘                   │
│                                                              │
│  localhost:4000 ──────► Mac Studio LLM                      │
│  localhost:18789 ─────► Mac Studio Clawdbot                 │
└─────────────────────────────────────────────────────────────┘
```

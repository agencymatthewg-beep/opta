# Opta Nexus Operations Guide

## System Roles

### Mac Studio (This Machine)
- **Primary Role:** Headless compute server
- **Services:** AI inference, compilation, Clawdbot gateway
- **Access:** SSH, Screen Sharing, Telegram bot

### MacBook Pro (Client)
- **Role:** Development workstation, mobile access
- **Connection:** VS Code Remote SSH, Claude Code CLI
- **Use Case:** Code editing, iOS simulation, remote builds

### Telegram (@mono_slavebot)
- **Role:** Mobile interface to Mac Studio
- **Use Case:** Send commands, check status, run tasks from phone
- **Allowed User:** 7799095654

---

## Daily Operations

### Morning Startup (if needed)

After a restart, services should auto-start. To verify:

```bash
# Check all services
opta-status

# If services aren't running:
opta-start
```

### Check System Health

```bash
# AI Engine health
curl http://localhost:8080/health

# LiteLLM health
curl http://localhost:4000/health

# Clawdbot health
clawdbot status --deep
```

### Monitor Resource Usage

```bash
# Memory usage
vm_stat | head -10

# GPU usage (AI inference)
sudo powermetrics --samplers gpu_power -i 1000 -n 1

# Active screen sessions
screen -ls
```

---

## Use Cases

### 1. Remote AI Coding (Claude Code)

**From MacBook Pro:**
```bash
export ANTHROPIC_BASE_URL="http://192.168.188.144:4000"
export ANTHROPIC_API_KEY="sk-local-opta"
cd ~/my-project
claude
```

**What happens:**
- Claude Code connects to Mac Studio's LiteLLM proxy
- Requests routed to local DeepSeek-70B
- 128k context window available
- No API costs

### 2. Mobile Commands via Telegram

**From phone, message @mono_slavebot:**
- "What's the system status?"
- "Run `git pull` in ~/my-project"
- "Check if the build passed"
- "Search for files containing 'TODO'"

**Clawdbot capabilities:**
- Execute shell commands
- Read/write files
- Search codebases
- Run builds

### 3. Fast Rust Compilation

**Build artifacts on RAM disk:**
```bash
# In Cargo.toml or .cargo/config.toml
[build]
target-dir = "/Volumes/OptaBuilds/my-project"
```

**Benefits:**
- 64GB RAM disk eliminates SSD I/O bottleneck
- Massive speedup for incremental builds
- Artifacts are volatile (clean slate after restart)

### 4. Multiple Concurrent AI Sessions

The AI Engine supports 4 parallel slots:
- Slot 1: Clawdbot (Telegram)
- Slot 2: Claude Code (MacBook Pro)
- Slot 3: Claude Code (Windows PC)
- Slot 4: Reserved/Additional

**Note:** If a 5th request comes in, it queues (1-5 second wait).

### 5. Remote iOS Development

**From MacBook Pro via VS Code Remote:**
1. SSH into Mac Studio
2. Edit code remotely
3. Build on Mac Studio (RAM disk)
4. Forward simulator to MacBook for testing

---

## Operational Limits

| Limit | Value | Impact |
|-------|-------|--------|
| Max concurrent agents | 4 | 5th request queues |
| Context window | 128k tokens | Can read entire codebases |
| Prefill time | 1-3 seconds | Normal during context loading |
| RAM disk capacity | 64GB | Large monorepos may need cleanup |

---

## Troubleshooting

### AI Engine Not Responding

```bash
# Check if running
screen -ls | grep ai-engine

# Restart
screen -X -S ai-engine quit
opta-start
```

### LiteLLM Proxy Issues

```bash
# Check logs
screen -r proxy

# Restart
screen -X -S proxy quit
~/.local/bin/litellm --config ~/config.yaml --port 4000 &
```

### Clawdbot Not Responding to Telegram

```bash
# Check status
clawdbot status --deep

# View logs
clawdbot logs --follow

# Restart gateway
clawdbot gateway restart
```

### RAM Disk Missing After Restart

```bash
# Recreate
opta-start
# or manually:
diskutil erasevolume HFS+ 'OptaBuilds' `hdiutil attach -nomount ram://134217728`
```

---

## Security Notes

1. **Local-only by design:** Gateway binds to loopback (127.0.0.1)
2. **Telegram allowlist:** Only user ID 7799095654 can send commands
3. **SSH keys:** Use ed25519 keys for client connections
4. **No external API exposure:** All services are internal network only

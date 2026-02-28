# Opta Nexus Infrastructure

## Executive Summary

This is a high-availability "Headless Development Cloud" hosted on a local Mac Studio, serving as the centralized compute, AI inference, and compilation host.

---

## Hardware Specifications

| Component | Specification |
|-----------|---------------|
| **Machine** | Mac Studio M3 Ultra |
| **GPU** | 80-Core GPU |
| **Memory** | 256GB Unified Memory |
| **Memory Bandwidth** | 800 GB/s |
| **Storage** | 1TB SSD |
| **Hostname** | MatthewacStudio.lan |
| **IP Address** | 192.168.188.144 |
| **Username** | opta |

---

## Memory Allocation Map (256GB Total)

| Purpose | Allocation | Type |
|---------|------------|------|
| AI Engine (DeepSeek-70B Q8) | 78 GB | Wired |
| Speculative Draft Model (Llama-3B) | 3 GB | Wired |
| Build Forge (RAM Disk) | 64 GB | Wired |
| Agent Context (KV Cache) | ~40 GB | Dynamic |
| Operating System Overhead | ~20 GB | Dynamic |
| Linker Buffer (cargo builds) | ~51 GB | Reserved |

**Swap Strategy:** Strictly disabled for build artifacts; system swap allowed only for OS stability.

---

## Services Running

### 1. AI Engine (llama.cpp Server)

| Setting | Value |
|---------|-------|
| Port | 8080 |
| Model | DeepSeek-R1-Distill-Llama-70B-Q8_0.gguf |
| Draft Model | Llama-3.2-3B-Instruct-Q4_K_M.gguf |
| Context Window | 131,072 tokens (128k) |
| Parallel Slots | 4 (-np 4) |
| KV Cache Quantization | 4-bit (q4_0) |
| Continuous Batching | Enabled (-cb) |

**Start command:** `opta-start` or `screen -r ai-engine`

### 2. Claude Code Router

| Setting | Value |
|---------|-------|
| Port | 3456 |
| Function | Smart routing for Claude Code requests |
| Config | ~/.claude-code-router/config.json |
| LaunchAgent | com.claude-code-router.plist |

**Features:**
- Task-based routing (default, background, think, longContext)
- Anthropic → OpenAI API translation
- 120k token long context threshold

**Routes all Claude Code requests → local DeepSeek-70B**

### 3. LiteLLM Proxy (Legacy)

| Setting | Value |
|---------|-------|
| Port | 4000 |
| Function | Generic OpenAI API proxy |
| Config | ~/config.yaml |

**Note:** Claude Code Router is now preferred for Claude Code. LiteLLM remains for other OpenAI-compatible clients.

### 4. RAM Disk (Build Forge)

| Setting | Value |
|---------|-------|
| Mount Point | /Volumes/OptaBuilds |
| Capacity | 64 GB |
| Purpose | Rust target/ directories |
| Persistence | Volatile (clears on restart) |

### 5. Clawdbot Gateway

| Setting | Value |
|---------|-------|
| Port | 18789 |
| Mode | Local |
| Telegram Bot | @mono_slavebot |
| Allowed User ID | 7799095654 |
| Model | openai/deepseek-r1-distill-llama-70b |
| LaunchAgent | com.clawdbot.gateway.plist |

---

## Network Access

### SSH Access
```bash
ssh opta@192.168.188.144
```

### API Endpoints

| Service | URL |
|---------|-----|
| AI Engine (Direct) | http://192.168.188.144:8080/v1 |
| Claude Code Router | http://127.0.0.1:3456 (local) |
| LiteLLM Proxy | http://192.168.188.144:4000/v1 |
| Clawdbot Dashboard | http://127.0.0.1:18789 (local only) |

### For Claude Code (Local on Mac Studio)
```bash
eval "$(ccr activate)"
claude
```

### For Claude Code on Client Machines
```bash
export ANTHROPIC_BASE_URL="http://192.168.188.144:4000"
export ANTHROPIC_API_KEY="sk-local-opta"
```

---

## Quick Commands

| Command | Description |
|---------|-------------|
| `opta-start` | Start all services (RAM disk + AI + Proxy) |
| `opta-status` | Check service status |
| `ccr status` | Check Claude Code Router status |
| `ccr code` | Start Claude Code via router |
| `ccr model` | Interactive model selection |
| `ccr ui` | Open router Web UI |
| `screen -r ai-engine` | Attach to AI engine logs |
| `screen -r proxy` | Attach to LiteLLM logs |
| `clawdbot status` | Check Clawdbot status |
| `clawdbot logs --follow` | Watch Clawdbot logs |

---

## File Locations

| Item | Path |
|------|------|
| Models | /Users/Shared/Models/ |
| llama.cpp | ~/llama.cpp/ |
| Claude Code Router Config | ~/.claude-code-router/config.json |
| LiteLLM Config | ~/config.yaml |
| Startup Script | ~/start_opta_server.sh |
| Clawdbot Config | ~/.clawdbot/clawdbot.json |
| Clawdbot Workspace | ~/clawd/ |
| Documentation | ~/opta-docs/ |
| SSH Keys | ~/.ssh/ |

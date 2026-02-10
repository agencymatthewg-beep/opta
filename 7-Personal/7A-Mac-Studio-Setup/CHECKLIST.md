# Mac Studio M3 Ultra Setup Checklist

## Pre-Transfer (Do on MacBook NOW)

### Downloads to Transfer
- [ ] Download `setup.sh` from this folder
- [ ] Download LM Studio installer: https://lmstudio.ai/
- [ ] Download TG Pro: https://www.tunabellysoftware.com/tgpro/

### Models to Pre-Download (Optional - saves time)
Store on Thunderbolt SSD for transfer:
- [ ] `bartowski/Llama-3.1-405B-Instruct-GGUF` (Q3_K_S) - ~190GB
- [ ] `bartowski/DeepSeek-Coder-V2-Instruct-GGUF` (Q4_K_M) - ~140GB

Source: https://huggingface.co/bartowski

---

## Day 1: Initial Boot

### 1. Basic Setup
- [ ] Complete macOS Setup Assistant
- [ ] Sign into Apple ID (optional for headless use)
- [ ] System Settings → General → Sharing → Enable "Remote Login" (SSH)
- [ ] Note the IP address: `ifconfig | grep "inet " | grep -v 127.0.0.1`

### 2. Transfer and Run Setup Script
```bash
# From MacBook, copy the setup script
scp setup.sh <username>@<mac-studio-ip>:~/

# SSH into Mac Studio
ssh <username>@<mac-studio-ip>

# Run setup
chmod +x setup.sh
./setup.sh
```

### 3. Critical System Config
- [ ] GPU memory limit set: `sudo sysctl iogpu.wired_limit_mb=245760`
- [ ] Launch daemon created for persistence
- [ ] SSH key generated

---

## Day 1: Software Verification

### Ollama
```bash
# Check Ollama is running
ollama --version

# List models
ollama list

# Quick test
ollama run qwen2.5:72b "What is 2+2?"
```

### MLX
```bash
conda activate mlx
python -c "import mlx; print(mlx.__version__)"
```

### Syncthing
- [ ] Access web UI: http://localhost:8384
- [ ] Add MacBook as device (get Device ID from MacBook's Syncthing)
- [ ] Create shared folder: `~/Projects` → sync with MacBook

---

## Day 1: MacBook Configuration

### SSH Config (~/.ssh/config)
Add this to your MacBook:
```
Host mac-studio
    HostName mac-studio.local
    User <your-username>
    LocalForward 11434 localhost:11434
    LocalForward 8384 localhost:8384
```

### Test Connection
```bash
# Quick connect
ssh mac-studio

# With port forwarding (access Ollama API locally)
ssh -L 11434:localhost:11434 mac-studio
```

### Syncthing on MacBook
- [ ] Add Mac Studio's Device ID
- [ ] Accept shared folder invitation
- [ ] Verify sync is working

---

## Model Setup (Priority Order)

### Tier 1: Daily Drivers (Download First)
| Model | Command | Size | Speed |
|-------|---------|------|-------|
| Qwen 2.5 72B | `ollama pull qwen2.5:72b` | ~40GB | 30+ t/s |
| Llama 3.3 70B | `ollama pull llama3.3:70b` | ~40GB | 25 t/s |

### Tier 2: Specialists (Download When Needed)
| Model | Command | Size | Speed |
|-------|---------|------|-------|
| DeepSeek Coder V2 | `ollama pull deepseek-coder-v2:236b` | ~140GB | 10-15 t/s |
| Qwen 2.5 Coder 32B | `ollama pull qwen2.5-coder:32b` | ~18GB | 40+ t/s |

### Tier 3: Frontier (Use LM Studio)
| Model | Source | Size | Speed |
|-------|--------|------|-------|
| Llama 3.1 405B | HuggingFace (Q3_K_S) | ~190GB | 3-5 t/s |
| DeepSeek R1 671B | HuggingFace (IQ1_S) | ~131GB | 2-3 t/s |

---

## Thermal Management

### TG Pro Configuration
1. Install TG Pro
2. Create custom fan curve:
   - 50°C → 20% fan speed
   - 70°C → 40% fan speed
   - 80°C → 60% fan speed
   - 90°C → 100% fan speed
3. Enable "Auto mode" for sustained workloads

### Monitoring Commands
```bash
# Check thermal state
pmset -g therm

# Check memory pressure
memory_pressure

# Check GPU memory limit
sysctl iogpu.wired_limit_mb
```

---

## Workflow Patterns

### Pattern: Daily AI Work
```bash
# From MacBook
ssh mac-studio
ai  # Uses qwen2.5:72b by default
```

### Pattern: Heavy Inference (405B)
```bash
# On Mac Studio
open -a "LM Studio"
# Load: Llama-3.1-405B-Instruct-Q3_K_S
# Set GPU layers to MAX
```

### Pattern: API Access from MacBook
```bash
# Terminal 1: Port forward
ssh -L 11434:localhost:11434 mac-studio

# Terminal 2: Use API
curl http://localhost:11434/api/generate -d '{
  "model": "qwen2.5:72b",
  "prompt": "Hello!"
}'
```

### Pattern: Overnight Batch Job
```bash
# Use tmux to keep session alive
ssh mac-studio
tmux new -s batch
# Run your inference script
# Ctrl+B, D to detach
# Reconnect later: tmux attach -t batch
```

---

## Troubleshooting

### Model Won't Load (Out of Memory)
```bash
# Check current GPU limit
sysctl iogpu.wired_limit_mb

# Increase if needed
sudo sysctl iogpu.wired_limit_mb=245760

# Verify model size vs available memory
check-ai-memory
```

### Slow Inference
1. Check thermal throttling: `pmset -g therm`
2. Ensure model is fully GPU-offloaded in LM Studio
3. Check if other apps are using memory

### SSH Connection Refused
```bash
# On Mac Studio, verify SSH is enabled
sudo systemsetup -getremotelogin

# Enable if needed
sudo systemsetup -setremotelogin on
```

### Ollama Not Responding
```bash
# Check if running
pgrep ollama

# Restart service
pkill ollama
ollama serve &
```

---

## Quick Reference

### Useful Commands
```bash
ai                    # Quick chat (daily driver)
ai llama3.3:70b      # Chat with specific model
check-ai-memory       # Memory status
check-thermals        # Thermal status
ollama list           # Show downloaded models
ollama ps             # Show running models
```

### Key URLs (via SSH tunnel)
- Ollama API: http://localhost:11434
- Syncthing: http://localhost:8384

### Storage Locations
- Ollama models: `~/.ollama/models/`
- LM Studio models: `~/.cache/lm-studio/models/`
- Syncthing config: `~/Library/Application Support/Syncthing/`

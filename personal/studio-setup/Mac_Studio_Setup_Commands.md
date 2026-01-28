# Mac Studio Setup Commands
## Opta Nexus: Local AI Development Environment

Copy and paste these commands in order to set up your Mac Studio as a headless development cloud.

---

## 1. Install Homebrew (if not already installed)

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

---

## 2. Install Required Dependencies

```bash
brew install screen cmake python3 pipx
pipx install litellm
pipx ensurepath
```

---

## 3. Clone and Build llama.cpp

```bash
cd ~
git clone https://github.com/ggerganov/llama.cpp.git
cd llama.cpp
cmake -B build -DGGML_METAL=ON
cmake --build build --config Release -j$(sysctl -n hw.ncpu)
cp build/bin/llama-server ~/llama-server
```

---

## 4. Create Models Directory

```bash
sudo mkdir -p /Users/Shared/Models
sudo chown $(whoami) /Users/Shared/Models
```

---

## 5. Download AI Models

**DeepSeek-70B Q8 (Main Model - ~78GB):**
```bash
cd /Users/Shared/Models
curl -L -O https://huggingface.co/bartowski/DeepSeek-R1-Distill-Llama-70B-GGUF/resolve/main/DeepSeek-R1-Distill-Llama-70B-Q8_0.gguf
```

**Llama-3.2-3B (Draft Model for Speculative Decoding - ~2GB):**
```bash
cd /Users/Shared/Models
curl -L -O https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf
```

---

## 6. Create LiteLLM Config

```bash
cat > ~/config.yaml << 'EOF'
model_list:
  - model_name: claude-3-5-sonnet-20241022
    litellm_params:
      model: openai/deepseek-r1-distill-llama-70b
      api_base: "http://localhost:8080/v1"
      api_key: "sk-local"
      stop: ["<|EOT|>", "<|end_of_sentence|>"]
EOF
```

---

## 7. Create Startup Script

```bash
cat > ~/start_opta_server.sh << 'EOF'
#!/bin/bash
# OPTA NEXUS STARTUP SCRIPT
# Handles RAM Disk, AI Engine, and Proxy

# 1. Create 64GB RAM Disk for Rust Builds
if [ ! -d "/Volumes/OptaBuilds" ]; then
    echo "Creating 64GB RAM Disk..."
    diskutil erasevolume HFS+ 'OptaBuilds' `hdiutil attach -nomount ram://134217728`
fi

# 2. Launch AI Engine (Screen Session: 'ai-engine')
# Uses DeepSeek-70B (Q8) + Llama-3B (Draft) + 4-bit Cache + 4 Slots
screen -dmS ai-engine ~/llama-server \
    -m /Users/Shared/Models/DeepSeek-R1-Distill-Llama-70B-Q8_0.gguf \
    -md /Users/Shared/Models/Llama-3.2-3B-Instruct-Q4_K_M.gguf \
    -c 131072 \
    -np 4 \
    -cb \
    -ngl 99 \
    -ctk q4_0 \
    -ctv q4_0 \
    --host 0.0.0.0 --port 8080

# Wait for AI Engine to initialize
echo "Waiting for AI Engine to start..."
sleep 10

# 3. Launch LiteLLM Proxy (Screen Session: 'proxy')
screen -dmS proxy litellm --config ~/config.yaml --host 0.0.0.0 --port 4000

echo "Opta Nexus Online."
echo "AI Engine: Port 8080 | Proxy: Port 4000 | RAM Disk: Mounted"
EOF

chmod +x ~/start_opta_server.sh
```

---

## 8. Create Stop Script

```bash
cat > ~/stop_opta_server.sh << 'EOF'
#!/bin/bash
# OPTA NEXUS SHUTDOWN SCRIPT

echo "Stopping AI Engine..."
screen -S ai-engine -X quit 2>/dev/null

echo "Stopping LiteLLM Proxy..."
screen -S proxy -X quit 2>/dev/null

echo "Unmounting RAM Disk..."
if [ -d "/Volumes/OptaBuilds" ]; then
    diskutil unmount /Volumes/OptaBuilds
fi

echo "Opta Nexus Offline."
EOF

chmod +x ~/stop_opta_server.sh
```

---

## 9. Enable SSH Remote Access

```bash
# Enable Remote Login (SSH)
sudo systemsetup -setremotelogin on

# Check your IP address
ipconfig getifaddr en0
```

---

## 10. Configure Firewall (Optional but Recommended)

```bash
# Allow incoming connections on ports 8080 and 4000
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add ~/llama-server
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --unblockapp ~/llama-server
```

---

## 11. Start the Server

```bash
~/start_opta_server.sh
```

---

## 12. Verify Services are Running

```bash
# Check screen sessions
screen -ls

# Test AI Engine directly
curl http://localhost:8080/health

# Test LiteLLM Proxy
curl http://localhost:4000/health
```

---

## 13. View Logs (attach to screen sessions)

```bash
# View AI Engine logs
screen -r ai-engine

# View Proxy logs
screen -r proxy

# Detach from screen: Press Ctrl+A then D
```

---

## Client Configuration (MacBook Pro / Other Machines)

### For Claude Code CLI:

```bash
export ANTHROPIC_BASE_URL="http://<MAC_STUDIO_IP>:4000"
export ANTHROPIC_API_KEY="sk-local-opta"
```

### Add to ~/.zshrc for persistence:

```bash
echo 'export ANTHROPIC_BASE_URL="http://<MAC_STUDIO_IP>:4000"' >> ~/.zshrc
echo 'export ANTHROPIC_API_KEY="sk-local-opta"' >> ~/.zshrc
source ~/.zshrc
```

Replace `<MAC_STUDIO_IP>` with your Mac Studio's IP address (found via `ipconfig getifaddr en0`).

---

## Auto-Start on Boot (Optional)

Create a LaunchDaemon to start the server on boot:

```bash
sudo cat > /Library/LaunchDaemons/com.opta.nexus.plist << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.opta.nexus</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>/Users/matthewbyrden/start_opta_server.sh</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>UserName</key>
    <string>matthewbyrden</string>
</dict>
</plist>
EOF

sudo chown root:wheel /Library/LaunchDaemons/com.opta.nexus.plist
sudo chmod 644 /Library/LaunchDaemons/com.opta.nexus.plist
sudo launchctl load /Library/LaunchDaemons/com.opta.nexus.plist
```

---

## Quick Reference

| Service | Port | Check Command |
|---------|------|---------------|
| AI Engine (llama-server) | 8080 | `curl http://localhost:8080/health` |
| LiteLLM Proxy | 4000 | `curl http://localhost:4000/health` |
| RAM Disk | N/A | `ls /Volumes/OptaBuilds` |

| Screen Session | Attach Command |
|----------------|----------------|
| AI Engine | `screen -r ai-engine` |
| Proxy | `screen -r proxy` |

---

## Memory Allocation Summary (256GB)

- **AI Engine (DeepSeek-70B Q8):** 78 GB
- **Draft Model (Llama-3B):** 3 GB
- **RAM Disk (Build Forge):** 64 GB
- **Agent Context (KV Cache):** ~40 GB
- **OS Overhead:** ~20 GB
- **Linker Buffer:** ~51 GB

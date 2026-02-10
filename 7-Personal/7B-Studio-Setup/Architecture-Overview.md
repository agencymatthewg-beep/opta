Here is the extensive, fully-verified system architecture documentation. You can save this entire block as a file named OPTA\_INFRASTRUCTURE\_CONTEXT.md and provide it to your Claude Code agents.

This document tells the agents exactly **where** they are running, **how** to access the high-performance resources, and **what** the operational limits are.

# ---

**Opta Nexus: System Architecture & Workflow Protocol**

## **1\. Executive System Context**

**Infrastructure Role:** This environment is a high-availability "Headless Development Cloud" hosted on a local Mac Studio.

**Hardware:** Mac Studio M3 Ultra (80-Core GPU, 256GB Unified Memory, 1TB SSD).

**Throughput:** 800 GB/s Memory Bandwidth.

**Primary Function:** To serve as the centralized Compute, AI Inference, and Compilation host for two simultaneous developers (Rust/iOS/Cross-platform).

## ---

**2\. Server Configuration (The Mac Studio)**

### **A. Memory Allocation Map (256 GB Total)**

* **AI Engine (DeepSeek-70B Q8):** 78 GB (Wired).  
* **Speculative Draft Model (Llama-3B):** 3 GB (Wired).  
* **Build Forge (RAM Disk):** 64 GB (Wired \- /Volumes/OptaBuilds).  
* **Agent Context (KV Cache):** \~40 GB (Dynamic \- 4 Parallel Slots).  
* **Operating System Overhead:** \~20 GB.  
* **Linker Buffer:** \~51 GB (Reserved for cargo build linking spikes).  
* **Swap Strategy:** **Strictly Disabled** for build artifacts; system swap allowed only for OS stability.

### **B. The AI Engine (Llama.cpp Server)**

* **Service:** llama-server hosted on Port 8080\.  
* **Model:** DeepSeek-R1-Distill-Llama-70B-Q8\_0.gguf (8-bit Quantized).  
* **Acceleration:** Speculative Decoding via Llama-3.2-3B-Instruct-Q4\_K\_M.gguf.  
* **Concurrency:** 4 Parallel Slots (-np 4\) with Continuous Batching (-cb).  
* **Context Window:** 131,072 Tokens (128k) per user.  
* **Optimization:** 4-bit KV Cache Quantization (-ctk q4\_0 \-ctv q4\_0) to maximize agent capacity.

### **C. The Build Forge (RAM Disk)**

* **Mount Point:** /Volumes/OptaBuilds  
* **Capacity:** 64 GB  
* **Purpose:** Stores all Rust target/ directories.  
* **Persistence:** **Volatile** (Clears on restart). Source code remains on SSD; only artifacts are volatile.

### **D. The Router (LiteLLM Proxy)**

* **Service:** litellm hosted on Port 4000\.  
* **Function:** Translates Anthropic API format (Claude Code) to OpenAI format (Local Server).  
* **Endpoint:** http://localhost:4000 (Mapped to http://ai.opta.local via Traefik).

## ---

**3\. Client Configuration Protocols**

### **User 1: MacBook Pro (Core Logic / Rust)**

* **Connection Protocol:** VS Code Remote SSH (ssh user@192.168.1.XX).  
* **Agent Configuration (Claude Code CLI):**  
  Bash  
  export ANTHROPIC\_BASE\_URL="http://192.168.1.XX:4000"  
  export ANTHROPIC\_API\_KEY="sk-local-opta" \# Dummy key

* **Workflow:**  
  * **Edit:** VS Code (Remote).  
  * **Build:** Runs on Mac Studio RAM Disk (Instant).  
  * **Simulate:** Runs Native iOS Simulator on MacBook Pro (using forwarded build).

### **User 2: Windows PC (UI / Shell / Documentation)**

* **Connection Protocol:** VS Code Remote SSH (ssh user\_2@192.168.1.XX).  
* **Agent Configuration (PowerShell):**  
  PowerShell  
  $env:ANTHROPIC\_BASE\_URL\="http://192.168.1.XX:4000"  
  $env:ANTHROPIC\_API\_KEY\="sk-local-opta"

* **Workflow:**  
  * **Edit:** VS Code (Remote).  
  * **Visual:** Streams Mac Studio Desktop via **Jump Desktop** (Fluid Protocol) to view iOS Simulator/Canvas.  
  * **Build:** Runs on Mac Studio RAM Disk.

## ---

**4\. Operational "Laws of Physics" for Agents**

* **Agent Concurrency Limit:** **4 Concurrent Agents.**  
  * If launching a 5th agent, it will queue. Do not terminate; wait 5-10s.  
* **Prefill Stutter:**  
  * When User A's agent initializes (reads context), User B may see a 1-3 second pause in generation. **This is normal** (GPU Compute saturation).  
* **Context Hygiene:**  
  * The 128k context allows reading the entire codebase. Agents are encouraged to read src/ recursively before answering.

## ---

**5\. Automation: The Startup Script**

*Save this script as start\_opta\_server.sh in the Mac Studio home directory.*

Bash

\#\!/bin/bash  
\# OPTA NEXUS STARTUP SCRIPT  
\# Handles RAM Disk, AI Engine, and Proxy

\# 1\. Create 64GB RAM Disk for Rust Builds  
if \[ \! \-d "/Volumes/OptaBuilds" \]; then  
    echo "Creating 64GB RAM Disk..."  
    diskutil erasevolume HFS+ 'OptaBuilds' \`hdiutil attach \-nomount ram://134217728\`  
fi

\# 2\. Launch AI Engine (Screen Session: 'ai-engine')  
\# Uses DeepSeek-70B (Q8) \+ Llama-3B (Draft) \+ 4-bit Cache \+ 4 Slots  
screen \-dmS ai-engine ./llama-server \\  
    \-m /Users/Shared/Models/DeepSeek-R1-Distill-Llama-70B-Q8\_0.gguf \\  
    \-md /Users/Shared/Models/Llama-3.2-3B-Instruct-Q4\_K\_M.gguf \\  
    \-c 131072 \\  
    \-np 4 \\  
    \-cb \\  
    \-ngl 99 \\  
    \-ctk q4\_0 \\  
    \-ctv q4\_0 \\  
    \--host 0.0.0.0 \--port 8080

\# 3\. Launch LiteLLM Proxy (Screen Session: 'proxy')  
\# Requires config.yaml in the same folder  
screen \-dmS proxy litellm \--config config.yaml \--host 0.0.0.0 \--port 4000

echo "Opta Nexus Online."  
echo "AI Engine: Port 8080 | Proxy: Port 4000 | RAM Disk: Mounted"

## **6\. LiteLLM Config (config.yaml)**

YAML

model\_list:  
  \- model\_name: claude-3-5-sonnet-20241022  \# Intercepts Claude Code requests  
    litellm\_params:  
      model: openai/deepseek-r1-distill-llama-70b  
      api\_base: "http://localhost:8080/v1"  
      api\_key: "sk-local"  
      stop: \["\<|EOT|\>", "\<|end\_of\_sentence|\>"\]  

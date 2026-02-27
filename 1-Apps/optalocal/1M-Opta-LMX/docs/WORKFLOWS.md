---
title: WORKFLOWS.md — Development & Deployment Workflows
created: 2026-02-15
updated: 2026-02-22
type: operations
audience: Developers, deployers, operators
status: Active
---

# WORKFLOWS.md — Common Development & Deployment Tasks

This document outlines step-by-step procedures for common tasks during development and production.

---

## Workflow 1: Local Development Setup

**Goal:** Set up a development environment on your machine to work on LMX code.

**Time:** ~15 minutes  
**Tools needed:** Terminal, Python 3.12+, git

### Steps

1. **Clone/navigate to project**
   ```bash
   cd ~/Synced/Opta/1-Apps/1M-Opta-LMX
   ```

2. **Create virtual environment**
   ```bash
   python3.12 -m venv .venv
   source .venv/bin/activate
   ```

3. **Install in development mode**
   ```bash
   pip install -e ".[dev]"
   ```

4. **Verify installation**
   ```bash
   python -c "import mlx; import fastapi; print('✓ Dependencies installed')"
   ```

5. **Run tests to verify setup**
   ```bash
   pytest tests/ -v --log-cli-level=DEBUG
   ```

### Troubleshooting
- **MLX not found** — Make sure you're on macOS with Apple Silicon (M3 Ultra or M4)
- **Python version mismatch** — Use `python3.12` explicitly, not `python3`
- **Test failures** — Check that you have at least one MLX model downloaded

---

## Workflow 2: Add a New Model Architecture

**Goal:** Support a new model type (e.g., GLM-5, Qwen, etc.)

**Time:** ~2-4 hours  
**Prerequisites:** Model exists on HuggingFace, GGUF version available

### Steps

1. **Check if MLX weights exist**
   ```bash
   # Search HuggingFace for mlx-community conversions
   # https://huggingface.co/mlx-community
   ```
   - If yes → go to step 3 (easy path)
   - If no → go to step 2 (GGUF fallback path)

2. **GGUF Path: Verify GGUF version available**
   ```bash
   # Search https://huggingface.co/models?sort=downloads&search=model-name+gguf
   # Verify it has safetensors format (preferred)
   ```

3. **Add model to inventory**
   ```yaml
   # Edit config.yaml or model-manifest.yaml
   models:
     - id: "glm-5-9b"
       name: "GLM-5 9B Chat"
       type: "mlx"  # or "gguf"
       repo_id: "mlx-community/glm-5-9b"
       weights_file: "model.safetensors"
       sha256: "abc123..."  # Get from HF model card
       size_gb: 20
   ```

4. **Write a test to verify loading**
   ```python
   # tests/test_models.py
   @pytest.mark.asyncio
   async def test_load_glm5():
       engine = await ModelEngine.create()
       model = await engine.load_model("glm-5-9b")
       assert model is not None
       
       # Generate a test prompt
       response = await engine.generate("Hello, how are you?")
       assert len(response) > 0
   ```

5. **Run the test**
   ```bash
   pytest tests/test_models.py::test_load_glm5 -v
   ```

6. **Update model documentation**
   ```bash
   # Add to docs/models/GLMMODELS.md or similar
   echo "## GLM-5 9B Chat
   - Type: MLX (or GGUF)
   - Size: 20GB
   - Capabilities: Chat, instruction-following
   " >> docs/models.md
   ```

### Validation Checklist
- [ ] Model loads without errors
- [ ] Can generate tokens from it
- [ ] Test passes
- [ ] SHA256 hash verified
- [ ] Documentation updated

---

## Workflow 3: Test Inference Locally

**Goal:** Verify that a model can do inference and measure performance.

**Time:** ~10 minutes (after model is loaded)

### Steps

1. **Start LMX in debug mode**
   ```bash
   # Terminal 1: Start server
   LOGLEVEL=DEBUG uvicorn src.opta_lmx.main:app --reload \
     --host 127.0.0.1 --port 1234
   ```

2. **Test with curl (simple)**
   ```bash
   # Terminal 2: Send a request
   curl -X POST http://localhost:1234/v1/chat/completions \
     -H "Content-Type: application/json" \
     -d '{
       "model": "mistral-7b",
       "messages": [{"role": "user", "content": "Hello, write a haiku"}],
       "stream": false
     }'
   ```

3. **Test with Python openai SDK**
   ```python
   import openai
   
   openai.api_base = "http://localhost:1234/v1"
   openai.api_key = "not-used-locally"
   
   response = openai.ChatCompletion.create(
       model="mistral-7b",
       messages=[{"role": "user", "content": "Hello"}],
       stream=False
   )
   print(response.choices[0].message.content)
   ```

4. **Test streaming**
   ```python
   import openai
   
   openai.api_base = "http://localhost:1234/v1"
   openai.api_key = "not-used"
   
   response = openai.ChatCompletion.create(
       model="mistral-7b",
       messages=[{"role": "user", "content": "Count to 10"}],
       stream=True
   )
   
   for chunk in response:
       delta = chunk.choices[0].delta.get("content", "")
       print(delta, end="", flush=True)
   print()
   ```

5. **Measure performance**
   ```python
   import time
   import openai
   
   openai.api_base = "http://localhost:1234/v1"
   openai.api_key = "not-used"
   
   prompt = "Write a 100-word essay about AI."
   start = time.time()
   
   response = openai.ChatCompletion.create(
       model="mistral-7b",
       messages=[{"role": "user", "content": prompt}],
       stream=False
   )
   
   elapsed = time.time() - start
   tokens = len(response.usage["completion_tokens"])
   tok_per_sec = tokens / elapsed
   
   print(f"{tok_per_sec:.1f} tokens/sec")
   ```

### Expected Performance
- Mistral 7B (MLX): 40-60 tokens/sec
- Llama2 70B (MLX): 10-20 tokens/sec
- Mistral 7B (GGUF): 20-30 tokens/sec (slower due to quantization)

---

## Workflow 4: Run Benchmarks

**Goal:** Compare performance across models and configurations.

**Time:** ~30 minutes

### Setup

```bash
# Create a benchmark script: tests/benchmark.py
cat > tests/benchmark.py << 'EOF'
import asyncio
import time
from src.opta_lmx.inference.engine import ModelEngine

MODELS = ["mistral-7b", "llama2-7b", "phi-2"]
PROMPTS = [
    "Hello, how are you?",
    "Explain quantum computing",
    "Write a short story"
]

async def benchmark():
    engine = await ModelEngine.create()
    
    for model_id in MODELS:
        try:
            model = await engine.load_model(model_id)
            results = []
            
            for prompt in PROMPTS:
                start = time.time()
                response = await engine.generate(prompt, max_tokens=100)
                elapsed = time.time() - start
                tokens = len(response.split())
                tok_per_sec = tokens / elapsed
                
                results.append({
                    "prompt": prompt[:50],
                    "tokens": tokens,
                    "elapsed": elapsed,
                    "tok_per_sec": tok_per_sec
                })
            
            # Print results for this model
            print(f"\n{model_id}:")
            for r in results:
                print(f"  {r['prompt']}: {r['tok_per_sec']:.1f} tok/s")
            
            await engine.unload_model(model_id)
        except Exception as e:
            print(f"Failed to benchmark {model_id}: {e}")

if __name__ == "__main__":
    asyncio.run(benchmark())
EOF

# Run it
python -m pytest tests/benchmark.py -v -s
```

### Output Example
```
mistral-7b:
  Hello, how are you?: 45.3 tok/s
  Explain quantum computing: 42.1 tok/s
  Write a short story: 44.8 tok/s

llama2-7b:
  Hello, how are you?: 35.2 tok/s
  Explain quantum computing: 33.9 tok/s
  Write a short story: 34.7 tok/s
```

---

## Workflow 5: Deploy to Mac Studio (launchd)

**Goal:** Install and run LMX as a persistent daemon on Mac Studio.

**Time:** ~15 minutes  
**Prerequisites:** LMX code is finalized, models are ready

### Steps

1. **SSH to Mac Studio**
   ```bash
   ssh matthew@mac-studio.local
   ```

2. **Create directories**
   ```bash
   sudo mkdir -p /var/log/opta-lmx
   sudo mkdir -p /Users/Shared/Opta-LMX/models
   sudo chown $(whoami) /Users/Shared/Opta-LMX/models
   ```

3. **Install Python package**
   ```bash
   cd ~/Synced/Opta/1-Apps/1M-Opta-LMX
   pip install -e .
   ```

4. **Create launchd plist**
   ```bash
   sudo tee /Library/LaunchDaemons/com.opta.lmx.plist > /dev/null << 'EOF'
   <?xml version="1.0" encoding="UTF-8"?>
   <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
     "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
   <plist version="1.0">
   <dict>
       <key>Label</key>
       <string>com.opta.lmx</string>
       <key>ProgramArguments</key>
       <array>
           <string>/usr/local/bin/python3.12</string>
           <string>-m</string>
           <string>uvicorn</string>
           <string>src.opta_lmx.main:app</string>
           <string>--host</string>
           <string>127.0.0.1</string>
           <string>--port</string>
           <string>1234</string>
       </array>
       <key>WorkingDirectory</key>
       <string>/Users/Shared/Opta-LMX</string>
       <key>KeepAlive</key>
       <true/>
       <key>RunAtLoad</key>
       <true/>
       <key>StandardOutPath</key>
       <string>/var/log/opta-lmx/out.log</string>
       <key>StandardErrorPath</key>
       <string>/var/log/opta-lmx/err.log</string>
       <key>EnvironmentVariables</key>
       <dict>
           <key>LOGLEVEL</key>
           <string>INFO</string>
       </dict>
   </dict>
   </plist>
   EOF
   ```

5. **Create config file**
   ```bash
   cat > ~/.opta-lmx/config.yaml << 'EOF'
   # Opta-LMX Configuration
   server:
     host: "127.0.0.1"
     port: 1234
   
   models:
     directory: "/Users/Shared/Opta-LMX/models"
     default: "mistral-7b"
   
   memory:
     max_percent: 90
   
   logging:
     level: "INFO"
     file: "/var/log/opta-lmx/app.log"
   EOF
   ```

6. **Start the daemon**
   ```bash
   sudo launchctl load /Library/LaunchDaemons/com.opta.lmx.plist
   ```

7. **Verify it's running**
   ```bash
   # Check status
   launchctl list com.opta.lmx
   
   # Test API
   curl http://localhost:1234/v1/models
   
   # Check logs
   log stream --level debug --predicate 'process == "uvicorn"'
   ```

### Troubleshooting
- **"Permission denied"** — Use `sudo` for plist operations
- **"Port 1234 already in use"** — Check if LM Studio is still running
- **Logs not appearing** — Check `/var/log/opta-lmx/` permissions

---

## Workflow 6: Monitor & Debug in Production

**Goal:** Troubleshoot issues on Mac Studio without interactive access.

**Time:** Variable

### Log Inspection
```bash
# Follow logs live
log stream --level debug --predicate 'process == "uvicorn"' --follow

# Search logs for errors
log show --predicate 'process == "uvicorn"' --level error

# Last 100 lines
tail -100 /var/log/opta-lmx/out.log
```

### Health Check
```bash
# Is daemon running?
launchctl list com.opta.lmx

# API health
curl http://localhost:1234/v1/models

# Memory usage
curl http://localhost:1234/admin/status | jq .memory
```

### Restart Daemon
```bash
# Graceful restart
launchctl bootout gui/$(id -u)/com.opta.lmx
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.opta.lmx.plist

# Or full system restart if necessary
sudo launchctl stop com.opta.lmx
sudo launchctl start com.opta.lmx
```

---

## Workflow 7: Integration Test with Opta CLI

**Goal:** Verify that Opta CLI can connect to LMX and request inference.

**Time:** ~10 minutes  
**Prerequisites:** LMX running, Opta CLI installed

### Steps

1. **Start LMX (if not already running)**
   ```bash
   # On Mac Studio
   uvicorn src.opta_lmx.main:app --host 127.0.0.1 --port 1234
   ```

2. **Test from MacBook (Opta CLI)**
   ```bash
   # Configure CLI to use LMX
   export INFERENCE_HOST="mac-studio.local"
   
   # Test connection
   opta connect
   # Should output: "✓ Connected to LMX on mac-studio.local:1234"
   
   # List models
   opta models
   # Should list: mistral-7b, llama2-70b, etc.
   
   # Test inference
   opta do "Write a haiku"
   # Should return a haiku via streaming
   ```

3. **Test streaming explicitly**
   ```bash
   opta do --stream "Count to 5" | head -20
   ```

4. **Check memory on Mac Studio**
   ```bash
   curl http://localhost:1234/admin/status | jq .
   ```

### Expected Output
```
$ opta do "Hello"
Connected to mistral-7b...
Hello! How can I assist you today?
```

---

## Workflow 8: Load Test (Concurrent Requests)

**Goal:** Verify LMX handles multiple simultaneous requests without crashing.

**Time:** ~15 minutes

### Script (Python)
```python
# tests/load_test.py
import asyncio
import aiohttp
import time

async def send_request(session, model, prompt, request_id):
    """Send a single request to LMX."""
    start = time.time()
    try:
        async with session.post(
            "http://localhost:1234/v1/chat/completions",
            json={
                "model": model,
                "messages": [{"role": "user", "content": prompt}],
                "stream": False
            }
        ) as resp:
            result = await resp.json()
            elapsed = time.time() - start
            return {
                "request_id": request_id,
                "status": resp.status,
                "elapsed": elapsed,
                "tokens": result.get("usage", {}).get("completion_tokens", 0)
            }
    except Exception as e:
        return {
            "request_id": request_id,
            "error": str(e)
        }

async def load_test():
    """Send 10 concurrent requests."""
    async with aiohttp.ClientSession() as session:
        tasks = [
            send_request(
                session,
                "mistral-7b",
                f"Hello, this is request {i}",
                i
            )
            for i in range(10)
        ]
        results = await asyncio.gather(*tasks)
    
    # Print results
    print(f"\nLoad Test Results (10 concurrent requests):")
    successful = [r for r in results if "error" not in r]
    failed = [r for r in results if "error" in r]
    
    if successful:
        avg_latency = sum(r["elapsed"] for r in successful) / len(successful)
        avg_tokens = sum(r["tokens"] for r in successful) / len(successful)
        print(f"  ✓ Successful: {len(successful)}")
        print(f"    Avg latency: {avg_latency:.2f}s")
        print(f"    Avg tokens: {avg_tokens:.0f}")
    
    if failed:
        print(f"  ✗ Failed: {len(failed)}")
        for r in failed:
            print(f"    Request {r['request_id']}: {r['error']}")

if __name__ == "__main__":
    asyncio.run(load_test())
```

### Run It
```bash
python tests/load_test.py
```

### Expected Output (6 Bots Scenario)
```
Load Test Results (10 concurrent requests):
  ✓ Successful: 10
    Avg latency: 3.45s
    Avg tokens: 45
```

---

## Workflow 9: Update Dependencies

**Goal:** Upgrade MLX, FastAPI, or other dependencies safely.

**Time:** ~30 minutes

### Steps

1. **Check for updates**
   ```bash
   pip list --outdated
   ```

2. **Update a specific package**
   ```bash
   pip install --upgrade mlx
   ```

3. **Update all dev dependencies**
   ```bash
   pip install --upgrade -r requirements-dev.txt
   ```

4. **Run full test suite**
   ```bash
   pytest tests/ -v
   ```

5. **Test locally**
   ```bash
   uvicorn src.opta_lmx.main:app --reload --port 1234
   ```

6. **If tests pass, update pyproject.toml**
   ```toml
   [project]
   dependencies = [
       "mlx>=0.14.0",  # Updated from 0.13.0
       ...
   ]
   ```

7. **Commit changes**
   ```bash
   git add pyproject.toml
   git commit -m "chore: upgrade mlx to 0.14.0"
   ```

---

## Workflow 10: Operate & Test Multi-Agent + Skills-Native

**Goal:** Validate end-to-end agent run lifecycle, skills execution, and MCP bridge behavior.

**Time:** ~15-20 minutes  
**Prerequisites:** Server dependencies installed, at least one model loaded

### Steps

1. **Start the API server**
   ```bash
   uvicorn src.opta_lmx.main:app --host 127.0.0.1 --port 1234
   ```

2. **Verify skills registry and MCP bridge surface**
   ```bash
   curl -s http://127.0.0.1:1234/v1/skills | jq .
   curl -s http://127.0.0.1:1234/v1/skills/mcp/tools | jq .
   ```

3. **Execute a known skill through native endpoint**
   ```bash
   curl -s -X POST http://127.0.0.1:1234/v1/skills/add/execute \
     -H "Content-Type: application/json" \
     -d '{"arguments":{"left":2,"right":5}}' | jq .
   ```

4. **Execute the same capability through MCP-style adapter**
   ```bash
   curl -s -X POST http://127.0.0.1:1234/v1/skills/mcp/call \
     -H "Content-Type: application/json" \
     -d '{"name":"add","arguments":{"left":2,"right":5}}' | jq .
   ```

5. **Create a strategy-native agent run**
   ```bash
   RUN_ID=$(curl -s -X POST http://127.0.0.1:1234/v1/agents/runs \
     -H "Content-Type: application/json" \
     -H "x-priority: interactive" \
     -H "traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01" \
     -d '{
       "request":{
         "strategy":"parallel_map",
         "prompt":"Summarize release risks",
         "roles":["researcher","reviewer"],
         "model":"auto",
         "max_parallelism":2,
         "timeout_sec":90
       },
       "metadata":{"source":"workflow-10"}
     }' | jq -r '.id')

   echo "$RUN_ID"
   ```

6. **Poll run status to completion**
   ```bash
   curl -s "http://127.0.0.1:1234/v1/agents/runs/$RUN_ID" | jq .
   curl -s "http://127.0.0.1:1234/v1/agents/runs?limit=20&status=completed" | jq .
   ```

7. **Validate cancellation path**
   ```bash
   SLOW_RUN_ID=$(curl -s -X POST http://127.0.0.1:1234/v1/agents/runs \
     -H "Content-Type: application/json" \
     -d '{
       "agent":"default",
       "input":{
         "strategy":"handoff",
         "prompt":"Long planning chain",
         "roles":["planner","coder","reviewer"],
         "timeout_sec":300
       }
     }' | jq -r '.id')

   curl -s -X POST "http://127.0.0.1:1234/v1/agents/runs/$SLOW_RUN_ID/cancel" | jq .
   ```

### Expected Results
- `/v1/skills` and `/v1/skills/mcp/tools` return non-empty tool/skill metadata.
- Native and MCP skill calls return consistent functional output.
- Agent run transitions through `queued`/`running` to a terminal state (`completed`, `failed`, or `cancelled`).
- Cancel endpoint sets target run status to `cancelled`.

---

## Workflow 11: Deploy Monitoring and Alert Pack (OC-043)

**Goal:** Install Opta LMX operations dashboards and alerts for OpenClaw bot fleet runtime visibility.

**Time:** ~20 minutes  
**Prerequisites:** Prometheus + Grafana access, `GET /admin/metrics` reachable

### Steps

1. **Verify metrics endpoint**
   ```bash
   curl -s http://127.0.0.1:1234/admin/metrics | head -40
   ```

2. **Install alert rules into Prometheus**
   ```bash
   sudo mkdir -p /etc/prometheus/rules/opta-lmx
   sudo cp docs/ops/monitoring/prometheus-alerts.yaml \
     /etc/prometheus/rules/opta-lmx/prometheus-alerts.yaml
   ```

3. **Reference rules in `prometheus.yml`**
   ```yaml
   rule_files:
     - /etc/prometheus/rules/opta-lmx/prometheus-alerts.yaml
   ```

4. **Reload Prometheus**
   ```bash
   curl -X POST http://localhost:9090/-/reload
   ```

5. **Import Grafana dashboard**
   - In Grafana: `Dashboards` -> `Import`
   - Upload: `docs/ops/monitoring/grafana-openclaw-dashboard.json`
   - Select the Prometheus datasource

6. **Verify alert and panel health**
   ```bash
   curl -s http://localhost:9090/api/v1/rules | jq '.status'
   ```

### Expected Results
- Alert rules load without Prometheus parse errors.
- Grafana dashboard `Opta LMX OpenClaw Fleet` renders all six core panels.
- Queue, latency, error ratio, and memory pressure signals are visible in one view.

---

## Workflow 5: Reliability + Perf Gate Verification

**Goal:** Validate never-crash loader behavior and tuned-profile performance gates before merge.

**Time:** ~2-5 minutes

### Steps

1. **Run gate tests**
   ```bash
   PYTHONPATH=src .venv/bin/pytest -q tests/test_chaos_resilience.py tests/test_perf_gate.py
   ```

2. **Interpret loader gate**
   - Loader crash/timeout simulations must quarantine the model.
   - API process remains alive; no hard process exit is allowed.

3. **Interpret autotune perf gate**
   - `avg_tokens_per_second` baseline comparison is enforced.
   - Gate must fail when throughput regression exceeds 15%.

4. **If gate fails**
   - Do not merge.
   - Attach failure output to the PR/session log.
   - Either update tuned baseline deliberately (with rationale) or fix runtime regression.

---

## Reference: Common Commands

### Development
```bash
# Install for development
pip install -e ".[dev]"

# Run tests
pytest tests/ -v

# Run specific test
pytest tests/test_api.py::test_chat_completions -v

# Run with coverage
pytest --cov=src tests/

# Start server
uvicorn src.opta_lmx.main:app --reload --port 1234

# Type check
mypy src/

# Lint
ruff check src/
```

### Deployment
```bash
# Install for production
pip install .

# Start daemon
sudo launchctl load /Library/LaunchDaemons/com.opta.lmx.plist

# Stop daemon
sudo launchctl bootout gui/$(id -u)/com.opta.lmx

# Follow logs
log stream --level debug

# Check status
launchctl list com.opta.lmx

# Health check
curl http://localhost:1234/admin/health
```

---

## References
- Deployment details: `CLAUDE.md` §5
- Safety guardrails: `docs/GUARDRAILS.md`
- Architecture: `docs/DECISIONS.md`
- Ecosystem: `docs/ECOSYSTEM.md`

---

*These workflows are living documents. Update them as new processes emerge or existing ones change.*

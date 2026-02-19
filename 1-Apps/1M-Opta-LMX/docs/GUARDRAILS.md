---
title: GUARDRAILS.md — Non-Negotiable Safety Rules
created: 2026-02-15
updated: 2026-02-15
type: safety
audience: All developers, reviewers, deployers
status: Active
---

# GUARDRAILS.md — Opta-LMX Safety & Non-Negotiable Rules

These rules are **absolute.** They override convenience. Violations are bugs, not design choices. Every person touching this code must know and follow them.

---

## 🔴 CRITICAL: Global Rules (C01-C06)

These come from `~/Synced/AI26/2-Bot-Ops/2A-Compliance/RULES-GLOBAL.md`. All bots and AIs follow these.

| ID | Rule | What It Means | LMX Context |
|----|------|---------------|----|
| **C01** | **No data exfiltration** — Never send private data (keys, tokens, personal info) to external services without explicit approval | Keys, tokens, model weights, logs → never to cloud | Never log API keys, model weights, or user prompts to external services. Logs stay local. |
| **C02** | **No destructive commands without confirmation** — `rm -rf`, `DROP TABLE`, format, etc. require explicit "yes, delete" | Critical data loss prevention | Model deletion, cache clearing must be confirmed. No silent purges. |
| **C03** | **No external posts without approval** — Tweets, emails, public messages require confirmation before sending | No accidental public announcements | Error reports never auto-posted. Telemetry never public. |
| **C04** | **No self-modification of safety rules** — Cannot edit RULES-GLOBAL.md, cannot disable compliance system | Safety rules are immutable | This file is read-only. Code cannot disable safety checks. |
| **C05** | **No bypassing authentication** — Cannot disable gateway auth, cannot share tokens publicly | Security is mandatory | API keys in config are local-only. Never expose auth tokens in logs. |
| **C06** | **No executing untrusted code** — Scripts from ClawHub, random GitHub repos, etc. must be reviewed first | Code review required | All external dependencies (pip packages) are pinned versions. No dynamic installs. |

**Enforcement:** STOP immediately if a violation occurs. Do not complete the action. Explain why.

---

## 🟠 LMX-SPECIFIC GUARDRAILS

These rules are unique to Opta-LMX because we're building an inference server on resource-constrained hardware.

### G-LMX-01: Memory Limits (Never Exceed 90%)

**Rule:** Never load a model if it would use more than 90% of available unified memory.

**Why:** Beyond 90%, OOM kills are likely. The server must crash gracefully, not out-of-memory panic.

**Implementation:**
```python
# ✅ CORRECT
async def can_load_model(model_size_gb: float) -> bool:
    available = psutil.virtual_memory().available
    threshold = available * 0.90
    return model_size_gb < threshold

# ❌ WRONG
async def load_model(model_id: str):
    # No memory check → can OOM crash
    model = mlx_lm.load(model_id)
    ...
```

**Enforcement:**
- Before loading: check memory
- If won't fit: return 503 or unload least-recently-used model
- Never crash. Ever.

---

### G-LMX-02: All Model Downloads Verified

**Rule:** Every model downloaded from HuggingFace must be verified with SHA256 before loading.

**Why:** Compromised model weights = compromised server. We need to trust what we load.

**Implementation:**
```python
# ✅ CORRECT
async def download_model(model_id: str, expected_sha256: str) -> bool:
    model_path = await hf_hub.download(model_id)
    actual_sha256 = hashlib.sha256(open(model_path, 'rb').read()).hexdigest()
    if actual_sha256 != expected_sha256:
        raise SecurityError(f"SHA256 mismatch: {model_id}")
    return True

# ❌ WRONG
async def download_model(model_id: str):
    model_path = await hf_hub.download(model_id)
    # No verification → could load corrupted model
    return True
```

**Enforcement:**
- Store SHA256 hashes in model inventory
- Verify on download
- Fail fast if hash doesn't match

---

### G-LMX-03: API Keys Never in Logs

**Rule:** No API keys, tokens, model weights, or sensitive data in server logs.

**Why:** Logs are persisted. If leaked, credentials are exposed.

**Implementation:**
```python
# ✅ CORRECT
logger.info("model_loaded", extra={
    "model_id": "mistral-7b",  # OK (public)
    "size_gb": 14,             # OK (metric)
    # token=request.headers["authorization"] — NEVER
})

# ❌ WRONG
logger.info(f"Loading {model_id} with key {api_key}")  # Exposes key
logger.debug(f"Request: {request}")  # May contain secrets
```

**Enforcement:**
- Code review checks for sensitive data in logs
- Sanitize request/response logging
- Never log request bodies or headers that contain auth

---

### G-LMX-04: No Cloud API Calls

**Rule:** LMX is a LOCAL inference server. It NEVER calls cloud APIs (OpenAI, Anthropic, etc.).

**Why:** The whole point is local, autonomous inference. If we proxy to cloud, we've defeated the purpose.

**Exceptions:**
- HuggingFace API (model downloads only, not inference)
- No exceptions to this rule

**Implementation:**
```python
# ✅ CORRECT
# Only local inference
response = await engine.generate(prompt)

# ❌ WRONG
import openai
openai.api_key = "sk-..."
response = await openai.ChatCompletion.create(...)  # NO
```

**Enforcement:**
- No `openai`, `anthropic`, `groq` imports in main code
- No external inference calls
- If a model doesn't have MLX support, use GGUF fallback (see G-LMX-05)

---

### G-LMX-05: Graceful Degradation Over Crash

**Rule:** When things go wrong (OOM, model load fails, etc.), degrade gracefully instead of crashing.

**Why:** LMX is infrastructure. A crash affects 6+ bots. Returning an error is better.

**Patterns:**
| Failure | Graceful Response |
|---------|-------------------|
| Model load fails | 503 "Model unavailable, trying fallback" |
| OOM on load | Unload LRU model, retry |
| OOM during inference | Stop generation, return partial response |
| Inference timeout | Interrupt, return "Request timeout" |
| Concurrent request overflow | Queue request, return 429 if queue full |

**Implementation:**
```python
# ✅ CORRECT
try:
    await engine.load_model(model_id)
except OOMError:
    await engine.unload_least_used()
    await engine.load_model(model_id)
except Exception as e:
    logger.error(f"Load failed: {e}")
    return HTTPException(503, "Model unavailable")

# ❌ WRONG
await engine.load_model(model_id)  # Crash on error
```

**Enforcement:**
- Every inference endpoint has try/except
- No bare `raise` that crashes the server
- Always return a meaningful HTTP error

---

### G-LMX-06: OpenAI API Compatibility is Non-Negotiable

**Rule:** Any change that breaks OpenAI API compatibility is a **BUG**, not a feature.

**Why:** Every client expects the exact same API format. Breaking it breaks all downstream tools.

**What "Compatible" Means:**
- Request format matches OpenAI exactly
- Response format matches OpenAI exactly
- SSE streaming format matches OpenAI exactly
- Error response codes match OpenAI conventions
- Any Python `openai` SDK client works without modification

**Example Test:**
```python
# This MUST work on day 1 and every day
import openai
openai.api_base = "http://localhost:1234/v1"
openai.api_key = "not-used-locally"

response = openai.ChatCompletion.create(
    model="mistral-7b",
    messages=[{"role": "user", "content": "Hello"}]
)
assert response["choices"][0]["message"]["role"] == "assistant"
```

**Enforcement:**
- API contract tests in `tests/test_openai_compat.py`
- Run on every commit
- Any breaking change = revert + discuss

---

## 🟡 DEPLOYMENT GUARDRAILS

### G-DEPLOY-01: launchd Configuration

**Rule:** LMX runs as a launchd daemon on macOS, not a manual foreground process.

**Why:** Ensures auto-start on boot, auto-restart on crash, proper resource limits.

**Plist Requirements:**
```xml
<key>Label</key>
<string>com.opta.lmx</string>

<key>ProgramArguments</key>
<array>
    <string>/usr/local/bin/python3.11</string>
    <string>-m</string>
    <string>uvicorn</string>
    <string>src.opta_lmx.main:app</string>
    <string>--host</string><string>127.0.0.1</string>
    <string>--port</string><string>1234</string>
</array>

<key>KeepAlive</key>
<true/>  <!-- Auto-restart on crash -->

<key>RunAtLoad</key>
<true/>  <!-- Start on boot -->

<key>StandardOutPath</key>
<string>/var/log/opta-lmx/out.log</string>

<key>StandardErrorPath</key>
<string>/var/log/opta-lmx/err.log</string>
```

**Enforcement:**
- Plist must exist at `/Library/LaunchDaemons/com.opta.lmx.plist`
- Cannot run as foreground process in production
- Logs must be persistent (not stdout-only)

---

### G-DEPLOY-02: Port 1234 (Drop-in Replacement)

**Rule:** LMX MUST listen on port 1234, same as LM Studio.

**Why:** Every client is already configured for port 1234. Changing port breaks everything.

**Enforcement:**
- Hardcoded in launchd plist
- Cannot be changed without Matthew's explicit approval
- Tests verify it's listening on 1234

---

### G-DEPLOY-03: Configuration is Versioned

**Rule:** All configuration must be in version control (`config.yaml` template) or generated deterministically.

**Why:** Reproducible deployments. Config can be restored if corrupted.

**What's Versioned:**
- `config.yaml` template (defaults for all settings)
- Model manifest (SHA256 hashes, locations)
- Routing rules

**What's NOT Versioned:**
- Runtime logs
- Downloaded models (large, on-disk)
- Temporary files

---

## 🟢 REVIEW CHECKLIST

Before merging any code, verify:

```
[ ] All tests pass (pytest tests/)
[ ] API contract test passes (OpenAI SDK compatible)
[ ] No API keys in code or logs
[ ] Memory limits respected (check G-LMX-01)
[ ] Error handling is graceful (G-LMX-05)
[ ] All functions are async where I/O happens (CLAUDE.md)
[ ] Type hints everywhere (CLAUDE.md)
[ ] No cloud API calls (G-LMX-04)
[ ] Model downloads verified (G-LMX-02)
[ ] Follows project structure (CLAUDE.md)
[ ] Documentation updated if API changed
```

---

## 🔗 Related Documents

- Global rules: `~/Synced/AI26/2-Bot-Ops/2A-Compliance/RULES-GLOBAL.md`
- Coding rules: `CLAUDE.md`
- Architecture decisions: `docs/DECISIONS.md`
- API spec: `docs/research/openai-api-spec.md`

---

## Violations & Escalation

**What to do if you find a violation:**
1. **Stop** immediately
2. **Log** it (e.g., "OOM crash detected in production")
3. **Report** to Matthew with details
4. **Fix** only after understanding root cause

**No "it will probably be fine" decisions.** These are non-negotiable.

---

*Last updated: 2026-02-15*
*These rules exist to keep LMX reliable, safe, and trustworthy. Follow them absolutely.*

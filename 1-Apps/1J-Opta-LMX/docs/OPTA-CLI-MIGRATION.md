# Opta CLI ↔ Opta-LMX Migration Plan

**Created:** 2026-02-15
**Purpose:** Document all feature overlaps, define clear boundaries, and plan the migration of model management features from Opta CLI to Opta-LMX.

---

## 1. Current Opta CLI State

**Location:** `~/Synced/Opta/1-Apps/1D-Opta-CLI-TS/`
**Codebase:** 1,692 lines across 19 TypeScript files
**Status:** Beta — agent loop complete, chat/sessions/memory/skills are stubs

### What's Built

| File | Lines | Status | Description |
|------|-------|--------|-------------|
| `src/index.ts` | 108 | ✅ Complete | CLI entry point, 8 commands, lazy loading |
| `src/core/agent.ts` | 346 | ✅ Complete | Agent loop — streaming, tools, compaction, permissions |
| `src/core/tools.ts` | 374 | ✅ Complete | 8 tools: read, write, edit, list, search, find, run, ask |
| `src/core/config.ts` | 111 | ✅ Complete | Zod schema, 4-layer config priority |
| `src/core/errors.ts` | — | ✅ Complete | Exit codes, error formatting |
| `src/core/debug.ts` | — | ✅ Complete | Verbose/debug logging |
| `src/commands/models.ts` | 183 | ✅ Complete | list/use/info — **NEEDS MIGRATION** |
| `src/commands/connect.ts` | 70 | ✅ Complete | LM Studio discovery — **NEEDS REWRITE** |
| `src/commands/do.ts` | 48 | ✅ Complete | Single-shot agent wrapper |
| `src/providers/lmstudio.ts` | 97 | ✅ Complete | LM Studio API adapter — **NEEDS REPLACEMENT** |
| `src/providers/manager.ts` | 58 | ✅ Complete | Provider selection — **NEEDS UPDATE** |
| `src/providers/base.ts` | 45 | ✅ Complete | Provider interface |
| `src/ui/*` | ~80 | ✅ Complete | Spinner, markdown, output |
| `src/commands/chat.ts` | 11 | ⚠️ Stub | Empty — needs implementation |
| `src/memory/store.ts` | 5 | ⚠️ Stub | Empty — needs implementation |
| `src/skills/loader.ts` | 4 | ⚠️ Stub | Empty — needs implementation |
| `src/commands/sessions.ts` | — | ⚠️ Stub | Command wired, no logic |
| `src/commands/mcp.ts` | — | ⚠️ Stub | V2 placeholder |
| `src/providers/anthropic.ts` | — | ⚠️ Stub | Cloud fallback placeholder |

---

## 2. Feature Overlap Analysis

### Features That MOVE to Opta-LMX

These features are currently in Opta CLI but belong in the inference server:

| Feature | Current Location | What It Does | Why It's LMX's Job |
|---------|-----------------|-------------|-------------------|
| **LM Studio connection** | `commands/connect.ts` | Discovers LM Studio, validates connection | LMX replaces LM Studio entirely — CLI connects to LMX instead |
| **LM Studio provider** | `providers/lmstudio.ts` | OpenAI SDK wrapper for LM Studio API | LMX serves the same API — this adapter becomes unnecessary |
| **Model listing from server** | `commands/models.ts` (listModels) | Queries LM Studio `/v1/models` | LMX's Admin API provides richer model info |
| **Model info** | `commands/models.ts` (infoModel) | Queries model details from LM Studio | LMX knows everything about its models (size, quant, speed, memory) |
| **Context limit lookup table** | `providers/lmstudio.ts` (CONTEXT_LIMIT_TABLE) | Hardcoded context limits per model | LMX should report this dynamically — it knows the loaded model's actual limit |
| **Model validation** | `providers/lmstudio.ts` (validate) | Sends 1-token test to verify model works | LMX's health check covers this |
| **Connection host/port config** | `core/config.ts` (connection object) | Stores LM Studio IP:port | Simplifies to LMX endpoint (could be same IP:port or different) |

### Features That STAY in Opta CLI

| Feature | Location | Why It Stays |
|---------|----------|-------------|
| **Agent loop** | `core/agent.ts` | CLI-side reasoning — decides what tools to call, manages conversation |
| **Tool system** (8 tools) | `core/tools.ts` | Executes on the USER'S machine — reads/edits their files |
| **Permissions** (allow/ask/deny) | `core/tools.ts`, `core/config.ts` | User-facing security, not inference-level |
| **Context compaction** | `core/agent.ts` (compactHistory) | Conversation management, not model management |
| **Streaming output** | `core/agent.ts` (collectStream) | Terminal rendering, not inference |
| **Chat REPL** | `commands/chat.ts` | User interaction — terminal UI |
| **Sessions** | `commands/sessions.ts`, `memory/store.ts` | User's conversation history |
| **Project memory** | `.opta/memory.md` | Local project knowledge |
| **Skills system** | `skills/loader.ts` | Extensibility framework |
| **MCP integration** | `commands/mcp.ts` | Tool protocol, not inference |
| **CLI framework** | `index.ts` | Entry point, command routing |
| **UI components** | `ui/*` | Terminal rendering |
| **Error handling** | `core/errors.ts` | CLI error UX |

### Features That GET ENHANCED (Both Sides)

| Feature | CLI Side | LMX Side |
|---------|----------|----------|
| **Model selection** | `opta models use <name>` — picks which model for agent loop | Admin API — loads/unloads the actual model weights |
| **Model downloading** | `opta models download <repo>` — CLI command triggers it | Admin API — actually performs the download + conversion |
| **Benchmarking** | `opta models bench <name>` — displays results | Admin API — runs the actual benchmark |
| **Smart routing** | `opta do` sends task → LMX picks model | Router classifies task, selects best loaded model |
| **Dual-model mode** | `opta do --architect X --coder Y` — agent loop orchestrates | LMX serves both models, handles memory |
| **Health monitoring** | `opta serve status` — displays health | Admin API — reports memory, speed, health |

---

## 3. Files That Need Changes in Opta CLI

### DELETE (Replaced by LMX)

```
src/providers/lmstudio.ts     — LMX replaces LM Studio entirely
```

### REWRITE

```
src/commands/connect.ts       — Connect to LMX instead of LM Studio
                                Simpler: just validate LMX endpoint is alive
                                
src/commands/models.ts        — Delegate to LMX Admin API
                                Add: download, load, unload, bench, status subcommands
                                Remove: direct LM Studio API calls

src/providers/manager.ts      — Replace LM Studio provider discovery with LMX client
                                Simpler: always use LMX provider

src/core/config.ts            — Rename connection.host/port to lmx.endpoint
                                Add: lmx.adminPort (if separate)
                                Keep: model.default, permissions, safety
```

### ADD (New Files)

```
src/providers/lmx.ts          — Opta-LMX client
                                OpenAI API for inference (same as lmstudio.ts)
                                + Admin API calls (load, unload, download, status, bench)

src/commands/serve.ts         — Remote LMX service management
                                start, stop, status, logs, update subcommands
                                Via SSH or LMX Admin API

src/core/router.ts            — Smart model routing logic (optional V2)
                                Ask LMX which model to use for a given task
```

### KEEP UNCHANGED

```
src/index.ts                  — Only add 'serve' command registration
src/core/agent.ts             — No changes needed (talks to OpenAI API regardless of backend)
src/core/tools.ts             — No changes (file operations are local)
src/core/errors.ts            — No changes
src/core/debug.ts             — No changes
src/commands/do.ts            — No changes (wraps agent loop)
src/commands/chat.ts          — No changes (needs implementation, but doesn't touch inference)
src/commands/sessions.ts      — No changes
src/commands/config.ts        — Minor: update config key names
src/commands/mcp.ts           — No changes
src/commands/completions.ts   — No changes
src/memory/store.ts           — No changes
src/skills/loader.ts          — No changes
src/ui/*                      — No changes
src/providers/base.ts         — No changes (interface stays the same)
src/providers/anthropic.ts    — No changes (cloud fallback)
```

---

## 4. Config Schema Migration

### Current (Opta CLI → LM Studio)

```typescript
{
  connection: {
    host: "192.168.188.11",    // LM Studio host
    port: 1234,                 // LM Studio port
    protocol: "http"
  },
  model: {
    default: "glm-4.7-flash",
    contextLimit: 128000
  },
  permissions: { ... },
  safety: { ... }
}
```

### After (Opta CLI → Opta-LMX)

```typescript
{
  lmx: {
    endpoint: "http://192.168.188.11:1234",   // LMX inference API
    adminEndpoint: "http://192.168.188.11:1235", // LMX admin API (optional, can be same port)
    // OR just one endpoint if admin is on same server:
    // endpoint: "http://192.168.188.11:1234"  // Admin at /admin/* on same port
  },
  model: {
    default: "glm-5-4bit",     // Default model (LMX loads it)
    architect: "",              // Optional: model for planning (V2)
    coder: "",                  // Optional: model for coding (V2)
    contextLimit: 0             // 0 = ask LMX for model's limit (dynamic)
  },
  routing: {
    enabled: false,             // V2: let LMX pick model per task
    rules: []                   // V2: custom routing rules
  },
  permissions: { ... },         // Unchanged
  safety: { ... }               // Unchanged
}
```

### Migration Path
- `contextLimit: 0` means "ask LMX" — LMX reports the actual limit for the loaded model
- `connection.host/port` → `lmx.endpoint` (single URL instead of host+port+protocol)
- Backward compatible: if `connection` exists in old config, convert to `lmx.endpoint` automatically

---

## 5. New `opta models` Command Spec (Post-Migration)

```bash
# === INFERENCE SELECTION (stays in CLI) ===
opta models                        # List models (loaded ★, on disk, available)
opta models use <name>             # Set default model for agent loop
opta models info <name>            # Show details (from LMX admin API)

# === MODEL MANAGEMENT (delegates to LMX admin API) ===
opta models load <name>            # Load model into memory
opta models unload <name>          # Free memory
opta models download <repo>        # Download from HuggingFace
opta models remove <name>          # Delete from disk
opta models bench <name>           # Benchmark (tok/s, quality)
opta models convert <path>         # Convert safetensors → MLX

# === STATUS (from LMX admin API) ===
opta models status                 # Memory usage, loaded models, throughput
opta models --json                 # Machine-readable for all subcommands
```

### Model List Display (New Format)

```
$ opta models

Models on Opta-LMX (192.168.188.11)

  LOADED
  ★ glm-5-4bit              420 GB   128K context   4.2 tok/s   MLX
    glm-4.7-flash-8bit       24 GB   128K context  45.1 tok/s   MLX

  ON DISK (not loaded)
    kimi-k2.5-q4             280 GB   128K context              GGUF
    deepseek-v3-4bit         378 GB    64K context              MLX

  AVAILABLE (HuggingFace)
    mlx-community/GLM-5-4bit                 420 GB   MLX
    unsloth/GLM-5-GGUF                       varies   GGUF

  Memory: 444 / 512 GB used (68 GB free)

  Use: opta models use <name>      Switch default
       opta models load <name>     Load into memory
       opta models download <repo> Download from HuggingFace
```

---

## 6. New `opta serve` Command Spec

```bash
opta serve status              # Is LMX running? What's loaded? Memory?
opta serve start               # Start LMX daemon on Mac Studio
opta serve stop                # Stop LMX daemon
opta serve restart             # Restart LMX
opta serve logs                # Tail LMX logs
opta serve logs --errors       # Show only errors
opta serve update              # Pull latest code, restart
opta serve config              # Show LMX server config
opta serve config set <k> <v>  # Update LMX config remotely
```

### Implementation: How `opta serve` Talks to LMX

```
Option A: LMX Admin API (preferred)
  opta serve status → GET http://lmx:1235/admin/health
  opta serve start  → SSH to Mac Studio, start launchd service
  opta serve stop   → POST http://lmx:1235/admin/shutdown
  opta serve logs   → SSH to Mac Studio, tail log file

Option B: SSH for everything (fallback)
  All commands via SSH to Mac Studio
```

---

## 7. Opta CLI Purpose Statement (Post-Migration)

### Before (Current V1 Design Doc)
> "Opta CLI is a local-first, agentic AI coding assistant that connects to LM Studio on your Mac Studio via its OpenAI-compatible API."

### After (With Opta-LMX)
> "Opta CLI is a local-first, agentic AI coding assistant powered by Opta-LMX. It uses LLMs running on your own hardware to read, edit, search, and build code — with the intelligence of frontier models and the privacy of local inference."

### Clear Boundaries

**Opta CLI is responsible for:**
- Making LLMs useful for coding (agent loop, tools, reasoning)
- User interaction (terminal UI, prompts, permissions)
- Conversation management (sessions, memory, context compaction)
- Extensibility (skills, MCP, plugins)

**Opta CLI is NOT responsible for:**
- Running LLMs (that's Opta-LMX)
- Managing model weights (that's Opta-LMX)
- GPU/memory management (that's Opta-LMX)
- Model downloading/conversion (that's Opta-LMX)
- Serving the inference API (that's Opta-LMX)

**Analogy:** Opta CLI is like VS Code (the IDE). Opta-LMX is like the Language Server (the engine). The IDE provides the UI and tools; the server provides the intelligence.

---

## 8. Implementation Order

### Phase 1: Build Opta-LMX (No CLI changes yet)
LMX serves on port 1234, same API as LM Studio.
Opta CLI works with zero changes — it doesn't know it's talking to LMX instead of LM Studio.

### Phase 2: Add LMX Provider to Opta CLI
Replace `lmstudio.ts` with `lmx.ts`. Add admin API calls.
Rewrite `connect.ts`, enhance `models.ts`.
Add `serve.ts` command.

### Phase 3: Finish Opta CLI V1 Stubs
Implement chat REPL, sessions, memory, skills.
These are independent of LMX — just completing the V1 design doc.

### Phase 4: Advanced Integration
Smart routing, dual-model, speculative decoding, MCP.
Both CLI and LMX evolve together.

---

## 9. Files Changed Summary

| Opta CLI File | Action | Description |
|--------------|--------|-------------|
| `src/providers/lmstudio.ts` | **DELETE** | Replaced by LMX |
| `src/providers/lmx.ts` | **CREATE** | New LMX client (inference + admin) |
| `src/commands/connect.ts` | **REWRITE** | Point at LMX, simpler validation |
| `src/commands/models.ts` | **REWRITE** | Full LMX admin integration |
| `src/commands/serve.ts` | **CREATE** | Remote LMX management |
| `src/providers/manager.ts` | **REWRITE** | Simplified — always use LMX |
| `src/core/config.ts` | **UPDATE** | `connection` → `lmx`, add routing config |
| `src/core/router.ts` | **CREATE** (V2) | Smart model routing |
| All other files | **UNCHANGED** | Agent loop, tools, UI, etc. |

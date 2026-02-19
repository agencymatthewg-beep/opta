# Opta Local — LLM Permissions System Research

> Research date: 2026-02-19
> Purpose: Inform the design of a permissions management dashboard for optalocal.com

---

## 1. Existing LLM Permission & Sandbox Systems

### 1.1 OpenAI Function/Tool Calling
- **Model:** Declarative — tools are defined per-request in the API payload. The model can only call tools you provide.
- **No built-in enforcement** — the application layer must validate and execute tool calls. OpenAI's API is "the model suggests, the app decides."
- **Relevance:** Our system should similarly separate *what the model requests* from *what gets executed*. The enforcement layer sits between model output and action execution.

### 1.2 LangChain Tool Permissions
- **Security policy:** Recommends read-only permissions + sandboxing together (either alone is insufficient).
- **Two sandbox patterns** (Feb 2026):
  1. **Sandbox-as-environment** — entire agent runs inside sandbox (Docker/VM). Simple but limits agent capabilities.
  2. **Sandbox-as-tool** — only code execution is sandboxed; agent orchestration runs outside. Allows tools with higher privileges than LLM-generated code.
- **Evolution:** Native isolation (Pyodide/Deno, now deprecated) → Provider-based containers (Modal, Daytona, Runloop) → OS-level primitives (influenced by Anthropic's bubblewrap/seatbelt approach).
- **Relevance:** For local LLMs, sandbox-as-tool is the right pattern. The LMX inference engine runs unrestricted; tool execution is sandboxed per permission profile.

### 1.3 Anthropic / Claude Code / OpenClaw
- **OS-level primitives:** bubblewrap (Linux) and seatbelt (macOS) for kernel-enforced filesystem and network restrictions.
- **OpenClaw exec-approvals:** JSON config (`~/.openclaw/exec-approvals.json`) with per-agent rules, defaults, and a Unix socket for real-time approval requests. Structure supports versioning and agent-specific overrides.
- **Relevance:** Direct inspiration. Our presets are analogous to OpenClaw's per-agent exec-approval configs.

### 1.4 AutoGen (Microsoft)
- **Conversational agent framework** with safety boundaries via:
  - Code execution in Docker containers
  - Human-in-the-loop approval for actions
  - Configurable "is_termination_msg" to stop runaway conversations
- **Relevance:** The human-in-the-loop pattern maps to our "ask" permission level (prompt user before executing).

### 1.5 Python Sandboxing Libraries
| Library | Approach | Limitation |
|---------|----------|------------|
| RestrictedPython | AST transformation, whitelist safe builtins | Python-only, can be bypassed with C extensions |
| PyPy Sandbox | Full interpreter sandbox | Abandoned, unmaintained |
| Pyodide | WASM-based Python | No native extensions, limited stdlib |
| nsjail / bubblewrap | OS-level namespace isolation | Linux-only (nsjail), requires privileges |
| Docker | Container isolation | Heavier, startup latency |

**Recommendation:** For Opta Local (macOS-focused), use seatbelt profiles for OS-level enforcement + application-layer tool gating. Docker as optional "maximum isolation" tier.

---

## 2. Recommended Scope Taxonomy

### 2.1 Scope Categories

| Category | Scope | Description | Granularity |
|----------|-------|-------------|-------------|
| **Filesystem** | `fs:read` | Read files from allowed paths | Path allowlist |
| | `fs:write` | Create/modify files in allowed paths | Path allowlist |
| | `fs:delete` | Delete files | Path allowlist |
| | `fs:glob` | List/search directory contents | Path allowlist |
| **Network** | `net:fetch` | HTTP(S) requests to allowed domains | Domain allowlist |
| | `net:listen` | Bind to local ports | Port range |
| | `net:unrestricted` | Any network access | Boolean |
| **Shell** | `shell:exec` | Execute shell commands | Command allowlist |
| | `shell:exec:safe` | Execute from safe command list only | Predefined list |
| | `shell:sudo` | Elevated privilege execution | Boolean |
| **Tools** | `tools:search` | Web search | Boolean |
| | `tools:browser` | Browser automation | Boolean |
| | `tools:code_exec` | Run generated code | Language allowlist |
| | `tools:custom` | Custom tool invocations | Tool name allowlist |
| **Memory** | `mem:read` | Read conversation history / context | Boolean |
| | `mem:write` | Persist data across sessions | Boolean |
| | `mem:vector` | Access vector store / embeddings | Store allowlist |
| **Data** | `data:db_read` | Query databases | Connection allowlist |
| | `data:db_write` | Modify database records | Connection allowlist |
| | `data:export` | Export/download data | Format allowlist |
| **System** | `sys:info` | Read system info (OS, hardware, env) | Boolean |
| | `sys:process` | List/manage processes | Boolean |
| | `sys:install` | Install packages/dependencies | Boolean |
| **Model** | `model:chain` | Call other models | Model allowlist |
| | `model:self_modify` | Modify own system prompt | Boolean |
| | `model:context_window` | Max context tokens allowed | Numeric limit |

### 2.2 Scope Representation

```json
{
  "scope": "fs:read",
  "granted": true,
  "constraints": {
    "paths": ["~/Documents/project/**", "/tmp/**"],
    "max_file_size_mb": 10
  }
}
```

Each scope has: `granted` (bool), `constraints` (scope-specific object), `ask` (bool — prompt user before executing).

---

## 3. Recommended Permission Presets

### Tier Names & Contents

| Preset | Trust Level | Description | Key Scopes |
|--------|-------------|-------------|------------|
| **🔒 Isolated** | 0 — None | Pure text generation, no tools | All scopes denied. Only inference. |
| **📖 Reader** | 1 — Minimal | Can read specified files, nothing else | `fs:read` (scoped), `mem:read` |
| **🛠️ Assistant** | 2 — Standard | Read/write files, safe shell, web search | `fs:read`, `fs:write`, `shell:exec:safe`, `tools:search`, `mem:read`, `mem:write` |
| **⚡ Developer** | 3 — Elevated | Full dev environment access | All of Assistant + `shell:exec`, `tools:code_exec`, `net:fetch`, `data:db_read`, `sys:info` |
| **🔓 Unrestricted** | 4 — Full | Everything allowed (power user) | All scopes granted. Warning displayed. |

### Design Decisions
- **Named tiers > numeric scores.** Users understand "Assistant" better than "Trust Level 2." Store numeric internally for comparison.
- **Default: Isolated.** New models start with zero permissions. Explicit opt-in required.
- **Custom presets** are first-class. Users can clone a tier, modify scopes, and save as "My API Bot" or "Code Review Agent."
- **Per-model assignment.** Each loaded model gets one preset. Can override per-conversation.

---

## 4. Enforcement Architecture

### 4.1 Overview

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│  Dashboard   │────▶│  FastAPI Backend  │────▶│  MLX / LMX  │
│  (Next.js)   │     │                  │     │  Inference   │
└─────────────┘     │  ┌────────────┐  │     └─────────────┘
                    │  │ Permission  │  │
                    │  │ Middleware  │  │     ┌─────────────┐
                    │  └─────┬──────┘  │────▶│  Tool Layer  │
                    │        │         │     │  (Sandboxed) │
                    │  ┌─────▼──────┐  │     └─────────────┘
                    │  │  Profile    │  │
                    │  │  Store      │  │
                    │  └────────────┘  │
                    └──────────────────┘
```

### 4.2 Request Flow

1. **Client sends chat request** with `model_id` (and optional `preset_override`)
2. **FastAPI middleware** (`PermissionMiddleware`):
   - Loads permission profile for `model_id` from profile store
   - Attaches `PermissionContext` to request state
3. **Inference runs normally** — MLX generates text/tool calls
4. **Tool execution interceptor** checks each tool call against `PermissionContext`:
   - **Granted:** Execute immediately
   - **Ask:** Return approval request to client (WebSocket)
   - **Denied:** Return error to model, optionally retry without tool
5. **Response returned** with audit log of permission decisions

### 4.3 FastAPI Middleware Pattern

```python
class PermissionMiddleware:
    async def __call__(self, request, call_next):
        model_id = extract_model_id(request)
        profile = await self.profile_store.get(model_id)
        request.state.permissions = PermissionContext(profile)
        response = await call_next(request)
        return response

class ToolExecutor:
    async def execute(self, tool_call, permissions: PermissionContext):
        scope = self.map_tool_to_scope(tool_call)
        decision = permissions.check(scope, tool_call.params)
        
        if decision == Decision.DENIED:
            return ToolResult.error(f"Permission denied: {scope}")
        if decision == Decision.ASK:
            approved = await self.request_approval(tool_call)
            if not approved:
                return ToolResult.error("User denied")
        
        # Execute in sandbox matching permission tier
        return await self.sandbox.run(tool_call, permissions.constraints(scope))
```

### 4.4 Profile Storage

```yaml
# ~/.optalocal/profiles/assistant.yaml
name: Assistant
trust_level: 2
scopes:
  fs:read:
    granted: true
    constraints:
      paths: ["~/Documents/**"]
  fs:write:
    granted: true
    constraints:
      paths: ["~/Documents/output/**"]
  shell:exec:safe:
    granted: true
    constraints:
      commands: ["ls", "cat", "grep", "find", "wc", "head", "tail"]
  net:fetch:
    granted: false
```

- **YAML files** in `~/.optalocal/profiles/` — human-readable, version-controllable
- **SQLite index** for fast lookup by model_id → profile mapping
- **Hot reload** — file watcher detects changes, no restart needed

### 4.5 Passing Config to MLX Inference

MLX inference itself doesn't need permission awareness. The key insight: **permissions gate tool execution, not generation.** The model generates freely; the enforcement layer decides what actions to allow.

For `model:context_window` limits, set `max_tokens` in the MLX generate call based on the profile.

For `model:chain` restrictions, the tool executor checks before forwarding to another model.

### 4.6 Preventing Breakout

| Risk | Mitigation |
|------|------------|
| Prompt injection to bypass permissions | Permissions enforced in application layer, not via system prompt. Model cannot "talk its way out." |
| Tool call parameter manipulation | Strict schema validation before execution. Path traversal checks (no `../`). |
| Indirect execution via code gen | Code execution tools run in sandboxed subprocess with restricted syscalls (seatbelt/bubblewrap). |
| Model modifying its own config | Profile store is read-only to the inference/tool layer. Only dashboard API can modify. |
| Exfiltration via allowed tools | Rate limiting on network calls. Content inspection for sensitive patterns. Logging all tool executions. |

---

## 5. Risks & Edge Cases

### 5.1 Critical Risks

1. **Permission escalation via chaining.** A model with `fs:read` + `shell:exec:safe` could `cat` a file containing credentials, then use those in a subsequent request. **Mitigation:** Content filtering on sensitive patterns (API keys, passwords) in tool outputs.

2. **Time-of-check/time-of-use (TOCTOU).** Profile changes while a long-running tool executes. **Mitigation:** Snapshot permissions at request start; apply to entire request lifecycle.

3. **Denial of service.** Model with `fs:write` fills disk. Model with `net:fetch` makes thousands of requests. **Mitigation:** Per-scope rate limits and resource quotas in constraints.

4. **Multi-model confusion.** Two models loaded simultaneously share a tool executor. **Mitigation:** Permission context is per-request, never global state.

### 5.2 Edge Cases

- **Streaming responses with tool calls mid-stream.** Must buffer and check permissions before forwarding tool results to client.
- **Model refuses to work within constraints.** Some models degrade significantly when tools are denied. Surface this in UI: "This model works best with Developer permissions."
- **Preset inheritance.** User creates custom preset based on "Assistant" — if Assistant preset updates, should custom inherit changes? **Recommendation:** No. Custom presets are snapshots. Show "based on Assistant v2" label but don't auto-update.
- **Offline mode.** All permission checks must work without network. Profile store must be local-first.

### 5.3 UI Considerations

- **GitHub-style scopes page:** Checkbox grid, categories on left, individual scopes as toggles. Constraints expand inline.
- **Diff view when modifying presets:** Show what changes from the base tier.
- **Audit log tab:** Every permission decision logged with timestamp, model, scope, decision, and parameters.
- **"Test permissions" button:** Dry-run a prompt against a profile to see what would be allowed/denied.
- **Visual trust indicator:** Color-coded badge on each model card showing its current tier (🔒🟢🟡🟠🔴).

---

## 6. Summary of Recommendations

1. **Scope taxonomy:** 22 scopes across 7 categories (filesystem, network, shell, tools, memory, data, system, model). Fine-grained with constraint objects per scope.

2. **Five preset tiers:** Isolated → Reader → Assistant → Developer → Unrestricted. Custom presets are first-class citizens.

3. **Enforcement:** FastAPI middleware loads profile per-request. Tool executor gates all actions. Sandboxed execution via seatbelt (macOS). Permissions are application-layer, never prompt-based.

4. **Default safe:** All models start as Isolated. Users explicitly grant permissions. This is the only defensible default for local AI.

5. **Storage:** YAML profile files (human-editable, git-friendly) + SQLite mapping table. Hot reload on file changes.

6. **Key insight from industry:** The model generates; the application enforces. Never trust the model to self-restrict. Every tool call goes through a permission check regardless of what the model "promises" in its output.

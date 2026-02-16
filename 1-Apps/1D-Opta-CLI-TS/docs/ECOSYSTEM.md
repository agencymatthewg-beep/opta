---
title: Opta Ecosystem
purpose: How Opta CLI relates to other Opta components
updated: 2026-02-15
---

# Opta Ecosystem — Component Relationships

Opta CLI doesn't exist in isolation. This document maps how it connects to the broader Opta system.

---

## Component Map

```
┌─────────────────────────────────────────────────────────────────┐
│ User's MacBook                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────┐      ┌──────────────────────┐          │
│  │   Opta CLI (this)    │      │   OptaPlus Web UI    │          │
│  │   node opta chat     │      │   Web interface      │          │
│  └──────────┬───────────┘      └──────────┬───────────┘          │
│             │                              │                      │
│             └──────────────┬───────────────┘                      │
│                            │ HTTP/REST                           │
│                            ▼                                     │
│  ┌────────────────────────────────────────┐                    │
│  │   OpenClaw Gateway                     │                    │
│  │   (Message routing, auth, logging)     │                    │
│  └────────────────────┬───────────────────┘                    │
│                       │                                         │
└─────────────────────┬─┼──────────────────────────────────────────┘
                      │ │ SSH tunnel (192.168.188.0/24 LAN)
                      │ │
┌─────────────────────┼─┼──────────────────────────────────────────┐
│ Mac Studio (Mono512)│ │                                          │
├─────────────────────┼─┼──────────────────────────────────────────┤
│                     ▼ ▼                                          │
│  ┌─────────────────────────────────┐                            │
│  │   LM Studio (port 1234)         │◄──CLI/OptaPlus             │
│  │   └─ Qwen2.5-72B (loaded)       │   (OpenAI-compatible       │
│  │   └─ GLM-4.7-Flash-MLX          │    /v1/chat/completions)   │
│  │   └─ Step-3.5-Flash             │                            │
│  └─────────────────────────────────┘                            │
│           ▲            ▲                                        │
│           │            │                                        │
│  ┌─────────────────────────────────┐                            │
│  │   Opta-LMX (inference engine)   │                            │
│  │   Wraps models + routes calls   │                            │
│  └─────────────────────────────────┘                            │
│                                                                  │
│  ┌─────────────────────────────────┐                            │
│  │   Opta Life (task manager)      │                            │
│  │   Syncs task state              │                            │
│  └─────────────────────────────────┘                            │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Component Relationships

### Opta CLI (This Repository)

**What it is:** A command-line tool on your MacBook for agentic AI coding.

**What it does:**
- Connects to LM Studio via HTTP API (port 1234)
- Sends prompts + tool definitions to the model
- Receives tool calls (read_file, edit_file, run_command, etc.)
- Executes tools locally on your MacBook
- Feeds results back to model
- Repeats until task is done

**File location:** `~/Synced/Opta/1-Apps/1D-Opta-CLI-TS/`

**Who uses it:** Matthew (developer)

**Scope:** Local-first, no cloud APIs in V1

---

### LM Studio

**What it is:** Local inference engine running on Mac Studio.

**What it does:**
- Loads and runs open-source LLMs (Qwen, GLM, Step, etc.)
- Exposes OpenAI-compatible `/v1/chat/completions` API on port 1234
- Manages GPU memory, model switching, inference

**Connection:** Opta CLI talks to `http://192.168.188.11:1234/v1/chat/completions`

**No authentication needed** — it's on your private LAN.

**API endpoint pattern:**
```bash
POST http://192.168.188.11:1234/v1/chat/completions
{
  "model": "Qwen2.5-72B",
  "messages": [ ... ],
  "tools": [ ... ],
  "tool_choice": "auto"
}
```

---

### Opta-LMX (Inference Engine)

**What it is:** High-level wrapper around LM Studio for the broader Opta ecosystem.

**What it does:**
- Abstracts model selection and routing
- Adds metadata (capabilities, context limits, etc.)
- Eventually: fallback to cloud APIs (Anthropic, OpenAI) if local models fail (V2)

**Connection from Opta CLI:** Direct to LM Studio (LMX is optional in V1)

**Future (V2):** Opta CLI could talk to Opta-LMX instead of raw LM Studio API.

---

### OptaPlus (Web UI)

**What it is:** Web interface for Opta tools, alternative to CLI.

**What it does:**
- Browser-based chat with same models as Opta CLI
- File browser, settings, session history
- Same tool definitions (read, edit, bash, etc.)

**Connection:** OptaPlus also talks to LM Studio (via OpenClaw Gateway)

**Shared features with Opta CLI:**
- Same tool system (8 tools)
- Same permission model (allow/ask/deny)
- Same config/session format (can resume CLI session in OptaPlus and vice versa)

**Difference:**
- Opta CLI: Command-line, fast, keyboard-driven
- OptaPlus: Web, visual, mouse-driven

---

### OpenClaw (Orchestration Layer)

**What it is:** Central gateway and orchestration layer for Opta and related systems.

**What it does:**
- Message routing (Telegram, Discord, Slack, etc.)
- Authentication and token management
- Skills and plugins system
- Canvas/node management

**Connection from Opta CLI:**
- ✅ Can receive tasks via OpenClaw (e.g., `opta do <task>`)
- ✅ Can send results back to OpenClaw
- In V2: Could expose Opta CLI skills via OpenClaw skill system

**Not currently:** Opta CLI doesn't rely on OpenClaw for core functionality. Opta CLI works standalone.

---

### Opta Life (Task Manager)

**What it is:** Persistent task/reminder system on your Mac Studio.

**What it does:**
- Tracks tasks, reminders, scheduling
- Exposes API at `http://localhost:3000/api/opta-sync`
- Matthew checks this on heartbeats

**Connection from Opta CLI:**
- V1: No direct connection (could add in V2)
- V2+: Could inject tasks into Opta Life (e.g., model finds a bug → "Reminder: fix login bug")

---

## Data Flow Examples

### Example 1: Single `opta chat` Session

```
1. User types: "opta chat"
2. CLI loads config (connection, model, permissions)
3. CLI sends to LM Studio:
   POST /v1/chat/completions {
     model: "Qwen2.5-72B",
     messages: [
       { role: "system", content: "You are an AI coding assistant. Tools: [8 schemas]" },
       { role: "user", content: "fix the auth middleware" }
     ],
     tools: [read_file, write_file, edit_file, ...],
     tool_choice: "auto"
   }

4. LM Studio (via Qwen model):
   "I'll read the auth middleware first"
   tool_calls: [
     { id: "1", function: { name: "read_file", arguments: "path: src/middleware/auth.ts" } }
   ]

5. CLI executes locally:
   read_file("src/middleware/auth.ts") → returns file contents

6. CLI sends back to model:
   POST /v1/chat/completions {
     messages: [..., { role: "user", content: "..." },
                    { role: "assistant", tool_calls: [...] },
                    { role: "tool", tool_call_id: "1", content: "file contents..." }],
     tool_choice: "auto"
   }

7. LM Studio:
   "I see the issue. The token expiry check is missing."
   tool_calls: [
     { id: "2", function: { name: "edit_file", arguments: "..." } }
   ]

8. CLI asks permission: "Edit src/middleware/auth.ts? (y/n)"
   User: y
   Executes edit_file() → saves changes

9. Continue until model says: "Done." (no tool_calls)

10. CLI saves session and exits.
```

### Example 2: CLI + OptaPlus on Same Session

```
1. Matthew uses: opta chat (on MacBook)
2. Creates session: abc123 (saved to ~/.config/opta/sessions/abc123.json)
3. Works on a task for 10 messages
4. Pauses and runs: opta chat --resume abc123
5. Later, opens OptaPlus web UI (on Mac Studio)
6. OptaPlus reads session abc123 (shares same directory)
7. Can continue from where CLI left off
8. Both tools update the same session file
```

**Key:** CLI and OptaPlus use the same session storage format, so they're interoperable.

---

## Sync & Sharing

### What's Synced

| Component | Synced | How | Where |
|-----------|--------|-----|-------|
| Opta CLI source | ✅ Yes | Syncthing | `~/Synced/Opta/1-Apps/1D-Opta-CLI-TS/` |
| Session files | ✅ Yes | Syncthing | `~/.config/opta/sessions/` |
| User config | ✅ Yes | Syncthing | `~/.config/opta/config.json` |
| LM Studio | ✅ Yes | Syncthing? | `/Users/Shared/312/Opta/LMStudio/` |
| Opta Life | ✅ Yes | Syncthing | `~/Synced/Opta/3-Data/Tasks/` |

### What's Not Synced

| Component | Why | Implication |
|-----------|-----|------------|
| Opta-LMX | Local service | Install on each device if needed |
| OpenClaw Gateway | Central service | Runs on Mac Studio, accessed via LAN |
| OptaPlus | Web app | Served from Mac Studio |

---

## Security & Privacy

### Opta CLI (Local-First)

**Data flow:**
- Your MacBook (Opta CLI) ↔ LM Studio (Mac Studio, local network) ↔ Your files

**No cloud:**
- File contents never leave your LAN
- Conversations stay local (unless you export)
- No 3rd party sees your code

**In V2:** Cloud fallback would require explicit opt-in + API keys.

### OpenClaw Gateway

**Used for:**
- Message routing (Telegram, Discord, etc.)
- Skill/plugin discovery
- Bot orchestration

**Not used for:** Core Opta CLI inference (direct LM Studio connection instead).

---

## API Contracts

### Opta CLI ↔ LM Studio

**Standard:** OpenAI-compatible `/v1/chat/completions`

**What we send:**
```json
{
  "model": "string",
  "messages": [{ "role", "content", "tool_calls" }],
  "tools": [{ "type": "function", "function": { "name", "description", "parameters" } }],
  "tool_choice": "auto" | "required" | { "type": "function", "function": { "name" } },
  "temperature": 0.7,
  "top_p": 0.9,
  "max_tokens": 2048,
  "stream": true
}
```

**What we expect:**
```json
{
  "choices": [
    {
      "message": {
        "role": "assistant",
        "content": "text",
        "tool_calls": [
          { "id", "function": { "name", "arguments": "json string" } }
        ]
      },
      "finish_reason": "tool_calls" | "stop" | "length"
    }
  ],
  "usage": { "prompt_tokens", "completion_tokens", "total_tokens" }
}
```

---

## Dependency Graph

```
Opta CLI
  ├─ LM Studio (HTTP API)
  │   └─ Local models (Qwen, GLM, Step, etc.)
  │
  ├─ Optional: OpenClaw Gateway (V2+)
  │   └─ Skill discovery
  │   └─ Message routing
  │
  ├─ Optional: Opta Life (V2+)
  │   └─ Task injection
  │   └─ Context in sessions
  │
  ├─ Local filesystem
  │   └─ Session storage (~/.config/opta/)
  │   └─ User config
  │
  └─ Optional: OptaPlus (shared session storage)
```

---

## Interoperability

### Can Opta CLI talk to OptaPlus sessions?

**Yes.** Both tools write to `~/.config/opta/sessions/` in the same JSON format. You can:
1. Start `opta chat` on MacBook
2. Switch to OptaPlus web UI on Mac Studio
3. Resume the same session
4. Switch back to `opta chat`

### Can Opta CLI talk to OpenClaw skills?

**V1: No.** Opta CLI has hardcoded 8 tools.

**V2: Planned.** Could load SKILL.md from `~/.openclaw/skills/` to extend tool definitions.

### Can Opta CLI use Anthropic Claude?

**V1: No.** Local-first, LM Studio only.

**V2: Planned.** With cloud fallback option.

---

## Scaling & Future

### If Opta CLI Becomes Popular

- More device support (Windows, Linux)
- Team collaboration (shared sessions, audit logs)
- Cloud sync (sessions in cloud database)
- Advanced workflows (multi-agent orchestration)
- IDE integrations (VS Code, JetBrains plugins)

### Integration Points for V2+

1. **SKILL.md loader** — Load custom tools from `~/.openclaw/skills/`
2. **OpenClaw skills** — Expose Opta CLI as a skill for orchestration
3. **Opta-LMX** — Route through LMX instead of direct LM Studio
4. **Opta Life** — Inject task results as reminders/follow-ups
5. **OptaPlus sync** — Bidirectional session sync

---

## Summary

**Opta CLI's Role in Opta Ecosystem:**

- **Primary function:** Local agentic AI coding assistant
- **Core connection:** LM Studio (direct HTTP API)
- **Optional connections:** OpenClaw, Opta Life, OptaPlus
- **Data residency:** Local by default, all on your MacBook/Mac Studio
- **Sharing:** Via session files + config (both Syncthing-backed)
- **Extensibility:** SKILL.md loader (V2+), plugin system (V2+)

**You can use Opta CLI standalone** (no OpenClaw, no OptaPlus needed) for local-first agentic coding. Optional connections can enhance it later.

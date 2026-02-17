---
title: Opta CLI Roadmap
scope: V0 (current) → V1 (planned) → V2+ (future)
updated: 2026-02-15
reference: docs/plans/2026-02-12-opta-cli-v1-design.md
---

# Opta CLI — Version Roadmap

## Current Status: V0 (BETA)

**Release:** 0.1.0 (unfinished Aider fork)  
**Status:** Code exists, unfinished, needs rewrite  
**Scope:** Proof of concept

### What Works in V0
- Basic CLI structure (Commander.js)
- Config loading (conf + cosmiconfig)
- Provider interface (base + Opta-LMX adapter)
- Some command stubs (chat, do, models, etc.)

### What's Missing in V0
- Full agent loop implementation
- Tool execution with permission checks
- Session persistence
- Interactive chat REPL
- Error handling and exit codes
- Tests and validation

### Decision: Rewrite as V1

V0 → V1 is a rewrite, not a continuation. The architecture (agent loop, tool system, permission model) is defined in the design doc, but most code needs to be written or rewritten from scratch.

---

## V1: Core Functionality (Ready to Build)

**Target:** Q1 2026 (8-week sprint)  
**Scope:** 3 capabilities  
**Status:** Design approved, ready for implementation

### The Three V1 Capabilities

#### 1️⃣ Connect & Manage (Week 1-2)

What: Discover Opta-LMX, list models, switch default.

**Commands:**
```bash
opta connect                    # Auto-discover Opta-LMX
opta connect --host 192.168.1.1  # Connect to custom host
opta models                     # List all models
opta models use <name>          # Switch default model
opta models info <name>         # Show model details (context limit, etc.)
```

**Implementation files:**
- `src/commands/connect.ts` (80 lines)
- `src/commands/models.ts` (80 lines)
- `src/providers/manager.ts` (40 lines)
- `src/providers/lmx.ts` (60 lines)
- Tests: `connect.test.ts`, `models.test.ts`

**Success criteria:**
- `opta connect` discovers Opta-LMX in <2 seconds
- `opta models list` shows all loaded models
- `opta models use qwen` switches default
- Offline error message is actionable

#### 2️⃣ Agentic Chat (Week 3-5)

What: Interactive chat where the model uses tools (read, edit, bash, search) to complete tasks.

**Commands:**
```bash
opta chat                       # Start interactive session
opta chat --resume <id>         # Resume prior session
opta do <task>                  # Single-shot task execution
```

**Features:**
- Streaming text output (token-by-token)
- Tool call parsing from model response
- Permission checks (ask for edit/bash, allow for read)
- Context compaction (auto-summarize at 70%)
- Circuit breaker (pause after 30 tool calls)
- Session persistence (JSON in `~/.config/opta/sessions/`)
- Session resume with full history

**Implementation files:**
- `src/core/agent.ts` (120 lines) — THE CORE LOOP
- `src/core/tools.ts` (200 lines) — 8 tools + execution
- `src/commands/chat.ts` (150 lines)
- `src/commands/do.ts` (50 lines)
- `src/memory/store.ts` (80 lines)
- `src/ui/spinner.ts`, `markdown.ts`, `output.ts`
- Tests: `agent.test.ts`, `tools.test.ts`

**Success criteria:**
- `opta chat` starts in <200ms
- Model can read/edit files autonomously
- Tool permissions work (can allow/ask/deny)
- Sessions persist and resume correctly
- Context compaction keeps old sessions under limit
- No infinite loops (circuit breaker catches them)

#### 3️⃣ Configuration (Week 6-7)

What: User-friendly config management, per-project and per-user.

**Commands:**
```bash
opta config list                # Show all config
opta config get key             # Get a value
opta config set key value       # Set a value
opta config reset               # Reset to defaults
```

**Config areas:**
- Connection (host, port, protocol)
- Model selection (default model, context limit)
- Permissions (which tools require approval)
- Safety (max tool calls, context compaction threshold)

**Implementation files:**
- `src/core/config.ts` (80 lines)
- `src/commands/config.ts` (60 lines)
- Tests: `config.test.ts`

**Success criteria:**
- Config merging works (CLI > env > project > user > defaults)
- `opta config set` persists changes
- Project config (`.opta/config.json`) overrides user config
- Permission rules are intuitive (safe by default)

#### 4️⃣ Polish (Week 8)

- Shell completions (`bash`, `zsh`, `fish`)
- Help text review and clarity
- README update with real examples
- Performance verification (<50ms `--help`, ~200ms `chat`)
- Smoke test all commands

**Files:**
- `src/commands/completions.ts` (40 lines)
- Updated README.md with examples

---

## V1 Release Checklist

### Before Release
- [ ] All commands tested on macOS with real Opta-LMX
- [ ] Help text is clear and consistent
- [ ] Error messages are actionable
- [ ] 95%+ test coverage for agent loop and tools
- [ ] Startup time measured and verified
- [ ] Shell completions work (bash/zsh/fish)
- [ ] README has real usage examples
- [ ] CLAUDE.md is accurate and up-to-date

### V1 Release Announcement
```
# Opta CLI v1.0

Local-first agentic AI coding assistant.

## What's New
- Connect to Opta-LMX (auto-discovery)
- Interactive chat with tool-use (read, edit, bash, search)
- Session persistence and resume
- Smart permissions (allow/ask/deny per tool)
- Auto-context compaction

## System Requirements
- macOS 12+ (for Mac Studio testing)
- Node.js 20+
- Opta-LMX running on same LAN

## Quick Start
opta connect    # Discover Opta-LMX
opta chat       # Start chatting
```

---

## V2: Confirmed Features (Design Approved)

**Timeline:** Q1-Q2 2026
**Design Doc:** `docs/plans/2026-02-15-v2-features-design.md`
**Status:** Design approved, ready for implementation

### V2 Core: 4 Features + 1 Command (In Implementation Order)

#### Phase 1: OPIS Integration + Repo Awareness (Export Map)

Foundation layer — changes how the system prompt is built.

- **OPIS hybrid injection** — Compressed project summary (~500t) in system prompt; `read_project_docs` tool for deep dives into ARCHITECTURE.md, KNOWLEDGE.md, etc.
- **Export map** — Regex-based scanner for top-level exports (~500-1K tokens). Replaces tree-sitter — OPIS provides architecture; export map provides symbol locations.
- Replaces `.opta/memory.md` with structured OPIS scaffold
- Falls back gracefully for non-OPIS projects

**New files:** `src/context/opis.ts`, `src/context/exports.ts`

#### Phase 2: Git Integration

Checkpoint system wraps around the agent loop.

- **Checkpoint snapshots** — Patch files saved after each edit_file/write_file (`.opta/checkpoints/`)
- **Task commit** — Single clean commit when agent loop completes, message generated by model
- **`/undo` command** — Reverse specific checkpoints mid-task
- **`opta diff`** — Show all uncommitted session changes
- **`--no-commit`** flag for manual control

**New files:** `src/git/checkpoints.ts`, `src/git/commit.ts`, `src/commands/diff.ts`

#### Phase 3: MCP Integration

Extends the tool system with external services.

- **Config-based discovery** — MCP servers declared in `.opta/config.json` (security-first)
- **OPIS hints** — `opta init` reads KNOWLEDGE.md and suggests relevant MCPs
- **Transport support** — stdio (local npm packages) + HTTP/SSE (remote servers)
- **Tool schema merging** — MCP tools merged with built-in tools; model sees them uniformly
- **Tool count budget** — Warn at >20 tools (local LLM degradation threshold)
- **`opta mcp list/add/remove/test`** — Full MCP management commands

**New files:** `src/mcp/client.ts`, `src/mcp/registry.ts`

#### Phase 4: `opta init` (OPIS Runner)

Requires Phases 1 + 3 to be working.

- **Structured command flow** — CLI drives OPIS stages; model generates scaffold in one shot
- **Auto-detection** — Greenfield vs brownfield vs companion mode from project state
- **10 mode-specific questions** — Asked via inquirer prompts, one at a time
- **Scaffold generation** — Model writes all OPIS files using write_file tool
- **MCP suggestions** — Parsed from generated KNOWLEDGE.md, offered for approval

**New files:** `src/commands/init.ts`, `src/opis/questions.ts`, `src/opis/templates.ts`

### V2 Implementation Strategy

Phased delivery — each phase is a separate PR:

1. Phase 1: OPIS + Export Map (foundation)
2. Phase 2: Git Integration (wraps agent loop)
3. Phase 3: MCP (extends tool system)
4. Phase 4: `opta init` (depends on 1 + 3)

---

## V3: Deferred Features (Post V2)

**Timeline:** Q3-Q4 2026 (if demand justifies)

### V3 Candidates (Not Yet Designed)

#### Plugin System
- Load SKILL.md files from `~/.opta/skills/`
- Extend tool definitions from plugins
- Plugin discovery and auto-loading

#### Cloud Fallback
- If Opta LMX is offline, fallback to Anthropic Claude API
- Requires API key management and cost control

#### Agent Swarms
- Multiple agents working in parallel
- Orchestration and communication

#### Diff-Based Editing
- Unified diffs instead of exact-match string replacement

#### LSP Integration
- Real-time diagnostics after edits

#### Browser Automation
- Selenium/Puppeteer for web automation

### V3 Implementation Strategy

Each V3 feature is a separate pull request, not all landing at once:

1. Pick one feature
2. Design (DECISIONS.md + design doc update)
3. Implement with tests
4. Merge and ship
5. Repeat for next feature

**Release cadence:** One V2 feature per 4-6 weeks, if demand justifies.

---

## V3+: Speculative (Future)

### Possible Directions

- **Orchestration:** Multiple agents coordinating tasks (local swarms)
- **Self-Improvement:** Agent learns from past sessions, refines strategies
- **Adaptive Models:** Switch models mid-task based on token budget
- **IDE Integration:** LSP server for VS Code, JetBrains, etc.
- **Web UI:** OptaPlus integration for web-based chat
- **Mobile Support:** SSH tunnel to MacBook CLI from iPhone
- **Team Collaboration:** Shared sessions, permissions, audit logs

**Timeline:** 2027+ (if business need arises)

---

## Version Comparison

| Feature | V0 | V1 | V2 | V3 |
|---------|----|----|----|----|
| **Opta-LMX connection** | Stub | ✅ | ✅ | ✅ |
| **Model listing** | Stub | ✅ | ✅ | ✅ |
| **Interactive chat** | Stub | ✅ | ✅ | ✅ |
| **Tool-use agent** | Stub | ✅ | ✅ | ✅ |
| **Session persistence** | No | ✅ | ✅ | ✅ |
| **Config management** | Stub | ✅ | ✅ | ✅ |
| **Plugin system** | No | No | ✅ | ✅ |
| **MCP integration** | No | No | ✅ | ✅ |
| **Cloud fallback** | No | No | ✅ | ✅ |
| **Agent swarms** | No | No | No | ✅ |
| **Self-learning** | No | No | No | ✅ |

---

## How Features Get Prioritized

### What Goes Into V1?
- ✅ Solves core problem (agentic AI coding on local models)
- ✅ Used daily by Matthew
- ✅ Fits in 8-week sprint
- ✅ Architecture is settled (no guessing)
- ✅ Minimal dependencies

### What Gets Deferred to V2?
- 🚫 Requires new architectural decisions
- 🚫 Low usage frequency
- 🚫 Adds complexity without proportional benefit
- 🚫 Can be added non-breaking later (plugins, MCP)
- 🚫 Unclear requirements

### Input from Users

- Matthew: "I need X" → Prioritizes V1 features
- Feedback from Matthew: "This is frustrating" → May become V1.1 hotfix or V2
- External interest: If 10+ people ask for feature → V2 candidate

---

## Related Documents

- **Design Doc:** `docs/plans/2026-02-12-opta-cli-v1-design.md` (10,000-word spec)
- **Decisions:** `docs/DECISIONS.md` (why V1 has these constraints)
- **Implementation:** `CLAUDE.md` (file map, code patterns)

---

## Questions

**Q: Why no V1 LSP integration?**  
A: Not the core use case. Agentic chat is the primary value. LSP can be V2.

**Q: Why no cloud fallback in V1?**  
A: V1 is local-first. Cloud fallback requires API key management, costs, privacy decisions. Can wait.

**Q: Why no plugins in V1?**  
A: Eight hardcoded tools are sufficient. Plugin system can be V2 when use cases emerge.

**Q: Will V1 work on Windows/Linux?**  
A: Should work on any Node 20+ machine. Not tested. Probably needs some path fixes. Not a V1 goal (Matthew uses Mac).

---
title: Opta CLI — Known-Good Command Matrix
purpose: Verified command invocations for support, debugging, and automation
updated: 2026-02-28
---

# Opta CLI — Known-Good Command Matrix

This matrix documents every top-level command and key flag combination that is verified to work. Use it for:
- Support triage ("does X actually work?")
- Automation scripting
- Post-install smoke testing
- Regression reference after upgrades

**Status codes:**
- ✅ Verified working
- ⚠️ Working with caveats (see notes)
- 🔧 Requires setup (API key, LMX server, etc.)
- ❌ Not yet supported on this platform

---

## Core Commands

### `opta chat`

| Invocation | Status | Notes |
|------------|--------|-------|
| `opta chat` | ✅ | Interactive REPL, uses configured provider |
| `opta chat --tui` | ✅ | Full-screen Ink TUI |
| `opta tui` | ✅ | Alias for `opta chat --tui` |
| `opta chat --plan` | ✅ | Read-only planning mode (no write/edit/run) |
| `opta chat --review` | ✅ | Code review mode |
| `opta chat --research` | ✅ | Research mode with web search |
| `opta chat --auto` | ✅ | Auto-accept all permission prompts |
| `opta chat --resume <id>` | ✅ | Resume a previous session by ID |
| `opta chat --model <name>` | ✅ | Override model for this session |
| `opta chat --device <host:port>` | ✅ | Override LMX host |
| `opta chat --provider anthropic` | 🔧 | Requires `ANTHROPIC_API_KEY` |
| `opta chat --provider lmx` | 🔧 | Requires LMX server at configured host |

### `opta do`

| Invocation | Status | Notes |
|------------|--------|-------|
| `opta do "task description"` | ✅ | Non-interactive one-shot agent task |
| `opta do "task" --auto` | ✅ | Skip all permission prompts |
| `opta do "task" --plan` | ✅ | Plan only, no destructive actions |
| `opta do "task" --provider anthropic` | 🔧 | Requires API key |
| `opta do "task" --max-turns 5` | ✅ | Limit agent loop iterations |
| `cat file.txt \| opta do "summarize this"` | ✅ | Stdin piped as input |

### `opta daemon`

| Invocation | Status | Notes |
|------------|--------|-------|
| `opta daemon start` | ✅ | Start background daemon on 127.0.0.1:9999 |
| `opta daemon stop` | ✅ | Graceful shutdown |
| `opta daemon restart` | ✅ | Stop + start; token rotates |
| `opta daemon status` | ✅ | Print pid, port, session count, uptime |
| `opta daemon logs` | ✅ | Tail log (Ctrl+C exits tail, daemon stays up) |

---

## Configuration

| Invocation | Status | Notes |
|------------|--------|-------|
| `opta config list` | ✅ | Print all resolved config values |
| `opta config get <key>` | ✅ | Print single value |
| `opta config set <key> <value>` | ✅ | Persist to `~/.config/opta/config.json` |
| `opta config menu` | ✅ | Interactive settings TUI |
| `opta config set provider.active anthropic` | 🔧 | Switch to cloud provider |
| `opta config set provider.active lmx` | 🔧 | Switch to LMX (default) |
| `opta config set permissions.edit_file allow` | ✅ | Auto-approve file edits |
| `opta config set permissions.run_command ask` | ✅ | Prompt before shell commands (default) |
| `opta config set connection.host 192.168.188.11` | ✅ | Point to Mac Studio LMX |
| `opta config set connection.port 1234` | ✅ | LMX port (default: 1234) |

---

## Environment Profiles

| Invocation | Status | Notes |
|------------|--------|-------|
| `opta env save <name>` | ✅ | Save current config as named profile |
| `opta env use <name>` | ✅ | Switch to named profile |
| `opta env list` | ✅ | List saved profiles |
| `opta env save studio --host 192.168.188.11 --port 1234` | ✅ | Save Mac Studio profile |

---

## Model Management

| Invocation | Status | Notes |
|------------|--------|-------|
| `opta models` | 🔧 | Interactive model picker (requires LMX) |
| `opta models load <name>` | 🔧 | Load model by fuzzy name |
| `opta models swap` | 🔧 | Interactive model swap |
| `opta models use` | 🔧 | Set default model interactively |
| `opta models dashboard` | 🔧 | Health + memory dashboard |
| `opta models browse-library` | 🔧 | Browse downloadable models |
| `opta models list` | 🔧 | List all available models |
| `opta models rag collections` | 🔧 | List RAG vector collections |
| `opta models rag ingest docs --file ./README.md` | 🔧 | Ingest file into RAG |

---

## Session Management

| Invocation | Status | Notes |
|------------|--------|-------|
| `opta sessions list` | ✅ | List all saved sessions |
| `opta sessions show <id>` | ✅ | Show session details |
| `opta sessions export <id>` | ✅ | Export to JSON/Markdown |
| `opta sessions delete <id>` | ✅ | Delete session by ID |

---

## API Keys / Keychain

| Invocation | Status | Notes |
|------------|--------|-------|
| `opta keychain set-anthropic <key>` | ✅ | Store Anthropic key in OS keychain |
| `opta keychain set-lmx <key>` | ✅ | Store LMX admin key in OS keychain |
| `opta keychain status` | ✅ | Show which keys are stored |
| `opta key set <service> <key>` | ✅ | Generic keychain write |

---

## MCP Integration

| Invocation | Status | Notes |
|------------|--------|-------|
| `opta mcp list` | ✅ | List configured MCP servers |
| `opta mcp add <name> "<cmd>"` | ✅ | Add stdio MCP server |
| `opta mcp add-playwright` | ✅ | Add Playwright MCP (auto-installs) |
| `opta mcp test <name>` | ✅ | Test connectivity to MCP server |
| `opta mcp remove <name>` | ✅ | Remove MCP server config |

---

## Browser Automation

| Invocation | Status | Notes |
|------------|--------|-------|
| `/browser` in chat | ✅ | Browser command menu in TUI |
| `opta do "open browser, go to ..."` | ✅ | Autonomous browser task via agent |
| `opta mcp add-playwright` | ✅ | Required for MCP-backed browser tools |
| `opta config set browser.autoInvoke false` | ✅ | Prevent automatic browser open (default) |
| `opta config set browser_open ask` | ✅ | Prompt before any browser open (default) |

---

## Diagnostics

| Invocation | Status | Notes |
|------------|--------|-------|
| `opta doctor` | ✅ | Full environment health check |
| `opta status` | ✅ | Quick status summary (LMX, daemon, account) |
| `opta doctor --fix` | ⚠️ | Attempts auto-fix; review changes |

---

## Shell Completions

| Invocation | Status | Notes |
|------------|--------|-------|
| `eval "$(opta completions zsh)"` | ✅ | Install zsh completions (add to .zshrc) |
| `eval "$(opta completions bash)"` | ✅ | Install bash completions |
| `opta completions fish \| source` | ✅ | Install fish completions |

---

## Embedding / Reranking

| Invocation | Status | Notes |
|------------|--------|-------|
| `opta embed "text to embed"` | 🔧 | Requires LMX with embedding model |
| `opta rerank "query" --documents "a\|b\|c"` | 🔧 | Requires LMX with rerank model |

---

## Slash Commands (In-Session)

Type `/` in any chat session to see all commands. Key ones:

| Slash Command | Status | Effect |
|---------------|--------|--------|
| `/help` | ✅ | Show all slash commands |
| `/model` | ✅ | Switch model mid-session |
| `/plan` | ✅ | Switch to plan mode |
| `/review` | ✅ | Switch to review mode |
| `/research` | ✅ | Switch to research mode |
| `/commit` | ✅ | Commit current working changes |
| `/checkpoint` | ✅ | Create named stash checkpoint |
| `/undo` | ✅ | Revert to last checkpoint |
| `/export` | ✅ | Export session transcript |
| `/debug` | ✅ | Print debug state |
| `/lmx status` | 🔧 | LMX health + active model |
| `/lmx reconnect` | 🔧 | Reset LMX connection |
| `/whoami` | ✅ | Show account + token status |
| `/memory` | ✅ | View project learning ledger |
| `/browser` | ✅ | Browser automation controls |

---

## Post-Install Smoke Test (Run in Order)

Use this sequence to verify a fresh install:

```bash
# 1. Basic help
opta --help

# 2. Environment check
opta doctor

# 3. Config read
opta config list

# 4. Cloud provider smoke test (requires ANTHROPIC_API_KEY)
ANTHROPIC_API_KEY=sk-ant-... opta do "say hello world"

# 5. Daemon lifecycle
opta daemon start
opta daemon status
curl http://127.0.0.1:9999/v3/health
opta daemon stop

# 6. Shell completions
opta completions zsh | head -3

# 7. LMX provider (requires Mac Studio on LAN)
opta config set provider.active lmx
opta config set connection.host 192.168.188.11
opta do "say hello world"
```

All steps should exit 0 without error output.

---

## Platform Availability Matrix

| Command / Feature | macOS | Linux | Windows |
|-------------------|-------|-------|---------|
| `opta chat` (Anthropic) | ✅ | ✅ | ✅ |
| `opta chat` (LMX) | ✅ | ✅ | ❌ |
| `opta chat --tui` | ✅ | ✅ | ✅ (Windows Terminal) |
| `opta daemon` | ✅ | ✅ | ✅ |
| `opta serve` | ✅ | ✅ | ❌ |
| `opta update` | ✅ | ✅ | ❌ |
| `run_command` tool | ✅ | ✅ | ✅ (`cmd.exe`) |
| LSP integration | ✅ | ✅ | ✅ |
| Keychain storage | ✅ | ✅ | ✅ |
| Browser automation | ✅ | ✅ | ✅ |

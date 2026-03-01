# Opta CLI

**Version: 0.5.0-alpha.1** — Core feature set complete. See [docs/ROADMAP.md](docs/ROADMAP.md) for path to v1.0.

A local-first agentic coding assistant powered by Apple Silicon LLM inference. Your code stays on your hardware — Opta routes through [Opta LMX](https://github.com/opta-operations/opta-lmx) running locally on a Mac Studio, with automatic cloud fallback to Anthropic Claude when needed.

## Install

```bash
npm i -g @opta/opta-cli
```

Run the guided setup wizard:

```bash
opta onboard
```

Or verify your environment at any time:

```bash
opta doctor
```

## Platform Support

| Feature                 | macOS | Linux | Windows                |
| ----------------------- | ----- | ----- | ---------------------- |
| `opta chat` (Anthropic) | yes   | yes   | yes                    |
| `opta chat` (LMX local) | yes   | no    | no                     |
| Agent file tools        | yes   | yes   | yes                    |
| Agent `run_command`     | yes   | yes   | yes (`cmd.exe`)        |
| Daemon                  | yes   | yes   | yes                    |
| TUI                     | yes   | yes   | yes (Windows Terminal) |
| LSP features            | yes   | yes   | yes                    |
| `opta serve`            | yes   | yes   | no                     |
| `opta update`           | yes   | yes   | no                     |

`opta serve` and `opta update` require macOS or Linux because Opta LMX infrastructure and management scripts are POSIX-oriented. On Windows, use Anthropic provider workflows or run those commands from a macOS/Linux host.

### Platform Profile Folders

To keep platform workflows unambiguous, this repo now keeps explicitly labeled platform guidance in:

- `platforms/windows/` - Windows-first workflow (no local LMX lifecycle)
- `platforms/macos/` - macOS-first workflow (full LMX lifecycle)

## Usage

```bash
# Interactive chat session
opta chat

# Full-screen terminal UI (React/Ink)
opta tui

# One-shot task execution
opta do "refactor the auth module"

# Planning mode (read-only, no edits)
opta chat --plan

# Code review mode
opta chat --review

# Auto-accept edits (no permission prompts)
opta chat --auto

# Target a specific device for inference
opta chat --device mono512:1234

# Resume a previous session
opta chat --resume <session-id>
```

## Features

### Local LLM Inference

Primary inference runs on Opta LMX (Apple Silicon, MLX-based). If LMX is unreachable, Opta falls back to Anthropic Claude automatically. Switch providers manually with `opta config set provider.active anthropic`.

### Built-in Tools

The agent has access to a full development toolkit:

| Tool           | Description                                  |
| -------------- | -------------------------------------------- |
| `read_file`    | Read file contents with optional line range  |
| `write_file`   | Create or overwrite files                    |
| `edit_file`    | Find-and-replace exact strings in files      |
| `multi_edit`   | Batch edits across multiple files            |
| `list_dir`     | List directory contents                      |
| `search_files` | Regex search across files (ripgrep-backed)   |
| `find_files`   | Glob-based file discovery                    |
| `run_command`  | Execute shell commands                       |
| `ask_user`     | Ask for clarification                        |
| `delete_file`  | Remove files                                 |
| `web_search`   | Search the web for docs and references       |
| `web_fetch`    | Fetch and extract readable content from URLs |

### Browser Automation

Playwright-powered browser control with session isolation, a policy engine for action gating, visual diff comparison, quality gates, and deterministic session replay.

Browser live-host and autonomy control are split into two config planes:

- `computerControl.foreground.*` controls direct screen interaction and can affect active user workflow.
- `computerControl.background.*` controls passive hosting/streaming behavior that can run in the background.

Key defaults and limits:

- `computerControl.background.maxHostedBrowserSessions`: `5` (hard max `5`)
- Live host scans and reserves `6` safe localhost ports by default (`1` control + up to `5` session viewers)
- Loopback-only binding (`127.0.0.1` / `localhost`)

Typical setup:

```bash
# Enable background live hosting
opta config set computerControl.background.enabled true
opta config set computerControl.background.allowBrowserSessionHosting true
opta config set computerControl.background.allowScreenStreaming true
opta config set computerControl.background.maxHostedBrowserSessions 5

# Enable foreground screen actions (interactive / can affect current user work)
opta config set computerControl.foreground.enabled true
opta config set computerControl.foreground.allowScreenActions true
opta config set computerControl.foreground.requireDangerousMode true

# Start browser live host (6-port scan, up to 5 session slots)
/browser host start

# Start browser live host with Peekaboo screen stream
/browser host start --screen peekaboo

# Maximum autonomy profile (requires dangerous mode or auto-accept + Peekaboo)
/autonomy ceo-max
```

### Sub-Agents

Spawn focused sub-agents for isolated subtasks with budget controls (max tool calls, token limits, timeouts). Use `delegate_task` to break complex work into sequential sub-tasks.

### Background Processes

Start, monitor, and manage long-running shell commands (`bg_start`, `bg_status`, `bg_output`, `bg_kill`) -- useful for dev servers, test suites, and builds.

### LSP Integration

Go-to-definition, find references, hover info, workspace symbol search, document symbols, and rename refactoring via Language Server Protocol.

### Research Routing

Multi-provider web research across Brave, Exa, Tavily, Gemini, and Groq with health-aware dispatch and configurable provider order.

### RAG Collections

Ingest documents into vector collections for semantic retrieval:

```bash
opta models rag collections
opta models rag ingest docs --file ./README.md --chunking markdown_headers
```

### Embeddings and Reranking

```bash
opta embed "semantic search query"
opta rerank "what changed?" --documents "release notes|commit log|chat"
```

### Learning Ledger

Persistent project memory that accumulates plans, problems, solutions, and reflections across sessions. Retrieved automatically when relevant context is needed.

### Git Integration

Automatic checkpoints on every file edit. Interactive undo via `/undo` in-session. Auto-commit at task completion.

### MCP Integration

Connect external tools via Model Context Protocol:

```bash
opta mcp add myserver "npx @myorg/mcp-server"
opta mcp add-playwright
opta mcp list
opta mcp test myserver
```

### Benchmark Suite

Generate an interactive showcase with three apps (landing page, chess UI, AI-news research briefing):

```bash
opta benchmark --serve
```

### Daemon Mode

Persistent background server exposing agent capabilities over HTTP + WebSocket for multi-client access:

```bash
opta daemon start
opta daemon status
opta daemon logs
opta daemon stop
```

#### Daemon contract compatibility

The daemon now surfaces an explicit API contract from `/v3/health`:
`contract.name=opta-daemon-v3`, `contract.version=1`.

CLI clients validate this during connection and fail fast with an actionable mismatch message if daemon/client versions drift.

If you see a contract mismatch error:

```bash
opta daemon restart
# if mismatch persists, update both CLI + daemon to the same release
```

### Quality gate

Run the repo quality gate before opening a PR:

```bash
npm run quality:gate
```

This enforces:

- Typecheck
- Contract regression tests (operations + daemon health contract)
- Core smoke suite

## Slash Commands

Type `/` during a chat session to browse all commands, or use directly:

| Command          | Description                     |
| ---------------- | ------------------------------- |
| `/help`          | List all slash commands         |
| `/model`         | Switch models mid-session       |
| `/plan`          | Switch to planning mode         |
| `/review`        | Switch to code review mode      |
| `/research`      | Switch to research mode         |
| `/commit`        | Commit current changes          |
| `/checkpoint`    | Create a named checkpoint       |
| `/undo`          | Revert to a previous checkpoint |
| `/export`        | Export session transcript       |
| `/debug`         | Show debug information          |
| `/browser`       | Browser automation controls     |
| `/lmx status`    | LMX health and model info       |
| `/lmx reconnect` | Reset LMX connection            |
| `/whoami`        | Show account and token status   |
| `/memory`        | View project memory             |

## Model Management

```bash
# Interactive model manager
opta models

# Load a model by fuzzy name
opta models load qwen2.5-coder

# Swap running model for another
opta models swap

# Set default model
opta models use

# Health dashboard
opta models dashboard

# Browse downloadable models
opta models browse-library
```

## Configuration

Config priority: CLI flags > environment variables > project `.opta/config.json` > user `~/.config/opta/config.json` > defaults.

```bash
# List all settings
opta config list

# Set default model
opta config set model.default qwen2.5-coder

# Switch provider
opta config set provider.active anthropic

# Auto-accept file edits
opta config set permissions.edit_file allow

# Interactive config menu
opta config menu
```

### Runtime Capability Enforcement (1R)

For sensitive daemon operations, Opta can call a remote capability evaluator before execution.

```bash
# Enable runtime enforcement
opta config set policy.runtimeEnforcement.enabled true

# Point to 1R capability evaluator
opta config set policy.runtimeEnforcement.endpoint http://127.0.0.1:3002/api/capabilities/evaluate

# Timeout/failure behavior
opta config set policy.runtimeEnforcement.timeoutMs 2500
opta config set policy.runtimeEnforcement.failOpen true
```

Applies to:
- `dangerous` operations (`benchmark`, `mcp.test`) by default
- Selected high-risk write operations (`env.delete`, `mcp.remove`, keychain deletes)

### Environment Profiles

Save and switch between named configurations:

```bash
opta env save laptop
opta env save studio --host 192.168.188.11 --port 1234
opta env use studio
opta env list
```

### Environment Variables

| Variable            | Purpose                                |
| ------------------- | -------------------------------------- |
| `OPTA_HOST`         | LMX server host (default: `localhost`) |
| `OPTA_PORT`         | LMX server port (default: `1234`)      |
| `ANTHROPIC_API_KEY` | Anthropic API key for cloud fallback   |
| `OPTA_MODEL`        | Default model override                 |
| `OPTA_AUTONOMY`     | Default autonomy level (0-5)           |

### API Key Storage

Store keys in the OS secure keychain instead of plaintext config:

```bash
opta keychain set-anthropic sk-ant-...
opta keychain set-lmx opta_sk_...
opta keychain status
```

## Shell Completions

```bash
# zsh
eval "$(opta completions zsh)"

# bash
eval "$(opta completions bash)"

# fish
opta completions fish | source
```

## Requirements

- **Node.js** 20 or later
- **macOS** recommended (Apple Silicon for local inference)
- **Opta LMX** on a Mac Studio or local machine for local inference (optional -- falls back to Anthropic cloud)
- **Playwright** for browser automation (optional, installed on first use)

## License

MIT -- see `package.json` for details.

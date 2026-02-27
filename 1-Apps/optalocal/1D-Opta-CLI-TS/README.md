# Opta CLI

A local-first agentic coding assistant powered by Apple Silicon LLM inference. Your code stays on your hardware -- Opta routes through [Opta LMX](https://github.com/opta-operations/opta-lmx) running locally on a Mac Studio, with automatic cloud fallback to Anthropic Claude when needed.

## Install

```bash
npm install -g opta-cli
```

Run the guided setup wizard:

```bash
opta onboard
```

Or verify your environment at any time:

```bash
opta doctor
```

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

| Tool | Description |
|------|-------------|
| `read_file` | Read file contents with optional line range |
| `write_file` | Create or overwrite files |
| `edit_file` | Find-and-replace exact strings in files |
| `multi_edit` | Batch edits across multiple files |
| `list_dir` | List directory contents |
| `search_files` | Regex search across files (ripgrep-backed) |
| `find_files` | Glob-based file discovery |
| `run_command` | Execute shell commands |
| `ask_user` | Ask for clarification |
| `delete_file` | Remove files |
| `web_search` | Search the web for docs and references |
| `web_fetch` | Fetch and extract readable content from URLs |

### Browser Automation

Playwright-powered browser control with session isolation, a policy engine for action gating, visual diff comparison, quality gates, and deterministic session replay.

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

## Slash Commands

Type `/` during a chat session to browse all commands, or use directly:

| Command | Description |
|---------|-------------|
| `/help` | List all slash commands |
| `/model` | Switch models mid-session |
| `/plan` | Switch to planning mode |
| `/review` | Switch to code review mode |
| `/research` | Switch to research mode |
| `/commit` | Commit current changes |
| `/checkpoint` | Create a named checkpoint |
| `/undo` | Revert to a previous checkpoint |
| `/export` | Export session transcript |
| `/debug` | Show debug information |
| `/browser` | Browser automation controls |
| `/lmx status` | LMX health and model info |
| `/lmx reconnect` | Reset LMX connection |
| `/whoami` | Show account and token status |
| `/memory` | View project memory |

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

### Environment Profiles

Save and switch between named configurations:

```bash
opta env save laptop
opta env save studio --host 192.168.188.11 --port 1234
opta env use studio
opta env list
```

### Environment Variables

| Variable | Purpose |
|----------|---------|
| `OPTA_HOST` | LMX server host (default: `192.168.188.11`) |
| `OPTA_PORT` | LMX server port (default: `1234`) |
| `ANTHROPIC_API_KEY` | Anthropic API key for cloud fallback |
| `OPTA_MODEL` | Default model override |
| `OPTA_AUTONOMY` | Default autonomy level (0-5) |

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

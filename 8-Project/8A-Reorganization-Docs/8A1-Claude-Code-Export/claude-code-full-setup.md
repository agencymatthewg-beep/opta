# Claude Code Full Capability Setup Guide

**Purpose:** Complete installation and configuration guide to replicate the full Claude Code environment with maximum capability, efficiency, and skill access.

**Target Machine:** Mac Studio (Apple Silicon)
**Date Generated:** January 27, 2026

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Core Software Installation](#2-core-software-installation)
3. [MCP Servers (Model Context Protocol)](#3-mcp-servers-model-context-protocol)
4. [Skills & Commands](#4-skills--commands)
5. [Agent Configurations](#5-agent-configurations)
6. [Environment Variables](#6-environment-variables)
7. [Project Structure](#7-project-structure)
8. [Verification Checklist](#8-verification-checklist)

---

## 1. Prerequisites

### System Requirements
- macOS 14+ (Sonoma or later)
- Apple Silicon (M1/M2/M3/M4)
- 16GB+ RAM recommended
- 50GB+ free disk space
- Xcode Command Line Tools

### Install Xcode CLI Tools
```bash
xcode-select --install
```

### Install Homebrew
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

---

## 2. Core Software Installation

### Package Managers & Runtimes

```bash
# Node.js (via nvm for version management)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash
source ~/.zshrc
nvm install 22
nvm use 22
nvm alias default 22

# Python (via pyenv)
brew install pyenv
echo 'eval "$(pyenv init -)"' >> ~/.zshrc
source ~/.zshrc
pyenv install 3.12
pyenv global 3.12

# Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env

# Bun (fast JS runtime)
curl -fsSL https://bun.sh/install | bash
```

### Essential CLI Tools

```bash
# Git & GitHub CLI
brew install git gh

# Development tools
brew install jq ripgrep fd bat eza tree

# Cloud CLIs
npm install -g vercel netlify-cli wrangler

# Database tools (optional)
brew install postgresql sqlite

# Media tools
brew install ffmpeg imagemagick
```

### Claude Code Installation

```bash
# Install Claude Code CLI
npm install -g @anthropic-ai/claude-code

# Verify installation
claude --version
```

---

## 3. MCP Servers (Model Context Protocol)

MCP servers extend Claude's capabilities with specialized tools. Configure these in `~/.claude/mcp.json` or project `.mcp.json`.

### 3.1 Serena (Code Intelligence)

**Capabilities:** Symbolic code analysis, intelligent editing, memory persistence, project understanding

```bash
# Install via pip
pip install serena-mcp

# Or clone and install
git clone https://github.com/serena-ai/serena.git
cd serena && pip install -e .
```

**Configuration:**
```json
{
  "mcpServers": {
    "serena": {
      "command": "serena",
      "args": ["serve"],
      "env": {
        "SERENA_PROJECT_ROOT": "${workspaceFolder}"
      }
    }
  }
}
```

### 3.2 Context7 (Library Documentation)

**Capabilities:** Real-time library docs lookup, code examples, API reference

```bash
npm install -g @context7/mcp-server
```

**Configuration:**
```json
{
  "mcpServers": {
    "context7": {
      "command": "context7-mcp",
      "args": []
    }
  }
}
```

### 3.3 Playwright (Browser Automation)

**Capabilities:** Web testing, screenshots, form filling, navigation, accessibility snapshots

```bash
npm install -g @anthropic-ai/mcp-playwright
npx playwright install chromium
```

**Configuration:**
```json
{
  "mcpServers": {
    "playwright": {
      "command": "mcp-playwright",
      "args": []
    }
  }
}
```

### 3.4 Gmail MCP

**Capabilities:** Read, send, search emails, manage labels, filters, attachments

```bash
npm install -g @anthropic-ai/mcp-gmail
```

**Configuration:**
```json
{
  "mcpServers": {
    "gmail": {
      "command": "mcp-gmail",
      "args": [],
      "env": {
        "GMAIL_CREDENTIALS_PATH": "~/.claude/gmail-credentials.json"
      }
    }
  }
}
```

**Setup:** Run `mcp-gmail auth` to authenticate with Google.

### 3.5 Google Drive MCP

**Capabilities:** Search files, read documents/spreadsheets, update cells

```bash
npm install -g @anthropic-ai/mcp-google-drive
```

**Configuration:**
```json
{
  "mcpServers": {
    "google-drive": {
      "command": "mcp-google-drive",
      "args": [],
      "env": {
        "GOOGLE_CREDENTIALS_PATH": "~/.claude/google-credentials.json"
      }
    }
  }
}
```

### 3.6 Google Calendar MCP

**Capabilities:** List/create/update events, free/busy queries, multi-account support

```bash
npm install -g @anthropic-ai/mcp-google-calendar
```

**Configuration:**
```json
{
  "mcpServers": {
    "google-calendar": {
      "command": "mcp-google-calendar",
      "args": []
    }
  }
}
```

### 3.7 Greptile (Code Review)

**Capabilities:** PR review, code analysis, custom context, merge request management

```bash
npm install -g @greptile/mcp-server
```

**Configuration:**
```json
{
  "mcpServers": {
    "greptile": {
      "command": "greptile-mcp",
      "args": [],
      "env": {
        "GREPTILE_API_KEY": "<your-api-key>"
      }
    }
  }
}
```

### 3.8 Gemini MCP

**Capabilities:** Google search, chat, file analysis via Gemini CLI

```bash
# Install Gemini CLI
npm install -g @anthropic-ai/mcp-gemini

# Authenticate
gemini auth login
```

**Configuration:**
```json
{
  "mcpServers": {
    "gemini": {
      "command": "mcp-gemini",
      "args": []
    }
  }
}
```

### 3.9 YouTube MCP

**Capabilities:** Search videos, get transcripts, channel stats, comments

```bash
npm install -g @anthropic-ai/mcp-youtube
```

**Configuration:**
```json
{
  "mcpServers": {
    "youtube": {
      "command": "mcp-youtube",
      "args": [],
      "env": {
        "YOUTUBE_API_KEY": "<your-youtube-api-key>"
      }
    }
  }
}
```

### Complete MCP Configuration File

Save as `~/.claude/mcp.json`:

```json
{
  "mcpServers": {
    "serena": {
      "command": "serena",
      "args": ["serve"]
    },
    "context7": {
      "command": "context7-mcp",
      "args": []
    },
    "playwright": {
      "command": "mcp-playwright",
      "args": []
    },
    "gmail": {
      "command": "mcp-gmail",
      "args": []
    },
    "google-drive": {
      "command": "mcp-google-drive",
      "args": []
    },
    "google-calendar": {
      "command": "mcp-google-calendar",
      "args": []
    },
    "greptile": {
      "command": "greptile-mcp",
      "args": []
    },
    "gemini": {
      "command": "mcp-gemini",
      "args": []
    },
    "youtube": {
      "command": "mcp-youtube",
      "args": []
    }
  }
}
```

---

## 4. Skills & Commands

Skills are slash commands that extend Claude's capabilities. Install these in your project's `.claude/` directory.

### 4.1 Core Productivity Skills

| Skill | Command | Purpose |
|-------|---------|---------|
| `/start` | Session opener | Context restoration, daily briefing |
| `/end` | Session closer | Commit, push, handoff notes |
| `/commit` | Guided commit | Smart git commits with co-author |
| `/status` | Quick status | Project state overview |
| `/pause` | Mid-session pause | Save context for later |

### 4.2 Development Skills

| Skill | Command | Purpose |
|-------|---------|---------|
| `/build` | Build pipeline | Compile, test, validate |
| `/perfect` | Code audit | Perfectionist quality review |
| `/improve` | Iterative improvement | Enhance existing code |
| `/bug` | Bug capture | Quick bug documentation |
| `/design` | Design system | UI/UX reference |

### 4.3 Planning & Ideas Skills

| Skill | Command | Purpose |
|-------|---------|---------|
| `/ideas` | Context brainstorm | Generate ideas from context |
| `/aideas` | Advanced ideas | Deep ideation with research |
| `/runidea` | Full idea pipeline | Complete idea development |
| `/cone` | Creative mode | "Cereal milk" brainstorming |
| `/100` | Must-have capture | Quick priority idea logging |

### 4.4 GSD (Get Stuff Done) Framework

| Skill | Command | Purpose |
|-------|---------|---------|
| `/gsd:progress` | Check progress | Route to next action |
| `/gsd:plan-phase` | Plan a phase | Break down into tasks |
| `/gsd:execute-phase` | Execute phase | Run planned work |
| `/gsd:verify-work` | UAT testing | Manual acceptance testing |
| `/gsd:new-project` | New project | Initialize with context |
| `/gsd:create-roadmap` | Create roadmap | Phase planning |

### 4.5 Code Quality Skills

| Skill | Command | Purpose |
|-------|---------|---------|
| `/opta` | Opta mode | Deep research, optimization |
| `/atpo` | Code analyzer | Find issues before fixing |
| `/optamize` | Perfectionist loop | Iterative codebase polish |

### 4.6 Visual & Documentation Skills

| Skill | Command | Purpose |
|-------|---------|---------|
| `/gu` | Visual guide | Generate HTML documentation |
| `/guphase` | Phase summary | Visual phase documentation |
| `/release-notes` | Release notes | Generate changelogs |

### 4.7 Ralph Agent Loop

| Skill | Command | Purpose |
|-------|---------|---------|
| `/ralph` | Agent loop | Autonomous task execution |
| `/ralph-plan` | Planning session | Task breakdown |
| `/ralph-task` | Add task | Queue work items |
| `/ralph-status` | Check status | Loop progress |
| `/ralph-resume` | Resume loop | Continue interrupted work |
| `/ralph-clean` | Clean state | Reset ralph context |

### Installing Skills

Skills are defined as markdown files in `.claude/commands/`. Copy from a working installation or create:

```
.claude/
├── commands/
│   ├── start.md
│   ├── end.md
│   ├── commit.md
│   ├── build.md
│   ├── perfect.md
│   ├── gu.md
│   ├── opta.md
│   ├── atpo.md
│   └── ... (all skill files)
├── agents/
│   └── ... (agent configurations)
└── settings.json
```

---

## 5. Agent Configurations

### Available Agent Types

| Agent | Purpose | Tools Access |
|-------|---------|--------------|
| `Bash` | Command execution | Bash only |
| `general-purpose` | Multi-step tasks | All tools |
| `Explore` | Codebase exploration | Read-only tools |
| `Plan` | Architecture planning | Read-only tools |
| `code-reviewer` | Code review | All tools |
| `code-explorer` | Deep code analysis | Read tools |
| `code-architect` | Feature design | Read tools |
| `pr-test-analyzer` | Test coverage | All tools |
| `silent-failure-hunter` | Error handling review | All tools |
| `comment-analyzer` | Comment quality | All tools |
| `type-design-analyzer` | Type system review | All tools |
| `idea-architect` | Ideation support | All tools |
| `session-manager` | Session open/close | All tools |
| `opta-optimizer` | Deep optimization | All tools |
| `atpo-code-analyzer` | Issue identification | All tools |

### Agent Configuration File

Save as `.claude/agents.json`:

```json
{
  "agents": {
    "opta-optimizer": {
      "description": "Deep research and optimization specialist",
      "systemPrompt": "You embody Opta's principles: deep research, creative thinking, proactive discovery, thorough analysis with concise summaries.",
      "tools": ["*"]
    },
    "atpo-code-analyzer": {
      "description": "Identify inefficiencies before optimization",
      "systemPrompt": "Analyze code for inefficiencies, inconsistencies, and potential problems. Provide comprehensive issue lists.",
      "tools": ["*"]
    }
  }
}
```

---

## 6. Environment Variables

### Required API Keys

Create `~/.claude/.env` or set in shell profile:

```bash
# Claude/Anthropic
export ANTHROPIC_API_KEY="sk-ant-..."

# Google Services
export GOOGLE_CLIENT_ID="..."
export GOOGLE_CLIENT_SECRET="..."
export GEMINI_API_KEY="..."
export YOUTUBE_API_KEY="..."

# GitHub
export GITHUB_TOKEN="ghp_..."

# Greptile (optional)
export GREPTILE_API_KEY="..."

# Todoist (optional)
export TODOIST_CLIENT_ID="..."
export TODOIST_CLIENT_SECRET="..."
```

### Getting API Keys

| Service | URL |
|---------|-----|
| Anthropic | https://console.anthropic.com/settings/keys |
| Google Cloud | https://console.cloud.google.com/apis/credentials |
| GitHub | https://github.com/settings/tokens |
| YouTube | https://console.cloud.google.com/apis/library/youtube.googleapis.com |
| Greptile | https://app.greptile.com/settings |
| Todoist | https://developer.todoist.com/appconsole.html |

---

## 7. Project Structure

### Recommended Directory Layout

```
~/Documents/Projects/
├── .claude/                    # Global Claude config
│   ├── mcp.json               # MCP server config
│   ├── settings.json          # Global settings
│   ├── commands/              # Global skills
│   └── agents/                # Agent definitions
│
└── YourProject/
    ├── .claude/               # Project-specific config
    │   ├── commands/          # Project skills
    │   └── settings.local.json
    ├── .planning/             # GSD framework
    │   ├── ROADMAP.md
    │   ├── STATE.md
    │   └── phases/
    ├── .serena/               # Serena memories
    │   └── memories/
    ├── CLAUDE.md              # Project instructions
    └── ... (project files)
```

### CLAUDE.md Template

Create in project root:

```markdown
# Project Name

## Overview
Brief description of the project.

## Tech Stack
- Framework: Next.js 15
- Language: TypeScript
- Styling: Tailwind CSS
- Database: PostgreSQL

## Development Commands
- `npm run dev` - Start dev server
- `npm run build` - Production build
- `npm run test` - Run tests

## Project Structure
Describe key directories and their purposes.

## Conventions
- Code style guidelines
- Naming conventions
- Git workflow

## Current Focus
What we're working on right now.
```

---

## 8. Verification Checklist

Run these commands to verify installation:

### Core Tools
```bash
# Check versions
node --version          # Should be 22.x
python --version        # Should be 3.12.x
rustc --version         # Latest stable
bun --version           # Latest
git --version           # 2.x+
gh --version            # Latest

# Claude Code
claude --version
```

### MCP Servers
```bash
# Verify each MCP server is accessible
which serena
which context7-mcp
which mcp-playwright
which mcp-gmail
which mcp-google-drive
which mcp-google-calendar
which greptile-mcp
which mcp-gemini
which mcp-youtube
```

### Cloud CLIs
```bash
vercel --version
netlify --version
wrangler --version
```

### Test Claude Code
```bash
# Start Claude Code in a project
cd ~/Documents/Projects/YourProject
claude

# Test MCP connections
# In Claude, try: "List my calendars" or "Take a screenshot of google.com"
```

---

## Quick Install Script

Save as `install-claude-full.sh` and run:

```bash
#!/bin/bash
set -e

echo "=== Claude Code Full Setup ==="

# Homebrew packages
echo "Installing Homebrew packages..."
brew install git gh jq ripgrep fd bat eza tree pyenv

# Node.js via nvm
echo "Installing Node.js..."
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm install 22
nvm use 22
nvm alias default 22

# Python via pyenv
echo "Installing Python..."
pyenv install 3.12
pyenv global 3.12

# Rust
echo "Installing Rust..."
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source ~/.cargo/env

# Bun
echo "Installing Bun..."
curl -fsSL https://bun.sh/install | bash

# Global npm packages
echo "Installing npm packages..."
npm install -g @anthropic-ai/claude-code
npm install -g vercel netlify-cli wrangler
npm install -g @context7/mcp-server
npm install -g @anthropic-ai/mcp-playwright
npm install -g @anthropic-ai/mcp-gmail
npm install -g @anthropic-ai/mcp-google-drive
npm install -g @anthropic-ai/mcp-google-calendar
npm install -g @anthropic-ai/mcp-gemini
npm install -g @anthropic-ai/mcp-youtube

# Playwright browsers
npx playwright install chromium

# Python packages
pip install serena-mcp

# Create config directory
mkdir -p ~/.claude/commands ~/.claude/agents

echo "=== Installation Complete ==="
echo "Next steps:"
echo "1. Configure API keys in ~/.claude/.env"
echo "2. Copy MCP config to ~/.claude/mcp.json"
echo "3. Authenticate Google services (gmail, calendar, drive)"
echo "4. Copy skills to ~/.claude/commands/"
```

---

## Support & Resources

- **Claude Code Docs:** https://docs.anthropic.com/claude-code
- **MCP Protocol:** https://modelcontextprotocol.io
- **Serena Docs:** https://github.com/serena-ai/serena
- **Context7:** https://context7.com/docs

---

*Generated by Claude Code on Mac Studio*
*Last Updated: January 27, 2026*

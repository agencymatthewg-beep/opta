# Opta .claude Command Architecture

## Quick Context
- .claude: documentation and resources
- Contains: guides, examples, and reference materials
- Use for: implementation and troubleshooting


**Folder-level custom commands, agents, and automation for Opta projects.**

---

## Overview

This directory contains the command infrastructure for Opta development. Custom commands extend Claude's capabilities within the Opta workspace, allowing rapid access to frequent operations, code analysis, and workflow shortcuts.

### What Is This?
- **Commands:** Custom `/` shortcuts (e.g., `/status`, `/build`, `/design`)
- **Agents:** Specialized personas for different tasks (infrastructure, debugging, etc.)
- **Automation:** Shell scripts that execute multi-step workflows
- **Configuration:** Centralized command registry and settings

---

## Quick Start

### Using Commands
Commands start with `/` and can be typed directly in Claude Code sessions:

```
/start              Open session, load context, show status
/status             Quick project status
/design             Show design system reference
/commit             Guided conventional commit
/build              Run build + type checks
```

**Tab completion works** for all commands in Claude Code.

### Available Commands (41 total)

See **[Commands Index](#commands-index)** below for full list with descriptions.

---

## Directory Structure

```
.claude/
├── README.md                          # This file
├── commands.json                      # Root command registry
├── commands/                          # Command definitions
│   ├── start.md                       # /start - Session opener
│   ├── status.md                      # /status - Quick status
│   ├── commit.md                      # /commit - Guided commits
│   └── ...40 more commands
├── command-runner.sh                  # Command executor
├── validate-commands.sh                # Command linter
├── update-commands-directory.sh        # Registry generator
├── agents/                            # Agent definitions (minimal)
└── plugins/                           # Plugin integrations
```

---

## Command System

### How Commands Work

1. **Definition:** Commands are defined in `.claude/commands/` as `.md` files
2. **Registry:** `commands.json` indexes all commands with metadata
3. **Lookup:** When you type `/name`, Claude searches:
   - Project-level commands (`./.claude/commands.json`)
   - Folder-level commands (parent directories)
   - Global commands (`~/.claude/commands.json`)
4. **Execution:** `command-runner.sh` executes the command payload

### Command Types

#### Skill Commands
Leverage Claude's capabilities for specialized analysis:
```json
{
  "/gu": {
    "type": "skill",
    "action": "gemini",
    "description": "Generate visual guide with Gemini"
  }
}
```

#### Tool Commands
Execute Claude tools (Read, Write, Edit, Bash):
```json
{
  "/design": {
    "type": "tool",
    "action": "Read",
    "params": { "file_path": "DESIGN_SYSTEM.md" }
  }
}
```

#### Bash Commands
Run shell scripts or commands:
```json
{
  "/rust": {
    "type": "bash",
    "action": "cd repos/rust && cargo metadata"
  }
}
```

#### Composite Commands
Multi-step workflows combining tools:
```json
{
  "/status": {
    "type": "composite",
    "steps": [
      { "type": "bash", "action": "git status" },
      { "type": "tool", "action": "Read", "params": {...} }
    ]
  }
}
```

### Aliases

Common abbreviations for quick typing:

| Alias | Full Command | Purpose |
|-------|--------------|---------|
| `/s` | `/status` | Quick status |
| `/d` | `/design` | Design reference |
| `/g` | `/gu` | Generate guide |
| `/r` | `/rust` | Rust core |
| `/a` | `/apps` | List apps |

---

## Commands Index

### Session Management
| Command | Description |
|---------|-------------|
| `/start` | Open session — load context, show status, suggest next action |
| `/end` | Close session — summarize work, capture learnings, update state |
| `/pause` | Pause mid-session — save context for later resume |
| `/status` | Quick status — phase, progress, next action |

### Context & Reference
| Command | Description |
|---------|-------------|
| `/decisions` | List recent architectural decisions |
| `/design` | Design system quick reference (glass, Framer, Lucide) |
| `/help` | Show all commands with descriptions |

### Ideation & Capture
| Command | Description |
|---------|-------------|
| `/100` | Capture must-have feature idea to MUST_HAVE.md |
| `/aideas` | Archive old ideas from IDEAS.md |
| `/ideas` | List current project ideas |
| `/learn` | Log pattern/correction to training data |
| `/bug` | Capture bug/issue to deferred issues |
| `/runidea` | Execute an idea from IDEAS.md |
| `/arunidea` | Archive executed ideas |

### Code Quality
| Command | Description |
|---------|-------------|
| `/perfect` | Deep code audit — meticulous review via perfectionist agent |
| `/improve` | Iterative refinement of recent changes |
| `/Optamize` | Perfectionist loop — fix ALL issues (max 30 iterations) |
| `/build` | Run build + type check + cargo check |
| `/cone` | Code one-liner fix via agent analysis |
| `/style` | Code style & linting (TypeScript/Rust) |

### Workflow
| Command | Description |
|---------|-------------|
| `/commit` | Guided commit with conventional format |
| `/phase-done` | Complete phase — create SUMMARY, update STATE |
| `/start` | Session start (context + status) |
| `/end` | Session end (summary + learnings) |

### Project Navigation
| Command | Description |
|---------|-------------|
| `/opta` | Activate Opta mode (deep research, creative) |
| `/oap` | Opta App Platform info & structure |
| `/optamize` | Optimize via perfectionist agent |
| `/atpo` | Opta app structure visualization |
| `/apps` | List all Opta apps (iOS, Web, Desktop, Shared) |
| `/rust` | Navigate to Rust core, show workspace |
| `/research` | Search Gemini Deep Research files |
| `/design` | Opta design system reference |

### Analysis & Visualization
| Command | Description |
|---------|-------------|
| `/gu` | Generate visual guide (Gemini + Mermaid) |
| `/gemdere` | Gemini to Mermaid diagram |
| `/gemini` | Invoke Gemini for analysis |
| `/learn` | Add learnings to training dataset |
| `/100` | Capture must-have features |

### Ralph Workflow (Task Management)
| Command | Description |
|---------|-------------|
| `/ralph` | Ralph agent — multi-step task executor |
| `/ralph-plan` | Plan Ralph task (steps, resources, timeline) |
| `/ralph-execute` | Execute Ralph plan |
| `/ralph-status` | Show Ralph task status |
| `/ralph-resume` | Resume interrupted Ralph task |
| `/ralph-clean` | Clean Ralph workspace |
| `/ralph-task` | Define new Ralph task |

### GSD (Getting Stuff Done)
| Command | Description |
|---------|-------------|
| `/gsd` | GSD mode — quick execution framework |
| `/guphase` | GSD phase planning (Gemini visual + text) |

### Release & Deployment
| Command | Description |
|---------|-------------|
| `/release-notes` | Generate release notes from commits |
| `/MacOS` | macOS app specific operations |
| `/iOS` | iOS app specific operations |
| `/qcon` | Quick context (session continuation) |
| `/qrem` | Quick reminder (add to reminders) |

---

## Agents

Opta has minimal dedicated agents; most specialization is achieved through:
- **Commands** — Task-specific workflows
- **Skill invocations** — Specialized LLM capabilities
- **Tool-based reasoning** — Code analysis, refactoring, planning

**Agent Directory:** `.claude/agents/` (mostly template structure)

### When Agents Are Used
- Complex multi-step reasoning (planning, analysis)
- Role-based personas (perfectionist, critic, researcher)
- State-based workflows (Ralph task execution)

---

## Plugins

### Enabled Plugins
None in standard Opta setup.

### Local Plugins
- **None currently enabled** — Commands handle most workflow needs

### Integration Points
- Gemini API: `/gu`, `/gemini`, `/gemdere` commands invoke Gemini 2.5 Flash
- Claude API: All native Claude commands
- Git: `/commit`, `/release-notes` integrate with git history

---

## Skills

Skills are not explicitly exported in Opta .claude, but are leveraged through commands:
- **Gemini vision** — `/gu`, `/gemini` (visual analysis, diagram generation)
- **Code analysis** — `/perfect`, `/build`, `/style` (perfectionist + compiler)
- **Git operations** — `/commit`, `/release-notes` (conventional commits)
- **Workflow orchestration** — `/ralph`, `/gsd` (multi-step task execution)

---

## Adding New Commands

### Step 1: Create Command File
Create `.claude/commands/mycommand.md`:

```markdown
# /mycommand - Short description

Detailed description of what this command does.

## Usage
/mycommand [options]

## Example
/mycommand --flag value
```

### Step 2: Update commands.json
Add entry to `commands.json`:

```json
{
  "/mycommand": {
    "description": "Short description",
    "type": "bash|tool|skill|composite",
    "action": "...",
    "params": {...}
  }
}
```

### Step 3: Validate
Run validation:
```bash
./.claude/validate-commands.sh
```

### Step 4: Regenerate Index
Update command index:
```bash
./.claude/update-commands-directory.sh
```

---

## Workflow Examples

### Starting a Work Session
```
/start          → Load context, show status
<do work>
/commit         → Make conventional commit
/end            → Summarize, capture learnings
```

### Deep Code Review
```
/status         → See what changed
/perfect        → Run meticulous code audit
/improve        → Iterative refinement (if needed)
/Optamize       → Max out code quality
/commit         → Commit improvements
```

### New Feature Development
```
/start          → Session context
/opta           → Activate Opta research mode
/gu "feature concept"  → Visual design
<code>          → Implement
/perfect        → Audit code
/100            → Save must-have ideas
/phase-done     → Complete phase
```

### Task Management (Ralph)
```
/ralph-plan "multi-step task"   → Plan task
/ralph-execute                  → Run it
/ralph-status                   → Check progress
/ralph-resume                   → Continue if interrupted
```

---

## Configuration

### commands.json
Central registry of all commands. Schema:
```json
{
  "$schema": "https://claude.ai/schemas/commands-v1.json",
  "version": "1.0",
  "description": "Project commands",
  "commands": {
    "/name": {
      "description": "What it does",
      "type": "bash|tool|skill|composite",
      "action": "...",
      "params": {...}
    }
  },
  "aliases": {
    "/short": "/fullname"
  }
}
```

### Command Lookup Order
1. **Project level:** `./.claude/commands.json` (deepest first)
2. **Folder level:** Walk up directory tree, stop at first match
3. **Global:** `~/.claude/commands.json`

---

## Troubleshooting

### Command Not Found
```bash
# Check if command exists
grep "/mycommand" .claude/commands.json

# Validate syntax
./.claude/validate-commands.sh

# Rebuild index
./.claude/update-commands-directory.sh
```

### Command Fails
1. Check command definition in `.claude/commands/mycommand.md`
2. Verify `commands.json` entry matches definition
3. Test the underlying action (bash, tool, or skill) separately
4. Check file paths are relative to correct working directory

### Permission Denied
```bash
# Make scripts executable
chmod +x .claude/*.sh
```

---

## Best Practices

1. **Keep commands focused** — One job per command
2. **Use aliases** — Provide short versions of common commands
3. **Document well** — Include examples in `.md` files
4. **Validate regularly** — Run `validate-commands.sh` after changes
5. **Version control** — Commit command changes to git
6. **Organize by domain** — Group related commands conceptually
7. **Use composite commands** — For multi-step workflows
8. **Leverage tools** — Prefer `/tool` to bash where safe

---

## See Also

- **Individual Commands:** `.claude/commands/*.md`
- **Full Registry:** `.claude/commands.json`
- **Validation Script:** `.claude/validate-commands.sh`
- **Main Workspace:** `~/Synced/Opta/`
- **Global Commands:** `~/.claude/commands.json` (if exists)

---

## Support

For help:
- List all commands: `/help`
- Check specific command: Look in `.claude/commands/[name].md`
- Validate setup: Run `./.claude/validate-commands.sh`
- Rebuild registry: Run `./.claude/update-commands-directory.sh`

---

**Last Updated:** 2026-02-10  
**Status:** Active (41 commands, multiple agents, validated)  
**Maintained by:** Opta Development Team

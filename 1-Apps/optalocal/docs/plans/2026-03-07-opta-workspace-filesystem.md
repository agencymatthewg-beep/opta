# Opta Workspace Filesystem Design
**Date:** 2026-03-07
**Status:** Implemented (Phase 1 — Init wizard creates structure)
**Next:** CLI and Code Desktop path updates

---

## Overview

The Opta Workspace filesystem is a two-tier structure created by the Opta Init install wizard. It gives every Optalocal app a canonical, predictable place to read and write state. All four core apps — CLI, Daemon, LMX, and Code Desktop — agree on these paths completely, mirroring how Codex macOS and the Codex terminal share the same filesystem state.

---

## Two-Tier Architecture

### Tier 1: `~/.config/opta/` — Machine-Managed State (Hidden)

XDG-standard config directory. Already used by the CLI (`platform/paths.ts`). The Init wizard ensures all subdirectories are pre-created.

```
~/.config/opta/
├── config.json              # User preferences (CLI primary, Code Desktop reads)
├── sessions/                # CLI auth sessions (<id>.json files)
├── daemon/                  # Daemon socket, PID, event log
├── themes/                  # Custom TUI color themes
├── lsp-bin/                 # LSP server binaries (installed by CLI)
├── logs/                    # Runtime logs from all apps   [NEW — created by init]
│   ├── daemon.log
│   ├── lmx.log
│   └── code.log
├── cache/                   # Embedding/RAG vector store caches   [NEW]
│   └── rag-store/
├── tools/                   # Global custom tool definitions   [NEW]
├── lmx-connections.json     # LMX server address book
└── opta-init-config.json    # Init wizard persistent config (incl. workspacePath)
```

**Owned by:** CLI daemon, LMX, Code Desktop (read-only for config.json)
**Not synced:** Machine-specific, excluded from iCloud

### Tier 2: `~/Documents/Opta Workspace/` — User-Facing Workspace (Visible)

User-readable, iCloud-eligible, Git-trackable. This is where users create projects, add knowledge, and view AI outputs. LMX auto-registers this directory for RAG indexing on first run.

```
~/Documents/Opta Workspace/
├── INDEX.md                   # Auto-generated navigation guide (YAML frontmatter)
│
├── About Me/
│   ├── INDEX.md
│   ├── ABOUT.md               # Who I am, expertise, preferences (fill this in)
│   └── MY-SETUP.md            # Hardware, software, Opta configuration
│
├── Projects/
│   ├── INDEX.md               # Lists all active projects
│   └── <project-name>/        # One folder per project (user-created)
│       ├── INDEX.md           # Auto-generated project context ladder
│       ├── GOAL.md            # What I'm building and why
│       ├── CLAUDE.md          # AI coding instructions (optional OPIS scaffold)
│       ├── Plans/             # Design docs, specs, ADRs
│       │   └── INDEX.md
│       ├── Research/          # Background research, references
│       │   └── INDEX.md
│       └── Temp/              # Scratch space (not indexed by RAG)
│           └── .gitkeep
│
├── Knowledge/
│   └── INDEX.md               # Personal knowledge base (RAG-indexed)
│
├── Skills/
│   └── INDEX.md               # Custom AI skill YAML files
│
├── Screenshots/
│   └── INDEX.md               # Auto-populated by CLI/Code Desktop
│
└── Exports/
    └── INDEX.md               # Conversation exports, AI reports
```

---

## YAML Frontmatter Standard

All INDEX.md and template files use YAML frontmatter so the LMX RAG system can extract metadata:

```yaml
---
type: workspace-index | section-index | user-profile | project-goal | plan-doc
ai-read-when:
  - always          # Always inject into context
  - starting-task   # Read when beginning any work
  - domain-specific # Read for specific topics
last-updated: YYYY-MM-DD
project: project-name    # Optional — scope to a project
tags: [tag1, tag2]       # Optional — for semantic search
---
```

### `type` Values

| Type | File | When AI reads |
|------|------|---------------|
| `workspace-index` | Root INDEX.md | Exploring workspace |
| `section-index` | Subfolder INDEX.md | Navigating sections |
| `user-profile` | About Me/ABOUT.md | Starting any task |
| `hardware-setup` | MY-SETUP.md | Hardware/infra questions |
| `projects-index` | Projects/INDEX.md | Starting development work |
| `project-goal` | Projects/X/GOAL.md | Working on that project |
| `plan-doc` | Plans/*.md | Planning/architecture decisions |

---

## Per-Project Template

When a user creates a new project (via `opta new` CLI command or Code Desktop), the following structure is scaffolded:

```
Projects/my-project/
├── INDEX.md          (auto-generated — context ladder for AI)
├── GOAL.md           (template — fill in: what, why, success criteria)
├── CLAUDE.md         (optional — AI coding instructions for this project)
├── Plans/
│   └── INDEX.md
├── Research/
│   └── INDEX.md
└── Temp/
    └── .gitkeep
```

### GOAL.md Template

```markdown
---
type: project-goal
project: my-project
ai-read-when:
  - always
last-updated: YYYY-MM-DD
---

# Goal: My Project

## What I'm Building
[One paragraph — the product/feature/result]

## Why
[Motivation — user need, business goal, learning objective]

## Success Criteria
- [ ] ...

## Current Phase
[What phase of development is this in?]

## Key Constraints
- Technology: [e.g. TypeScript, Rust, Python]
- Deadline: [optional]
- Must not: [things to avoid]
```

---

## RAG Auto-Registration

The LMX server automatically registers the workspace for RAG indexing on first run:

| Path | Collection | Patterns |
|------|-----------|---------|
| `~/Documents/Opta Workspace/` | `global` | `*.md, *.txt, *.yaml` |
| `~/Documents/Opta Workspace/About Me/` | `user-context` | `*.md` |
| `~/.config/opta/` | `opta-config` | `*.json, *.yaml` |

Projects get their own collection when registered:
- `~/Documents/Opta Workspace/Projects/<name>/` → `project-<slug>`

---

## Context Ladder (How AI Reads This)

AI systems use a graduated read strategy based on available context budget:

| Context Budget | What AI reads |
|----------------|--------------|
| < 8K tokens | Root INDEX.md only |
| 8–32K tokens | INDEX.md + ABOUT.md + current project GOAL.md |
| > 32K tokens | Full workspace scan via RAG semantic search |

The `ai-read-when: [always]` frontmatter field causes certain files (ABOUT.md, project GOAL.md) to always be injected into context regardless of budget.

---

## App Integration Plan

### Phase 1 — Init Wizard (THIS PHASE — DONE)
- ✅ Init wizard Rust backend creates the full filesystem on setup completion
- ✅ `WorkspaceCreationResult` returned to frontend with path + counts
- ✅ `workspacePath` stored in `~/.config/opta/opta-init-config.json`

### Phase 2 — Opta LMX (DONE — prev session)
- ✅ LMX auto-registers `~/Documents/Opta Workspace/` (collection: `global`)
- ✅ LMX auto-registers `~/.config/opta/` (collection: `opta-config`)
- ✅ Watch registry persists at `~/.opta-lmx/watch-registry.json`

### Phase 3 — Opta CLI (NEXT)
- `opta workspace` command to open/navigate workspace
- `opta new <project-name>` scaffolds Projects/<name>/ with templates
- CLI reads `workspacePath` from `~/.config/opta/opta-init-config.json`
- Screenshots saved to `~/Documents/Opta Workspace/Screenshots/`
- Exports saved to `~/Documents/Opta Workspace/Exports/`

### Phase 4 — Opta Code Desktop (AFTER CLI)
- Code Desktop reads `workspacePath` from config
- Screenshots saved to `~/Documents/Opta Workspace/Screenshots/`
- Project picker shows `Projects/` subdirectories
- Skills loaded from `~/Documents/Opta Workspace/Skills/`

---

## Cross-Platform Paths

| Platform | Tier 1 | Tier 2 |
|----------|--------|--------|
| macOS | `~/.config/opta/` | `~/Documents/Opta Workspace/` |
| Windows | `%APPDATA%\opta\` | `%USERPROFILE%\Documents\Opta Workspace\` |
| Linux | `$XDG_CONFIG_HOME/opta/` | `~/Documents/Opta Workspace/` |

On macOS, `~/Documents/Opta Workspace/` is iCloud-eligible (if iCloud Drive is enabled).

---

## Design Decisions

**Q: Why not `~/.opta/` for hidden state?**
The CLI already standardizes on `~/.config/opta/` (XDG spec). Introducing `~/.opta/` would split state across two hidden locations. We extend the existing standard instead.

**Q: Why pre-create all folders even if empty?**
Empty folders take zero space. Pre-creation means every app always has a guaranteed path to write to without defensive mkdir calls. It also makes the workspace immediately discoverable by the user.

**Q: Why `~/Documents/Opta Workspace/` and not `~/Opta/`?**
Documents/ is iCloud-synced on macOS. It's discoverable in Finder's sidebar. Users expect project files in Documents. "Opta Workspace" is clear user-outcome language (not "Opta Config").

**Q: Why INDEX.md in every folder?**
INDEX.md files serve as context ladders for AI. An AI reading `Projects/INDEX.md` immediately knows what projects exist without scanning the full directory tree. Follows the pattern established in the LMX autonomous RAG design.

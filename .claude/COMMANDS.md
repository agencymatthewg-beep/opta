# Opta Custom Commands

Quick reference for all custom slash commands available in this project.

---

## Quick Reference

| Command | Purpose | Phase |
|---------|---------|-------|
| `/start` | Open session with full context | Session |
| `/end` | Close session, capture learnings | Session |
| `/pause` | Pause mid-session, save context | Session |
| `/opta` | Activate Opta mode | Session |
| `/status` | Quick status check | Context |
| `/decisions` | List recent decisions | Context |
| `/design` | Design system reference | Context |
| `/100` | Capture must-have idea | Capture |
| `/learn` | Log training data | Capture |
| `/bug` | Capture bug/issue | Capture |
| `/build` | Build + type check | Workflow |
| `/commit` | Guided commit | Workflow |
| `/phase-done` | Complete phase | Workflow |
| `/help` | Show all commands | Utility |

---

## Session Commands

### `/start`
**File:** `.claude/commands/start.md`

Opens a new development session:
- Loads all context files (hardware, workflows, PROJECT, STATE)
- Shows current phase and progress
- Checks for blockers, deferred issues, pending todos
- Suggests next action
- Checks for resume state from `/pause`

### `/end`
**File:** `.claude/commands/end.md`

Closes the current session:
- Summarizes work completed
- Prompts for training data capture
- Updates STATE.md with progress
- Logs to SESSION_LOG.md
- Checks for uncommitted changes

### `/pause`
**File:** `.claude/commands/pause.md`

Pauses work mid-session:
- Saves current context to PAUSE_STATE.md
- Records what you were working on
- Records next step planned
- Resume with `/start` later

### `/opta`
**File:** `.claude/commands/opta.md`

Activates Opta mode:
- Deep research, not surface-level
- Creative and adaptive thinking
- Proactive variable discovery
- Thorough analysis + TL;DR summaries

---

## Context Commands

### `/status`
**File:** `.claude/commands/status.md`

Quick status without full context load:
- Current phase and plan
- Progress percentage
- Last activity
- Next suggested action

### `/decisions`
**File:** `.claude/commands/decisions.md`

List recent architectural decisions:
- Pulled from STATE.md
- Categorized by type
- With rationale

### `/design`
**File:** `.claude/commands/design.md`

Design system quick reference:
- Animation rules (Framer Motion)
- Icon rules (Lucide React)
- Glass effects
- Color variables
- Typography

---

## Capture Commands

### `/100`
**File:** `.claude/commands/100.md`

Capture must-have feature idea:
- Clarifies vision with questions
- Adds to MUST_HAVE.md
- Categorized by type (Feature, UX, Technical, Integration)

### `/learn`
**File:** `.claude/commands/learn.md`

Log training data:
- Good patterns to replicate
- Corrections to avoid
- Preferences discovered
- Appends to opta-optimizer-training.md

### `/bug`
**File:** `.claude/commands/bug.md`

Quick bug capture:
- Adds to STATE.md deferred issues
- With severity and context
- For later triage

---

## Workflow Commands

### `/build`
**File:** `.claude/commands/build.md`

Run full build pipeline:
1. `npm run build` (Vite + TypeScript)
2. `npm run check` (type checking)
3. `cargo check` (Rust validation)
4. Reports pass/fail with details

### `/commit`
**File:** `.claude/commands/commit.md`

Guided commit workflow:
1. Shows git status and diff
2. Drafts conventional commit message
3. Gets approval/edits
4. Commits with Co-Authored-By

### `/phase-done`
**File:** `.claude/commands/phase-done.md`

Complete current phase:
1. Verifies all tasks done
2. Generates SUMMARY.md
3. Updates STATE.md progress
4. Suggests next phase

---

## Adding New Commands

1. Create `.claude/commands/[name].md`
2. Add entry to this index
3. Command becomes available as `/[name]`

---

*Last updated: 2026-01-16*

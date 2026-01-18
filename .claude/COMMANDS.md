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
| `/perfect` | Deep perfectionist code audit | Quality |
| `/Optamize` | Perfectionist loop - fix ALL issues | Quality |
| `/build` | Build + type check | Workflow |
| `/commit` | Guided commit | Workflow |
| `/phase-done` | Complete phase | Workflow |
| `/help` | Show all commands | Utility |
| `/improve` | Iterative code polish | Quality |
| `/cone` | Wild creative brainstorm | Ideation |
| `/ideas` | Context brainstorm | Ideation |
| `/runidea` | Full idea pipeline | Ideation |
| `/aideas` | Advanced ideas (power-user) | Ideation |
| `/arunidea` | Advanced idea pipeline | Ideation |
| `/ralph` | Run Ralph agent loop | Automation |
| `/ralph-task` | Add task to scratchpad | Automation |
| `/ralph-plan` | Start planning session | Automation |
| `/ralph-resume` | Resume interrupted loop | Automation |
| `/ralph-status` | Check loop status | Automation |
| `/ralph-clean` | Clear Ralph state | Automation |

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

## Automation Commands (Ralph)

Ralph is an autonomous agent loop system for feature development.

### `/ralph`
**File:** `.claude/commands/ralph.md`

Run a Ralph agent loop:
```
/ralph Add dark mode toggle
```
- Starts Builder → Reviewer cycle
- Interactive TUI for monitoring
- Each task = one commit
- Backpressure (tests/lint) required

### `/ralph-task`
**File:** `.claude/commands/ralph-task.md`

Add tasks to scratchpad without running:
```
/ralph-task Fix memory leak in process monitor
```
- Tasks queued in `.agent/scratchpad.md`
- Run `/ralph` when ready to execute

### `/ralph-plan`
**File:** `.claude/commands/ralph-plan.md`

Start a planning session:
```
/ralph-plan User authentication system
```
- Generates task breakdown
- Saves plan to `specs/`
- Option to add tasks to scratchpad

### `/ralph-resume`
**File:** `.claude/commands/ralph-resume.md`

Resume interrupted loop:
```
/ralph-resume
```
- Continues from existing state
- Shows completed/remaining tasks

### `/ralph-status`
**File:** `.claude/commands/ralph-status.md`

Check current loop status:
```
/ralph-status
```
- Shows progress, pending tasks
- Identifies blockers

### `/ralph-clean`
**File:** `.claude/commands/ralph-clean.md`

Clear Ralph state:
```
/ralph-clean
```
- Removes `.agent/` contents
- Start fresh

---

## Quality Commands

### `/perfect`
**File:** `.claude/commands/perfect.md`

Launch perfectionist-code-auditor agent for comprehensive review:
```
/perfect              # Audit recent changes (git diff)
/perfect staged       # Audit staged changes only
/perfect branch       # Audit all changes on current branch
/perfect file:path    # Audit specific file or directory
/perfect full         # Complete codebase audit
```

Features:
- 6-phase systematic methodology (structure, quality, performance, security, standards, maintainability)
- Design system compliance verification
- Issues categorized by severity (Critical, Important, Minor)
- Every finding has file:line references
- Quality score (0-10) and prioritized action plan
- Option to automatically fix issues after audit

### `/improve`
**File:** `.claude/commands/improve.md`

Launch iterative-improver agent for systematic refinements:
- Analyzes recent changes (git diff or conversation)
- Applies 20-50+ small improvements
- Categories: naming, comments, formatting, type safety, performance
- Outputs GenUI HTML report to `/tmp/`
- Non-breaking: no logic changes

### `/Optamize`
**File:** `.claude/commands/optamize.md`

Perfectionist codebase optimization loop (Atpo-Opta Cycle):
```
/Optamize                    # Full codebase optimization
/Optamize src/components/    # Optimize specific scope
/Optamize --max-iterations 15  # Custom iteration limit
```

Features:
- Runs up to **30 iterations** until codebase is perfected
- **Atpo Phase**: Comprehensive analysis (TypeScript errors, design violations, code quality)
- **Opta Phase**: Systematic fixes for all identified issues
- **Validation Phase**: Build + type check after each iteration
- Tracks progress in `.agent/optamize-state.md`
- Exits when: perfection achieved OR max iterations OR user cancelled

Issue Categories Addressed:
- Build & TypeScript errors
- Design system compliance
- Code quality (dead code, duplication, missing error handling)
- Performance issues
- Security vulnerabilities
- TODO/FIXME completeness
- Consistency violations

Exit Conditions:
1. **PERFECTION_ACHIEVED**: Zero issues found
2. **MAX_ITERATIONS**: Reached 30 iterations
3. **USER_CANCELLED**: Interrupted by user
4. **CRITICAL_FAILURE**: Unrecoverable error

Integration: Pairs with `/build`, `/perfect` (final verification), `/commit`

---

## Ideation Commands

### `/cone`
**File:** `.claude/commands/cone.md`

Creative brainstorm with cereal-milk-creative agent:
- Unconventional, abstract, wildly creative ideas
- 3-7 ideas from "spicy but doable" to "unhinged"
- For breaking creative blocks
- Stream-of-consciousness style with grounded versions

### `/ideas`
**File:** `.claude/commands/ideas.md`

Quick context brainstorm:
- Analyzes current conversation
- Generates relevant ideas
- Prioritizes by feasibility and impact
- Quick wins + worth exploring lists

### `/runidea`
**File:** `.claude/commands/runidea.md`

Full 3-stage idea pipeline:
```
/runidea [topic or problem]
```
1. **Ideation**: 15-25+ ideas, shortlist top candidates
2. **Critique**: Risk assessment, feasibility analysis
3. **Compare**: Matrix comparison, use case examples

### `/aideas`
**File:** `.claude/commands/aideas.md`

Advanced ideas for power users:
- Deep customization options
- AI/LLM integration possibilities
- Automation and scripting hooks
- API extensibility
- Elevates basic ideas to power-user level

### `/arunidea`
**File:** `.claude/commands/arunidea.md`

Advanced idea pipeline (power-user focus):
```
/arunidea [topic or problem]
```
1. **Advanced Ideation**: 15-25+ ideas with extensibility focus
2. **Power-User Critique**: Scores for extensibility, AI, automation
3. **Compare & Architect**: Architecture sketches, extension points

---

## Adding New Commands

1. Create `.claude/commands/[name].md`
2. Add entry to this index
3. Command becomes available as `/[name]`

---

*Last updated: 2026-01-18*

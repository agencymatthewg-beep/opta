# /status - Quick Status

Show current project status without full context load.

## Process

### 1. Read STATE.md Only

Read `.planning/STATE.md` to get:
- Current phase and plan
- Progress percentage
- Last activity
- Any blockers or deferred issues

### 2. Display Status

```
STATUS
═══════════════════════════════════════════════════════════════
Phase:     8.1 (Adaptive Intelligence) - 2/4 plans
Progress:  70% (28/40 total)
Last:      2026-01-16 — Completed 08.1-02-PLAN.md
Next:      08.1-03-PLAN.md (Preference Inference)
═══════════════════════════════════════════════════════════════
```

### 3. Show Issues (if any)

If blockers or deferred issues exist:
```
ATTENTION
───────────────────────────────────────────────────────────────
Blockers: 1
Deferred: 2

Run /start for full context
───────────────────────────────────────────────────────────────
```

## Difference from /start

| /status | /start |
|---------|--------|
| Reads STATE.md only | Reads all context files |
| Shows status | Shows status + context |
| Quick (1 file) | Thorough (9 files) |
| No suggestions | Suggests next action |
| For quick checks | For session start |

## Usage

Use `/status` when you:
- Just need a quick progress check
- Are in the middle of work
- Don't need full context reload

Use `/start` when you:
- Begin a new session
- Need full context
- Want suggestions for next action

# /pause - Mid-Session Pause

Save current context for later resume without fully closing the session.

## When to Use

- Need to step away but will return soon
- Switching to a different task temporarily
- Want to preserve exact context for seamless resume

## Process

### 1. Capture Current State

Gather:
- What plan/task you're currently working on
- Files that have been modified
- The next step that was planned
- Any notes about current state

### 2. Prompt for Notes

```
PAUSE SESSION
═══════════════════════════════════════════════════════════════
Working on: [detected from conversation]
Next step:  [detected from conversation]

Any notes to add? (optional, press Enter to skip)
───────────────────────────────────────────────────────────────
```

### 3. Save to PAUSE_STATE.md

Create/overwrite `.planning/PAUSE_STATE.md`:

```yaml
---
paused_at: 2026-01-16T15:30:00Z
session_duration: ~45 min
---

# Pause State

## Working On
- Plan: 08.1-02-PLAN.md
- Task: 2 (Implement pattern storage)
- File: src/ai/learning.ts

## Files Modified This Session
- src/ai/learning.ts (new)
- src/types/profile.ts (modified)
- mcp-server/src/opta_mcp/profile.py (modified)

## Next Step
Implement the PatternStore class with:
- addPattern(pattern: LearnedPattern)
- getPatterns(category: string)
- persist to localStorage

## Notes
[User's custom notes if provided]

## Context Summary
[Brief summary of what was accomplished so far]
```

### 4. Confirm

```
PAUSED
═══════════════════════════════════════════════════════════════
State saved to: .planning/PAUSE_STATE.md
Duration so far: ~45 min

Resume with /start - it will detect the pause state and offer
to continue from where you left off.
═══════════════════════════════════════════════════════════════
```

## Resume Flow

When `/start` runs and finds PAUSE_STATE.md:
```
RESUME AVAILABLE
═══════════════════════════════════════════════════════════════
Found pause state from 2 hours ago:

Working on: 08.1-02-PLAN.md, Task 2
Next step:  Implement PatternStore class
Notes:      [any notes]

Resume from here? (y/n)
═══════════════════════════════════════════════════════════════
```

If yes: Load context and continue
If no: Delete PAUSE_STATE.md and start fresh

## Difference from /end

| /pause | /end |
|--------|------|
| Saves current position | Closes session properly |
| No STATE.md updates | Updates STATE.md |
| No SESSION_LOG entry | Logs to SESSION_LOG |
| Quick, informal | Thorough, formal |
| For temporary breaks | For end of work session |

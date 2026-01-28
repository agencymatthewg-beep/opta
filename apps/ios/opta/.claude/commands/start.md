# /start - Session Opener

Begin a new development session with full context loading.

## Immediate Actions

Read ALL context files in parallel to build situational awareness:

1. `../../../3. Matthew x Opta/1. personal/hardware.md` - Device ecosystem
2. `../../../3. Matthew x Opta/1. personal/workflows.md` - Work patterns and preferences
3. `../../../3. Matthew x Opta/1. personal/goals.md` - Current priorities
4. `../../../3. Matthew x Opta/1. personal/profile.md` - Communication style
5. `.planning/PROJECT.md` - Opta vision and requirements
6. `.planning/STATE.md` - Current progress and decisions
7. `.planning/MUST_HAVE.md` - Must-implement features
8. `.claude/agents/opta-optimizer-training.md` - Learned behaviors
9. `.planning/PAUSE_STATE.md` - Check if resuming from pause (if exists)

## After Reading Context

### 1. Check for Resume State
If `.planning/PAUSE_STATE.md` exists:
- Show what was being worked on
- Show files that were modified
- Show the next step that was planned
- Ask: "Resume from where you left off?"

### 2. Display Session Status

```
SESSION START
─────────────────────────────────────────
Phase:     [current phase name] - [X/Y plans]
Progress:  [XX%] ([completed]/[total] plans)
Last:      [last completed plan]
Next:      [next plan to execute]
─────────────────────────────────────────
```

### 3. Check for Issues

- **Blockers**: Any items in STATE.md Blockers/Concerns section
- **Deferred Issues**: Any items that need attention
- **Pending Todos**: Any incomplete todos from last session

If any exist, show them:
```
ATTENTION NEEDED
─────────────────────────────────────────
[List blockers/issues/todos]
─────────────────────────────────────────
```

### 4. Suggest Next Action

Based on context, suggest the most logical next step:
- If in middle of phase: "Ready to execute [next PLAN.md]?"
- If phase complete: "Phase X complete. Ready to start Phase Y?"
- If blockers exist: "Address [blocker] before continuing?"

## Response Format

```
SESSION START
─────────────────────────────────────────
Phase:     8.1 (Adaptive Intelligence) - 1/4 plans
Progress:  68% (27/40 plans)
Last:      08.1-01-PLAN.md (Profile Storage)
Next:      08.1-02-PLAN.md (Pattern Learning)
─────────────────────────────────────────

Context loaded:
- Hardware: MacBook Pro M4 Max (daily driver)
- Goals: Ship Opta MVP, Mac Studio setup
- Project: Phase 8.1 in progress

No blockers or pending issues.

Ready to execute 08.1-02-PLAN.md (Pattern Learning)?
```

## Opta Mode Activation

After session start, operate in full Opta mode:
- Deep research, never surface-level
- Creative and adaptive thinking
- Proactive variable discovery
- Thorough analysis + concise summaries

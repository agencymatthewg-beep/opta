# /phase-done - Complete Phase

Mark the current plan/phase as complete and update all tracking documents.

## Process

### 1. Verify Completion

Check that all tasks in the current PLAN.md are done:
- Read the active PLAN.md file
- Verify each task has been completed
- Check that verification steps pass

If incomplete:
```
INCOMPLETE TASKS
═══════════════════════════════════════════════════════════════
The following tasks are not yet complete:

- [ ] Task 3: Implement pattern storage
- [ ] Task 4: Add persistence layer

Complete these before running /phase-done
═══════════════════════════════════════════════════════════════
```

### 2. Generate SUMMARY.md

Create the summary file at `.planning/phases/[phase]/[plan]-SUMMARY.md`:

```markdown
---
phase: [phase-name]
plan: [plan-number]
type: summary
---

# [Plan Title] - Summary

## Performance
- Duration: [X] min
- Started: [timestamp]
- Completed: [timestamp]

## Accomplishments

### Tasks Completed
1. [Task 1 description]
2. [Task 2 description]
...

### Files Modified
- `path/to/file1.ts` - [what changed]
- `path/to/file2.tsx` - [what changed]

### Commits
- `abc1234` - feat: [message]
- `def5678` - fix: [message]

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| [choice] | [why] |

## Next Steps
- Ready for [next plan]
```

### 3. Update STATE.md

Edit `.planning/STATE.md`:
- Update "Current Position" (increment plan number)
- Update "Progress" percentage
- Update "Last activity" timestamp
- Add any new decisions to "Accumulated Context > Decisions"
- Update velocity metrics

### 4. Check Phase Completion

If this was the last plan in the phase:
```
PHASE COMPLETE
═══════════════════════════════════════════════════════════════
Phase 8.1 (Adaptive Intelligence) is now complete!

All 4 plans finished:
- 08.1-01: Profile Storage
- 08.1-02: Pattern Learning
- 08.1-03: Preference Inference
- 08.1-04: Feedback Loop

Ready to start Phase 9 (Optimization Score)?
═══════════════════════════════════════════════════════════════
```

### 5. Capture Training Data

Prompt for learnings:
```
TRAINING CAPTURE
═══════════════════════════════════════════════════════════════
Any patterns that worked well during this plan?
Any corrections or anti-patterns to avoid?

(Type to log, or "skip" to continue)
═══════════════════════════════════════════════════════════════
```

If provided, append to `.claude/agents/opta-optimizer-training.md`.

### 6. Confirm

```
PLAN COMPLETED
═══════════════════════════════════════════════════════════════
Plan:     08.1-02-PLAN.md
Duration: 12 min
Summary:  .planning/phases/08.1-adaptive-intelligence/08.1-02-SUMMARY.md
Progress: 70% (28/40 plans)
Next:     08.1-03-PLAN.md (Preference Inference)
═══════════════════════════════════════════════════════════════
```

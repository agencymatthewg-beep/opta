# /gsd:consider-issues - Review and Triage Deferred Issues

Review all deferred issues from STATE.md and decide next steps.

## Process

### 1. Load Current Issues

Read `.planning/STATE.md` and find the "Deferred Issues" section. Display:

```
DEFERRED ISSUES TRIAGE
═══════════════════════════════════════════════════════════════
Found [N] deferred issues to review.
═══════════════════════════════════════════════════════════════
```

### 2. For Each Issue

Present issues one by one:

```
ISSUE [N] of [Total]
───────────────────────────────────────────────────────────────
Description: [Issue description]
Severity:    [High/Medium/Low]
Location:    [Location]
Added:       [Date]
Age:         [Days old]
───────────────────────────────────────────────────────────────

What would you like to do?
  1. Fix now (start working on it)
  2. Escalate (increase severity)
  3. Downgrade (decrease severity)
  4. Defer (keep for later)
  5. Close (no longer relevant)
  6. Skip (review later)

> [user input]
```

### 3. Actions

| Choice | Action |
|--------|--------|
| Fix now | Create TODO, switch to fixing, remove from deferred |
| Escalate | Increase severity in STATE.md |
| Downgrade | Decrease severity in STATE.md |
| Defer | Keep in STATE.md, update review date |
| Close | Remove from STATE.md, add to changelog if significant |
| Skip | Move to next issue |

### 4. Summary

After reviewing all issues:

```
TRIAGE COMPLETE
═══════════════════════════════════════════════════════════════
Issues reviewed: [N]
  - Fixed now:  [N]
  - Escalated:  [N]
  - Downgraded: [N]
  - Deferred:   [N]
  - Closed:     [N]
  - Skipped:    [N]

Remaining deferred: [N] issues
Next triage recommended: [Date based on oldest high severity]
═══════════════════════════════════════════════════════════════
```

## Quick Mode

Review only high-severity issues:
```
/gsd:consider-issues high
```

Review issues older than N days:
```
/gsd:consider-issues --older-than 7
```

## Triage Guidelines

| Severity | Max Age | Action if Exceeded |
|----------|---------|-------------------|
| High | 3 days | Must fix or escalate to blocking |
| Medium | 14 days | Consider fixing or downgrading |
| Low | 30 days | Consider closing if still not fixed |

## Related Commands

- `/bug` - Add new issue to triage list
- `/status` - See issue count overview
- `/gsd:plan-phase` - Plan phase work

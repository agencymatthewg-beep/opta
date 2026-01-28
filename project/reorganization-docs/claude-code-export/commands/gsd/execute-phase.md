# /gsd:execute-phase - Execute a Planned Phase

Start working through the tasks of a planned phase systematically.

## Arguments

- `$ARGUMENTS` - Phase number to execute (e.g., "41.2", "51")

## Process

### 1. Pre-Flight Checks

```
PHASE EXECUTION
═══════════════════════════════════════════════════════════════
Phase:      [Phase Number]: [Phase Title]
Goal:       [Goal from ROADMAP]
Depends on: [Dependencies]
═══════════════════════════════════════════════════════════════

Pre-flight checks:
  [✓] Phase is planned (has task breakdown)
  [✓] Dependencies completed
  [✓] Foundation analysis validated
  [?] Build passing

Checking build status...
```

### 2. Foundation Validation

**CRITICAL**: Phase execution is BLOCKED until foundation analysis passes.

```bash
npm run validate:foundation -- [phase-number]
```

If foundation not validated:
```
BLOCKED - Foundation Analysis Required
───────────────────────────────────────────────────────────────
Phase [N] cannot begin execution without foundation analysis.

Run: npm run validate:foundation -- [N]

Or create foundation at:
.planning/foundations/phase-[N]/FOUNDATION_CHECKLIST.md

See: .planning/FOUNDATION_ANALYSIS.md for template
───────────────────────────────────────────────────────────────
```

### 3. Load Tasks

Read the phase tasks from `.planning/ROADMAP.md`:

```
TASKS FOR PHASE [N]
───────────────────────────────────────────────────────────────
[ ] [N]-01: [Task description]
[ ] [N]-02: [Task description]
[ ] [N]-03: [Task description]
───────────────────────────────────────────────────────────────
Total: [X] tasks
Progress: 0%
───────────────────────────────────────────────────────────────
```

### 4. Execute Tasks

For each task, use the TodoWrite tool to track and execute:

```
STARTING TASK [N]-[XX]
───────────────────────────────────────────────────────────────
Task: [Description]

Beginning implementation...
```

After completing each task:
- Update ROADMAP.md to mark task complete `[x]`
- Update STATE.md with progress
- Run build to verify no regressions

### 5. Progress Tracking

Show progress after each task:

```
PROGRESS UPDATE
───────────────────────────────────────────────────────────────
Phase [N] Progress: [X]/[Total] tasks ([%]%)

Completed:
  [x] [N]-01: [Description]
  [x] [N]-02: [Description]

Remaining:
  [ ] [N]-03: [Description]
───────────────────────────────────────────────────────────────
```

### 6. Phase Completion

When all tasks complete:

```
PHASE COMPLETE
═══════════════════════════════════════════════════════════════
Phase [N]: [Title] is complete!

Summary:
  - Tasks completed: [X]
  - Build status: Passing
  - Tests: [Pass/Fail]

Next steps:
  1. Run /phase-done to officially close the phase
  2. Or continue to Phase [N+1]
═══════════════════════════════════════════════════════════════
```

## Interruption Handling

If execution is interrupted:
- Progress is saved in STATE.md
- Resume with `/gsd:execute-phase [N]` to continue
- Completed tasks remain marked

## Quick Options

Start from a specific task:
```
/gsd:execute-phase 41.2 --from 03
```

Skip foundation check (not recommended):
```
/gsd:execute-phase 41.2 --skip-foundation
```

## Related Commands

- `/gsd:plan-phase` - Plan phase tasks first
- `/gsd:consider-issues` - Handle issues that arise
- `/phase-done` - Officially complete phase
- `/status` - Check overall progress

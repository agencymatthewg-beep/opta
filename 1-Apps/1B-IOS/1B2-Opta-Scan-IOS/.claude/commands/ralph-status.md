# /ralph-status - Check Ralph Loop Status

View current Ralph state and progress.

## Usage

```
/ralph-status
```

## Process

### 1. Read State Files

Check:
- `.agent/scratchpad.md` - Task list
- `.agent/events.jsonl` - Event history

### 2. Display Status

```
RALPH STATUS
═══════════════════════════════════════════════════════════════
State: [active/idle/blocked]

Tasks:
  Completed:  3
  Pending:    2
  Blocked:    0

Progress: ████████████░░░░░░░░ 60%

Current task: [task name or "None"]

Recent events:
  [timestamp] build.done - Task 3 completed
  [timestamp] review.approved - Changes accepted
  [timestamp] build.task - Started Task 3

═══════════════════════════════════════════════════════════════
```

### 3. If Blocked

Show blocker details:
```
BLOCKED: [blocker description]

Last attempted: [what was tried]
Suggestion: [how to unblock]

Fix the issue and run /ralph-resume to continue.
```

## Notes

- Quick check without starting a loop
- Shows recent event history
- Identifies blockers if any

# /ralph-resume - Resume Interrupted Ralph Loop

Resume a previously interrupted Ralph loop from existing state.

## Usage

```
/ralph-resume
```

## Process

### 1. Check for Existing State

Look for `.agent/scratchpad.md` and `.agent/events.jsonl`:
- If no scratchpad exists: "No previous loop found. Use /ralph to start."
- If scratchpad exists: Continue

### 2. Show Current State

```
RESUMING RALPH LOOP
═══════════════════════════════════════════════════════════════
Previous state found:

Completed tasks:
- [x] Task 1
- [x] Task 2

Remaining tasks:
- [ ] Task 3
- [ ] Task 4

Last event: [event type] at [timestamp]
═══════════════════════════════════════════════════════════════

Resume? (y/n)
```

### 3. Resume Loop

If user confirms:
```bash
/Users/matthewbyrden/ralph-orchestrator/target/release/ralph resume -i
```

### 4. Report Completion

Same as `/ralph` completion report.

## Notes

- Ralph preserves state in `.agent/` directory
- Events are logged to `.agent/events.jsonl`
- Use `/ralph-clean` to clear state and start fresh

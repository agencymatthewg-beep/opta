# /ralph-clean - Clean Ralph State

Clear all Ralph state to start fresh.

## Usage

```
/ralph-clean
```

## Process

### 1. Show Current State

```
RALPH CLEANUP
═══════════════════════════════════════════════════════════════
Files to remove:

.agent/
├── scratchpad.md (3 tasks, 1 completed)
├── events.jsonl (47 events)
└── checkpoints/ (2 checkpoints)

This will permanently delete all Ralph state.
═══════════════════════════════════════════════════════════════

Proceed? (y/n)
```

### 2. If Confirmed

Run cleanup:
```bash
/Users/matthewbyrden/ralph-orchestrator/target/release/ralph clean
```

### 3. Recreate Base Files

Recreate empty scratchpad:
```markdown
# Agent Scratchpad

## Current Tasks

## Notes

## Blocked Items
```

### 4. Confirm

```
CLEANUP COMPLETE
═══════════════════════════════════════════════════════════════
Ralph state cleared. Ready for new loop.

Run /ralph [task] to start fresh.
```

## Notes

- Use when you want to abandon current work
- Completed commits are NOT affected (only tracking state)
- Use with caution - no undo

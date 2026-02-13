# /ralph-task - Add Task to Ralph Scratchpad

Add tasks to the Ralph scratchpad without starting a loop.

## Usage

```
/ralph-task [task description]
```

**Examples:**
- `/ralph-task Add haptic feedback to buttons`
- `/ralph-task Refactor useSwipeNavigation hook`
- `/ralph-task Write tests for TelemetryCard`

## Process

### 1. Parse Task

Extract task from user input. If no task provided, ask:
```
What task should I add to the Ralph scratchpad?
```

### 2. Read Current Scratchpad

Read `.agent/scratchpad.md` to see existing tasks.

### 3. Add Task

Append the new task under `## Current Tasks`:
```markdown
- [ ] [New task description]
```

### 4. Confirm

```
TASK ADDED
═══════════════════════════════════════════════════════════════
New:      [task description]
Position: #[number] in queue
═══════════════════════════════════════════════════════════════

Current scratchpad:
- [ ] Task 1
- [ ] Task 2  ← NEW
- [x] Completed task

Run /ralph to start processing tasks.
```

## Bulk Add

Multiple tasks can be added at once:
```
/ralph-task
- Add dark mode
- Fix memory leak
- Update documentation
```

Each line becomes a separate task.

## Notes

- Tasks are processed in order (top = highest priority)
- Reorder manually in `.agent/scratchpad.md` if needed
- Use `/ralph` to start processing

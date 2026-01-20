# /qcon - Quick Continue

Recall the last saved context from `/qrem` and continue working.

## Execution

1. **Read quick-memory**: Load `/.claude/quick-memory/LAST.md`
2. **Present context**: Show what was saved
3. **Resume work**: Continue from where we left off

## Storage Location

```
.claude/quick-memory/LAST.md
```

## Process

When the user runs `/qcon`:

1. Read the LAST.md file from quick-memory
2. If file exists:
   - Display the saved context
   - Ask "Continue from here?" or just proceed if clear
3. If file doesn't exist or is empty:
   - Inform user: "No quick memory saved. Use /qrem first."

## Response Format

```
**Quick Memory Recalled**
Saved: [timestamp]

[Display the saved context]

---
Continuing from: [resume point]
```

---

**Now execute**: Read the quick-memory file and continue from where we left off.

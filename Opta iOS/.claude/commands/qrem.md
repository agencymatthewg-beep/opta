# /qrem - Quick Remember

Save the current conversation context for instant recall later.

## Execution

1. **Capture the context**: Take the user's last message or the current working context
2. **Save to quick-memory**: Write to `/.claude/quick-memory/LAST.md`
3. **Confirm**: Brief acknowledgment

## Storage Location

```
.claude/quick-memory/LAST.md
```

## Process

When the user runs `/qrem` or `/qrem <specific text>`:

1. If text is provided after `/qrem`, save that exact text
2. If no text provided, save a summary of the current work context:
   - What we're working on
   - Key findings or issues identified
   - Where we left off
   - Any pending actions

3. Write to the storage file with timestamp
4. Respond briefly: "Remembered. Use /qcon to continue."

## Format for LAST.md

```markdown
# Quick Memory
**Saved:** [timestamp]

## Context
[The saved text or context summary]

## Key Points
- [Point 1]
- [Point 2]

## Resume From
[Where to pick up]
```

---

**Now execute**: Look at the current conversation context and save it to quick-memory.

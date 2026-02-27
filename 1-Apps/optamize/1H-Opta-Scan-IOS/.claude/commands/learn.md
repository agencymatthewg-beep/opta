# /learn - Log Training Data

Capture patterns, corrections, or preferences for the Opta agent.

## Purpose

Build training data that will:
1. Improve my behavior in future sessions
2. Inform the Opta app's AI personality when ported
3. Create a record of what works and what doesn't

## Process

### 1. Determine Type

Ask what kind of learning to log:
```
TRAINING TYPE
═══════════════════════════════════════════════════════════════
What would you like to log?

1. Good Pattern   - Something that worked well
2. Correction     - Something to avoid in future
3. Preference     - A rule or preference to follow
═══════════════════════════════════════════════════════════════
```

### 2. Capture Details

**For Good Pattern:**
```
GOOD PATTERN
═══════════════════════════════════════════════════════════════
Context: [What were you trying to do?]
What worked: [Describe the approach]
Why it worked: [What made it effective?]
═══════════════════════════════════════════════════════════════
```

**For Correction:**
```
CORRECTION
═══════════════════════════════════════════════════════════════
Context: [What were you trying to do?]
What went wrong: [Describe the issue]
Better approach: [What should happen instead?]
═══════════════════════════════════════════════════════════════
```

**For Preference:**
```
PREFERENCE
═══════════════════════════════════════════════════════════════
Category: [Communication / Output / Decision Making / Other]
Rule: [The preference to follow]
Rationale: [Why this matters]
═══════════════════════════════════════════════════════════════
```

### 3. Append to Training File

Edit `.claude/agents/opta-optimizer-training.md`:

**Good Pattern format:**
```markdown
### Good Example: [Date]
**Context**: [context]
**Why It Worked**: [explanation]
**Pattern to Replicate**: [extractable rule]
```

**Correction format:**
```markdown
### Correction: [Date]
**Context**: [context]
**Agent Response**: [what went wrong]
**Preferred Response**: [what should happen]
**Learning**: [rule to extract]
```

**Preference format:**
```markdown
#### [Category]
- [Rule] — [Rationale]
```

### 4. Confirm

```
LOGGED
═══════════════════════════════════════════════════════════════
Type:     [Good Pattern / Correction / Preference]
Added to: .claude/agents/opta-optimizer-training.md
═══════════════════════════════════════════════════════════════

This will improve future interactions and inform the Opta app AI.
```

## Quick Mode

If context is clear from conversation, skip prompts and log directly:
```
/learn This approach of breaking down the task first worked really well
```

Automatically categorizes and logs without interactive prompts.

# /gsd:plan-phase - Break Down a Phase into Tasks

Analyze a roadmap phase and create an actionable task breakdown.

## Arguments

- `$ARGUMENTS` - Phase number to plan (e.g., "41.2", "51")

## Process

### 1. Load Phase Information

Read `.planning/ROADMAP.md` and find the specified phase. Display:

```
PHASE PLANNING
═══════════════════════════════════════════════════════════════
Phase:      [Phase Number]: [Phase Title]
Goal:       [Goal from ROADMAP]
Depends on: [Dependencies]
Research:   [Yes/No - Research required?]
═══════════════════════════════════════════════════════════════
```

### 2. Research Check

If the phase requires research:

```
RESEARCH REQUIRED
───────────────────────────────────────────────────────────────
This phase requires research before planning.
Topics to investigate:
  - [Research topic 1]
  - [Research topic 2]

Would you like to:
  1. Do research first (recommended)
  2. Plan with assumptions (may need revision)

> [user input]
```

### 3. Analyze Requirements

For each phase, consider:
- **Frontend changes** - UI components, styling, animations
- **Backend changes** - Rust commands, data structures
- **Integration** - How it connects to existing features
- **Testing** - What needs verification
- **Documentation** - What needs updating

### 4. Generate Task Breakdown

Create specific, actionable tasks:

```
TASK BREAKDOWN
───────────────────────────────────────────────────────────────
Phase [N]: [Title]
───────────────────────────────────────────────────────────────

## Foundation (Do First)
- [ ] [N]-01: [Task description]
- [ ] [N]-02: [Task description]

## Core Implementation
- [ ] [N]-03: [Task description]
- [ ] [N]-04: [Task description]

## Integration
- [ ] [N]-05: [Task description]

## Polish & Testing
- [ ] [N]-06: [Task description]
- [ ] [N]-07: [Task description]

───────────────────────────────────────────────────────────────
Total tasks: [N]
Estimated complexity: [Low/Medium/High]
───────────────────────────────────────────────────────────────
```

### 5. Update ROADMAP.md

Replace the TBD placeholder with the actual tasks:

```markdown
Plans:
- [ ] [N]-01: [Task description]
- [ ] [N]-02: [Task description]
...
```

### 6. Confirm

```
PHASE PLANNED
═══════════════════════════════════════════════════════════════
Phase [N] now has [X] actionable tasks.
Updated: .planning/ROADMAP.md

Ready to start? Run /optamize to begin implementation.
═══════════════════════════════════════════════════════════════
```

## Task Naming Convention

Tasks follow the pattern: `[Phase]-[Sequence]: [Description]`

Examples:
- `41.2-01: Create base shader structure`
- `41.2-02: Implement simplex noise function`
- `51-03: Add puzzle board component`

## Planning Guidelines

| Phase Type | Typical Tasks |
|------------|---------------|
| UI Feature | Component, styling, animation, integration, tests |
| Backend Feature | Types, commands, state, frontend integration, tests |
| Research | Spike, prototype, document findings, plan next steps |
| Refactor | Identify scope, incremental changes, verify behavior |

## Related Commands

- `/optamize` - Execute planned tasks
- `/gsd:consider-issues` - Handle deferred issues
- `/status` - Check current progress
- `/phase-done` - Complete a phase

# /ralph - Run Ralph Agent Loop

Start an autonomous Ralph loop for feature development.

## Usage

```
/ralph [prompt]
```

**Examples:**
- `/ralph Add dark mode toggle to settings`
- `/ralph Fix memory leak in process monitor`
- `/ralph Implement keyboard shortcuts`

## Process

### 1. Parse the Prompt

Extract the task from user input. If no prompt provided, ask:
```
What would you like Ralph to build?
```

### 2. Prepare the Scratchpad

Add the task to `.agent/scratchpad.md`:
```markdown
## Current Tasks

- [ ] [User's task description]
```

### 3. Execute Ralph Loop

Run the Ralph orchestrator:
```bash
/Users/matthewbyrden/ralph-orchestrator/target/release/ralph run --prompt "[task]" -i
```

Use `-i` for interactive TUI mode so user can monitor progress.

### 4. Report Completion

When Ralph finishes, summarize:
```
RALPH LOOP COMPLETE
═══════════════════════════════════════════════════════════════
Task:        [original task]
Iterations:  [count]
Status:      [completed/blocked]
═══════════════════════════════════════════════════════════════

Changes made:
- [file1]: [description]
- [file2]: [description]

Run /build to validate, then /commit to save.
```

## Flags

| Flag | Effect |
|------|--------|
| `--autonomous` or `-a` | Run headless without TUI |
| `--dry-run` | Show config without executing |
| `--verbose` or `-v` | Show detailed output |

## Hats Available

- **Builder**: Implements one task, runs backpressure, commits
- **Reviewer**: Reviews code quality (doesn't modify)

## Notes

- Ralph will pick tasks from `.agent/scratchpad.md`
- Each task = one commit
- Backpressure (tests/lint) must pass before commit
- Use `/ralph-task` to add tasks without running
- Use `/ralph-resume` to continue interrupted loops

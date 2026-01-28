# /ralph-plan - Start Ralph Planning Session

Start a Prompt-Driven Development planning session with Ralph.

## Usage

```
/ralph-plan [feature description]
```

**Examples:**
- `/ralph-plan User authentication system`
- `/ralph-plan Real-time process monitoring dashboard`
- `/ralph-plan Cross-platform notification system`

## Process

### 1. Parse Feature

Extract feature description. If not provided, ask:
```
What feature would you like to plan?
```

### 2. Start Planning Session

```bash
/Users/matthewbyrden/ralph-orchestrator/target/release/ralph plan --prompt "[feature]"
```

### 3. Planning Output

Ralph will generate:
- Feature breakdown into tasks
- Technical approach
- File structure
- Dependencies

### 4. Review Plan

```
PLANNING SESSION COMPLETE
═══════════════════════════════════════════════════════════════
Feature:  [feature name]

Tasks generated:
1. [ ] [Task 1]
2. [ ] [Task 2]
3. [ ] [Task 3]
...

Saved to: specs/[feature-name].md
═══════════════════════════════════════════════════════════════

Add these tasks to scratchpad and start building? (y/n)
```

### 5. If Approved

- Copy tasks to `.agent/scratchpad.md`
- Offer to run `/ralph` immediately

## Notes

- Plans are saved to `specs/` directory
- Review and adjust before executing
- Use `/ralph` to execute the planned tasks

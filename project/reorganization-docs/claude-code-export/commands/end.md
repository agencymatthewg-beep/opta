# /end - Session Closer

End the current development session with proper documentation and cleanup.

## Process

### 1. Summarize Work Completed

Review the conversation and list:
- Plans executed (with commit hashes if available)
- Files created or modified
- Features implemented or bugs fixed
- Decisions made

```
SESSION SUMMARY
─────────────────────────────────────────
Duration:    [estimated time]
Completed:   [list of completed work]
Files:       [key files modified]
Commits:     [number of commits made]
─────────────────────────────────────────
```

### 2. Capture Learnings

Prompt for training data:
```
TRAINING CAPTURE
─────────────────────────────────────────
Any patterns that worked well this session?
Any corrections or things to avoid?
Any new preferences discovered?

(Type your learnings or "skip" to continue)
─────────────────────────────────────────
```

If learnings provided, append to `.claude/agents/opta-optimizer-training.md` under the appropriate section.

### 3. Update STATE.md

Use the Edit tool to update `.planning/STATE.md`:
- Update "Current Position" if plans completed
- Update "Last activity" timestamp
- Add any new decisions to "Accumulated Context > Decisions"
- Update velocity metrics if a plan was completed

### 4. Log to Session History

Append to `.planning/SESSION_LOG.md`:
```markdown
## [Date] Session [N]
- Duration: [X hours]
- Completed: [work done]
- Learnings: [any logged]
- Next: [suggested next action]
```

### 5. Check for Uncommitted Work

Run `git status` to check for uncommitted changes.

If uncommitted changes exist:
```
UNCOMMITTED CHANGES
─────────────────────────────────────────
[list of changed files]

Commit these changes before ending? (y/n)
─────────────────────────────────────────
```

If yes, trigger `/commit` workflow.

### 6. Suggest Next Session

```
NEXT SESSION
─────────────────────────────────────────
Suggested: [next action based on roadmap]
Progress:  [updated %]
─────────────────────────────────────────

Session closed. Run /start to begin next session.
```

## Clean Up

If `.planning/PAUSE_STATE.md` exists, delete it (session properly closed, not paused).

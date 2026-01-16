# /help - Command Reference

Display all available custom commands.

## Output

```
OPTA COMMANDS
═══════════════════════════════════════════════════════════════

SESSION
───────────────────────────────────────────────────────────────
/start         Open session - load context, show status, suggest next action
/end           Close session - summarize work, capture learnings, update state
/pause         Pause mid-session - save context for later resume
/opta          Activate Opta mode (deep research, creative thinking)

CONTEXT
───────────────────────────────────────────────────────────────
/status        Quick status - phase, progress, next action
/decisions     List recent architectural decisions
/design        Design system quick reference (glass, Framer, Lucide)

CAPTURE
───────────────────────────────────────────────────────────────
/100           Capture must-have feature idea to MUST_HAVE.md
/learn         Log pattern/correction to training data
/bug           Capture bug/issue to deferred issues

WORKFLOW
───────────────────────────────────────────────────────────────
/build         Run build + type check + cargo check
/commit        Guided commit with conventional format
/phase-done    Complete phase - create SUMMARY, update STATE

═══════════════════════════════════════════════════════════════
Tip: Run /start at the beginning of each session for full context
```

## Notes

- Commands are defined in `.claude/commands/`
- Full command index in `.claude/COMMANDS.md`
- Add new commands by creating `.claude/commands/[name].md`

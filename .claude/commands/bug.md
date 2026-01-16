# /bug - Quick Bug Capture

Quickly log a bug or issue for later triage.

## Process

### 1. Capture Bug Details

```
BUG REPORT
═══════════════════════════════════════════════════════════════
Describe the bug:
> [user input]

Severity? (1=low, 2=medium, 3=high)
> [user input]

Where does it occur? (file/component/feature)
> [user input or auto-detected]
═══════════════════════════════════════════════════════════════
```

### 2. Add to STATE.md

Edit `.planning/STATE.md` under "Deferred Issues":

```markdown
### Deferred Issues

| Issue | Severity | Location | Added |
|-------|----------|----------|-------|
| [Description] | [High/Med/Low] | [Location] | 2026-01-16 |
```

### 3. Confirm

```
BUG LOGGED
═══════════════════════════════════════════════════════════════
Issue:    [Description]
Severity: [High/Medium/Low]
Location: [Location]
Added to: .planning/STATE.md > Deferred Issues
═══════════════════════════════════════════════════════════════

Use gsd:consider-issues to review and triage later.
```

## Quick Mode

For fast capture from conversation:
```
/bug The glass effect flickers on Safari - medium severity
```

Auto-parses:
- Description: "The glass effect flickers on Safari"
- Severity: Medium
- Location: (auto-detect or "Unknown")

## Severity Guide

| Level | Description | Action |
|-------|-------------|--------|
| High | Blocks usage, data loss risk | Address before next release |
| Medium | Affects experience, has workaround | Address soon |
| Low | Minor issue, cosmetic | Address when convenient |

## Related Commands

- `gsd:consider-issues` - Review and triage deferred issues
- `/status` - See issue count in status
- `/start` - Issues shown in session opener

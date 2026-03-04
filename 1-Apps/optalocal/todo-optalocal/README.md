# todo-optalocal — Cross-Agent Coordination Hub

This directory is the **single source of truth for cross-app work items** across the Opta Local ecosystem. Any AI agent working inside one app that identifies changes needed in other apps drops a document here instead of attempting the changes itself.

---

## How It Works

1. **Agent A** is working inside `1D-Opta-CLI-TS` and adds a new protocol event.
2. Agent A knows `1P-Opta-Code-Universal` and `1L-Opta-LMX-Dashboard` need matching updates.
3. Instead of context-switching into those apps, Agent A creates **one document per target app** in this folder.
4. **Agent B**, already active inside the target app, picks up the document and implements it with full local context.

This prevents agents from making blind, context-poor edits in unfamiliar codebases and lets the agent that *owns* the target app handle the work properly.

---

## File Naming Convention

```
{TargetApp}-{BriefReason}-{Timestamp}.md
```

| Segment | Format | Example |
|---------|--------|---------|
| **TargetApp** | App directory name or short identifier | `1P-Opta-Code-Universal`, `1T-Opta-Home`, `1M-Opta-LMX` |
| **BriefReason** | Kebab-case summary (≤5 words) | `add-audio-protocol-events`, `update-nav-links`, `sync-api-types` |
| **Timestamp** | `YYYYMMDD-HHmm` (local time) | `20260304-1814` |

**Full example:**

```
1P-Opta-Code-Universal-add-audio-protocol-events-20260304-1814.md
```

---

## Document Template

```markdown
# {What needs to happen}

**Source App:** {App that triggered this}
**Target App:** {App that needs the update}
**Priority:** {critical | high | normal | low}
**Created:** {ISO timestamp}
**Status:** pending

## Context

Why this change is needed. Reference the source commit, PR, or conversation if available.

## Required Changes

Specific, actionable list of what the target app agent should implement:

- [ ] Change 1
- [ ] Change 2

## References

- Source file: `path/to/file-that-changed`
- Related docs: links or paths
- Conversation ID: (if applicable)

## Completion

When done, the implementing agent updates:
- **Status:** `done`
- **Implemented by:** {agent identifier or commit hash}
- **Date completed:** {ISO timestamp}
```

---

## Use Cases

### 1. Ripple-Effect Updates (Primary)

Agent in `1D-CLI` adds a new daemon operation → drops a todo for `1P-Desktop` to add the UI, and another for `1L-Dashboard` to add the panel.

### 2. Feature Coordination

Multiple agents working in parallel on a feature that spans apps. Each agent documents what the others need to do, avoiding race conditions and duplicate work.

### 3. Design System Propagation

A design token or component pattern changes in one app → todos are created for every app that needs to adopt it.

### 4. API Contract Changes

LMX adds a new endpoint → todos for CLI daemon proxy, Desktop client, and Dashboard to consume it.

### 5. Dependency & Config Sync

Shared dependency version bumps, environment variable additions, or deployment config changes that affect multiple apps.

---

## Agent Directives

- **Always check this folder** at the start of a session in any Opta app. If there's a pending todo targeting your app, implement it.
- **Never delete** completed documents — mark them `done` so there's an audit trail.
- **One document per target app** — if a change affects 3 apps, create 3 separate documents.
- **Be specific** — the implementing agent may not have your context. Include file paths, type signatures, and expected behavior.
- **Mark priority honestly** — `critical` means the target app is broken without this change.

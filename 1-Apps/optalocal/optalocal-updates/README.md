# Opta Local Unified Update Log System

This directory (`/optalocal-updates/`) serves as the chronological, immutable record for all **live production updates** across the Opta Local ecosystem.

## Scope

An entry is required here anytime changes are pushed to:

1. **LIVE websites** (e.g., `init.optalocal.com`, `lmx.optalocal.com`, `accounts.optalocal.com`, `optalocal.com`, `help.optalocal.com`, `learn.optalocal.com`).
2. **Core Local Apps** when pushed to stable branches or distributed via the Opta Init setup flow.

*Note: In-progress dev iterations or unreleased prototypes do NOT get a log entry here. These logs map to user-facing shippable reality.*

## File Naming Convention

All files must follow a strict, padded 4-digit numeric sequence to guarantee chronological sorting:
`NNNN-[app-or-service]-[short-update-slug].md`

Examples:

- `0001-opta-daemon-logo-shipped.md`
- `0042-init-setup-wizard-released.md`
- `0105-accounts-google-oauth-fix.md`

## File Format Template

Every log entry must follow this exact Markdown structure:

```markdown
# [Update Title]

**Date:** [YYYY-MM-DDTHH:MM:SSZ (UTC or local with timezone)]
**Target:** [App or Website Name (e.g., Opta Help, Opta LMX)]
**Update Type:** [Feature | Fix | Design | Architecture | Content]
**Commit:** [Short Hash if applicable, or "N/A"]

## Summary

A 2-3 sentence overview of what the update achieved and why it was made from a product/user perspective.

## Detailed Changes

- **[Component/System]:** Specific technical detail of the change.
- **[Component/System]:** Specific technical detail of the change.

## Rollout Impact

Note any required cache-clearing, user migrations, downtime, or cross-app ripple effects (e.g., "Requires users to re-run `opta init`"). If none, explicitly state "Seamless / No action required".
```

## Agent Directives

Whenever an autonomous agent completes a task that falls under the [Scope](#scope) defined above, it MUST:

1. Check the highest `NNNN` number in this directory.
2. Create the next `NNNN+1` file using the template.
3. Commit the log file alongside or immediately after the deployment commit.

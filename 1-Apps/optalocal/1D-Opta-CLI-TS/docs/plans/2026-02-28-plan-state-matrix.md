---
status: active
owner: cli-maintainers
scope: 1D-Opta-CLI-TS plan files only
canonical_source: frontmatter status
---

# Opta CLI Plan State Matrix (Canonical)

Single source summary for plan-state reconciliation in `1D-Opta-CLI-TS`.

## Summary

- Total scoped plan files: 40
- ACTIVE: 7
- REVIEW: 0
- COMPLETED: 5
- ARCHIVED: 28
- Frontmatter vs registry mismatches: 0
- Frontmatter vs queue mismatches: 0
- Stale ACTIVE/REVIEW entries: 0

## Reconciliation Rules

- `status` frontmatter is canonical.
- `ACTIVE` or `REVIEW` must have at least one open checkbox.
- `COMPLETED` has no open checkboxes and at least one done checkbox.
- `ARCHIVED` has no open checkboxes and no pending work.

## ACTIVE (7)

| Plan | Open | Done |
|---|---:|---:|
| .planning/phases/01-tui-markdown/01-01-PLAN.md | 8 | 0 |
| docs/FEATURE-PLAN.md | 13 | 2 |
| docs/plans/2026-02-15-v2-features-design.md | 5 | 22 |
| docs/plans/2026-02-23-codex-desktop-parity-spec.md | 8 | 8 |
| docs/plans/2026-02-28-opta-code-capability-stability-windows-master-plan.md | 5 | 1 |
| docs/ROADMAP.md | 3 | 0 |
| OPTIMIZATION-PLAN.md | 22 | 0 |

## REVIEW (0)

- _None_

## COMPLETED (5)

| Plan | Open | Done |
|---|---:|---:|
| .planning/ROADMAP.md | 0 | 20 |
| docs/plans/archive/2026-02-16-v2-phase2-git-integration.md | 0 | 6 |
| docs/plans/archive/2026-02-26-accounts-lmx-integration-plan.md | 0 | 10 |
| docs/plans/archive/2026-02-26-opta-v1-implementation-plan.md | 0 | 3 |
| docs/plans/archive/2026-02-26-tui-quality-improvement-plan.md | 0 | 9 |

## ARCHIVED (28)

| Plan | Open | Done |
|---|---:|---:|
| .planning/phases/02-tui-input/02-01-PLAN.md | 0 | 0 |
| docs/plans/archive/2026-02-12-opta-cli-v1-design.md | 0 | 0 |
| docs/plans/archive/2026-02-16-v2-features-implementation.md | 0 | 0 |
| docs/plans/archive/2026-02-16-v2-phase1-opis-exports.md | 0 | 0 |
| docs/plans/archive/2026-02-16-v2-phase3-mcp-integration.md | 0 | 0 |
| docs/plans/archive/2026-02-16-v3-background-shell.md | 0 | 0 |
| docs/plans/archive/2026-02-16-v3-hooks.md | 0 | 0 |
| docs/plans/archive/2026-02-16-v3-lsp.md | 0 | 0 |
| docs/plans/archive/2026-02-16-v3-master-execution.md | 0 | 0 |
| docs/plans/archive/2026-02-16-v3-roadmap.md | 0 | 0 |
| docs/plans/archive/2026-02-16-v3-sub-agents.md | 0 | 0 |
| docs/plans/archive/2026-02-17-opencode-ux-parity-master.md | 0 | 0 |
| docs/plans/archive/2026-02-17-optimization-audit.md | 0 | 0 |
| docs/plans/archive/2026-02-17-ux-phase1a-input-editor.md | 0 | 0 |
| docs/plans/archive/2026-02-17-ux-phase1b-rendering.md | 0 | 0 |
| docs/plans/archive/2026-02-17-ux-phase1c-session-workflow.md | 0 | 0 |
| docs/plans/archive/2026-02-17-ux-phase2-ink-migration.md | 0 | 0 |
| docs/plans/archive/2026-02-17-ux-phase3-advanced-tui.md | 0 | 0 |
| docs/plans/archive/2026-02-18-developer-velocity-improvements.md | 0 | 0 |
| docs/plans/archive/2026-02-20-level3-daemon-program-plan.md | 0 | 0 |
| docs/plans/archive/2026-02-22-ai-capability-implementation-report.md | 0 | 0 |
| docs/plans/archive/2026-02-22-ai-capability-research-browser-learning-plan.md | 0 | 0 |
| docs/plans/archive/2026-02-23-mac-studio-model-startup-stability-report.md | 0 | 0 |
| docs/plans/archive/2026-02-23-opta-cli-antigravity-browser-runtime-plan.md | 0 | 0 |
| docs/plans/archive/2026-02-23-yjs-session-update-log-system-plan.md | 0 | 0 |
| docs/plans/archive/2026-02-25-code-review-fixes.md | 0 | 0 |
| docs/plans/archive/2026-02-26-opta-onboarding-settings-overlay.md | 0 | 0 |
| docs/plans/archive/2026-02-28-windows-compatibility.md | 0 | 0 |

# Opta CLI -> Opta Code Parity Matrix

Date: 2026-03-03  
Scope:
- CLI engine: `/Users/matthewbyrden/Synced/Opta/1-Apps/optalocal/1D-Opta-CLI-TS`
- Desktop/web client: `/Users/matthewbyrden/Synced/Opta/1-Apps/optalocal/1P-Opta-Code-Universal`

## Investigation Inputs (Local)

- `npx tsx src/index.ts --help` in `1D-Opta-CLI-TS`
- `npx tsx src/index.ts account --help`
- `npx tsx src/index.ts mcp --help`
- `npx tsx src/index.ts daemon --help`
- `src/protocol/v3/operations.ts` (operation contract)
- `1P` pages/components/hooks (`App.tsx`, `OperationsPage.tsx`, `CliOperationsPage.tsx`, `useModels.ts`, `Composer.tsx`)

## Canonical Architecture Boundary

- `1D-Opta-CLI-TS` owns runtime behavior and command execution.
- `1P-Opta-Code-Universal` is a daemon client/operator surface.
- Command-family parity should be delivered through daemon operations first, then UI.

## Current Coverage Summary

Legend:
- `Dedicated` = purpose-built page/workflow in Opta Code
- `Console` = available via Operations Console / CLI Operations page
- `Adapted` = capability is intentionally represented via a context-optimized Opta Code pathway
- `Partial` = some behavior present, but not full CLI parity

| CLI Feature Family | Opta Code Coverage | Notes |
| --- | --- | --- |
| Session orchestration (`opta`, `chat`, `do`, live timeline, permissions, cancel) | Dedicated | Sessions cockpit (`WorkspaceRail`, `TimelineCards`, `Composer`) with Chat/Do/Plan/Review/Research modes |
| Core model lifecycle (`status`, `models` load/unload/download/delete/list/memory) | Dedicated | `ModelsPage` + daemon LMX endpoints |
| Daemon operation catalog (`/v3/operations`) | Dedicated | `OperationsPage` imports `OPERATION_IDS` from shared protocol and shows parity meter |
| Config operations (`config.get/set/list/reset`) | Dedicated | `ConfigStudioPage` |
| Account auth + cloud keys (`account.*`) | Dedicated | `AccountControlPage` |
| Local keys (`key.create/show/copy`) | Dedicated | `AccountControlPage` local shortcut panel |
| Daemon lifecycle (`daemon.*`) | Dedicated + Console | `DaemonPanel` + operations |
| CLI utility ops (`doctor`, `version.check`, `completions.generate`, `keychain.*`, `serve.*`, `init.run`, `update.run`, `sessions.*`, `diff`, `embed`, `rerank`, `benchmark`, `mcp.*`) | Console | `CliOperationsPage` scoped families |
| Onboarding (`onboard`, `setup`) | Adapted | In-app setup wizard now routes through canonical `onboard.apply` (all providers, key storage mode, marker write) instead of separate config writer |
| HTTP server command (`server`) | Adapted | Legacy server runtime behavior is represented by desktop daemon panel + `serve.*` operations |
| Chat mode flags (`--plan`, `--review`, `--research`) | Dedicated | Composer/runtime submit API supports all CLI intent modes |
| Per-run control flags (`--auto`, `--dangerous`, `--no-commit`, `--no-checkpoints`, `--provider`, `--model`, `--format`) | Dedicated | Composer forwards full turn override contract to daemon runtime with mode/git/provider/model/output adaptation |
| Advanced `opta models` suite (`history`, `aliases`, `predictor`, `helpers`, `quantize`, `agents`, `skills`, `rag`, `health`, `scan`, `browse-*`, `dashboard` parity) | Console + Dedicated | `models.*` operations are daemon-addressable; `ModelsPage` adds dedicated `history`/`health`/`scan` controls and the rest run via operation console |

## Parity Verdict

Opta Code does **not** currently contain all Opta CLI features.

It has strong parity for:
- session runtime workflows,
- core model lifecycle,
- daemon operation families in `OPERATION_IDS`,
- advanced models capability via operation + targeted dedicated UI.

Known intentional / partial differences:
- Onboarding remains a desktop-native flow (form-based), but it now executes the same backend profile application path as CLI (`onboard.apply`).

## Immediate Next Gaps To Close

1. Keep parity artifacts (`docs/parity/*.json`) fresh during release prep and CI.
2. Add dedicated UI affordances for additional high-frequency advanced model actions as usage data warrants.

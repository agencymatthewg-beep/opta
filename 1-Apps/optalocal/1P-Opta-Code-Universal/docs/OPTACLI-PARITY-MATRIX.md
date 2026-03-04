# Opta CLI -> Opta Code Parity Matrix

Date: 2026-03-04  
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
- `1P-Opta-Code-Universal` is a frontend optimization layer over daemon/CLI capabilities.
- Opta CLI is the primary TUI coding interface and is not redundant.
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
| Daemon lifecycle (`daemon.*`) | Dedicated + Console | `SystemOperationsPage` + `DaemonPanel` + CLI bridge |
| CLI utility ops (`doctor`, `version.check`, `completions.generate`, `keychain.*`, `serve.*`, `init.run`, `update.run`) | Dedicated + Console | `SystemOperationsPage` scoped families + CLI bridge |
| App management (`apps.*`) | Dedicated + Console | `AppCatalogPage` + CLI bridge |
| Session memory management (`sessions.*`) | Dedicated + Console | `SessionMemoryPage` + CLI bridge |
| Tooling ops (`diff`, `embed`, `rerank`, `benchmark`, `ceo.benchmark`) | Dedicated + Console | `ToolingOperationsPage` + CLI bridge |
| Full operation-family fallback | Console | `CliOperationsPage` (advanced parity bridge) |
| Onboarding (`onboard`, `setup`) | Dedicated + Console | In-app setup wizard routes through canonical `onboard.apply` and system controls expose the same operation family via daemon API |
| HTTP server command (`server`) | Dedicated + Console | Server lifecycle is represented by `daemon.*` + `serve.*` operations in `SystemOperationsPage` and CLI bridge |
| Chat mode flags (`--plan`, `--review`, `--research`) | Dedicated | Composer/runtime submit API supports all CLI intent modes |
| Per-run control flags (`--auto`, `--dangerous`, `--no-commit`, `--no-checkpoints`, `--provider`, `--model`, `--format`) | Dedicated | Composer forwards full turn override contract to daemon runtime with mode/git/provider/model/output adaptation |
| Advanced `opta models` suite (`history`, `aliases`, `predictor`, `helpers`, `quantize`, `agents`, `skills`, `rag`, `health`, `scan`, `browse-*`, `dashboard` parity) | Console + Dedicated | `models.*` operations are daemon-addressable; `ModelsPage` adds dedicated `history`/`health`/`scan` controls and the rest run via operation console |

## Parity Verdict

Opta Code now has required command-family and daemon-operation parity with Opta CLI.

Current parity status:
- command-family mapping: `29/29` (including `apps`)
- scoped CLI operations coverage: `79/79` (including `ceo.benchmark` and `apps.*`)
- required runtime mode/override coverage: complete

Known intentional adapted behaviors (documented and accepted):
- `tui`

## Ongoing Maintenance

1. Keep parity artifacts (`docs/parity/*.json`) fresh during release prep and CI (always regenerate before check).
2. Track adapted-command acceptance criteria (`tui`) as product behavior evolves.

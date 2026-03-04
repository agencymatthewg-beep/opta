# Opta Code CLI Parity Plan

Date: 2026-03-03

## Objective
Deliver contextual parity so every Opta CLI capability is either:
- a dedicated desktop workflow, or
- a first-class operation in Opta Code's CLI Operations surface, or
- an explicit adapted behavior with documented rationale and acceptance tests.

Architecture contract:
- Opta CLI is the primary TUI coding interface.
- Opta Code is the contextual frontend optimization layer over daemon/CLI capabilities.

## Current Status
- Command-family coverage: validated (`29/29` mapped in parity check).
- Operation coverage in CLI Operations scope: validated (`79/79`, unmatched `0`).
- Per-turn runtime override coverage: validated (`model`, `provider`, `dangerous`, `auto`, `noCommit`, `noCheckpoints`, `format`).
- Onboarding sync: desktop wizard now executes canonical CLI backend onboarding path (`onboard.apply`) including provider/key-storage branches and `.onboarded` marker semantics.
- Contextual feature routing: utility families now have dedicated pages (`SystemOperationsPage`, `AppCatalogPage`, `SessionMemoryPage`, `ToolingOperationsPage`) with CLI bridge fallback.

## Remaining Adapted Behaviors (Not 1:1)
1. `tui`
- Why: terminal rendering and keyboard semantics are intentionally replaced by desktop interaction model.
- Acceptance target: feature-equivalent controls for mode switching, interrupt/cancel, tool permission flow, and event timeline state.

## Execution Backlog
1. Add adapted-parity acceptance tests
- Add a parity test suite that validates expected adapted behavior contracts for `tui`.

2. Expand memory-focused desktop affordances
- Add richer memory controls in session UI (pin/retrieve/retention policies) backed by existing operations.

3. Maintain CI parity gates
- Keep `parity:export` and `parity:check` in release checklist and CI blocking path.
- Fail builds when required mode/override/scope/command coverage regresses.

## Non-Goals
- Pixel-identical TTY emulation in desktop.
- Preserving terminal-specific interaction artifacts where desktop-native UX is superior.

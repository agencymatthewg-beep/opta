# Opta Code CLI Parity Plan

Date: 2026-03-03

## Objective
Deliver contextual parity so every Opta CLI capability is either:
- a dedicated desktop workflow, or
- a first-class operation in Opta Code's CLI Operations surface, or
- an explicit adapted behavior with documented rationale and acceptance tests.

## Current Status
- Command-family coverage: validated (`28/28` mapped in parity check).
- Operation coverage in CLI Operations scope: validated (`75/75`, unmatched `0`).
- Per-turn runtime override coverage: validated (`model`, `provider`, `dangerous`, `auto`, `noCommit`, `noCheckpoints`, `format`).
- Onboarding sync: desktop wizard now executes canonical CLI backend onboarding path (`onboard.apply`) including provider/key-storage branches and `.onboarded` marker semantics.

## Remaining Adapted Behaviors (Not 1:1)
1. `tui`
- Why: terminal rendering and keyboard semantics are intentionally replaced by desktop interaction model.
- Acceptance target: feature-equivalent controls for mode switching, interrupt/cancel, tool permission flow, and event timeline state.

2. `server`
- Why: server lifecycle is represented through daemon + serve operations instead of separate terminal process management UX.
- Acceptance target: explicit server-state diagnostics and lifecycle controls in daemon panel and operations page.

3. `memory`
- Why: capability is represented via sessions persistence/search/export instead of a standalone memory command panel.
- Acceptance target: dedicated memory-oriented entry points for discoverability (search, pin, recall, retention policies).

## Execution Backlog
1. Add adapted-parity acceptance tests
- Add a parity test suite that validates expected adapted behavior contracts for `tui`, `server`, and `memory`.

2. Add memory-focused desktop affordances
- Create explicit memory actions in session UI (pin/retrieve/retention) backed by existing operations.

3. Maintain CI parity gates
- Keep `parity:export` and `parity:check` in release checklist and CI blocking path.
- Fail builds when required mode/override/scope/command coverage regresses.

## Non-Goals
- Pixel-identical TTY emulation in desktop.
- Preserving terminal-specific interaction artifacts where desktop-native UX is superior.

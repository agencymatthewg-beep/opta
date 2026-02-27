# Trigger Modes and Skill Stacking Runbook
Date: 2026-02-25
Owner: Opta Runtime
Status: Active

## Objective
Document:
1. How trigger words and workflow modes currently work.
2. How stacking multiple trigger words in one prompt should behave.
3. Whether to load all skill packs at once or dynamically load/unload by phase.

## Current State (Implemented)
### 1) Input trigger highlighting
- TUI input highlighting is implemented in:
  - `src/tui/input-highlighting.ts`
  - `src/tui/InputBox.tsx`
- Trigger words are now loaded from config (`config.tui.triggerModes`) and passed to InputBox.
- Matching is case-insensitive and whole-word (`\b...\b`), rendered in cyan + bold.

### 2) Trigger router on submit (active behavior)
- Trigger routing is implemented in:
  - `src/tui/trigger-router.ts`
  - `src/tui/App.tsx`
- On submit, Opta resolves stacked trigger words into:
  1. Matched trigger set
  2. Effective workflow mode (precedence: `review > plan > research > normal`)
  3. Requested capabilities and skill packs
- If a stricter mode is requested by triggers, TUI auto-shifts mode for the turn and records it in action history.

### 3) Browser trigger preflight on submit (active behavior)
- Browser trigger preflight is implemented in:
  - `src/browser/trigger-session.ts`
  - `src/tui/App.tsx`
- On prompt submit with a browser trigger word:
  1. Runtime is scanned for an existing open Playwright session.
  2. Preferred prior session is reused when available.
  3. Otherwise the first open session is reused.
  4. If no open session exists, a new visible session is opened (`headless=false`).
- CLI then surfaces status:
  - Action history entry (`Started/Reusing Opta Browser session ...`)
  - System message indicating active browser session
- Outbound prompt is augmented with a deterministic session instruction so model actions continue on the active session.

### 4) Dynamic skill load/unload runtime (active behavior)
- Dynamic skill runtime is implemented in:
  - `src/tui/skill-runtime.ts`
  - `src/tui/App.tsx`
- On each submit, requested skills from triggers are reconciled with runtime policy:
  - load newly requested skills
  - refresh active skills
  - unload inactive skills when configured
  - expire stale skills by TTL
  - evict least-recently-active skills when over capacity
- Runtime policy is configured in:
  - `config.tui.skillRuntime.dynamicLoading`
  - `config.tui.skillRuntime.unloadInactive`
  - `config.tui.skillRuntime.ttlMinutes`
  - `config.tui.skillRuntime.maxActiveSkills`

### 5) Workflow modes (actual behavior controls)
- Workflow mode in TUI is tracked as:
  - `normal | plan | research | review`
  - Defined in `src/tui/App.tsx`.
- Activation paths:
  - Slash commands: `/plan`, `/research`, `/review` (and toggling back off)
  - TUI mode cycle: `Shift+Tab` through workflow modes
- Permission and tool behavior are enforced by:
  - `src/core/tools/permissions.ts` (`MODE_PERMISSIONS`)
  - `src/core/agent-profiles.ts` (`filterToolsForMode`)

### 6) Browser command workflow
- `/browser ...` is a command namespace, not a workflow mode toggle.
- Operational commands include:
  - `status`, `pause`, `resume`, `stop`, `kill`
  - `replay`, `approvals`, `profiles`, `trends`, `canary`
- Implemented in `src/commands/slash/browser.ts`.

## Stacking Trigger Words in One Prompt
### Implemented semantics
When multiple trigger words appear in the same prompt, Opta treats them as a capability request set and resolves:
1. Effective workflow mode (single safety mode at runtime).
2. Active skill pack set (loaded/unloaded via runtime reconciler).
3. Capability flags (e.g., browser) that do not override safety mode.

### Priority and conflict resolution
Use deterministic precedence:
1. `review` (most restrictive, read-only)
2. `plan`
3. `research`
4. `normal`

`browser` should act as a capability flag, not a safety mode override.  
Example: if prompt contains both `review` and `browser`, effective mode should stay `review` and browser write actions remain blocked.

## Should All Skills Be Loaded At Once?
Short answer: **No** (except very small, tightly related stacks).

### Why not all-at-once
- Increases prompt/context size and token cost.
- Adds conflicting instructions and lowers tool-selection precision.
- Reduces determinism for local models with smaller practical context budgets.

### Recommended approach: dynamic load/unload
Use a hybrid runtime strategy:
1. Keep a tiny always-on core prompt (safety, formatting, guardrails).
2. Preload only high-confidence skill packs from explicit triggers.
3. Load additional packs just-in-time when phase/tool intent changes.
4. Unload inactive packs (keep a short summary state) when no longer needed.

## Runtime Design (Implemented Baseline)
### A) Trigger registry
- Declarative trigger mapping lives in `config.tui.triggerModes`.
- Each entry supports:
  - `word`
  - `modeHint` (optional)
  - `priority`
  - `capabilities`
  - `skills`

### B) Intent router + skill runtime
- Submit-time router parses and resolves:
  - matched words
  - effective mode
  - capabilities
  - requested skills
- Skill runtime then performs load/unload/evict/expire decisions using TTL + capacity policy.
- Prompt is annotated with deterministic context:
  - resolved mode
  - matched triggers
  - active capabilities
  - active skills

### C) Safety invariants
- Workflow mode restrictions always win over capability flags.
- Browser or command capabilities cannot bypass `plan`/`review` write blocks.
- Permission engine remains source of truth for execution approval.

## Practical Recommendation for Opta
Use dynamic loading by default, with a small preload window for explicit trigger words in the user prompt.  
This is the best balance of:
- model precision
- context efficiency
- operational determinism
- safety compliance across mixed-mode prompts

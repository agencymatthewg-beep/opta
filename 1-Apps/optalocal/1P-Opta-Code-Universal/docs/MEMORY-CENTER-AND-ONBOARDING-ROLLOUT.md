# Memory Center + Onboarding Deprecation Rollout

Date: 2026-03-03
Owners: Opta Code Desktop + Opta CLI Runtime

## Goal
Deliver a dedicated Memory Center UX backed by canonical Opta CLI memory operations, and deprecate legacy Tauri setup writes now while removing them in the next release.

## Release N (Current) - Deprecate Now
Status: Implemented

### Scope delivered
- Added Memory Center page in Opta Code:
  - pin/unpin and list pins
  - recall search + pin actions
  - retention policy get/set
  - prune preview and apply
- Routed all Memory Center actions through daemon operations backed by CLI runtime.
- Updated Setup Wizard completion step to call daemon `onboard.apply` after daemon bootstrap + token retrieval.
- Kept Tauri `save_setup_config` only as compatibility shim.
- Added runtime deprecation warning + append-only deprecation log for legacy `save_setup_config` calls.

### Acceptance criteria (Release N)
- Memory actions in Opta Code produce the same state transitions as CLI `sessions` actions.
- Wizard no longer depends on `save_setup_config` for normal flow.
- Any remaining `save_setup_config` caller leaves deprecation evidence in `.../opta/daemon/deprecations.log`.

## Release N+1 (Next) - Remove Legacy Path
Status: Planned

### Removal tasks
1. Remove Tauri command `save_setup_config` and related command registration.
2. Remove `SetupConfig` write-path logic that writes CLI config directly from desktop wizard.
3. Delete compatibility deprecation log helper code specific to `save_setup_config`.
4. Ensure all onboarding entry points use daemon `onboard.apply` only.
5. Keep migration note in release notes: legacy command removed, daemon onboarding required.

### Guardrails before removal
- Verify no desktop codepath invokes `save_setup_config`.
- Verify no external automation depends on this Tauri command (or publish migration script/instructions).
- Keep onboarding retry/error UX in place for daemon failures.

### Post-removal verification
- Setup Wizard integration tests pass with daemon-only onboarding.
- Operations contract tests include `onboard.apply` request/response validation.
- Manual smoke test: fresh install -> onboarding -> session start -> persistence restart check.

## Operational Metrics
- Track deprecation log counts per week in Release N.
- Proceed with removal in N+1 when legacy call volume is zero (or accepted migration risk is approved).

## Risk Notes
- Primary risk: hidden third-party automation still calling `save_setup_config`.
- Mitigation: deprecation log telemetry + release note warning + one-release grace period.

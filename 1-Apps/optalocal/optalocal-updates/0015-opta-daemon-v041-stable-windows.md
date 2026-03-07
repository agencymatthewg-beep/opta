# Opta Daemon v0.4.1 Stable Release — macOS + Windows

**Date:** 2026-03-07T05:44:00Z
**Target:** Opta Init, Opta CLI
**Update Type:** Feature
**Commit:** N/A (triggered by opta-daemon-v0.4.1 tag)

## Summary

Opta Daemon v0.4.1 is now shipping on the stable channel with full macOS and Windows build artifacts. This resolves the P0 Windows blocker where Windows users could not receive daemon updates through the stable release pipeline. Stable channel rollout is configured at 5% to allow cautious validation before broader distribution.

## Detailed Changes

- **`channels/stable.json`:** Updated release metadata to reference `opta-daemon-v0.4.1` GitHub release. Populated macOS (universal tar.gz) and Windows x64 (zip) artifact URLs. Set rollout to 5%.
- **`channels/stable.json`:** Cleared broken `opta-code-universal` v0.2.1 artifact URLs that were blocking automated manifest sync (set rollout to 0%). Component definition preserved for future re-enablement.
- **`public/desktop/manifest-stable.json`:** Regenerated from stable channel source via `sync:desktop-manifests`.
- **CI pipeline:** `opta-daemon-v0.4.1` tag triggered three workflows — `opta-daemon-macos-build`, `opta-daemon-windows-build`, and `opta-daemon-release-cross-platform-gate`. All passed. Both platform artifacts published to GitHub Releases.

## Rollout Impact

Windows users checking for Opta updates will now receive daemon v0.4.1 through the stable channel at 5% rollout. macOS users similarly covered. No user action required — the Opta Init Manager's auto-updater consumes `channels/stable.json` directly. Rollout percentage should be increased to 100% after initial cohort validation.

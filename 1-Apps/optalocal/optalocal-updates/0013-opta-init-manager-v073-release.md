# Opta Init Manager v0.7.3 UI Restoration

**Date:** 2026-03-07T00:00:00Z
**Target:** Opta Init
**Update Type:** Fix
**Commit:** N/A

## Summary

Restored the core "Opta Code" 3D dashboard layout for the Opta Init environment selection screen. Fixed a major layout regression to ensure proper focus on the central hero actions.

## Detailed Changes

- **Desktop App / Component Alignments**: Removed the detached top utility bar and natively integrated the `Settings` and `Opta Local` shortcut icons directly adjacent to the main installation action buttons at the bottom of the viewport.
- **CSS Robustness**: Eliminated fragile `absolute` positioning parameters for the bottom UI row in favor of a standard flex layout, resolving clipping errors during resize.
- **Version Bump**: Upgraded Tauri `tauri.conf.json` and native package dependencies to target a stable `0.7.3` release block.

## Rollout Impact

Seamless. Once binaries are published and users update to v0.7.3 either manually from the Init website or automatically via the built-in updater flow, the layout will instantly be applied.

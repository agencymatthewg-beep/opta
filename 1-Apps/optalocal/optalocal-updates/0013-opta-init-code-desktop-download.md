# Opta Code Desktop Added to Init Website Downloads

**Date:** 2026-03-07T00:50:00Z
**Target:** Opta Init
**Update Type:** Feature
**Commit:** 51c36273

## Summary

Opta Code Desktop v0.2.1 is now listed as a downloadable product on init.optalocal.com. Users can download the macOS DMG (Apple Silicon) and Windows EXE installer directly from the Init website's Downloads section.

## Detailed Changes

- **download-artifacts.ts:** Added `code` product entry with `CODE_VERSION = "0.2.1"`, macOS DMG and Windows EXE fallback URLs pointing to GitHub Releases.
- **channels/stable.json:** Updated `opta-code-universal` component to version `0.2.1`, rollout `100%`, with populated artifact URLs for both platforms.
- **public/desktop/manifest-stable.json:** Synced with `channels/stable.json`.

## Rollout Impact

Seamless / No action required. The download card renders automatically via the existing `DOWNLOAD_TARGETS` iteration on `page.tsx`.

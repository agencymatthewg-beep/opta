---
id: "0016"
date: "2026-03-07"
app: "opta-code-desktop-universal, opta-init"
author: "Antigravity"
title: "Opta Code Desktop v0.2.2 Live Release"
---

# Opta Code Desktop v0.2.2 Live Release

## What Was Deployed

1. **GitHub Release (`1P-Opta-Code-Desktop`)**:
   - Pushed tag `v0.2.2` to trigger the `opta-code-macos-build.yml` and `opta-code-windows-build.yml` GitHub action pipelines.
   - Built the latest `aarch64` and `x64-setup.exe` artifacts.
2. **Opta Init Deploy (`1O-Opta-Init`)**:
   - Updated `lib/download-artifacts.ts` to statically resolve to `Opta Code Desktop v0.2.2`.
   - Updated `channels/stable.json` and synchronized `desktop-updates/stable.json`.
   - Vercel deployed the latest `init.optalocal.com` artifact.

## Key Changes

- Substantial UI reskin for the Settings Menu Keybinds and Workspace Selection.
- Injection of the Terminal Diagnostic Grid "Empty State" in standard Chat View for when LMX Local Daemon disconnects.
- `aarch64` and `windows-x86_64` parity mapping established via `node scripts/sync-desktop-manifests.mjs`.

## Validation

- `npm run typecheck` + `vitest` pass successfully.
- `out/` exported statically and deployed to Vercel without JS cache failure.
- Vercel edge deployment successfully maps to `init.optalocal.com`.

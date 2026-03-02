# 1O-Opta-Init

Canonical path: `1-Apps/optalocal/1O-Opta-Init`

## What It Is

Opta Init is the Opta Local distribution and update control plane.

- **Web app** (Next.js, static export) published at `init.optalocal.com`
- **Desktop Manager** (Tauri) in `desktop-manager/` for install/update/launch orchestration across Opta Local apps

## Local Development

```bash
cd /Users/matthewbyrden/Synced/Opta/1-Apps/optalocal/1O-Opta-Init
npm install
npm run dev
```

## Validation and Build

```bash
npm run check
npm run build
npm run start
```

## Release Contract + Sync

```bash
npm run validate:release-contract
npm run sync:desktop-manifests
npm run sync:manager-updates
npm run sync:vercel-redirects
```

## Desktop Manager

```bash
cd /Users/matthewbyrden/Synced/Opta/1-Apps/optalocal/1O-Opta-Init/desktop-manager
npm install
npm run typecheck
npm run build
```

## Key Docs

- `ARCHITECTURE.md`
- `docs/RELEASE-CONTROL-WORKFLOW.md`
- `docs/WORKFLOWS.md`

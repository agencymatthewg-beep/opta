# Opta Local Workspace

Canonical workspace for Opta Local apps under `/Users/matthewbyrden/Synced/Opta/1-Apps/optalocal`.

## App Matrix

| ID | App | Path | Stack | Dev Port | Core role |
|---|---|---|---|---:|---|
| 1D | Opta CLI | `1D-Opta-CLI-TS` | TypeScript CLI/daemon | n/a | Runtime engine and daemon control plane |
| 1M | Opta LMX | `1M-Opta-LMX` | Python/FastAPI/MLX | 1234 | Local inference runtime |
| 1O | Opta Init | `1O-Opta-Init` | Next.js + Desktop Manager (Tauri) | 3001 | Distribution/update control plane |
| 1P | Opta Code Universal | `1P-Opta-Code-Universal` | React/Vite + Tauri | 5173 | Local desktop/web operator client |
| 1R | Opta Accounts | `1R-Opta-Accounts` | Next.js + Supabase | 3002 | Auth and account management |
| 1S | Opta Status | `1S-Opta-Status` | Next.js | 3005 | Product/system status dashboard |
| 1T | Opta Home | `1T-Opta-Home` | Next.js | 3000 | Marketing/home surface |
| 1U | Opta Help | `1U-Opta-Help` | Next.js static export | 3006 | Docs/help center |
| 1V | Opta Learn | `1V-Opta-Learn` | Next.js | 3007 | Guides and learning system |
| 1X | Opta Admin | `1X-Opta-Admin` | Next.js | 3008 | Private website-management control plane |

## Workspace Commands

Run from `optalocal/`:

```bash
npm run apps:list
npm run apps:verify
npm run check:all
npm run build:all
npm run dev:1o
npm run dev:1p
npm run dev:1x
```

Workspace scripts are powered by:
- `apps.registry.json`
- `scripts/opta-local-workspace.mjs`

For reliability, workspace `check` and `build` tasks force `CI=1` automatically so test/build tools run in non-interactive mode.

## Opta Init Release Metadata Preparation

To prepare Opta Init manifests/feeds/redirects in one command:

```bash
npm run release:opta-init:prepare
```

This runs strict release validation and then syncs:
- desktop component manifests
- manager updater metadata
- Vercel redirect map

## CI Workflows (Repo Root)

- `.github/workflows/opta-init-ci.yml`
- `.github/workflows/opta-init-release-manifest-checks.yml`
- `.github/workflows/opta-init-desktop-manager-release.yml`
- `.github/workflows/opta-code-macos-build.yml`
- `.github/workflows/opta-code-windows-build.yml`
- `.github/workflows/opta-local-web-ci.yml`

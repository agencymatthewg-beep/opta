# OptaLocal Documentation Status

Updated: 2026-03-01
Scope: `1-Apps/optalocal/*`

## Canonical apps
- `1D-Opta-CLI-TS` — runtime/TUI/daemon
- `1L-Opta-Local` — deprecated duplicate client (retired/deleted from workspace)
- `1M-Opta-LMX` — inference service (Mono512 host)
- `1O-Opta-Init` — Opta Init Website + Opta Init Desktop Manager (desktop manager is the only website download target)
- `1P-Opta-Code-Universal` — desktop client for Opta CLI daemon
- `1R-Opta-Accounts` — auth/accounts portal
- `1S-Opta-Status` — status and incident visibility
- `1T-Opta-Home` — brand homepage (optalocal.com root) — **live 2026-03-01**
- `1U-Opta-Help` — help/docs website
- `1V-Opta-Learn` — learn/guides website

## Domain Map (current, all live)

| Domain | App | Vercel Project | Status |
|--------|-----|----------------|--------|
| `optalocal.com` | 1T-Opta-Home | `web` (prj_LUQzl1HQ...) | ✅ Live — brand homepage |
| `www.optalocal.com` | 1T-Opta-Home | `web` | ✅ Live |
| `lmx.optalocal.com` | 1L-Opta-Local (legacy) | `opta-lmx-dashboard` (prj_VbWNtBjU...) | ✅ Live (frozen legacy deploy) |
| `init.optalocal.com` | 1O-Opta-Init | `opta-init` | ✅ Live |
| `accounts.optalocal.com` | 1R-Opta-Accounts | `accounts` | ✅ Live — SSO portal |
| `status.optalocal.com` | 1S-Opta-Status | `status` | ✅ Live |
| `help.optalocal.com` | 1U-Opta-Help | `opta-help` | ✅ Live |

## Vercel Deploy Notes

### optalocal.com (brand homepage — `web` project)
- Deploy from: `1-Apps/optalocal/1T-Opta-Home/` directly
- rootDirectory: null (deploys from app dir)
- outputDirectory: null (Vercel builds Next.js natively — NO output: 'export')
- `cd 1T-Opta-Home && vercel deploy --prod`

### lmx.optalocal.com (LMX dashboard — `opta-lmx-dashboard` project)
- Deploy from: `/Users/Shared/312/Opta/` (monorepo root)
- rootDirectory (historical): `1-Apps/optalocal/1L-Opta-Local/web` (path removed from workspace)
- installCommand: `cd ../../../.. && pnpm install --no-frozen-lockfile`
- `.vercel/project.json` at monorepo root points to `prj_VbWNtBjUrPUpzZMW6QFhn86KTYsJ`
- `.vercelignore` at monorepo root whitelists: 1L web, 1D CLI packages, 6D-UI
- `cd /Users/Shared/312/Opta && vercel deploy --prod`

## Actions completed (2026-03-01)
- Built and deployed `1T-Opta-Home` to `optalocal.com`
- Created new `opta-lmx-dashboard` Vercel project for `1L-Opta-Local`
- Moved `lmx.optalocal.com` domain from old `web` project → new `opta-lmx-dashboard`
- Fixed `.vercelignore` to include `1D-Opta-CLI-TS/packages/` (daemon-client, protocol-shared)
- Both domains verified live and serving correct content

## Maintenance rule
When a major architecture/path/policy change occurs, update:
1. app-local APP.md / ARCHITECTURE.md
2. This file (`OPTALOCAL-DOCS-STATUS.md`)
3. SOT project map (`AI26/1-SOT/PROJECTS.md`)

## Known gaps
- optamize.biz has no brand homepage (sister ecosystem — cross-brand path absent)
- Real product screenshots not yet in `optalocal.com` Ecosystem section (using icon cards)

## Canonical Distribution Policy

- Opta Init Website (`init.optalocal.com`) and Opta Init Desktop Manager are separate components in the same app boundary.
- Across OptaLocal websites, users should only download **Opta Init Desktop Manager**.
- CLI/LMX/Code are lifecycle-managed from Opta Init Manager, not presented as direct website downloads.

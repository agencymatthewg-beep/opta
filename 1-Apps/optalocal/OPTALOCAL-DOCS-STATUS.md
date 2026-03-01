# OptaLocal Documentation Status

Updated: 2026-03-01
Scope: `1-Apps/optalocal/*`

## Canonical apps
- `1D-Opta-CLI-TS` — runtime/TUI/daemon
- `1L-Opta-Local` — LMX dashboard (lmx.optalocal.com)
- `1M-Opta-LMX` — inference service (Mono512 host)
- `1O-Opta-Init` — project/init system
- `1P-Opta-Code-Desktop` — desktop client for Opta CLI daemon
- `1R-Opta-Accounts` — auth/accounts portal
- `1T-Opta-Home` — brand homepage (optalocal.com root) — **live 2026-03-01**

## Domain Map (current, all live)

| Domain | App | Vercel Project | Status |
|--------|-----|----------------|--------|
| `optalocal.com` | 1T-Opta-Home | `web` (prj_LUQzl1HQ...) | ✅ Live — brand homepage |
| `www.optalocal.com` | 1T-Opta-Home | `web` | ✅ Live |
| `lmx.optalocal.com` | 1L-Opta-Local | `opta-lmx-dashboard` (prj_VbWNtBjU...) | ✅ Live — LMX dashboard |
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
- rootDirectory: `1-Apps/optalocal/1L-Opta-Local/web`
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
- `OPTA-LOCAL-STACK.md` at `1-Apps/optalocal/` is still empty — needs population
- optamize.biz has no brand homepage (sister ecosystem — cross-brand path absent)
- Real product screenshots not yet in `optalocal.com` Ecosystem section (using icon cards)

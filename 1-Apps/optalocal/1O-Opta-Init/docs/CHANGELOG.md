# Opta Init — Changelog

## [1.1.3] - 2026-03-06 ✅ Windows Priority Directive (Opta Code + Daemon)

### Changed

- Updated active docs to mark complete Windows development for `opta-code-universal` and `opta-daemon` as P0 ASAP:
  - `APP.md`
  - `docs/ROADMAP.md`
  - `docs/GO-LIVE-CHECKLIST.md`
  - `docs/WORKFLOWS.md`
- Added explicit execution order and validation expectations for Windows completion, including strict release-contract checks and clean-machine evidence.
- Hardened release automation: `/.github/workflows/opta-daemon-release-manifest-sync.yml` now requires both macOS and Windows artifacts before manifest sync, and enforces platform coverage via `strict_require_platforms_for`.
- Added automated Opta Daemon cross-platform release lanes:
  - `/.github/workflows/opta-daemon-macos-build.yml`
  - `/.github/workflows/opta-daemon-windows-build.yml`
  - `/.github/workflows/opta-daemon-release-cross-platform-gate.yml`
- Fixed release asset race handling for manifest sync workflows:
  - `/.github/workflows/opta-daemon-release-manifest-sync.yml` now waits until both platform artifacts are present before resolving payload.
  - `/.github/workflows/opta-code-release-manifest-sync.yml` now waits until both platform artifacts are present before resolving payload.

## [1.1.2] - 2026-03-06 ✅ Reality Alignment (Docs + App Wiring + mDNS)

### Added

- Added strict docs/live-state validator:
  - `scripts/validate-docs-live-status.mjs`
- Added npm script:
  - `npm run validate:docs:live-status`
- Added native mDNS discovery surface in desktop manager:
  - `discover_lmx_mdns()`
  - `discover_and_store_lmx_connection()`
- Added network-discovery contract doc:
  - `docs/NETWORK-DISCOVERY.md`

### Changed

- Updated active docs to reflect live release reality for:
  - Windows manager updater + installer lanes (stable + beta)
- Clarified channel-manifest readiness status for non-CLI artifacts (`opta-lmx`, `opta-code-universal`, `opta-daemon`) in active roadmap/checklist docs.
- Wired docs/live-state gate into default validation flows:
  - `validate:release-contract`
  - `check`
- Wired setup wizard and daemon drawer into main desktop manager flow.
- Enforced kill-only daemon drawer behavior (restart path removed until backend support exists).
- `save_opta_config` now persists to `~/.config/opta/opta-init-config.json`.
- Added `get_opta_config()` command for first-run setup hydration.
- Startup connection resolution now prefers stored LMX, then mDNS, then `localhost:1234`.

## [1.1.1] - 2026-03-03 ✅ Docs Hygiene + Promotion Governance

### Added

- Added promotion matrix + stable-readiness gate script:
  - `scripts/promotion-status-report.mjs`
- Added CI publication of promotion status artifact:
  - `opta-init-promotion-status` from `/.github/workflows/opta-init-release-manifest-checks.yml`

### Changed

- Added conditional stable hard-gate in release-manifest CI:
  - runs `npm run validate:stable-promotion` when stable feed files change.
- Archived superseded install-gap audit document to:
  - `docs/archive/2026-02/AUDIT-2026-02-28-DEVICE-INSTALL-GAPS.md`
- Updated active docs (`INDEX`, `WORKFLOWS`, `ROADMAP`, `GO-LIVE-CHECKLIST`) to reflect current promotion system and live known gaps.

### Added (Follow-up)

- Added active-docs reference validator:
  - `scripts/validate-docs-references.mjs`
- Added docs consistency CI workflow:
  - `/.github/workflows/opta-init-docs-checks.yml`

## [1.1.0] - 2026-03-02 ✅ Release Control Plane Contract

### Added

- Added versioned release-control schema: `channels/schema/release-manifest.v1.schema.json`.
- Added internal release-control runbook: `docs/RELEASE-CONTROL-WORKFLOW.md`.
- Added manifest validator script: `scripts/validate-release-manifests.mjs`.

### Changed

- Replaced minimal channel metadata with full control-plane manifests in:
  - `channels/stable.json`
  - `channels/beta.json`
- Channel manifests now include component-level macOS/Windows artifacts for:
  - `opta-cli`
  - `opta-lmx`
  - `opta-code-universal`
  - `opta-daemon`
- Added rollout + promotion visibility to docs index and roadmap.

## [1.0.1] - 2026-02-28 ✅ Documentation + Delivery Sync

### Changed

- Synchronized architecture and workflow docs with the currently deployed single-page IA (`Features`, `CLI`, `Install`, `Download`, `Dashboard`, `Account`).
- Updated references from legacy setup/usage section naming to current section naming.
- Updated platform version references to Next.js 16 in active docs.
- Added explicit cache-control documentation for rewritten HTML routes.

### Fixed

- Added non-static route cache header in `vercel.json` to enforce `max-age=0, must-revalidate` and reduce stale UI variant risk.
- Deployed production update and re-aliased `init.optalocal.com` after cache policy fix.

## [1.0.0] - 2026-02-28 ✅ LIVE — UI/UX APPROVED

### Shipped

- Next.js static site — TypeScript strict, Tailwind, Framer Motion
- Fonts: Sora (UI) + JetBrains Mono (code blocks) via next/font
- Design system: --opta-\* CSS variables, glassmorphism aesthetic
- Core sections: Hero, CLI showcase, install, architecture, features, downloads, dashboard CTA, footer
- Framer Motion: blur-in reveals, stagger children, spring interactions, film grain
- vercel.json: security headers and static asset immutable cache
- robots.txt, sitemap.xml
- SEO: metadataBase, canonical URL, Open Graph, googleBot config
- Deployed: https://opta-init.vercel.app + https://init.optalocal.com
- Vercel project: opta-init (matthews-projects-5b1a3ee3)
- Cloudflare DNS: init.optalocal.com CNAME → cname.vercel-dns.com

### Design Approval

- Owner reviewed and approved the Obsidian Glassmorphism aesthetic, section layout, spring animation system, and all component designs on 2026-02-28
- Visual direction locked — see DECISIONS.md D07

## [0.1.0] - 2026-02-27

### Added

- OPIS scaffold created
- APP.md, CLAUDE.md, ARCHITECTURE.md, docs/ established
- Project initialized

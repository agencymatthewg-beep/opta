# Opta Init — Changelog

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

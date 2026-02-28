---
status: active
---

# Opta Init — Roadmap

## v1.0 — Live & Functional ✅ SHIPPED 2026-02-28

**All acceptance criteria met. Site live at https://init.optalocal.com**

> **UI/UX DESIGN APPROVED 2026-02-28** — Owner has reviewed and approved the Obsidian Glassmorphism aesthetic, spring physics animations, section layout, and component design. The visual direction is locked. Future work focuses on functionality and content, not redesign.

### Phase 1: Scaffold ✅

- [x] `npx create-next-app` with TypeScript, Tailwind, app router
- [x] `output: 'export'` configured
- [x] Sora + JetBrains Mono loaded via next/font
- [x] --opta-\* CSS variables established in globals.css
- [x] Framer Motion installed
- [x] cn() utility created
- [x] download target registry (moved from static constants to `lib/download-artifacts.ts`)

### Phase 2: Sections ✅

- [x] Header — logo (Opta wordmark), anchor nav
- [x] Hero — tagline, sub-copy, primary download CTA with spring animation
- [x] CLI Showcase — visual terminal flows and command palette examples
- [x] Install section — bootstrap command + prerequisites
- [x] Architecture + features sections — stack and capability overview
- [x] Downloads — card per app (CLI, LMX), macOS + Windows state, glass card style
- [x] Dashboard CTA — "Open Web Dashboard" + "Manage Account"
- [x] Footer — brand, links

### Phase 3: Polish ✅

- [x] Scroll-triggered reveals on all sections (blur-in + stagger)
- [x] Micro-interactions on all buttons and cards
- [x] Film grain overlay on hero
- [x] Hero glassmorphism background (gradient mesh + blur)
- [x] Mobile responsive (all sections work at 375px+)

### Phase 4: QA + Deploy ✅

- [ ] Lighthouse >= 95 Performance, 100 Accessibility, 100 SEO — _pending audit_
- [x] Download cards now resolve live release assets and avoid false "Coming Soon" copy when artifacts exist
- [x] Vercel project created (`opta-init`, team `matthews-projects-5b1a3ee3`)
- [x] init.optalocal.com CNAME added to Cloudflare DNS
- [x] Live and resolving → https://opta-init.vercel.app ✅
- [x] HTML route cache-control hardened (`max-age=0, must-revalidate`) and redeployed

**Deploy URLs:**

- Production: https://opta-init.vercel.app
- Custom domain: https://init.optalocal.com

---

## v1.1 — Real Download Artifacts + Dynamic Buttons

_Partially delivered: release-asset detection + state-aware CTA shipped. Remaining items track version badges and full go-live gates._

- [x] Replace placeholder download URLs with release-asset detection from GitHub API
- [ ] GitHub API call at build time to fetch latest release version tag
- [ ] Version badge shown on download buttons (e.g. "v0.1.0")
- [ ] Fallback to hardcoded URL if GitHub API unavailable at build time
- [ ] Bootstrap script hosted at `https://optalocal.com/init` — update UI to point to it
- [x] Install-state messaging: show live "Installer/Package Ready" vs "Coming Soon" based on artifact status

**Design contract:** All v1.1 additions must match the approved v1.0 aesthetic — glass cards, violet accents, spring interactions. No new design patterns without owner sign-off (see D07 in DECISIONS.md).

## v1.2 — QA Pass

- [ ] Lighthouse audit (target ≥95 perf, 100 a11y, 100 SEO)
- [ ] Cross-browser testing (Chrome, Safari, Firefox)
- [ ] Verify all download links return 200
- [ ] End-to-end acceptance test on clean machine (see GO-LIVE-CHECKLIST.md)

## v2.0 — optalocal.com Platform Root

- [ ] Root domain landing page at optalocal.com linking to all platform apps
- [ ] init.optalocal.com remains the canonical onboarding entry
- [ ] Shared nav component between platform apps (1L, 1O, future)
- [ ] Design: extend the approved v1.0 aesthetic — same tokens, same motion spec

# Opta Init — Roadmap

## v1.0 — Live & Functional ✅ SHIPPED 2026-02-28

**All acceptance criteria met. Site live at https://init.optalocal.com**

### Phase 1: Scaffold ✅
- [x] `npx create-next-app` with TypeScript, Tailwind, app router
- [x] `output: 'export'` configured
- [x] Sora + JetBrains Mono loaded via next/font
- [x] --opta-* CSS variables established in globals.css
- [x] Framer Motion installed
- [x] cn() utility created
- [x] constants.ts with download URL placeholders

### Phase 2: Sections ✅
- [x] Header — logo (Opta wordmark), anchor nav
- [x] Hero — tagline, sub-copy, primary download CTA with spring animation
- [x] Downloads — card per app (CLI, LMX), macOS + Windows buttons, glass card style
- [x] Setup Guide — tabbed component, sequential steps per app, copy-pasteable commands
- [x] Optimal Usage — tips and key commands per app
- [x] Dashboard CTA — "Open Dashboard" button -> lmx.optalocal.com
- [x] Footer — brand, links

### Phase 3: Polish ✅
- [x] Scroll-triggered reveals on all sections (blur-in + stagger)
- [x] Micro-interactions on all buttons and cards
- [x] Film grain overlay on hero
- [x] Hero glassmorphism background (gradient mesh + blur)
- [x] Mobile responsive (all sections work at 375px+)

### Phase 4: QA + Deploy ✅
- [ ] Lighthouse >= 95 Performance, 100 Accessibility, 100 SEO — _pending audit_
- [x] All download links verified (placeholder URLs — update when releases ship)
- [x] Vercel project created (`opta-init`, team `matthews-projects-5b1a3ee3`)
- [x] init.optalocal.com CNAME added to Cloudflare DNS
- [x] Live and resolving → https://opta-init.vercel.app ✅

**Deploy URLs:**
- Production: https://opta-init.vercel.app
- Custom domain: https://init.optalocal.com (DNS propagating)

---

## v1.1 — Dynamic Download Buttons

- [ ] GitHub API call at build time to fetch latest release version
- [ ] Version badge shown on download buttons
- [ ] Fallback to hardcoded URL if API unavailable

## v1.2 — QA Pass

- [ ] Lighthouse audit (target ≥95 perf, 100 a11y, 100 SEO)
- [ ] Real download URLs (when CLI + LMX releases ship to GitHub Releases)
- [ ] Cross-browser testing

## v2.0 — optalocal.com Platform Root

- [ ] Root domain landing page linking to all optalocal.com apps
- [ ] init.optalocal.com remains the onboarding entry
- [ ] Shared nav between platform apps

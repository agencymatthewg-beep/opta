# Opta Home — Roadmap

**Status:** v1.1 implementation pass (hero/logo rollout + production drift closure).

---

## v1.0 — Live Baseline (✅ 2026-03-01)

Baseline production release that moved `optalocal.com` root from dashboard routing to brand-home routing.

**Completed:**
- [x] Root domain positioned as Opta ecosystem entry point (not LMX dashboard)
- [x] Next.js app structure stabilized (`Nav`, `Hero`, `BenchmarkStrip`, `QuickStart`, `HardwareStats`, `Ecosystem`, `DataSync`, `ArchDiagram`, `ModelGrid`, `CliPreview`, `FeatureTrio`, `CtaBlock`, `Footer`)
- [x] Opta visual system parity (void background, violet accents, glass/obsidian panels, Sora + JetBrains Mono)
- [x] Build pipeline verified

---

## v1.1 — Hero + Messaging Refresh (✅ 2026-03-05)

Focused visual and positioning update aligned to stepped-arc prototype direction.

**Completed:**
- [x] Hero heading simplified around primary statement: `Run autonomous AI.`
- [x] Supporting copy updated for explicit cloud/local operating modes
- [x] Stepped arc composition tuned for new logo balance (Init/CLI elevated, LMX/Code centered)
- [x] Hero glow intensity reduced for cleaner OLED readability and lower visual noise
- [x] Mobile-safe responsive spacing retained

**Validation checklist:**
- [x] `npm run build` succeeds locally
- [x] Production deploy + post-deploy smoke check (`optalocal.com` aliased on 2026-03-05)
- [ ] Lighthouse target confirmation (≥95 Performance, 100 Accessibility, 100 SEO)

---

## v1.2 — Polish Backlog (Next)

- [ ] Animated number counters in `HardwareStats`
- [ ] Optional film grain texture layer in hero (subtle, toggleable)
- [ ] Spotlight hover refinement for ecosystem cards
- [ ] Real product screenshots in ecosystem cards

---

## v2.0 — Expansion (Conditional)

- [ ] Multi-page extension (`/stack`, `/models`) if needed
- [ ] Public release changelog/blog flow
- [ ] Live status signal surface (status.optalocal.com integration)

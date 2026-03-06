# Opta Home — Decisions Log

Resolved decisions — do not re-open without explicit instruction.

---

## D001 — Design System: Match init.optalocal.com exactly

**Decision:** Use identical design system to init.optalocal.com (CSS vars, glass utilities, obsidian cards, fonts, motion system).
**Rationale:** Brand cohesion. Both sites are part of the same ecosystem and should feel like one product family.
**Date:** 2026-03-01
**Status:** Locked ✅

---

## D002 — Stack: Next.js 16 + Operational Health Route

**Decision:** Next.js 16 App Router with static homepage rendering and a single operational runtime endpoint: `/api/health`.
**Rationale:** Preserve static-content performance while adding explicit health observability and dependency probing support.
**Date:** 2026-03-05
**Status:** Locked ✅

---

## D003 — UX Structure: Gemini 3.1 Pro spec

**Decision:** Page sections follow the Gemini 3.1 Pro UX design generated 2026-03-01: Nav → Hero → Ecosystem Bento → Hardware Stats → CLI Preview → Feature Trio → CTA Block → Footer.
**Rationale:** AI-generated spec informed by best practices for dev-tool marketing sites.
**Date:** 2026-03-01
**Status:** Draft — sections subject to refinement after Matthew Q&A

---

## D004 — Prefix: 1T

**Decision:** Project lives at `1-Apps/optalocal/1T-Opta-Home/`
**Rationale:** Next available prefix after 1R in the optalocal domain. (1S not used.)
**Date:** 2026-03-01
**Status:** Locked ✅

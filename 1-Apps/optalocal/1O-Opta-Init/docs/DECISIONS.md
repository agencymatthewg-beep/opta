# Opta Init — Decisions

## D01: Static export over SSR
**Decision:** Use Next.js `output: 'export'` (pure static), not SSR or ISR.
**Reason:** Content never changes at runtime. Zero server cost. Perfect CDN caching. No runtime failure modes. Download URLs and guide content are editorial — updated at build time.
**Status:** Locked.

## D02: Next.js over plain HTML
**Decision:** Next.js 15 despite being a static site.
**Reason:** Consistency with Opta web ecosystem (1L, 1F, 1B all use Next.js). TypeScript support. next/font for zero-FOUT Sora loading. Framer Motion integrates cleanly. Easy to extend if v2 needs dynamic features.
**Status:** Locked.

## D03: Framer Motion for animations (not CSS)
**Decision:** All interactive animations via Framer Motion spring physics, not CSS transitions.
**Reason:** Research confirms spring physics produces higher perceived quality. CSS ease-out is detectable as "cheap." Framer Motion spring config (stiffness, damping, mass) matches physical reality. Interruptible by default.
**Status:** Locked.

## D04: Single page, not multi-page
**Decision:** All content on one page with anchor navigation.
**Reason:** This is an onboarding page, not a docs site. Scroll-through experience is the correct UX. Users should see everything without navigation overhead.
**Status:** Locked.

## D05: Dark mode only at v1
**Decision:** Dark (Obsidian Glassmorphism) is the only theme at launch.
**Reason:** Opta aesthetic is a dark brand. Building a quality light mode takes significant additional effort with diminishing returns at v1. Can be added in v1.1.
**Status:** Locked for v1.

## D06: Domain is init.optalocal.com (not get. or dl.)
**Decision:** init.optalocal.com reflects the "Initializer" brand name.
**Reason:** Matthew's explicit direction. "Init" as in initialize your stack — more meaningful than a generic "get" or "download" subdomain.
**Status:** Locked.

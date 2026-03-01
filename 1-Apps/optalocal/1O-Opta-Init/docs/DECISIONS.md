# Opta Init — Decisions

## D01: Static export over SSR

**Decision:** Use Next.js `output: 'export'` (pure static), not SSR or ISR.
**Reason:** Content never changes at runtime. Zero server cost. Perfect CDN caching. No runtime failure modes. Download URLs and guide content are editorial — updated at build time.
**Status:** Locked.

## D02: Next.js over plain HTML

**Decision:** Next.js (currently 16.x) despite being a static site.
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

## D07: UI/UX design approved and locked — Obsidian Glassmorphism aesthetic

**Decision:** The v1.0 visual design — Obsidian Glassmorphism aesthetic, section layout, animation system (spring physics + blur-in reveals + stagger), component patterns (glass cards, violet CTAs, film grain), and typography (Sora + JetBrains Mono) — is approved by the owner and locked.
**Reason:** Owner explicitly reviewed and approved the shipped v1.0 design on 2026-02-28. No redesign or significant visual deviation is in scope for v1.x. Any future UI changes must extend the approved system, not replace it.
**Implications:**

- AI agents must not propose redesigns or alternative aesthetics
- New components added in v1.1+ must match existing glass card and spring animation patterns
- The locked design is the reference point for all downstream optalocal.com apps (see KNOWLEDGE.md)
  **Status:** Locked.

## D08: Revalidate all rewritten HTML routes

**Decision:** Apply `Cache-Control: public, max-age=0, must-revalidate` to non-static rewritten routes in addition to explicit `.html` files.
**Reason:** The site uses rewrites (`/$1.html`) and static hosting; explicit route-level revalidation reduces stale HTML variants being served through CDN/browser cache.
**Status:** Locked.

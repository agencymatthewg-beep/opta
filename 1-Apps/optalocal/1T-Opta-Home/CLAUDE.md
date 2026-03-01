# Opta Home — CLAUDE.md

> AI coding instructions for optalocal.com brand homepage.

**Read APP.md and WORKFLOW-DESIGN-ITERATION.md before making any changes.**

---

## Identity Snapshot

This is a **static marketing homepage** for optalocal.com. It is NOT:
- A dashboard (that's lmx.optalocal.com)
- An onboarding guide (that's init.optalocal.com)
- An auth system (that's accounts.optalocal.com)

One job: impress visitors, communicate capability, route them to the right app.

---

## Stack

```
Next.js 16 (App Router)
TypeScript (strict mode)
Tailwind CSS v3
Framer Motion ^12
Lucide React (icons)
```

No `output: 'export'` — Vercel builds natively. No API routes. No server actions.

---

## File Structure (current)

```
app/
  globals.css         ← Design system — CSS vars, utilities, keyframes
  layout.tsx          ← Font loading (Sora + JetBrains Mono), metadata
  page.tsx            ← Section order. Add/remove sections here.
components/
  Nav.tsx             ← Sticky glass header, ecosystem nav links
  Hero.tsx            ← Split layout: headline + technical flow diagram
  BenchmarkStrip.tsx  ← Full-width animated stats bar
  Ecosystem.tsx       ← 4-app obsidian bento grid
  ArchDiagram.tsx     ← Local vs Cloud architecture comparison
  ModelGrid.tsx       ← Model compatibility table
  CliPreview.tsx      ← Typewriter terminal animation
  FeatureTrio.tsx     ← 3-column obsidian cards
  CtaBlock.tsx        ← Full-width CTA
  Footer.tsx          ← Site footer
  OptaRing.tsx        ← Brand icon — do not modify
lib/
  utils.ts            ← cn() only
public/
  fonts/              ← JetBrains Mono woff2 files
```

---

## Design System Rules

1. **Never change CSS variables** in globals.css without explicit instruction
2. **Use `.obsidian-interactive`** for all hoverable dark cards
3. **Use `.text-moonlight`** for primary headings (white→violet gradient)
4. **Use `.glass-subtle`** for nav and overlays
5. **Background**: `.bg-grid-subtle` for sections that need texture; `.bg-dot-subtle` for dot pattern
6. **No linear easings** — Framer Motion only: `{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }`
7. **Scroll animations**: `useInView(ref, { once: true, margin: "-100px" })`
8. **Entry pattern**: `initial={{ opacity: 0, y: 20 }} animate={isInView ? { opacity: 1, y: 0 } : {}}` with 100ms stagger per item

---

## Design Philosophy (non-negotiable)

- **Precision over decoration** — grid texture, not organic blobs
- **Real data as texture** — benchmark numbers, model specs are the visuals
- **Violet sparingly** — CTAs, active states, key data. Not background splashes.
- **Terminal DNA** — JetBrains Mono for all stats, specs, code
- **Non-AI aesthetics** — no generic gradient-on-white, no floating brain icons, no "powered by AI" copy

---

## Color Quick Reference

| Token | Value | Use |
|-------|-------|-----|
| `--color-void` | #09090b | Page background |
| `--color-primary` | #a855f7 | Electric Violet — CTAs, accents |
| `--color-neon-green` | #22c55e | "Local only", live status |
| `--color-neon-red` | #ef4444 | Cloud blocked, disabled |
| `--color-text-primary` | #fafafa | Body text |
| `--color-text-secondary` | #a1a1aa | Subtitles, descriptions |
| `--color-text-muted` | #52525b | Labels, captions |

---

## External Links

| Destination | URL |
|------------|-----|
| Init | https://init.optalocal.com |
| LMX Dashboard | https://lmx.optalocal.com |
| Accounts | https://accounts.optalocal.com |

---

## Build & Deploy

```bash
# Local build verify
npm run build

# Deploy to optalocal.com (production)
cd /Users/Shared/312/Opta/1-Apps/optalocal/1T-Opta-Home
vercel deploy --prod --token "$VERCEL_TOKEN"
```

Build must pass TypeScript checks with 0 errors. All components are `"use client"` (Framer Motion).

---

## Never Do

- No `output: 'export'` or `distDir: 'out'` — Vercel builds natively
- No `<Image>` — use `<img>` with `unoptimized` for this static site
- No `useRouter()` — static site, no client routing
- No API fetches in components — all data is hardcoded static
- No modifying OptaRing CSS keyframes
- No new dependencies without explicit instruction
- No running `npm run dev` and leaving it — clean up after dev sessions

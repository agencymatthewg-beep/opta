# Opta Init — Architecture

## Overview

Pure static site. No server. No API. No database. Vercel CDN delivers the pre-built output globally.

## Data Flow

```
User hits init.optalocal.com
        |
Cloudflare DNS resolves init CNAME -> cname.vercel-dns.com
        |
Vercel serves static HTML/CSS/JS from CDN edge
        |
Browser renders page (no hydration needed for content)
        |
Framer Motion mounts spring animations client-side
        |
User clicks download -> GitHub Releases direct link
User clicks Open Dashboard -> https://lmx.optalocal.com
```

## Page Structure (Single Page)

```
/ (page.tsx)
  ├── <Header />            — Logo, nav anchors (Downloads, Setup, Usage)
  ├── <Hero />              — Tagline, sub-copy, primary Download CTA
  ├── <Downloads />         — App cards (CLI, LMX, Local) with platform buttons
  ├── <SetupGuide />        — Tabbed: CLI tab / LMX tab / Opta Local tab
  ├── <OptimalUsage />      — Tips, key commands, recommended workflows
  ├── <DashboardCTA />      — "Open Dashboard" -> lmx.optalocal.com
  └── <Footer />            — Links, legal, brand
```

## Rendering Strategy

- `output: 'export'` in next.config.ts — full static export
- All content server-rendered at build time
- Client components only for animation wrappers
- Zero client-side data fetching

## Animation Architecture

Framer Motion provides spring physics on the web. Pattern:

1. Each section is a `motion.div` with `useInView` trigger
2. Children stagger in with `variants` + `transition: { staggerChildren: 0.015 }`
3. Entry animation: `opacity 0->1, y 20->0, filter blur(8px)->blur(0)`
4. Interactive elements use `whileHover` and `whileTap` with spring
5. Film grain: CSS pseudo-element with SVG noise filter, `opacity: 0.03`

## Build Pipeline

```
npm run build
  -> next build (TypeScript compile, Tailwind purge, next/font preload)
  -> next export -> out/
  -> Vercel deploys out/ to CDN
  -> init.optalocal.com resolves

Local dev:
  npm run dev -> localhost:3005
```

## Dependencies (planned)

| Package | Purpose | Size impact |
|---------|---------|------------|
| next 15 | Framework | — |
| framer-motion | Spring animations | ~45KB gzip |
| clsx | Class merging | ~1KB |
| tailwind-merge | Tailwind dedup | ~5KB |

Total JS budget: < 150KB gzip for initial load.

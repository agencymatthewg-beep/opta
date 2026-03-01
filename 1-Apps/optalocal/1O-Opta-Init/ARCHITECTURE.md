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
User clicks Open Web Dashboard -> https://lmx.optalocal.com
User clicks Manage Account -> https://accounts.optalocal.com
```

## Page Structure (Single Page)

```
/ (page.tsx)
  ├── Header                — Logo + nav anchors (Features, CLI, Install, Download, Account)
  ├── Hero                  — Core value prop + "Initialize System" CTA
  ├── CLI Showcase          — Three productized visual terminal panels
  ├── Install Section       — Bootstrap command + prerequisites
  ├── Layered Architecture  — CLI / LMX / Web stack cards
  ├── Features Grid         — Capability cards
  ├── Downloads             — CLI available + LMX coming soon state
  ├── Dashboard CTA         — "Open Web Dashboard" + "Manage Account"
  └── Footer                — Brand + links
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
  -> next build --webpack (TypeScript + static export)
  -> out/
  -> Vercel deploys output to CDN
  -> init.optalocal.com resolves

Local dev:
  npm run dev -> localhost:3005
```

## Caching Behavior

- Static assets (`/_next/static/*`) are immutable (`max-age=31536000, immutable`)
- HTML routes are revalidated (`max-age=0, must-revalidate`)
- Rewritten non-asset routes also revalidate (`max-age=0, must-revalidate`)
- This prevents stale UI variants from persisting behind CDN/browser caches

## Dependencies (current)

| Package | Purpose | Size impact |
|---------|---------|------------|
| next 16 | Framework | — |
| framer-motion | Spring animations | ~45KB gzip |
| clsx | Class merging | ~1KB |
| tailwind-merge | Tailwind dedup | ~5KB |

Total JS budget: < 150KB gzip for initial load.

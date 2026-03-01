# Opta Init — CLAUDE.md

> AI Coding Instructions for init.optalocal.com

Read APP.md first. Then this file. Then docs/ as needed.

---

## What This Is

A statically exported Next.js 16 marketing + onboarding site for the Opta Local stack. It lives at init.optalocal.com. It has exactly one job: get users downloaded, install-ready, and handed off to runtime surfaces.

## Stack

- Next.js 16 (app router, `output: 'export'`)
- TypeScript strict
- Tailwind CSS v4
- Framer Motion (spring physics animations)
- Sora + JetBrains Mono via next/font

## Aesthetic Directives (NON-NEGOTIABLE)

**Background:** `#09090b` (void black — NEVER pure #000)
**Surface:** `#18181b` / **Elevated:** `#27272a` / **Border:** `#3f3f46`
**Primary:** `#8b5cf6` (Electric Violet) / **Glow:** `#a855f7`
**Glass BG:** `rgba(109,40,217,0.15)` / **Glass Border:** `rgba(139,92,246,0.35)`
**Text:** `#fafafa` / `#a1a1aa` / `#52525b`
**Font UI:** Sora / **Font Mono:** JetBrains Mono

### Glass Panel Pattern
```tsx
className="bg-[rgba(109,40,217,0.15)] border border-[rgba(139,92,246,0.35)] backdrop-blur-xl rounded-xl"
```

### CTA Button Pattern
```tsx
className="bg-[#8b5cf6] hover:bg-[#7c3aed] text-white font-semibold px-6 py-3 rounded-lg transition-colors"
// With Framer Motion spring scale on tap
```

## Animation Rules (NON-NEGOTIABLE)

1. **Spring physics ONLY** — never `transition: 200ms ease`. Use Framer Motion.
2. **Staggered reveals** — sections enter with 10–20ms child stagger
3. **Scroll-triggered blur-in** — elements emerge from `filter: blur(8px)` + `opacity: 0`
4. **Micro-interactions** — every button, card, and link has a hover/tap response
5. **Film grain** — subtle CSS noise overlay on hero (`opacity: 0.025–0.04`)
6. **Max perceived duration** — no animation feels longer than 400ms
7. **Interruptible** — all Framer Motion animations use `layout` prop where applicable

### Standard Section Reveal
```tsx
const variants = {
  hidden: { opacity: 0, y: 20, filter: 'blur(8px)' },
  visible: { opacity: 1, y: 0, filter: 'blur(0px)' }
}
// Use useInView hook, trigger once, spring transition
```

### Stagger Container
```tsx
const container = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.015 } }
}
```

## Coding Standards

- Functional components only, no class components
- TypeScript strict — no `any`
- Named exports for all components
- No inline styles — use Tailwind + CSS variables
- `cn()` utility (clsx + tailwind-merge) for conditional classes
- File naming: kebab-case for files, PascalCase for components

## Performance Rules

- No client components unless animation requires it — use `'use client'` sparingly
- Images: next/image with proper sizing, WebP preferred
- Fonts: preloaded via next/font, no external font requests
- No heavy runtime dependencies on a marketing site
- Lighthouse >= 95 Performance before shipping

## Content Rules

- Lead with outcomes not implementation details
- Never assume the reader is a developer
- All code blocks in setup guides must use JetBrains Mono
- Commands must be copy-pasteable with a single click

## What NOT To Do

- No CSS ease/linear for interactive animations — Framer Motion only
- No user auth, no API calls, no database
- No duplicate content from lmx.optalocal.com or other optalocal apps
- No light mode as default — dark is canonical, light mode optional later
- No third-party analytics that add >50ms to LCP

## File Structure

```
src/
  app/
    layout.tsx        (root layout, fonts, metadata)
    page.tsx          (home — all sections)
    globals.css       (--opta-* tokens, base styles)
  components/
    OptaRing.tsx      (animated singularity logo)
  lib/
    constants.ts      (download URLs, platform links, content)
```

## Key Constants (update when releases ship)

```ts
// lib/constants.ts
export const DOWNLOADS = {
  cli: {
    macos: 'https://github.com/agencymatthewg-beep/opta/releases/latest/download/opta-cli-npm.tgz',
    windows: null,
  },
  lmx: {
    macos: null,
    windows: null,
  },
}
export const DASHBOARD_URL = 'https://lmx.optalocal.com'
export const ACCOUNTS_URL = 'https://accounts.optalocal.com'
```

## Deployment

- `npm run build` → `next export` → `out/` directory
- Deploy via Vercel with `init` subdomain CNAME
- Verify Cloudflare DNS: `init CNAME cname.vercel-dns.com`

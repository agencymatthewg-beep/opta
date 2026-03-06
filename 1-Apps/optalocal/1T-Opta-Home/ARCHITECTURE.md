# Opta Home — Architecture

*Last updated: 2026-03-05*

---

## Overview

Marketing site with static content plus one operational runtime endpoint (`/api/health`) for monitoring.

```
User → Vercel Edge (optalocal.com) → prerendered page assets
                                   → _next/static/chunks/* (JS bundles)
                                   → fonts/* (JetBrains Mono woff2)
                                   → /api/health (runtime health route)
```

---

## Component Tree

```
app/page.tsx
├── <Nav />             — Sticky glass header, ecosystem links, OptaRing logo
├── <Hero />            — Split layout: headline + technical flow diagram
│                         Animated tok/s counter, dark grid texture bg
│                         Client → LMX → Apps diagram (Framer Motion)
├── <BenchmarkStrip />  — Full-width stats bar, animated counters on scroll
│                         512GB RAM · 22.2 tok/s · 836GB models · 0 cloud · <200ms TTFT
├── <Ecosystem />       — 4-app obsidian bento grid
│                         Init · LMX · CLI · Accounts (with hover glow)
├── <ArchDiagram />     — Local vs Cloud architecture comparison
│                         Local (active, green) vs Cloud (crossed out, red)
├── <ModelGrid />       — Model compatibility table
│                         Kimi K2.5 · MiniMax M2.5 · Qwen · Llama · DeepSeek
├── <CliPreview />      — Typewriter terminal animation showing CLI usage
├── <FeatureTrio />     — 3-column obsidian cards: Performance · Privacy · Control
├── <CtaBlock />        — Full-width CTA → init.optalocal.com
└── <Footer />          — Logo, nav links, copyright
```

---

## Page Sections (in render order)

| # | Section | Purpose | Design Pattern |
|---|---------|---------|----------------|
| 1 | Nav | Navigation + identity | Glass header, sticky |
| 2 | Hero | First impression, core value prop | Split layout, technical diagram, counter |
| 3 | Benchmark Strip | Real performance data | Full-width stats, animated counters |
| 4 | Ecosystem | App suite overview | 2×2 obsidian bento grid |
| 5 | Arch Diagram | Privacy / local-only architecture | Side-by-side comparison |
| 6 | Model Grid | Proven model compatibility | Technical data table |
| 7 | CLI Preview | Developer credibility | Terminal animation |
| 8 | Feature Trio | Key differentiators | 3-column cards |
| 9 | CTA Block | Conversion to init | Large CTA |
| 10 | Footer | Site links | Clean footer |

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Rendering | Static page + runtime health route |
| Styling | Tailwind CSS v3 + CSS custom properties |
| Animations | Framer Motion (spring physics) |
| Fonts | Sora (Google Fonts) + JetBrains Mono (local woff2) |
| Icons | Lucide React |
| Deploy | Vercel CDN (`optalocal.com`) |

---

## Design System

Inherits from `init.optalocal.com`:

| Token | Value | Usage |
|-------|-------|-------|
| `--color-void` | `#09090b` | Page background |
| `--color-surface` | `#0c0c12` | Card backgrounds |
| `--color-elevated` | `#1a1a24` | Benchmark strip bg |
| `--color-primary` | `#a855f7` | Electric Violet — accents, CTAs |
| `--color-neon-green` | `#22c55e` | "Local only", status indicators |
| `--color-neon-red` | `#ef4444` | Cloud blocked / disabled |
| `--font-sora` | Sora | Headings, UI text |
| `--font-jetbrains` | JetBrains Mono | Stats, code, terminal |

### CSS Utility Classes (globals.css)

```css
.glass           — glass card (backdrop blur 12px)
.glass-subtle    — lighter glass (backdrop blur 8px)
.glass-strong    — heavy glass (backdrop blur 20px)
.obsidian        — solid dark card
.obsidian-interactive — dark card with violet hover glow
.text-moonlight  — white→violet gradient text
.bg-grid-subtle  — 48px precision grid texture
.bg-dot-subtle   — 32px violet dot pattern
.glow-violet     — violet glow box-shadow
.glow-violet-sm  — subtle violet glow
.status-live     — animated green dot pseudo-element
```

---

## Build Output

Route summary after build:
- `○ /` static
- `○ /_not-found` static
- `ƒ /api/health` dynamic

---

## Vercel Project

| Field | Value |
|-------|-------|
| Project | `web` (matthews-projects-5b1a3ee3) |
| Project ID | `prj_LUQzl1HQxbRGKaAYYdELDOp0kqjc` |
| Domain | `optalocal.com` |
| Root Directory | `1-Apps/optalocal/1T-Opta-Home` |
| Framework | Next.js |
| Node | 24.x |

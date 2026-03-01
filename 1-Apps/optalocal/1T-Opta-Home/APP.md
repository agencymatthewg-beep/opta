---
app: opta-home
type: web-app
platforms: [web]
language: typescript
status: live
version: 1.0.0
depends_on: []
depended_on_by: [opta-init, opta-local, opta-accounts]
port: null
opis_version: 2.0
opis_mode: ecosystem-add
---

<!-- AI-SUMMARY (50 words max)
Opta Home is the brand homepage for optalocal.com — the root domain entry point for the entire Opta Local ecosystem. It orients new and returning users, communicates the stack's value, and routes them to the correct sub-app (init, lmx, accounts, CLI). Static, no backend. -->

# Opta Home — APP.md

> Private AI infrastructure for Apple Silicon. Your compute, your control.

---

## 1. Identity

| Field | Value |
|-------|-------|
| **Name** | Opta Home |
| **Full Name** | optalocal.com Brand Homepage |
| **Tagline** | Private AI infrastructure for Apple Silicon |
| **Type** | Static Marketing / Brand Homepage |
| **Platform** | Web (Next.js 16, static export) |
| **Language** | TypeScript |
| **Status** | v1.0 Live — deployed to optalocal.com (2026-03-01) |
| **Owner** | Matthew Byrden / Opta Operations |
| **Domain** | optalocal.com (root) |
| **Parent Platform** | optalocal.com ecosystem |
| **Path** | `1-Apps/optalocal/1T-Opta-Home/` |

---

## 2. Purpose

### What It Does
optalocal.com is the canonical brand entry point for the Opta Local stack. It communicates what the ecosystem is, who it's for, and routes visitors to the right app for their intent. It's the authoritative answer to "what is optalocal.com?"

### What Problem It Solves
The optalocal.com root domain currently serves the Opta Local dashboard — wrong first impression for anyone who doesn't already have LMX running. New and returning visitors need a brand homepage that explains the ecosystem and navigates them correctly.

### What Makes It Different
- Not a dashboard (that's lmx.optalocal.com)
- Not an onboarding guide (that's init.optalocal.com)
- The ecosystem overview — the "why" before the "how"
- Single source of truth for what optalocal.com means

### What It Does NOT Do
- Does not run any backend logic
- Does not duplicate init.optalocal.com's setup guide
- Does not replace lmx.optalocal.com's dashboard
- Does not manage auth or accounts
- Does not contain documentation or changelogs

---

## 3. Target Audience

### Primary Users
- ⚠️ OPEN QUESTION — See Section 10

### Use Cases
- Someone hears about "Opta Local" → lands on optalocal.com → understands what it is → goes to init or lmx
- Matthew shares optalocal.com with someone → they see a polished brand overview
- ⚠️ OPEN QUESTION — additional scenarios pending answers

### Experience Goal
- Premium, intentional — feels like a product company homepage, not a side project
- Identical aesthetic to init.optalocal.com (glassmorphism, obsidian cards, Electric Violet, Sora + JetBrains Mono)
- Calm, confident — communicates quality without noise

---

## 4. Non-Negotiable Capabilities

| # | Capability | Why |
|---|-----------|-----|
| 1 | Links to all 4 sub-apps (init, lmx, CLI, accounts) | Ecosystem navigation |
| 2 | Hero section with core value prop | First impression |
| 3 | Ecosystem bento grid (core apps + management websites split) | Orientation |
| 4 | Static export (no backend) | Performance + reliability |
| 5 | Mobile responsive | Basics |
| 6 | Init design system parity | Brand cohesion |

---

## 5. Design Language

Inherits canonical Opta design system — identical to init.optalocal.com:

- Background: `#09090b` void black
- Primary: `#a855f7` Electric Violet
- Glass: `rgba(12,12,18,0.6)` + border `rgba(255,255,255,0.15)`
- Text: `#fafafa` / `#a1a1aa` / `#52525b`
- Font: Sora (UI) + JetBrains Mono (code/stats)
- Motion: Framer Motion spring physics only (stiffness:400, damping:30)
- Cards: `.obsidian-interactive` hover glow system

---

## 6. Architecture

```
optalocal.com (Vercel CDN, static export)
└── Next.js 16 App Router
    ├── Nav (sticky glass + OptaRing logo)
    ├── Hero (split layout — headline + technical flow diagram, Mac Studio→LMX→Apps)
    ├── Benchmark Strip (full-width: 512GB · 22.2 tok/s · 836GB · 0 cloud · <200ms)
    ├── Ecosystem (split view: Main Local Apps + Management Websites)
    ├── Arch Diagram (Local active vs Cloud crossed out, side-by-side)
    ├── Model Grid (compatibility table: Kimi K2.5 · MiniMax · Qwen · Llama · DeepSeek)
    ├── CLI Preview (typewriter terminal animation)
    ├── Feature Trio (Performance · Privacy · Control)
    ├── CTA Block (→ init.optalocal.com)
    └── Footer
```

No API routes. No server components requiring runtime. No authentication.

### Design Philosophy (v1.0)
- **Non-AI design patterns** — precision grid, not organic blobs; real data as visual texture
- **Technical credibility** — real benchmarks, model specs, architecture diagrams front and center
- **Violet used sparingly** — CTAs, active states, key data points only (not decorative splashes)
- **Terminal DNA** — JetBrains Mono for all stats and technical content

---

## 7. Ecosystem Position

```
optalocal.com          ← THIS SITE (brand home, routing hub)
init.optalocal.com     ← Onboarding + downloads
lmx.optalocal.com      ← LMX dashboard
accounts.optalocal.com ← SSO portal
```

Also connects to:
- `optamize.biz` (sister ecosystem — personal apps)

---

## 8. Development Rules

- Framework: Next.js 16, App Router, `output: 'export'`
- Styling: Tailwind CSS v3 with CSS custom properties
- Fonts: Sora (Google Fonts) + JetBrains Mono (local woff2)
- Animations: Framer Motion only — no CSS transitions for interactive elements
- No JS required for core content (graceful degradation)
- Lint: ESLint config-next
- Deploy: Vercel → optalocal.com (replace current lmx dashboard at root)

---

## 9. Current Phase

**v1.0 Live (2026-03-01)** — Full production build deployed to `optalocal.com`. Replaces the LMX dashboard that was incorrectly serving from the root domain.

**Design direction locked:**
- Technical diagram hero (not blob animations)
- Real benchmark data as visual texture (not decorative stats)
- Model compatibility table included (Kimi K2.5, MiniMax, Qwen, Llama, DeepSeek)
- Local vs Cloud architecture diagram (not generic privacy copy)

**Vercel project settings updated:** rootDirectory changed from `1L-Opta-Local/web` → `1T-Opta-Home`

---

## 10. Future Enhancements

| Priority | Enhancement | Notes |
|----------|-------------|-------|
| HIGH | Real product screenshots in Ecosystem cards | Need actual LMX/CLI/Accounts UI shots |
| MED | optamize.biz link in footer | Cross-brand discovery path missing |
| MED | `/models` sub-page | Full model library page (more than 6 entries) |
| LOW | Changelog/blog section | Community building |
| LOW | Status page integration | Link to status.optalocal.com |

Canonical taxonomy: `../docs/PRODUCT-MODEL.md` (Opta Local = 4 main local apps; management websites are separate support layer).

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
Opta Home is the root brand homepage for Opta and Opta Local. It explains what Opta is, introduces Opta AI as the optimizer users interact with, positions Opta Local as the first public release, and routes users into activation flows via init, lmx, accounts, CLI, and Code. -->

# Opta Home — APP.md

> Opta is the Optimiser. Opta Local is the first public way to run Opta AI.

---

## 1. Identity

| Field | Value |
|-------|-------|
| **Name** | Opta Home |
| **Full Name** | optalocal.com Brand Homepage |
| **Tagline** | Opta is the Optimiser. Opta Local is the first public way to run Opta AI |
| **Type** | Marketing / Brand Homepage |
| **Platform** | Web (Next.js 16 App Router on Vercel) |
| **Language** | TypeScript |
| **Status** | v1.0 Live — deployed to optalocal.com (2026-03-01) |
| **Owner** | Matthew Byrden / Opta Operations |
| **Domain** | optalocal.com (root) |
| **Parent Platform** | optalocal.com ecosystem |
| **Path** | `1-Apps/optalocal/1T-Opta-Home/` |

---

## 2. Purpose

### What It Does
optalocal.com is the canonical brand entry point for Opta and the Opta Local ecosystem. It explains what Opta is, introduces Opta AI, frames Opta Local as the first public release, and routes visitors to the right app for their intent.

### What Problem It Solves
Without explicit brand framing, visitors confuse Opta Local for the entire company/product and miss the actual value model. The homepage must explain the Opta platform, where Opta AI fits, and how users activate Opta AI in CLI/Code with either LMX (local) or cloud models.

### What Makes It Different
- Explains Opta (company/platform) and Opta Local (first release) in one coherent model
- Explicitly defines Opta AI as the user-facing optimizer personality
- Shows activation flow: runtime source (LMX or cloud) powers Opta AI for CLI/Code
- Keeps ecosystem routing clear without collapsing into a dashboard or docs portal

### What It Does NOT Do
- Does not run product backend logic (only operational health endpoint)
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
| 1 | Hero copy that explains Opta and Opta Local together | Correct top-level positioning |
| 2 | Dedicated "What is Opta?" + "What is Opta AI?" sections | Removes brand/product ambiguity |
| 3 | Activation flow section: `LMX or Cloud → Opta AI → CLI/Code` | Explains how coding workflow actually works |
| 4 | Ecosystem bento grid (core apps + management websites split) | Orientation |
| 5 | Runtime health endpoint (`/api/health`) + hardened headers | Operational reliability |
| 6 | Mobile responsive | Basics |
| 7 | Init design system parity | Brand cohesion |

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
optalocal.com (Vercel CDN + Next.js runtime)
└── Next.js 16 App Router
    ├── Nav (sticky glass + OptaRing logo)
    ├── Hero (Opta-level positioning + Opta Local first-release framing)
    ├── Opta Explainer (What Opta is, What Opta AI is)
    ├── Activation Flow (Model Source→Opta AI→CLI/Code)
    ├── Benchmark Strip (full-width: 512GB · 22.2 tok/s · 836GB · 0 cloud · <200ms)
    ├── Ecosystem (split view: Main Local Apps + Management Websites)
    ├── Arch Diagram (Local active vs Cloud crossed out, side-by-side)
    ├── Model Grid (compatibility table: Kimi K2.5 · MiniMax · Qwen · Llama · DeepSeek)
    ├── CLI Preview (typewriter terminal animation)
    ├── Feature Trio (Performance · Privacy · Control)
    ├── CTA Block (→ init.optalocal.com)
    └── Footer
```

Single operational API route: `/api/health`. No auth/account flows on this site.

### Design Philosophy (v1.0)
- **Non-AI design patterns** — precision grid, not organic blobs; real data as visual texture
- **Opta-first messaging** — company and optimizer identity explained before component routing
- **Technical credibility** — real benchmarks, model specs, architecture diagrams front and center
- **Violet used sparingly** — CTAs, active states, key data points only (not decorative splashes)
- **Terminal DNA** — JetBrains Mono for all stats and technical content

---

## 7. Distribution Policy

- `optalocal.com` should present **one install path only**: Opta Init Desktop Manager.
- Do not present direct end-user downloads for CLI/LMX/Code on the website.
- Route users to `init.optalocal.com` for installation and managed lifecycle.

## 8. Ecosystem Position

```
optalocal.com          ← THIS SITE (brand home, routing hub)
init.optalocal.com     ← Onboarding + downloads
lmx.optalocal.com      ← LMX dashboard
accounts.optalocal.com ← SSO portal
CLI + Code             ← Opta AI execution surfaces once activated
```

Also connects to:
- `optamize.biz` (sister ecosystem — personal apps)

### Activation Relationship (Canonical)
- Opta AI is the optimizer users interact with.
- Opta AI runs inside CLI and Code experiences.
- Opta AI is powered by either:
  - Opta LMX local model runtime
  - Cloud model runtime
- Homepage must make this relationship explicit, not implied.

---

## 9. Development Rules

- Framework: Next.js 16, App Router
- Styling: Tailwind CSS v3 with CSS custom properties
- Fonts: Sora (Google Fonts) + JetBrains Mono (local woff2)
- Animations: Framer Motion only — no CSS transitions for interactive elements
- No JS required for core content semantics (animations enhance, not block)
- Lint: ESLint config-next
- Deploy: Vercel → optalocal.com (replace current lmx dashboard at root)

---

## 10. Current Phase

**v1.0 Live (2026-03-01)** — Full production build deployed to `optalocal.com`. Replaces the LMX dashboard that was incorrectly serving from the root domain.

**Design direction locked:**
- Technical diagram hero (not blob animations)
- Explicit Opta/Opta AI/Opta Local relationship messaging
- Explicit activation flow (`LMX or Cloud → Opta AI → CLI/Code`)
- Real benchmark data as visual texture (not decorative stats)
- Model compatibility table included (Kimi K2.5, MiniMax, Qwen, Llama, DeepSeek)
- Local vs Cloud architecture diagram (not generic privacy copy)

**Vercel project settings updated:** rootDirectory changed from `1L-Opta-LMX-Dashboard` → `1T-Opta-Home`

---

## 11. Future Enhancements

| Priority | Enhancement | Notes |
|----------|-------------|-------|
| HIGH | Real product screenshots in Ecosystem cards | Need actual LMX/CLI/Accounts UI shots |
| MED | optamize.biz link in footer | Cross-brand discovery path missing |
| MED | `/models` sub-page | Full model library page (more than 6 entries) |
| LOW | Changelog/blog section | Community building |
| LOW | Status page integration | Link to status.optalocal.com |

Canonical taxonomy: `../docs/PRODUCT-MODEL.md` (Opta Local = 4 main local apps; management websites are separate support layer).

---
app: opta-init
type: web-app
platforms: [web]
language: typescript
status: planning
version: 0.1
depends_on: [opta-cli-ts, opta-lmx, opta-local]
depended_on_by: []
port: 3005
opis_version: 2.0
opis_mode: ecosystem
---

<!-- AI-SUMMARY (50 words max)
Opta Init: The official download and getting-started site for the Opta Local stack (Opta CLI, Opta LMX, Opta Local). macOS + Windows installers, step-by-step setup guides, optimal usage tips. Static Next.js site at init.optalocal.com. Obsidian Glassmorphism aesthetic. Zero auth, zero dashboards — pure onboarding. -->

# Opta Init — APP.md

> Your local AI stack, ready in minutes.

---

## 1. Identity

| Field | Value |
|-------|-------|
| **Name** | Opta Init |
| **Full Name** | Opta Initializer |
| **Tagline** | Your local AI stack, ready in minutes |
| **Type** | Static Marketing + Onboarding Website |
| **Platform** | Web (Next.js, statically exported) |
| **Language** | TypeScript |
| **Status** | v1.0 Live — https://init.optalocal.com |
| **Owner** | Matthew Byrden / Opta Operations |
| **Domain** | init.optalocal.com |
| **Parent Platform** | optalocal.com (multi-app LLM platform) |

---

## 2. Purpose

### What It Does

Opta Init is the front door to the Opta Local stack. It gives any user — whether a seasoned Claude Code power user or someone running LLMs at home — a clean, beautiful, frictionless path to:

1. **Download** Opta CLI and Opta LMX for their platform (macOS / Windows)
2. **Set up** their local inference stack in minutes with clear sequential guides
3. **Use it optimally** — tips, commands, and workflows for real productivity
4. **Access the dashboard** — direct link to lmx.optalocal.com once running

### What Problem It Solves

The Opta Local stack has no public onboarding surface. Discovery happens through repos and word of mouth. New users face scattered READMEs and no canonical download URL. Opta Init creates the definitive first-touch experience — polished, strategic, broadly accessible.

### What Makes It Different

- Not a dashboard — exactly one job: get you started
- Broad appeal, technical roots — markets without alienating
- Premium by default — glassmorphism + spring physics + HD micro-animations
- Static performance — zero server, instant load, perfect Lighthouse scores

### What It Does NOT Do

- No user accounts / authentication
- No model downloads or LLM inference
- No dashboard functionality (that is lmx.optalocal.com)
- No blog, changelog, or news section
- No payment flows
- No duplication of other optalocal.com apps

---

## 3. Target Audience

### Primary

- Claude Code / Claude Max users — already running local inference or aware of local LLMs
- Home LLM runners — MacBook Pro M-series, Mac Studio, Windows with RTX GPU

### Breadth Principle

Never over-index on a single audience. Copy and layout should feel accessible and premium to a 20-year-old experimenting with open-source AI, a developer who replaced Claude API with local inference, and a non-developer who runs LM Studio and wants something better.

Lead with outcomes ("chat with your own models"), not implementation ("MLX-native inference daemon"). The setup guide reveals the depth.

---

## 4. Non-Negotiable Capabilities

| # | Capability | Why |
|---|-----------|-----|
| 1 | macOS + Windows download buttons for Opta CLI and Opta LMX | Core function |
| 2 | Step-by-step setup guides for each app | Without this downloads are orphaned |
| 3 | Optimal usage tips per app | Differentiates from a plain download page |
| 4 | Open Dashboard CTA linking to lmx.optalocal.com | Completes the funnel |
| 5 | Opta Glassmorphism aesthetic with spring animations + micro-interactions | Quality signal |
| 6 | Deployed and live on init.optalocal.com via Vercel | Must be publicly accessible at v1 |
| 7 | Static — no server-side logic | No runtime failures, fast everywhere |

---

## 5. Design Language

Inherits canonical Opta design system. See CLAUDE.md for implementation rules.

Background: #09090b / Surface: #18181b / Elevated: #27272a / Border: #3f3f46
Primary: #8b5cf6 / Primary Glow: #a855f7
Glass BG: rgba(109,40,217,0.15) / Glass Border: rgba(139,92,246,0.35)
Text Primary: #fafafa / Secondary: #a1a1aa / Muted: #52525b
Font UI: Sora / Font Mono: JetBrains Mono
Motion: Spring physics only — no CSS ease/linear for interactive elements

Premium animation principles (from Opta research):
- Spring physics — mass/stiffness/damping, never duration-based
- Staggered entry — items cascade 10-20ms apart
- Blur-in on scroll reveal — elements emerge from blur + opacity
- Micro-interactions on every interactive element
- Film grain overlay at 2-4% opacity on hero sections
- No animation over 400ms perceived duration
- Interruptible — all animations cancellable cleanly

---

## 6. Architecture Overview

init.optalocal.com (Vercel CDN, static export)
  -> Next.js 15 (app router, static export)
     -> Hero Section (value prop, primary CTAs)
     -> Download Section (per-app macOS/Windows buttons)
     -> Setup Guide (tabbed, per-app, step-by-step)
     -> Optimal Usage (tips per app)
     -> Dashboard CTA (Open Dashboard -> lmx.optalocal.com)

No backend. No API routes. No auth. No database.

---

## 7. Ecosystem Context

- Downloads Opta CLI (1D) and Opta LMX (1M)
- Links to Opta Local (1L) at lmx.optalocal.com
- Sibling: optalocal.com root (platform portal)
- Sibling: lmx.optalocal.com (LMX management dashboard)

Domain architecture:
  optalocal.com          (platform root)
  init.optalocal.com     (this site — onboarding + downloads)
  lmx.optalocal.com      (Opta Local dashboard)
  [future subdomains as new apps ship]

---

## 8. Development Rules

- Framework: Next.js 15, app router, static export (output: export)
- Styling: Tailwind CSS v4 with --opta-* CSS variables
- Fonts: Sora + JetBrains Mono via next/font (self-hosted)
- Animations: Framer Motion (web spring physics) for interactive elements
- Lighthouse: must score >= 95 Performance, 100 Accessibility, 100 SEO before v1
- Deploy: next export -> Vercel, init.optalocal.com CNAME
- No JS required for content — setup guides readable without JS

---

## 9. Current Phase

**v1.0 shipped 2026-02-28.** Site live at https://init.optalocal.com and https://opta-init.vercel.app.
Next: v1.1 (dynamic download buttons via GitHub API), v1.2 (Lighthouse audit + real download URLs).

---

## 10. Open Questions

- Are Opta CLI and Opta LMX releases on GitHub Releases? (determines download URLs)
- Does optalocal.com root need its own landing page first?
- Should Windows build exist at v1 or macOS-only for initial launch?

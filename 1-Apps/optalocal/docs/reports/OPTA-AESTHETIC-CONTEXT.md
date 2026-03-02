# Opta Aesthetic Context — Gemini Injection Document

> Injected at the top of every Gemini 3.1 call. Ensures all visual output stays within the Opta design system.
> Updated: 2026-03 — full business hierarchy + design system separation of concerns.
> Canonical design rules: `/design/aesthetics/README.md` | Relationships: `/design/relationships/README.md`

---

## Business Hierarchy

**Opta / Opta AI (Opta Operations):** Top-level parent business encompassing all products (Opta Local, Life Manager, etc.).

**Opta Local:** A dedicated sub-ecosystem of Opta focused *solely* on helping users run and use Local LLMs on their machine.

### The Two Categories of Opta Local Apps

**A. Main Local Apps (Core Product)**
Direct-execution tools for running local LLMs. Prioritise density, contrast, and raw data visibility.
- Opta LMX — the core local inference engine (accent: Electric Violet `#a855f7`)
- Opta Local — the web-based LMX management dashboard (accent: Electric Violet `#a855f7`)
- Opta CLI — terminal-native command-line tool (accent: Neon Green `#22c55e`)
- Opta Code Desktop — AI-assisted coding desktop app (accent: Violet + Cyan mixed)

**B. Opta Management Websites (Support & Infrastructure)**
Web properties for onboarding, identity, docs, and discovery. Prioritise trust, clarity, and structural readability.
- Opta Accounts — identity and authentication (accent: Identity Blue `#3b82f6`)
- Opta Status — system health monitoring (accent: dynamic — green/amber/red)
- Opta Home (optalocal.com) — main marketing site (accent: Muted Grey/Mixed `#a1a1aa`)
- Opta Help (help.optalocal.com) — technical reference docs (accent: Muted Grey `#a1a1aa`)
- Opta Learn (learn.optalocal.com) — discovery and guide portal (accent: Mixed per app)
- Opta Init (init.optalocal.com) — bootstrapping/install flow (accent: Neon Amber `#f59e0b`)

**Separation of Concerns:**
- Main Local Apps → JetBrains Mono-heavy, void-native, dense, terminal aesthetic
- Management Websites → Sora-primary, glass elements, structural readability, onboarding-friendly

---

## Brand Identity

**Opta Local** is a private AI infrastructure stack. The aesthetic is:
- Precision engineering — not generic AI SaaS
- Terminal DNA — developer-tool heritage, not consumer app
- Void-native — OLED-optimised, pitch black everywhere
- Data as texture — real specs and numbers are the visual language

Tone: calm authority. Nothing performs. The work speaks.

---

## Color System (exact — never approximate)

| Name | Hex | Use |
|------|-----|-----|
| Void Black | #09090b | ALL backgrounds — never lighter |
| Surface | #0c0c12 | Slight lift from void |
| Elevated | #1a1a24 | Cards on surface |
| Electric Violet | #a855f7 | Primary brand — CTAs, active states, key accents only |
| Violet Glow | rgba(168,85,247,0.3) | Ambient glow behind marks — never solid fill |
| Neon Green | #22c55e | Always-local indicators, live status |
| Neon Amber | #f59e0b | Optional/conditional states, Init accent |
| Neon Red | #ef4444 | Blocked, disabled, errors |
| Neon Cyan | #06b6d4 | Inline code highlights |
| Identity Blue | #3b82f6 | Accounts / auth surfaces |
| Text Primary | #fafafa | Main body text |
| Text Secondary | #a1a1aa | Subtitles, descriptions, Muted Grey accent |
| Text Muted | #52525b | Labels, captions, metadata |
| Glass BG | rgba(12,12,18,0.6) | Glass card backgrounds |
| Glass Border | rgba(255,255,255,0.15) | Glass card borders |
| Obsidian BG | rgba(5,3,10,0.8) | Heavy opaque cards |
| Code BG | #0a0a0f | Code block backgrounds |

**Violet rule:** CTAs, active indicators, key data only. Never as a large gradient wash or background.

---

## Typography

| Font | Role | Weight |
|------|------|--------|
| Sora | UI body, headings, copy (Management Websites primary) | 400 (body) 600 (semi) 700 (bold) |
| JetBrains Mono | Data, stats, code, terminal, labels, badges (Main Apps primary) | 400–600 |

All quantitative data (numbers, percentages, model names, ports, commands) = JetBrains Mono, never Sora.

**Typography context by app category:**
- Main Local Apps (LMX, Local dashboard, CLI, Code): Lean heavily on JetBrains Mono — terminal-like density
- Management Websites (Home, Help, Learn, Init, Accounts): Sora-first — readable prose, clear structure

---

## Headline Treatment (.text-moonlight)

```css
background: linear-gradient(135deg, #ffffff 0%, #ffffff 50%, rgba(168,85,247,0.5) 100%);
-webkit-background-clip: text; -webkit-text-fill-color: transparent;
```
Result: mostly white, subtle violet ghost at end. NOT a full color gradient.
**Scope to single keywords or short phrases only — not long sentences (mobile rendering issue).**

---

## Glass Classes

```
.glass-subtle  — rgba(9,9,11,0.4)  border rgba(255,255,255,0.10) blur(8px)   — nav, overlays
.glass         — rgba(12,12,18,0.6) border rgba(255,255,255,0.15) blur(12px)  — cards
.glass-strong  — rgba(12,12,18,0.8) border rgba(255,255,255,0.20) blur(20px)  — modals
.obsidian      — rgba(5,3,10,0.8)   border rgba(255,255,255,0.05) blur(16px)  — heavy cards
```

Obsidian hover: border-color rgba(168,85,247,0.4), bg rgba(10,5,20,0.9), glow shadow.

---

## Status Badges / Pills

- Always Local / Live:  bg rgba(34,197,94,0.1)  border rgba(34,197,94,0.3)  text #22c55e
- Optional / Amber:     bg rgba(245,158,11,0.1) border rgba(245,158,11,0.3) text #f59e0b
- Identity / Violet:    bg rgba(168,85,247,0.1) border rgba(168,85,247,0.3) text #a855f7
- Error / Blocked:      bg rgba(239,68,68,0.1)  border rgba(239,68,68,0.3)  text #ef4444
- Identity Blue:        bg rgba(59,130,246,0.1) border rgba(59,130,246,0.3) text #3b82f6

---

## Background Textures

| Class | Pattern | Use |
|-------|---------|-----|
| .bg-grid-subtle | 48px white lines 3% opacity | Technical/data sections (Main Apps) |
| .bg-dot-subtle | 32px radial violet dots 15% opacity | Softer sections (Management Websites) |
| Solid void | #09090b | Hero, CTA, clean sections |

No organic shapes. No blob gradients.

---

## Animation

Easing: [0.16, 1, 0.3, 1] (custom spring — fast out, slow settle). Duration 0.5–0.7s.
Entry: opacity 0 y:20 → opacity 1 y:0. Stagger 100ms between items.
No bounce, no elastic.

---

## Site Context: optalocal.com — Opta Home (Management Website)

**Category:** Management Website | **Accent:** Muted Grey/Mixed `#a1a1aa`
**Purpose:** Impress, communicate capability, route to apps. Marketing tone.
Sections: Nav (glass header, orbit ring logo) → Hero (headline + flow diagram) → BenchmarkStrip → Ecosystem (3 primary apps + infra layer) → ArchDiagram (3-layer local arch: Always Local / Local-First / Identity) → ModelGrid → CliPreview (terminal typewriter) → FeatureTrio → CTA → Footer
Key UI: Dot-grid backgrounds, obsidian bento cards, green/amber/violet layer badges.

---

## Site Context: help.optalocal.com — Opta Help (Management Website)

**Category:** Management Website | **Accent:** Muted Grey `#a1a1aa`
**Purpose:** Technical reference documentation. 10+ doc sections with sidebar nav.
Layout: Glass top nav → 3-column docs layout (sidebar / main content / TOC) → footer.
Prose: .prose-opta class for document body. h2 has bottom border. Code = neon cyan inline, dark block.
Components: Callout boxes (amber/green/red variants), CodeBlock (dark bg, neon cyan), StepList, ApiEndpoint, TabGroup, FeatureTable.
Navigation: Left sidebar with section groups. Active state = violet. Inactive = text-muted.
Key: Same color tokens as homepage but docs-optimised — more text-heavy, less animation.

---

## Site Context: learn.optalocal.com — Opta Learn (Management Website)

**Category:** Management Website | **Accent:** Mixed per app (see Per-App table below)
**Purpose:** Search-first guide discovery portal. Bridge between marketing (optalocal.com) and full docs (help).
Tone: Approachable, visual, discoverable. .bg-dot-subtle background.
Key UI: Orbit ring + "learn" wordmark, glass search bar, obsidian-interactive guide cards with per-app color dots.
Guide viewer: Full-screen reader, sticky glass breadcrumb header, prose sections with amber callout + neon-green code blocks.

---

## Site Context: init.optalocal.com — Opta Init (Management Website)

**Category:** Management Website | **Accent:** Neon Amber `#f59e0b`
**Purpose:** Bootstrapping and install flow. Step-by-step onboarding.
Key UI: Conditional states, clear progress steps, amber-accented CTAs.

---

## Site Context: accounts.optalocal.com — Opta Accounts (Management Website)

**Category:** Management Website | **Accent:** Identity Blue `#3b82f6`
**Purpose:** Authentication, identity, and account management.
Key UI: Animated status badges, clear error states (#ef4444), trust-first layout.

---

## Site Context: Opta Local Dashboard (lmx.optalocal.com) — Main Local App

**Category:** Main Local App | **Accent:** Electric Violet `#a855f7`
**Purpose:** Web-based LMX management dashboard. Dense data visibility.
Key UI: Stat cards (`#1E293B` bg, violet icon, JetBrains Mono values), server status hero section, glass backdrop-filter. 8px spacing multiples. Terminal-like density.

---

## Per-App Color Accents (for learn guide cards, badges, and cross-app references)

| App | Accent | Category |
|-----|--------|----------|
| LMX / Opta Local dashboard | #a855f7 violet | Main Local App |
| CLI | #22c55e green | Main Local App |
| Code Desktop | #a855f7 + #06b6d4 | Main Local App |
| Accounts | #3b82f6 blue | Management Website |
| Init | #f59e0b amber | Management Website |
| Help | #a1a1aa grey | Management Website |
| Learn | mixed per-guide app | Management Website |
| Home | #a1a1aa grey | Management Website |
| General / Cross-app | #a1a1aa grey | — |

---

## Opta Local Brand Mark (Orbit Ring)

SVG, 2D. Components:
- Outer circle (stroke #a855f7 opacity 0.6, fill void, glow ring opacity 0.08)
- Tilted ellipse orbit (stroke #a855f7 opacity 0.5, rx:16 ry:7 rotate:-30)
- Center singularity dot (fill white opacity 0.9, bloom rgba(168,85,247,0.2))

Official parent Opta logo: `/design/logos/Opta/opta-logo.png`
Per-app logos: `/design/logos/<app-name>/` — source of truth for all brand marks.

---

## Anti-Patterns — NEVER Generate

| Banned | Correct |
|--------|---------|
| White/light backgrounds | Void black #09090b |
| Full purple-blue gradient washes | Solid void + element-level glow only |
| Floating brain / neural net icons | Circuit, server, terminal, geometric icons |
| Rounded bubble shapes / organic blobs | Grid geometry, 8-16px card rounding |
| "Powered by AI" copy | Specific technical claims |
| Pastel/muted colors | High-contrast on void |
| Neon rainbow accents | Single violet + green/amber/red for state only |
| Generic stock illustration | Technical diagram, engineering aesthetic |
| Heavy shadow on cards | Subtle glow (rgba violet 0.06–0.08 max) |
| .text-moonlight on long phrases | Scope gradient to single keyword/short phrase only |
| Applying Main Local App density to Management Websites | Respect category separation |
| Applying Management Website softness to Main Local Apps | Keep terminal density for core tools |

---

## Image Generation / Editing Guardrails

When generating or editing visuals:
- Keep background in the void range (`#09090b`/`#0c0c12`) unless explicitly overridden.
- Reserve violet for accents/active states; do not flood full backgrounds with purple gradients.
- Prefer technical motifs (terminal grids, architecture diagrams, device silhouettes) over generic AI art tropes.
- Apply correct category aesthetic (dense/terminal for Main Local Apps; structured/readable for Management Websites).
- Export targets:
  - Hero/section artwork: WebP preferred, PNG fallback
  - Logos/marks: SVG where possible, PNG @2x fallback (source: `/design/logos/`)
- Validate final output against contrast and readability in dark mode before handoff.

---

## App Logo System (Canonical — All Apps Share This Template)

All Opta Local app logos share a single locked template. Only two elements vary.

**Locked across every logo:**
- Void black radial background (`#0d0c14` → `#09090b`)
- Gravitational particle field (violet/white, inverse-square density toward centre)
- Outer ring: 3-layer depth (halo → soft → gradient arc `#c084fc`→`#4c1d95` + glow)
- Orbit ellipse with gradient stroke + node dots
- Layered centre bloom + specular flare
- Wordmark: Sora 600 · "opta local" `#71717a` · divider · **app name `#a855f7`**

**Two variables per app:**
1. App name text (e.g. `learn`, `help`, `lmx`, `accounts`, `status`)
2. Inner mark inside the ring (unique glyph per app)

Template source: `/design/logos/opta-logo-template.html`
Full spec: `/design/logos/LOGO-SYSTEM.md`
Canonical render (Opta Learn): `/design/logos/Opta-Learn/opta-learn-logo.png`

# Opta Aesthetic Context — Gemini Injection Document

> Injected at the top of every Gemini 3.1 call. Ensures all visual output stays within the Opta design system.
> Updated: 2026-03-01 — includes both optalocal.com and help.optalocal.com context.

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
| Neon Amber | #f59e0b | Optional/conditional states |
| Neon Red | #ef4444 | Blocked, disabled, errors |
| Neon Cyan | #06b6d4 | Inline code highlights |
| Text Primary | #fafafa | Main body text |
| Text Secondary | #a1a1aa | Subtitles, descriptions |
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
| Sora | UI body, headings, copy | 400 (body) 600 (semi) 700 (bold) |
| JetBrains Mono | Data, stats, code, terminal, labels, badges | 400–600 |

All quantitative data (numbers, percentages, model names, ports, commands) = JetBrains Mono, never Sora.

---

## Headline Treatment (.text-moonlight)

```css
background: linear-gradient(135deg, #ffffff 0%, #ffffff 50%, rgba(168,85,247,0.5) 100%);
-webkit-background-clip: text; -webkit-text-fill-color: transparent;
```
Result: mostly white, subtle violet ghost at end. NOT a full color gradient.

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

---

## Background Textures

| Class | Pattern | Use |
|-------|---------|-----|
| .bg-grid-subtle | 48px white lines 3% opacity | Technical/data sections |
| .bg-dot-subtle | 32px radial violet dots 15% opacity | Softer sections |
| Solid void | #09090b | Hero, CTA, clean sections |

No organic shapes. No blob gradients.

---

## Animation

Easing: [0.16, 1, 0.3, 1] (custom spring — fast out, slow settle). Duration 0.5–0.7s.
Entry: opacity 0 y:20 → opacity 1 y:0. Stagger 100ms between items.
No bounce, no elastic.

---

## Site Context: optalocal.com (brand homepage)

Purpose: Impress, communicate capability, route to apps. Marketing tone.
Sections: Nav (glass header, orbit ring logo) → Hero (headline + flow diagram) → BenchmarkStrip → Ecosystem (3 primary apps + infra layer) → ArchDiagram (3-layer local arch: Always Local / Local-First / Identity) → ModelGrid → CliPreview (terminal typewriter) → FeatureTrio → CTA → Footer
Key UI: Dot-grid backgrounds, obsidian bento cards, green/amber/violet layer badges.

---

## Site Context: help.optalocal.com (documentation hub)

Purpose: Technical reference documentation. 10+ doc sections with sidebar nav.
Layout: Glass top nav → 3-column docs layout (sidebar / main content / TOC) → footer.
Prose: .prose-opta class for document body. h2 has bottom border. Code = neon cyan inline, dark block.
Components: Callout boxes (amber/green/red variants), CodeBlock (dark bg, neon cyan), StepList, ApiEndpoint, TabGroup, FeatureTable.
Navigation: Left sidebar with section groups. Active state = violet. Inactive = text-muted.
Key: Same color tokens as homepage but docs-optimised — more text-heavy, less animation.

---

## Site Context: learn.optalocal.com (new — building now)

Purpose: Search-first guide discovery portal. Simple: logo + search bar → guide cards → full-screen guide reader.
Tone: Bridge between marketing (optalocal.com) and full docs (help.optalocal.com). Approachable, visual.
Key UI: Orbit ring + "learn" wordmark, glass search bar, obsidian-interactive guide cards with per-app color dots.
Guide viewer: Full-screen reader, sticky glass breadcrumb header, prose sections with amber callout + neon-green code blocks.

---

## Per-App Color Accents (used in learn guide cards and badges)

| App | Accent | Use |
|-----|--------|-----|
| LMX | #a855f7 violet | Inference engine |
| CLI | #22c55e green | Command line |
| Accounts | #3b82f6 blue | Identity/auth |
| Init | #f59e0b amber | Onboarding |
| General | #a1a1aa grey | Cross-app content |

---

## Opta Local Brand Mark (Orbit Ring)

SVG, 2D. Components:
- Outer circle (stroke #a855f7 opacity 0.6, fill void, glow ring opacity 0.08)
- Tilted ellipse orbit (stroke #a855f7 opacity 0.5, rx:16 ry:7 rotate:-30)
- Center singularity dot (fill white opacity 0.9, bloom rgba(168,85,247,0.2))

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


## Image Generation / Editing Guardrails (new)

When generating or editing visuals:
- Keep background in the void range (`#09090b`/`#0c0c12`) unless explicitly overridden.
- Reserve violet for accents/active states; do not flood full backgrounds with purple gradients.
- Prefer technical motifs (terminal grids, architecture diagrams, device silhouettes) over generic AI art tropes.
- Export targets:
  - Hero/section artwork: WebP preferred, PNG fallback
  - Logos/marks: SVG where possible, PNG @2x fallback
- Validate final output against contrast and readability in dark mode before handoff.


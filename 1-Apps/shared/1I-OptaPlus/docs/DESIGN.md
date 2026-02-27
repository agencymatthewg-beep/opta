# Cinematic Void Design System

OptaPlus implements the **Cinematic Void** design language — a dark-first, OLED-optimized visual system built around deep black backgrounds, glassmorphism surfaces, and electric neon accents.

---

## Color Palette

### Base (Void)

| Token | Hex | Usage |
|-------|-----|-------|
| `optaVoid` | `#050505` | Main background — deepest black (OLED) |
| `optaSurface` | `#0A0A0A` | Slightly elevated surface |
| `optaElevated` | `#121212` | Raised elements, cards |
| `optaBorder` | `rgba(255,255,255,0.06)` | Subtle outlines |

### Primary (Electric Violet)

| Token | Hex | Usage |
|-------|-----|-------|
| `optaPrimary` | `#8B5CF6` | Brand color — buttons, accents, active states |
| `optaPrimaryGlow` | `#A78BFA` | Brighter accent for glow effects |
| `optaPrimaryDim` | `rgba(139,92,246,0.1)` | Transparent overlay / hover states |

### Neon Accents

| Token | Hex | Usage |
|-------|-----|-------|
| `optaGreen` | `#22C55E` | Success, delivered status |
| `optaBlue` | `#3B82F6` | Info, syntax strings |
| `optaAmber` | `#F59E0B` | Warning, syntax numbers |
| `optaRed` | `#EF4444` | Error, destructive actions |
| `optaCyan` | `#06B6D4` | Links, charts, informational |
| `optaNeonPurple` | `#A855F7` | Secondary purple accent |
| `optaPink` | `#EC4899` | Charts, decorative |
| `optaCoral` | `#F97316` | Charts, warm accent |
| `optaIndigo` | `#6366F1` | Charts, cool accent |

### Text

| Token | Hex | Usage |
|-------|-----|-------|
| `optaTextPrimary` | `#EDEDED` | High-contrast body text |
| `optaTextSecondary` | `#A1A1AA` | Labels, descriptions |
| `optaTextMuted` | `#52525B` | Timestamps, hints, disabled |

### Glass

| Token | Value | Usage |
|-------|-------|-------|
| `optaGlassBackground` | `rgba(10,10,10,0.4)` | Dark translucent fill |
| `optaGlassBorder` | `rgba(255,255,255,0.05)` | Subtle white outline |
| `optaGlassHighlight` | `rgba(255,255,255,0.03)` | Top edge highlight |

### Syntax Highlighting

| Token | Color | Usage |
|-------|-------|-------|
| `optaCodeBackground` | `#080808` | Code block background |
| `optaSyntaxKeyword` | Violet | Language keywords |
| `optaSyntaxString` | Emerald | String literals |
| `optaSyntaxNumber` | Amber | Numeric literals |
| `optaSyntaxType` | Cyan | Type names |
| `optaSyntaxComment` | Gray (0.45) | Comments |
| `optaSyntaxDecorator` | Light violet | Decorators / attributes |
| `optaSyntaxVariable` | Teal | Variables |
| `optaSyntaxOperator` | Soft violet | Operators |

---

## Typography

**Brand typeface:** Sora (falls back to system rounded)

| Token | Size | Weight | Usage |
|-------|------|--------|-------|
| `soraLargeTitle` | 34pt | Bold | Hero banners, splash |
| `soraTitle1` | 28pt | Semibold | Page titles |
| `soraTitle2` | 22pt | Semibold | Section titles |
| `soraTitle3` | 18pt | Semibold | Subsection titles |
| `soraHeadline` | 16pt | Semibold | Prominent headers |
| `soraSubhead` | 15pt | Medium | Secondary headers |
| `soraCallout` | 14pt | Regular | Callout text |
| `soraBody` | 13pt | Regular | Chat messages, prose |
| `soraFootnote` | 11pt | Regular | Footnotes, metadata |
| `soraCaption` | 10pt | Regular | Timestamps, hints |

### Convenience Modifiers

```swift
Text("Body").optaBody()         // 13pt Sora, primary color
Text("Caption").optaCaption()   // 10pt Sora, muted color
Text("Title").optaTitle()       // 28pt Sora semibold, primary color
Text("Header").optaHeadline()   // 16pt Sora semibold, primary color
```

---

## Glass Effects

Three tiers of glassmorphism, increasing in visual weight:

### Subtle (`.glassSubtle()` / `.glassPanel()`)
- Material: `.ultraThinMaterial`
- Corner radius: 12pt
- Border: `optaGlassBorder` at 15% opacity, 0.5pt
- Use: Sidebars, table headers, secondary panels

### Standard (`.glass()` / `.glassCard()`)
- Material: `.thinMaterial`
- Corner radius: 16pt
- Border: `optaGlassBorder` at 20% opacity, 0.5pt
- Use: Message bubbles, cards, dialogs

### Strong (`.glassStrong()` / `.glassSheet()`)
- Material: `.regularMaterial`
- Corner radius: 20pt
- Border: `optaGlassBorder` at 25% opacity, 0.5pt
- Inner glow: Radial gradient of `optaPrimary` at 6% opacity
- Shadow: Black at 25% opacity, 16pt radius, 8pt Y offset
- Use: Modals, sheets, hero elements

### Pill (`.glassPill()`)
- Material: `.ultraThinMaterial`
- Shape: Capsule
- Border: `optaGlassBorder` at 15% opacity
- Use: Badges, tags, compact indicators

### Glow (`.glassGlow(color:)`)
- Dual shadow: Primary at 30% opacity (24pt), secondary at 12% opacity (48pt)
- Use: Bot accent color identification

### Glow Border (`.glowBorder(color:)`)
- Outer glow: 60% opacity, 3pt blur
- Inner line: 30% opacity, 0.75pt
- Use: Active/selected state highlighting

### Void Fade (`.voidFade(edges:)`)
- Overlaid linear gradients from `optaVoid` → clear
- Default length: 40pt
- Use: Scroll edges, content boundaries

---

## Animation & Motion

All animations respect `accessibilityReduceMotion`. When enabled, animations are instant or skipped.

### Spring Tokens

| Token | Response | Damping | Usage |
|-------|----------|---------|-------|
| `.optaSpring` | 0.3s | 0.7 | Standard — toggles, expansions, transitions |
| `.optaSnap` | 0.2s | 0.8 | Snappy — button presses, icon swaps |
| `.optaGentle` | 0.5s | 0.85 | Gentle — large layout shifts, full-screen |
| `.optaPulse` | 1.2s | — | Repeating ease-in-out for loading states |

### Motion Modifiers

| Modifier | Effect | Parameters |
|----------|--------|------------|
| `.ambientFloat()` | Continuous Y sine oscillation | amplitude: 3.5pt, period: 4s |
| `.breathe()` | Continuous scale pulse | 0.98–1.02×, period: 3s |
| `.hoverGlow(color:)` | Colored shadow on macOS hover | radius: 20pt, `.optaSnap` transition |
| `.gradientFade(edges:)` | Transparency mask at edges | fadeLength: 8% of view |

### Entrance Animations

| Modifier | Effect | Parameters |
|----------|--------|------------|
| `.ignition(delay:)` | Fade + slide up (12pt) + spring | delay: 0s default |
| `.optaEntrance(delay:)` | Fade + slide up (20pt) + scale (0.95) | delay: 0s default |
| `.staggeredIgnition(index:)` | Cascading list entrance | staggerInterval: 0.05s |
| `.optaPulse()` | Repeating opacity pulse (1.0 → 0.5) | 1.2s cycle |
| `.optaExit(isPresented:)` | Fade + slide down (10pt) + scale (0.97) | bound to state |

---

## Component Patterns

### Message Bubble
- Glass card background (`.glass()`)
- Bot accent color glow (`.glassGlow()`)
- Staggered ignition entrance
- Grouped timestamps (collapsed when <60s apart)

### Code Block
- `optaCodeBackground` (`#080808`)
- Language label in `optaTextMuted`
- Copy button on hover (macOS) / tap (iOS)
- Multi-language syntax highlighting

### Thinking Overlay
- Expandable and draggable (macOS)
- Breathing animation on indicator
- Glass strong background

### Command Palette
- Glass strong sheet
- Fuzzy text search
- Keyboard navigable (↑↓ + Enter)

### Corner Radius Scale

| Context | Radius |
|---------|--------|
| Large panels, sheets | 20–24pt |
| Cards, message bubbles | 16pt |
| Small elements, pills | 12pt |
| Badges, capsules | Capsule (full) |

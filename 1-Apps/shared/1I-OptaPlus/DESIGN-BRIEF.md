# OptaPlus Design Brief
*Compiled: 2026-02-13 — from 7-site interactive preference discovery*
*Integrated with Opta Design System (Cinematic Void theme)*

---

## 🎯 Design Identity: "Cinematic Void"

OptaPlus lives in darkness. Content emerges from a void — glowing, floating, alive. Every element breathes. Nothing is static. The aesthetic is **premium developer luxury** — not friendly, not playful, not corporate. Think Resend meets Raycast in a space station.

**Brand font:** Sora (geometric, modern) — falls back to SF Rounded
**Brand color:** Electric Violet `#8B5CF6`
**Background:** Void `#050505` (OLED-optimized, near-black)
**Motion:** Spring physics only (`.optaSpring`, `.optaSnap`, `.optaGentle`)
**Glass:** `.ultraThinMaterial` / `.thinMaterial` / `.regularMaterial` with graduated opacity

---

## 🏆 Reference Hierarchy (by Matthew's preference)

| Rank | Site | Rating | Key Influence |
|------|------|--------|---------------|
| 1 | **Resend.com** | ⭐⭐⭐ FAVOURITE | Pure void, 3D objects, purple accent, premium quality |
| 2 | **Raycast.com** | ⭐⭐ | Color illumination, pill nav, hover glow, brand-adaptive cards |
| 3 | **Lusion.co** | ⭐⭐ | Scroll dynamics, interaction animations, preloading splash |
| 4 | **Linear.app** | ⭐ | Centralized layout, gradient-to-void edges, minimalism |
| 5 | **Nothing.tech** | ⭐ selective | Space backgrounds, full-screen usage, dot-matrix character |
| 6 | **Stripe.com** | ⭐ selective | Per-element micro-animations, moving backgrounds |
| 7 | **Texts.com** | ❌ WORST | Everything to avoid — light, blue, generic, average |

---

## 🎨 Color System (Opta Design Tokens)

### Core Palette (from `Colors.swift`)
| Token | SwiftUI | Hex | Usage |
|-------|---------|-----|-------|
| `optaVoid` | `Color.optaVoid` | `#050505` | Main background — deepest black |
| `optaSurface` | `Color.optaSurface` | `#0A0A0A` | Slightly elevated surfaces |
| `optaElevated` | `Color.optaElevated` | `#121212` | Raised elements, cards |
| `optaPrimary` | `Color.optaPrimary` | `#8B5CF6` | Brand — Electric Violet |
| `optaPrimaryGlow` | `Color.optaPrimaryGlow` | `#A78BFA` | Brighter accent, glow source |
| `optaPrimaryDim` | `Color.optaPrimaryDim` | `#8B5CF6` @ 10% | Hover/active tint |
| `optaTextPrimary` | `Color.optaTextPrimary` | `#EDEDED` | High-contrast text |
| `optaTextSecondary` | `Color.optaTextSecondary` | `#A1A1AA` | Muted labels |
| `optaTextMuted` | `Color.optaTextMuted` | `#52525B` | Timestamps, hints |
| `optaBorder` | `Color.optaBorder` | `white` @ 6% | Subtle outlines |

### Neon Accent Palette
| Token | Hex | Usage |
|-------|-----|-------|
| `optaGreen` | `#22C55E` | Success, delivered, positive |
| `optaBlue` | `#3B82F6` | Info, links |
| `optaAmber` | `#F59E0B` | Warning, caution |
| `optaRed` | `#EF4444` | Error, destructive |
| `optaCyan` | `#06B6D4` | Charts, informational |
| `optaCoral` | `#F97316` | Warm accent (Opta Max) |
| `optaPink` | `#EC4899` | Decorative |
| `optaIndigo` | `#6366F1` | Secondary cool |

### Glass Tokens
| Token | Value | Usage |
|-------|-------|-------|
| `optaGlassBackground` | `#0A0A0A` @ 40% | Dark translucent fill |
| `optaGlassBorder` | `white` @ 5% | Subtle glass edge |
| `optaGlassHighlight` | `white` @ 3% | Top-edge light catch |

### Bot-Adaptive Colors (from Raycast influence)
Each bot gets its own accent that tints UI elements — using existing neon palette:
| Bot | Token | Hex | Glow |
|-----|-------|-----|------|
| Opta Max | `optaCoral` | `#F97316` | Orange glow |
| Opta512 | `optaPrimary` | `#8B5CF6` | Violet glow |
| Mono | `optaGreen` | `#22C55E` | Green glow |
| Floda | `optaAmber` | `#F59E0B` | Yellow glow |
| Saturday | `optaBlue` | `#3B82F6` | Blue glow |
| YJ | `optaAmber` | `#F59E0B` | Amber glow |

---

## 🔲 Layout Principles

### 1. Centralized Composition
- Content gravitates to center, not edge-to-edge
- Messages centered (not left/right aligned)
- Max-width containers with generous margins
- Elements "float" in the void

### 2. Full-Screen Utilization
- Use every pixel — no wasted space
- Edge-to-edge on mobile (content reaches screen edges)
- macOS: full window coverage, minimal chrome
- Backgrounds extend to all edges even if content is centered

### 3. Gradient-to-Void Edges
- No hard borders on panels/images
- Content dissolves into darkness via gradient masks
- Cards fade at edges rather than having visible boundaries
- "Emerge from darkness" — content appears to float out of the void

### 4. Generous Negative Space
- Sections breathe — never cramped
- Whitespace (actually "blackspace") is a feature, not waste
- Premium = restraint

---

## 🌊 Motion System (CORE REQUIREMENT)

Motion is the #1 priority. A beautiful but static UI would be unacceptable.

### Hierarchy of Motion
1. **Background** — Always subtly moving (particles, gradient shifts, ambient glow)
2. **Elements** — Each has its own life (subtle idle animations)
3. **Interactions** — Respond to hover/touch/scroll with glow, lift, scale
4. **Transitions** — Smooth state changes, no hard cuts

### Required Animation Types
| Type | Description | Reference |
|------|-------------|-----------|
| **Ambient background** | Subtle particle field or gradient shift, always moving | Nothing.tech starfield |
| **3D hero objects** | Rotating/floating 3D elements, constantly moving | Resend.com cube/sphere |
| **Hover glow** | Elements illuminate on hover/proximity | Raycast icon bar |
| **Scroll-driven** | Elements shift/transform based on scroll position | Lusion.co |
| **Per-element micro** | Each card/button/panel has independent subtle motion | Stripe.com cards |
| **Gradient-to-void dissolve** | Content edges fade with animated gradient | Linear.app |
| **Spring physics** | All transitions use spring (never duration-based) | Existing OptaPlus system |

### Loading Screen
- Preload all assets before showing content
- Animated splash with Opta "O" brand mark (3D rotating, violet glow)
- Smooth transition from loading → content (fade/reveal)
- Never show partial/janky load state

### Animation Tokens (from `Animations.swift`)
| Token | Response | Damping | Usage |
|-------|----------|---------|-------|
| `.optaSpring` | 0.3s | 0.7 | General — toggles, expansion, transitions |
| `.optaSnap` | 0.2s | 0.8 | Quick — button presses, icon swaps |
| `.optaGentle` | 0.5s | 0.85 | Large — layout shifts, full-screen transitions |

All respect `accessibilityReduceMotion` via existing `IgnitionModifier`.

### Entrance Animations (from `ViewModifiers.swift`)
| Modifier | Effect | Usage |
|----------|--------|-------|
| `.ignition()` | Fade + slide up with spring | Single element entrance |
| `.staggeredIgnition(index:)` | Cascading entrance (0.05s intervals) | List items, message history |

### New Motion Modifiers Needed
| Modifier | Effect | Reference |
|----------|--------|-----------|
| `.ambientFloat()` | Subtle continuous Y oscillation | Resend 3D objects |
| `.hoverGlow(color:)` | Glow intensifies on hover | Raycast icon bar |
| `.scrollParallax(speed:)` | Element moves at different rate than scroll | Lusion scroll dynamics |
| `.breathe()` | Subtle scale pulse (0.98 → 1.02) | Idle state for living UI |
| `.gradientFade(edges:)` | Content dissolves at edges | Linear gradient-to-void |

---

## 🧊 Glass & Surface System (from `ViewModifiers.swift`)

### Glass Tiers (existing modifiers)
| Modifier | Material | Corner Radius | Border | Shadow | Usage |
|----------|----------|---------------|--------|--------|-------|
| `.glassSubtle()` | `.ultraThinMaterial` | 12pt | 0.5px @ 25% | None | Table headers, secondary panels |
| `.glass()` | `.thinMaterial` | 16pt | 1px @ 40% | None | Message bubbles, dialogs |
| `.glassStrong()` | `.regularMaterial` | 20pt | 1.5px @ 60% | 16px blur, 8px Y | Modals, hero elements |

### Surface Rules
- Glass surfaces should feel like they're **floating** in the void, not sitting on a plane
- Depth via shadow + blur, not border/outline
- Inner content slightly brighter than outer edges (center glow)
- **Gradient-to-void fade** at panel edges preferred over hard borders (Linear influence)
- Use `optaGlassBackground` for custom translucent fills when material doesn't suit

---

## ✏️ Typography (Sora Design System)

**Brand Font:** Sora — geometric sans-serif
**Fallback:** SF Rounded (system, closest visual match)
**Implementation:** `Font.sora(_ size:, weight:)` in `Typography.swift`

### Existing Presets
| Preset | Token | Size | Weight |
|--------|-------|------|--------|
| Body | `.soraBody` | 15pt | Regular |
| Caption | `.soraCaption` | 12pt | Regular |
| Headline | `.soraHeadline` | 20pt | Semibold |

### Extended Hierarchy (new for OptaPlus)
| Level | Code | Size (macOS) | Size (iOS) | Weight | Style |
|-------|------|-------------|------------|--------|-------|
| Hero | `.sora(48, weight: .bold)` | 48-64pt | 32-40pt | Bold | Gradient fill (Moonlight) |
| Title | `.sora(28, weight: .semibold)` | 28-32pt | 24-28pt | Semibold | Standard |
| Headline | `.soraHeadline` | 20pt | 20pt | Semibold | Standard |
| Subhead | `.sora(17, weight: .medium)` | 17pt | 17pt | Medium | Standard |
| Body | `.soraBody` | 15pt | 15pt | Regular | Standard |
| Caption | `.soraCaption` | 12pt | 12pt | Regular | `optaTextMuted` |
| Accent | `.sora(_, weight: .medium)` | Variable | Variable | Medium Italic | `optaPrimary` or gradient |

### Typography Rules
- **Sora everywhere** — brand consistency across all Opta apps
- **Mixed weight hierarchy** — Bold hero → Semibold title → Regular body (clear visual levels)
- **Italic accent text** for emphasis words — Resend "tonight" influence
- **Gradient hero text** (Moonlight: white → violet → indigo) for brand elements
- **Bold, confident headings** — large, centered, never shrunk — Lusion influence
- **No system font mixing** — Sora or fallback only, never mix with SF Pro serif

---

## 🤖 3D Elements (CORE REQUIREMENT)

### Bot Avatars
- Replace flat emoji with **3D rendered icons** per bot
- Each bot has a unique 3D object with their brand color
- Objects rotate/float constantly (subtle idle animation)
- Glow/reflection in bot's accent color

### Possible 3D Treatments
| Element | 3D Treatment |
|---------|-------------|
| Bot avatars | Rotating 3D icons (like Resend's cube/sphere) |
| Empty chat state | Floating 3D scene |
| Loading state | 3D brand mark animation |
| Settings/onboarding | Interactive 3D elements |

### Implementation in SwiftUI
- SceneKit or RealityKit for 3D rendering
- `.usdz` models for bot avatars
- Continuous rotation animation
- Subtle reflection/environment mapping

---

## 📱 Platform-Specific

### macOS
- Full window utilization — sidebar + chat fill the window
- Custom titlebar (transparent, integrated with content)
- Pill-shaped navigation elements
- Hover states with glow everywhere
- Keyboard shortcut badges in UI

### iOS
- Edge-to-edge dark background
- Full-screen utilization
- Swipe gestures for navigation (bot switching, session drawer)
- Haptic feedback on interactions
- Respect safe areas but visually extend beyond them

---

## ❌ Anti-Patterns (What NOT to Do)

- ❌ Light/white backgrounds
- ❌ Bright blue as primary (reads as "generic tech")
- ❌ Hard borders/outlines on cards
- ❌ Static UI without motion
- ❌ Cramped layouts without breathing room
- ❌ Friendly/playful aesthetic (OptaPlus is premium/serious)
- ❌ Boxy/closed elements (everything should float/blend)
- ❌ Duration-based animations (spring physics only)
- ❌ Partial/janky loading states

---

## 📐 Component Specifications

### Message Bubbles
- User: Violet gradient glass, centered, 65% max width
- Bot: Dark glass, centered, 75% default / 92% for code/tables
- No hard borders — gradient edge fade
- Floating shadow beneath
- Appear with spring animation

### Sidebar
- Dark glass surface
- Bot rows with 3D avatar, name, status glow
- Active bot highlighted with accent glow
- Bot-specific accent color tinting

### Input Bar
- Glass surface at bottom
- Rounded/pill-shaped text field
- Send button with accent glow on hover
- Session mode indicator (subtle pill badge)

### Thinking Overlay
- Floating glass panel, bottom-left
- Pulsing brain icon with glow
- Event timeline with fade-in items
- Click-through (non-blocking)

### Context Panel
- Floating pill trigger, top-right
- Expandable glass panel
- Grouped items with flow layout pills
- Hover reveals size/detail

---

---

## 🔗 Cross-Platform Consistency (Opta Ecosystem)

OptaPlus shares design tokens with the entire Opta app ecosystem:

### SwiftUI (iOS + macOS — OptaPlus, Opta Scan, Opta Life iOS)
- Colors: `Color.opta*` tokens from `Colors.swift`
- Typography: `Font.sora()` from `Typography.swift`
- Glass: `.glassSubtle()`, `.glass()`, `.glassStrong()` modifiers
- Motion: `.optaSpring`, `.optaSnap`, `.optaGentle` animations
- Entrance: `.ignition()`, `.staggeredIgnition()` modifiers

### Web (Opta Life, AICompare, Optamize Website)
- Colors: CSS variables (`--primary`, `--background`, etc.)
- Typography: Sora font (Google Fonts / self-hosted)
- Glass: `.glass`, `.glass-subtle`, `.glass-strong` CSS classes
- Motion: Framer Motion (never CSS transitions)
- Icons: Lucide React only

### Border Radius Scale
| Size | Radius | Usage |
|------|--------|-------|
| Small | 12pt | Inputs, pills, captions |
| Medium | 16pt | Cards, bubbles, buttons |
| Large | 20pt | Modals, panels |
| XL | 24pt | Hero sections, full panels |

### Design System Transition Note
| Old Name | New Name | Status |
|----------|----------|--------|
| "Obsidian Glassmorphism" | "Cinematic Void" | Active theme |
| `optaPurple` (#A855F7) | `optaPrimary` (#8B5CF6) | Deprecated → use new |
| Duration-based animation | Spring physics only | Enforced |

---

*This brief is the source of truth for all OptaPlus visual decisions. Every component, every animation, every color choice should trace back to this document and the Opta design system tokens in `OptaMolt/DesignSystem/`.*

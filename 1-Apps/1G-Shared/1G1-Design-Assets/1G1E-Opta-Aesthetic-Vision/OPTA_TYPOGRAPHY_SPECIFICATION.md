# Opta Typography Specification

> **Purpose**: This document is the authoritative reference for all typography used in Opta products. It defines the official "Opta Font" styling that must be used consistently across all platforms.

---

## 1. Primary Font: Sora

### 1.1 Font Family

```css
font-family: 'Sora', -apple-system, BlinkMacSystemFont, sans-serif;
```

**Google Fonts Import:**
```css
@import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&display=swap');
```

**HTML Link:**
```html
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&display=swap" rel="stylesheet">
```

### 1.2 Why Sora

| Quality | Description |
|---------|-------------|
| **Geometric** | Clean, modern letterforms with geometric foundations |
| **Technical** | Feels precise and technological without being cold |
| **Readable** | Excellent legibility at all sizes |
| **Versatile** | Works for both UI and display typography |
| **Premium** | Conveys sophistication without being pretentious |

---

## 2. The "Opta Hero" Typography Style

This is the signature Opta heading style — used for major titles, hero text, and brand moments.

### 2.1 Visual Reference

```
╔══════════════════════════════════════════════════════════════════════╗
║                                                                       ║
║                      ┌──────────────────────┐                        ║
║                      │ SPECIFICATION v2.1   │  ← Badge               ║
║                      └──────────────────────┘                        ║
║                                                                       ║
║              R I N G   E V O L U T I O N                             ║
║              ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲                            ║
║              │                            │                          ║
║              │  Moonlight Gradient        │                          ║
║              │  (White → Purple → Indigo) │                          ║
║              │                            │                          ║
║              └────────────────────────────┘                          ║
║                                                                       ║
║              T H E   N E W   O P T A   R I N G   D E S I G N         ║
║              ↑                                                        ║
║              Subtitle (Light, Wide Tracking)                         ║
║                                                                       ║
║                      ════════════════                                ║
║                      ↑ Neon accent line                              ║
║                                                                       ║
╚══════════════════════════════════════════════════════════════════════╝
```

### 2.2 Hero Heading Specifications

```css
.opta-hero-heading {
    /* Font */
    font-family: 'Sora', sans-serif;
    font-size: 3.5rem;           /* 56px at base */
    font-weight: 700;            /* Bold */
    letter-spacing: 0.12em;      /* Wide tracking */
    line-height: 1.1;

    /* Moonlight Gradient Fill */
    background: linear-gradient(
        180deg,
        #fafafa 0%,              /* White at top */
        #a855f7 50%,             /* Electric Violet mid */
        #6366f1 100%             /* Indigo at bottom */
    );
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;

    /* Glow Effect */
    text-shadow: 0 0 80px rgba(139, 92, 246, 0.5);
}
```

| Property | Value | Notes |
|----------|-------|-------|
| Font Family | Sora | Primary, with system fallbacks |
| Font Size | 3.5rem (56px) | Scale down for smaller contexts |
| Font Weight | 700 (Bold) | Always bold for hero headings |
| Letter Spacing | 0.12em | Wide, but not extreme |
| Line Height | 1.1 | Tight for display text |
| Gradient | White → Purple → Indigo | "Moonlight" gradient |
| Text Shadow | Purple glow, 80px blur | Creates atmospheric halo |

### 2.3 Moonlight Gradient Colors

```css
/* The exact Moonlight gradient stops */
--moonlight-start: #fafafa;     /* Pure white */
--moonlight-mid: #a855f7;       /* Electric Violet (Tailwind purple-500) */
--moonlight-end: #6366f1;       /* Indigo (Tailwind indigo-500) */
```

**Gradient Direction:** Top to bottom (180deg) — light at top, darker at bottom, mimicking overhead lighting.

---

## 3. The "Opta Subtitle" Typography Style

Used beneath hero headings for secondary context.

### 3.1 Subtitle Specifications

```css
.opta-subtitle {
    /* Font */
    font-family: 'Sora', sans-serif;
    font-size: 1.1rem;           /* 17.6px at base */
    font-weight: 300;            /* Light */
    letter-spacing: 0.25em;      /* Very wide tracking */
    text-transform: uppercase;

    /* Color */
    color: #a1a1aa;              /* text-secondary */
}
```

| Property | Value | Notes |
|----------|-------|-------|
| Font Family | Sora | Same as heading |
| Font Size | 1.1rem (17.6px) | Smaller than heading |
| Font Weight | 300 (Light) | Thin, elegant |
| Letter Spacing | 0.25em | Very wide — defines the style |
| Text Transform | uppercase | Always caps |
| Color | #a1a1aa | Muted secondary text |

---

## 4. The "Opta Badge" Typography Style

Used for version numbers, tags, and small labels.

### 4.1 Badge Specifications

```css
.opta-badge {
    /* Font */
    font-family: 'Sora', sans-serif;
    font-size: 0.8rem;           /* 12.8px at base */
    font-weight: 400;            /* Regular */
    letter-spacing: 0.15em;      /* Wide tracking */

    /* Color */
    color: #8b5cf6;              /* Electric Violet (primary) */

    /* Container */
    display: inline-block;
    padding: 6px 16px;
    background: linear-gradient(
        135deg,
        rgba(139, 92, 246, 0.2),
        rgba(59, 130, 246, 0.1)
    );
    border: 1px solid rgba(139, 92, 246, 0.4);
    border-radius: 100px;        /* Pill shape */
}
```

| Property | Value | Notes |
|----------|-------|-------|
| Font Size | 0.8rem | Small |
| Font Weight | 400 | Regular |
| Letter Spacing | 0.15em | Wide but not extreme |
| Color | #8b5cf6 | Primary purple |
| Background | Purple gradient, 20% opacity | Glass effect |
| Border | Purple, 40% opacity | Subtle definition |
| Border Radius | 100px | Full pill shape |

---

## 5. Typography Hierarchy

### 5.1 Complete Scale

| Level | Name | Size | Weight | Tracking | Use Case |
|-------|------|------|--------|----------|----------|
| H1 | Hero | 3.5rem | 700 | 0.12em | Page titles, brand moments |
| H2 | Section | 1.75rem | 600 | 0.08em | Section headers |
| H3 | Subsection | 1.25rem | 600 | 0.05em | Card titles, subsections |
| H4 | Label | 1rem | 500 | 0.1em | Labels, small headings |
| Body | Paragraph | 1rem | 400 | normal | Main content |
| Small | Caption | 0.875rem | 400 | normal | Captions, metadata |
| Tiny | Badge | 0.8rem | 400 | 0.15em | Tags, version numbers |
| Subtitle | Subtitle | 1.1rem | 300 | 0.25em | Under hero headings |

### 5.2 CSS Variables

```css
:root {
    /* Font Family */
    --font-primary: 'Sora', -apple-system, BlinkMacSystemFont, sans-serif;

    /* Font Sizes */
    --text-hero: 3.5rem;
    --text-h2: 1.75rem;
    --text-h3: 1.25rem;
    --text-h4: 1rem;
    --text-body: 1rem;
    --text-small: 0.875rem;
    --text-tiny: 0.8rem;
    --text-subtitle: 1.1rem;

    /* Font Weights */
    --weight-light: 300;
    --weight-regular: 400;
    --weight-medium: 500;
    --weight-semibold: 600;
    --weight-bold: 700;

    /* Letter Spacing */
    --tracking-hero: 0.12em;
    --tracking-wide: 0.08em;
    --tracking-subtitle: 0.25em;
    --tracking-badge: 0.15em;
    --tracking-normal: normal;

    /* Moonlight Gradient */
    --gradient-moonlight: linear-gradient(180deg, #fafafa 0%, #a855f7 50%, #6366f1 100%);
}
```

---

## 6. SwiftUI Implementation

### 6.1 Font Extension

```swift
import SwiftUI

extension Font {
    /// Primary Opta font - Sora
    /// Falls back to SF Pro if Sora not available
    static func opta(size: CGFloat, weight: Font.Weight = .regular) -> Font {
        // If Sora is bundled in the app:
        // return .custom("Sora", size: size).weight(weight)

        // Using system font with Sora-like characteristics:
        return .system(size: size, weight: weight, design: .default)
    }

    /// Hero heading style
    static var optaHero: Font {
        .opta(size: 44, weight: .bold)
    }

    /// Subtitle style
    static var optaSubtitle: Font {
        .opta(size: 13, weight: .light)
    }

    /// Badge style
    static var optaBadge: Font {
        .opta(size: 11, weight: .regular)
    }
}
```

### 6.2 Text Styles

```swift
extension View {
    /// Apply Opta Hero heading style with moonlight gradient
    func optaHeroStyle() -> some View {
        self
            .font(.system(size: 44, weight: .bold))
            .tracking(6)  // 0.12em equivalent
            .foregroundStyle(
                LinearGradient(
                    colors: [
                        .white,
                        Color(hex: 0xA855F7),  // Electric Violet
                        Color(hex: 0x6366F1)   // Indigo
                    ],
                    startPoint: .top,
                    endPoint: .bottom
                )
            )
            .shadow(color: Color(hex: 0x8B5CF6).opacity(0.5), radius: 40)
    }

    /// Apply Opta Subtitle style
    func optaSubtitleStyle() -> some View {
        self
            .font(.system(size: 13, weight: .light))
            .tracking(4)  // 0.25em equivalent (wider)
            .textCase(.uppercase)
            .foregroundColor(Color(hex: 0xA1A1AA))
    }
}
```

---

## 7. Section Header Style

Used for glass panel section headers with neon accent line.

### 7.1 Specifications

```css
.opta-section-header {
    display: flex;
    align-items: center;
    gap: 20px;
}

.opta-section-header h2 {
    font-family: 'Sora', sans-serif;
    font-size: 1.75rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    white-space: nowrap;

    /* Gradient text */
    background: linear-gradient(90deg, #fafafa, #8b5cf6);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
}

.opta-section-header .line {
    flex: 1;
    height: 1px;
    background: linear-gradient(90deg, #8b5cf6, transparent);
    box-shadow: 0 0 15px #8b5cf6;
}
```

---

## 8. Accent Line / Divider

The glowing line beneath hero text.

```css
.opta-accent-line {
    width: 200px;
    height: 2px;
    margin: 40px auto 0;
    background: linear-gradient(90deg, transparent, #8b5cf6, transparent);
    box-shadow: 0 0 20px #8b5cf6;
}
```

---

## 9. Quick Reference Card

```
╔══════════════════════════════════════════════════════════════════════╗
║                    OPTA TYPOGRAPHY QUICK REFERENCE                    ║
╠══════════════════════════════════════════════════════════════════════╣
║                                                                       ║
║  FONT FAMILY                                                         ║
║  ───────────                                                         ║
║  Primary: Sora (Google Fonts)                                        ║
║  Fallback: -apple-system, BlinkMacSystemFont, sans-serif             ║
║                                                                       ║
║  HERO HEADING                                                        ║
║  ────────────                                                        ║
║  Size: 3.5rem (56px)    Weight: 700 (Bold)                          ║
║  Tracking: 0.12em       Gradient: Moonlight (↓)                      ║
║                                                                       ║
║  MOONLIGHT GRADIENT                                                  ║
║  ──────────────────                                                  ║
║  #fafafa (White) → #a855f7 (Violet) → #6366f1 (Indigo)              ║
║  Direction: 180deg (top to bottom)                                   ║
║                                                                       ║
║  SUBTITLE                                                            ║
║  ────────                                                            ║
║  Size: 1.1rem (17.6px)  Weight: 300 (Light)                         ║
║  Tracking: 0.25em       Transform: uppercase                         ║
║  Color: #a1a1aa                                                      ║
║                                                                       ║
║  BADGE                                                               ║
║  ─────                                                               ║
║  Size: 0.8rem (12.8px)  Weight: 400 (Regular)                       ║
║  Tracking: 0.15em       Color: #8b5cf6                              ║
║  Border: 1px rgba(139, 92, 246, 0.4)                                ║
║  Background: Purple gradient glass @ 20% opacity                     ║
║                                                                       ║
║  SECTION HEADER                                                      ║
║  ──────────────                                                      ║
║  Size: 1.75rem (28px)   Weight: 600 (Semibold)                      ║
║  Tracking: 0.08em       Gradient: White → Purple (→)                 ║
║  + Neon accent line with glow                                        ║
║                                                                       ║
╚══════════════════════════════════════════════════════════════════════╝
```

---

## 10. Implementation Checklist

When implementing Opta typography, ensure:

- [ ] **Sora font is loaded** (Google Fonts or bundled)
- [ ] **Hero headings use Moonlight gradient** (180deg, white → violet → indigo)
- [ ] **Letter spacing matches spec** (hero: 0.12em, subtitle: 0.25em)
- [ ] **Subtitles are uppercase and light weight** (300)
- [ ] **Badges use pill shape** with purple glass background
- [ ] **Section headers have neon accent line** with glow
- [ ] **Text shadows use purple glow** (rgba(139, 92, 246, 0.5))
- [ ] **Fallback fonts specified** for system compatibility

---

*Document Version: 1.0*
*Last Updated: January 2026*
*For use with: All Opta products and documentation*

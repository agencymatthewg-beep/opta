# Opta Design System

> **NON-NEGOTIABLE**: All UI, UX, styling, and design decisions in Opta MUST follow this design system. No exceptions.

## Core Design Principles

| Principle | Requirement |
|-----------|-------------|
| **Mood** | Immersed, focused, simplistic, futuristic |
| **Style** | Glassmorphism with medium frost (50-70% opacity) |
| **Colors** | Purple & Violet palette ONLY |
| **Animations** | Rich & dynamic using Framer Motion |
| **Typography** | Sora font family exclusively |
| **Icons** | Lucide React icons ONLY |
| **Inspiration** | Apple Music / Spotify smoothness |

---

## Required Dependencies

All UI work MUST use these installed packages:

```json
{
  "framer-motion": "^11.x",
  "@fontsource/sora": "^5.x",
  "lucide-react": "^0.x",
  "class-variance-authority": "^0.x",
  "clsx": "^2.x",
  "tailwind-merge": "^2.x"
}
```

---

## Color Palette (MANDATORY)

### CSS Variables (defined in `src/index.css`)

```css
/* Primary Purple Spectrum - USE THESE ONLY */
--primary: 270 80% 60%;           /* Rich violet - main actions */
--primary-foreground: 0 0% 100%;  /* White text on primary */
--accent: 280 70% 65%;            /* Electric violet - highlights */

/* Background & Surfaces */
--background: 260 30% 8%;         /* Deep purple-black */
--foreground: 0 0% 98%;           /* Near-white text */
--card: 260 25% 12%;              /* Elevated surfaces */
--muted: 260 20% 18%;             /* Subtle backgrounds */
--muted-foreground: 260 10% 60%; /* Secondary text */

/* Semantic Colors */
--success: 160 70% 45%;           /* Green for positive states */
--warning: 45 90% 55%;            /* Amber for caution */
--danger: 0 75% 55%;              /* Red for errors/critical */

/* Borders & Effects */
--border: 260 20% 25%;            /* Subtle borders */
--ring: 270 80% 60%;              /* Focus rings */

/* Glow Effects */
--glow-primary: 270 100% 65%;
--glow-success: 160 100% 50%;
--glow-warning: 45 100% 60%;
--glow-danger: 0 100% 60%;
```

### Usage Rules

1. **NEVER** use arbitrary colors outside this palette
2. **NEVER** use hex values directly - use CSS variables via Tailwind
3. **ALWAYS** use semantic color names (`text-primary`, `bg-card`, etc.)

---

## Glass Effect Classes (MANDATORY)

### Three Tiers of Glass

```css
/* Standard glass - most components */
.glass {
  @apply bg-card/60 backdrop-blur-xl border border-border/30;
}

/* Subtle glass - nested elements, inputs */
.glass-subtle {
  @apply bg-card/40 backdrop-blur-lg border border-border/20;
}

/* Strong glass - modals, overlays */
.glass-strong {
  @apply bg-card/80 backdrop-blur-2xl border border-border/40;
}
```

### Usage Rules

1. **ALWAYS** use `.glass`, `.glass-subtle`, or `.glass-strong` for panels
2. **NEVER** use solid backgrounds on interactive surfaces
3. **ALWAYS** include `backdrop-blur` for glass effects
4. **ALWAYS** use semi-transparent borders (`border-border/30`)

---

## Typography (MANDATORY)

### Font Family

```css
font-family: 'Sora', system-ui, sans-serif;
```

### Type Scale

| Element | Class | Weight |
|---------|-------|--------|
| Page Title | `text-2xl font-bold` | 700 |
| Section Header | `text-lg font-semibold` | 600 |
| Card Title | `text-sm font-semibold` | 600 |
| Body Text | `text-sm` | 400 |
| Small/Caption | `text-xs` | 400 |
| Label | `text-xs font-medium uppercase tracking-widest` | 500 |

### Gradient Text (for headings)

```tsx
<h1 className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
  Title
</h1>
```

### Rules

1. **NEVER** use fonts other than Sora
2. **ALWAYS** use the defined type scale
3. **ALWAYS** use gradient text for page titles

---

## Icons (MANDATORY)

### Library: Lucide React ONLY

```tsx
import { IconName } from 'lucide-react';
```

### Standard Sizing

| Context | Size | strokeWidth |
|---------|------|-------------|
| Page header icon | `w-5 h-5` | 1.75 |
| Card/section icon | `w-4 h-4` | 1.75 |
| Inline with text | `w-3.5 h-3.5` | 1.5 |
| Large decorative | `w-7 h-7` to `w-8 h-8` | 1.5 |

### Example

```tsx
<SettingsIcon className="w-5 h-5 text-primary" strokeWidth={1.75} />
```

### Rules

1. **NEVER** use inline SVGs
2. **NEVER** use icon libraries other than Lucide
3. **ALWAYS** set appropriate `strokeWidth`
4. **ALWAYS** use semantic colors for icons

---

## Animations (MANDATORY)

### Library: Framer Motion ONLY

```tsx
import { motion, AnimatePresence } from 'framer-motion';
```

### Standard Animation Patterns

#### Page/Section Entry
```tsx
<motion.div
  initial={{ opacity: 0, y: 12 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ delay: 0.1 }}
>
```

#### Staggered List Items
```tsx
{items.map((item, index) => (
  <motion.div
    key={item.id}
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: index * 0.03 }}
  />
))}
```

#### Hover Effects
```tsx
<motion.div
  whileHover={{ y: -3, scale: 1.01 }}
  whileTap={{ scale: 0.99 }}
>
```

#### Exit Animations (use AnimatePresence)
```tsx
<AnimatePresence mode="wait">
  {show && (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
    />
  )}
</AnimatePresence>
```

#### Value Transitions (counters, meters)
```tsx
<motion.span
  key={value}
  initial={{ opacity: 0, y: -10 }}
  animate={{ opacity: 1, y: 0 }}
>
  {value}
</motion.span>
```

### Rules

1. **NEVER** use CSS transitions for complex animations
2. **ALWAYS** use Framer Motion for all animations
3. **ALWAYS** use `AnimatePresence` for exit animations
4. **ALWAYS** stagger list item animations
5. **ALWAYS** add hover/tap feedback to interactive elements

---

## Component Patterns (MANDATORY)

### Card Structure

```tsx
<motion.div
  className="glass rounded-xl border border-border/30 overflow-hidden"
  initial={{ opacity: 0, y: 12 }}
  animate={{ opacity: 1, y: 0 }}
>
  {/* Header */}
  <div className="px-4 py-3 border-b border-border/20">
    <h3 className="text-sm font-semibold">Title</h3>
  </div>

  {/* Content */}
  <div className="p-4">
    {/* ... */}
  </div>
</motion.div>
```

### Button Styles

```tsx
// Primary action
<Button className="gap-1.5 rounded-xl bg-gradient-to-r from-primary to-accent">
  <Icon className="w-4 h-4" />
  Action
</Button>

// Secondary/outline
<Button variant="outline" className="gap-1.5 glass-subtle rounded-xl border-border/30">
  <Icon className="w-4 h-4" />
  Action
</Button>

// Ghost
<Button variant="ghost" className="gap-1.5 rounded-xl">
  <Icon className="w-4 h-4" />
  Action
</Button>
```

### Input Fields

```tsx
<input
  className={cn(
    'w-full px-4 py-2.5 rounded-xl',
    'glass-subtle border border-border/30',
    'text-sm text-foreground placeholder:text-muted-foreground/50',
    'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50',
    'transition-all duration-200'
  )}
/>
```

### Badges/Pills

```tsx
// Status badge
<span className={cn(
  'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
  'bg-primary/15 text-primary border border-primary/30'
)}>
  <Icon className="w-3.5 h-3.5" />
  Label
</span>

// Success variant
<span className="bg-success/15 text-success border border-success/30">

// Warning variant
<span className="bg-warning/15 text-warning border border-warning/30">

// Danger variant
<span className="bg-danger/15 text-danger border border-danger/30">
```

### Glow Effects

```tsx
// On hover
className="hover:shadow-[0_0_24px_-8px_hsl(var(--glow-primary)/0.4)]"

// Active/selected state
className="shadow-[0_0_24px_-8px_hsl(var(--glow-primary)/0.5)]"

// Success glow
className="shadow-[0_0_24px_-8px_hsl(var(--glow-success)/0.4)]"
```

---

## Loading States (MANDATORY)

### Skeleton Pattern

```tsx
<div className="h-4 w-3/4 rounded bg-muted/30 animate-shimmer" />
```

### Spinner

```tsx
import { Loader2 } from 'lucide-react';

<Loader2 className="w-4 h-4 animate-spin text-primary" />
```

### Loading Card

```tsx
<div className="glass rounded-xl p-4 space-y-3">
  <div className="h-5 w-32 rounded-lg bg-muted/30 animate-shimmer" />
  <div className="space-y-2">
    <div className="h-4 w-full rounded bg-muted/30 animate-shimmer" />
    <div className="h-4 w-3/4 rounded bg-muted/30 animate-shimmer" />
  </div>
</div>
```

---

## Empty States (MANDATORY)

```tsx
<motion.div
  className="flex flex-col items-center justify-center py-12 text-center"
  initial={{ opacity: 0, scale: 0.95 }}
  animate={{ opacity: 1, scale: 1 }}
>
  <motion.div
    className="w-16 h-16 flex items-center justify-center rounded-full glass border border-border/30 mb-6"
    animate={{ rotate: [0, 5, -5, 0] }}
    transition={{ duration: 4, repeat: Infinity }}
  >
    <Icon className="w-7 h-7 text-muted-foreground/40" strokeWidth={1.5} />
  </motion.div>
  <h3 className="text-lg font-medium text-foreground mb-2">
    Title
  </h3>
  <p className="text-sm text-muted-foreground/70 max-w-sm">
    Description
  </p>
</motion.div>
```

---

## File Structure (MANDATORY)

```
src/
├── components/
│   ├── ui/           # Reusable UI primitives (button, switch, etc.)
│   ├── Background.tsx
│   ├── GlassPanel.tsx
│   └── [Feature]*.tsx
├── lib/
│   ├── utils.ts      # cn() helper
│   └── animations.ts # Animation variants
├── hooks/
│   └── use*.ts
├── pages/
│   └── *.tsx
└── index.css         # Global styles, CSS variables
```

---

## Code Style Rules

### Imports Order

```tsx
// 1. React
import { useState, useEffect } from 'react';

// 2. Framer Motion
import { motion, AnimatePresence } from 'framer-motion';

// 3. UI Components
import { Button } from '@/components/ui/button';

// 4. Custom Components
import CustomComponent from '../components/CustomComponent';

// 5. Hooks
import { useCustomHook } from '../hooks/useCustomHook';

// 6. Utils
import { cn } from '@/lib/utils';

// 7. Types
import type { CustomType } from '../types';

// 8. Icons (always last)
import { Icon1, Icon2 } from 'lucide-react';
```

### Component Structure

```tsx
/**
 * ComponentName - Brief description
 */
function ComponentName({ prop1, prop2 }: ComponentProps) {
  // 1. Hooks
  const [state, setState] = useState();

  // 2. Derived state / memos
  const derived = useMemo(() => {}, []);

  // 3. Effects
  useEffect(() => {}, []);

  // 4. Handlers
  const handleAction = () => {};

  // 5. Render
  return (
    <motion.div>
      {/* JSX */}
    </motion.div>
  );
}

export default ComponentName;
```

---

## Checklist for All New UI Work

Before submitting any UI code, verify:

- [ ] Uses Sora font (no other fonts)
- [ ] Uses Lucide icons only (no inline SVGs)
- [ ] Uses glass effect classes (`.glass`, `.glass-subtle`, `.glass-strong`)
- [ ] Uses CSS variable colors only (no hex/rgb)
- [ ] Uses Framer Motion for all animations
- [ ] Has proper entry animations
- [ ] Has hover/tap feedback on interactive elements
- [ ] Uses `AnimatePresence` for conditional renders
- [ ] Follows component patterns from this document
- [ ] Has proper loading skeleton states
- [ ] Has proper empty states
- [ ] Uses semantic color variants (success/warning/danger)
- [ ] Has glow effects where appropriate
- [ ] Follows import order convention
- [ ] Uses `cn()` for conditional classes

---

## Enforcement

This design system is **NON-NEGOTIABLE**. Any PR or code change that:

1. Introduces non-Lucide icons
2. Uses fonts other than Sora
3. Uses colors outside the defined palette
4. Uses CSS transitions instead of Framer Motion for complex animations
5. Creates solid (non-glass) panels
6. Skips loading/empty states

**MUST be rejected and revised.**

---

*Last Updated: Phase 5.1 Completion*
*Maintained by: Opta Development Team*

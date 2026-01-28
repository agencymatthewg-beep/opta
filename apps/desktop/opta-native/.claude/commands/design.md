# /design - Design System Reference

Quick reference for Opta's design system rules.

## Output

```
DESIGN SYSTEM - QUICK REFERENCE
═══════════════════════════════════════════════════════════════

ANIMATIONS
───────────────────────────────────────────────────────────────
Library:  Framer Motion ONLY
Import:   import { motion, AnimatePresence } from 'framer-motion'

CORRECT:
  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>

WRONG:
  className="transition-opacity"  // No CSS transitions
  <div style={{ transition: '...' }}>  // No inline transitions

ICONS
───────────────────────────────────────────────────────────────
Library:  Lucide React ONLY
Import:   import { Settings, Home } from 'lucide-react'
Props:    className="w-5 h-5" strokeWidth={1.75}

CORRECT:
  <Settings className="w-5 h-5 text-primary" />

WRONG:
  <svg>...</svg>  // No inline SVGs ever

GLASS EFFECTS
───────────────────────────────────────────────────────────────
Classes:
  .glass         Standard glass (most components)
  .glass-subtle  Nested elements, inputs
  .glass-strong  Modals, overlays

CORRECT:
  <div className="glass rounded-xl border border-border/30">

WRONG:
  <div className="bg-gray-800">  // No solid backgrounds

COLORS
───────────────────────────────────────────────────────────────
Method:   CSS Variables ONLY (never hex/rgb)

CORRECT:
  text-primary, bg-card, text-success, text-warning, text-danger
  border-border/30, bg-background

WRONG:
  text-[#8b5cf6]  // No arbitrary colors
  bg-purple-500   // No Tailwind color palette

TYPOGRAPHY
───────────────────────────────────────────────────────────────
Font:     Sora (already configured globally)
Weights:  font-normal, font-medium, font-semibold, font-bold

STYLING
───────────────────────────────────────────────────────────────
Helper:   cn() for conditional classes
Import:   import { cn } from '@/lib/utils'

Example:
  className={cn('glass p-4', isActive && 'border-primary')}

═══════════════════════════════════════════════════════════════
Full spec: /DESIGN_SYSTEM.md
```

## Pre-Commit Checklist

Before any UI work is committed, verify:
- [ ] No inline SVGs (Lucide only)
- [ ] No arbitrary colors (CSS variables only)
- [ ] All containers use glass effects
- [ ] All animations use Framer Motion
- [ ] Interactive elements have hover/tap feedback
- [ ] Build passes (`npm run build`)

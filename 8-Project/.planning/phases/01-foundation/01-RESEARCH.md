# Phase 1: Foundation - Research

**Research Date:** 2026-01-28
**Phase:** Foundation
**Confidence:** High (familiar patterns with modern tooling)

## Executive Summary

Phase 1 establishes the Next.js 15 project with Opta's hybrid design system. Research confirms this phase can proceed with standard patterns - Next.js 15 App Router is stable, Tailwind CSS 4 introduces `@theme` for design tokens, and CVA + Radix UI provide a proven component foundation. The hybrid design (Life Manager layout + MacOS visual flair) is achievable through Tailwind's backdrop-blur utilities for glass effects.

---

## Core: Next.js 15 App Router

### Project Structure (2025 Best Practices)

**Recommended layout:**
```
├── src/
│   ├── app/           # Routes, layouts, pages
│   ├── components/    # Reusable components
│   │   ├── ui/        # Primitive UI (Button, Card, Input)
│   │   ├── layout/    # Header, Footer, Sidebar
│   │   └── features/  # Feature-specific components
│   ├── lib/           # Utilities, helpers, configs
│   └── styles/        # Global styles
├── public/            # Static assets
├── package.json
└── next.config.js
```

**Key conventions:**
- Use `src/` directory for clean separation from config files
- `page.tsx` exposes routes, `layout.tsx` for shared UI
- `loading.tsx` for skeletons, `error.tsx` for error boundaries
- Route groups `(groupName)/` organize without affecting URLs
- Server Components by default - only use `'use client'` when needed

**Avoid:**
- Nesting too deep (max 3-4 levels)
- Single monolithic `utils.ts` - break into logical groups
- Putting all code in `app/` - keep components separate

### Server vs Client Components

- All components are Server Components by default in App Router
- Server Components reduce JS bundle size, access DB directly
- Add `'use client'` only for interactivity, hooks, browser APIs
- Server Actions for forms and mutations

**Sources:**
- [Next.js Project Structure Docs](https://nextjs.org/docs/app/getting-started/project-structure)
- [Inside the App Router (2025 Edition)](https://medium.com/better-dev-nextjs-react/inside-the-app-router-best-practices-for-next-js-file-and-directory-structure-2025-edition-ed6bc14a8da3)

---

## Ecosystem: Design System Stack

### Tailwind CSS 4 - Theme Customization

Tailwind CSS 4 introduces the `@theme` directive for defining design tokens:

```css
@import "tailwindcss";

@theme {
  --color-neon-cyan: oklch(0.9 0.15 180);
  --color-neon-purple: oklch(0.7 0.2 300);
  --color-glass-bg: rgba(255, 255, 255, 0.1);

  --font-heading: "Inter", sans-serif;
  --font-mono: "JetBrains Mono", monospace;

  --ease-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55);
  --ease-smooth: cubic-bezier(0.4, 0, 0.2, 1);
}
```

**Key features:**
- Define custom colors, fonts, spacing as CSS variables
- Automatically generates utilities (`bg-neon-cyan`, `font-heading`)
- Use `--*: initial` to disable defaults
- Theme variables available in both CSS and JS

### Class Variance Authority (CVA)

CVA provides type-safe component variants with Tailwind:

```typescript
import { cva, type VariantProps } from "class-variance-authority";
import { twMerge } from "tailwind-merge";

const button = cva(["font-semibold", "border", "rounded"], {
  variants: {
    intent: {
      primary: ["bg-blue-500", "text-white", "border-transparent"],
      secondary: ["bg-white", "text-gray-800", "border-gray-400"],
      glass: ["bg-white/10", "backdrop-blur-md", "border-white/20"],
    },
    size: {
      sm: ["text-sm", "py-1", "px-2"],
      md: ["text-base", "py-2", "px-4"],
      lg: ["text-lg", "py-3", "px-6"],
    },
  },
  compoundVariants: [
    { intent: "primary", size: "md", class: "uppercase" },
  ],
  defaultVariants: {
    intent: "primary",
    size: "md",
  },
});

export interface ButtonProps extends VariantProps<typeof button> {}
export const buttonStyles = (props: ButtonProps) => twMerge(button(props));
```

**VS Code setup** - Add to `settings.json`:
```json
{ "tailwindCSS.classFunctions": ["cva", "cx"] }
```

### Radix UI Primitives

Radix provides unstyled, accessible primitives:

- **Dialog/Modal**: WAI-ARIA compliant, keyboard navigation (Esc, Tab, Enter)
- **Dropdown Menu**: Roving tabindex, submenus, checkboxes, radio items
- **Tooltip, Popover, Select**: Full accessibility baked in

**Pattern**: Use Radix primitives + CVA styling + Tailwind classes

```jsx
import { DropdownMenu } from "radix-ui";

<DropdownMenu.Root>
  <DropdownMenu.Trigger asChild>
    <button className={buttonStyles({ intent: "glass" })}>Menu</button>
  </DropdownMenu.Trigger>
  <DropdownMenu.Portal>
    <DropdownMenu.Content className="bg-white/10 backdrop-blur-md rounded-lg">
      <DropdownMenu.Item className="px-4 py-2 hover:bg-white/20">
        Item
      </DropdownMenu.Item>
    </DropdownMenu.Content>
  </DropdownMenu.Portal>
</DropdownMenu.Root>
```

---

## Patterns: Hybrid Design System

### Architecture Approach

**Life Manager contribution** (layout/UX):
- Clean dashboard grid system
- Clear information hierarchy
- Consistent spacing and typography
- Responsive breakpoints

**MacOS contribution** (visual flair):
- Glass morphism effects on cards/panels
- Neon accent colors for data viz
- Subtle animations on interactions
- Dark theme with high contrast

### Glass Morphism Implementation

**Core Tailwind classes:**
```html
<div class="bg-white/10 backdrop-blur-md border border-white/20 rounded-lg shadow-lg">
  <!-- Glass card content -->
</div>
```

**Key utilities:**
- `backdrop-blur-md` / `backdrop-blur-lg` - Frosted glass effect
- `bg-white/10` to `bg-white/30` - Semi-transparent background
- `border-white/20` - Subtle glass edge
- `shadow-lg` - Depth perception

**Performance note:** Use glass effects selectively - heavy `backdrop-filter` usage can impact rendering on lower-end devices.

**2025 Trend - Liquid Glass:**
- Combines backdrop blur with gradient animations
- Radial/linear gradients with low opacity
- Subtle keyframe animations for "liquid" flow
- Use sparingly for hero sections or key UI elements

### Motion/Framer Motion for Animations

**Layout animations:**
```jsx
import { motion } from "framer-motion";

<motion.div
  layout
  transition={{ duration: 0.3, ease: "easeInOut" }}
  className="..."
>
  {/* Content that can reposition */}
</motion.div>
```

**Key patterns:**
- `layout` prop for automatic position/size animations
- Change via `style` or `className`, not `animate` prop for layout
- Use `layoutId` for shared element transitions
- Keep transitions under 300ms for snappy feel

---

## Don't Hand-Roll

| Need | Use Instead |
|------|-------------|
| Accessible modals | Radix Dialog |
| Dropdown menus | Radix DropdownMenu |
| Component variants | CVA + twMerge |
| Design tokens | Tailwind @theme |
| Animations | Framer Motion |
| Form handling | React Hook Form + Zod |
| Icons | Lucide React |

---

## SOTA Check

| Technology | Version | Status |
|------------|---------|--------|
| Next.js | 15.x | Stable, App Router mature |
| React | 19.x | Stable, RSC fully supported |
| Tailwind CSS | 4.x | Stable, @theme available |
| CVA | 1.0.0-beta | Production ready |
| Radix UI | Latest | Stable |
| Framer Motion | 11.x | Stable |

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Glass effects performance | Use selectively, test on target devices |
| Tailwind 4 breaking changes | Check migration guide, use stable features |
| Component over-engineering | Start minimal, extract patterns when repeated 3x |
| RSC complexity | Default to server, add 'use client' only when needed |

---

## Implementation Recommendations

### Phase 1 Plans Breakdown

1. **01-01: Project scaffolding**
   - `npx create-next-app@latest` with App Router, TypeScript, Tailwind
   - Configure `src/` directory structure
   - Set up ESLint, Prettier

2. **01-02: Design system and core components**
   - Configure Tailwind `@theme` with Opta colors/typography
   - Create CVA-based primitives: Button, Card, Input, Badge
   - Add Radix primitives for Dialog, Dropdown, Tooltip

3. **01-03: Layout structure and navigation**
   - Root layout with glass sidebar navigation
   - Dashboard grid system
   - Header with search/filters
   - Responsive breakpoints

### Dependencies to Install

```json
{
  "dependencies": {
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@radix-ui/react-dialog": "latest",
    "@radix-ui/react-dropdown-menu": "latest",
    "@radix-ui/react-tooltip": "latest",
    "class-variance-authority": "^1.0.0-beta",
    "tailwind-merge": "^2.0.0",
    "framer-motion": "^11.0.0",
    "lucide-react": "latest"
  }
}
```

---

## Sources

### Context7 Documentation
- Next.js 15 App Router: `/vercel/next.js/v15.1.8`
- Tailwind CSS 4: `/websites/tailwindcss`
- Framer Motion: `/websites/motion_dev`
- Radix UI Primitives: `/websites/radix-ui-primitives`
- CVA: `/websites/cva_style`

### Web Research
- [Epic Web Dev: Glassmorphism with Tailwind](https://www.epicweb.dev/tips/creating-glassmorphism-effects-with-tailwind-css)
- [FlyonUI: Liquid Glass Effects](https://flyonui.com/blog/liquid-glass-effects-in-tailwind-css/)
- [Wisp: Next.js 15 Project Structure](https://www.wisp.blog/blog/the-ultimate-guide-to-organizing-your-nextjs-15-project-structure)
- [Medium: App Router Best Practices 2025](https://medium.com/better-dev-nextjs-react/inside-the-app-router-best-practices-for-next-js-file-and-directory-structure-2025-edition-ed6bc14a8da3)

---

*Research completed: 2026-01-28*
*Ready for: /gsd:plan-phase 1*

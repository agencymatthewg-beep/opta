# Opta Help — CLAUDE.md

> AI coding instructions for help.optalocal.com documentation site.

**Read APP.md before writing any code.**

## Stack

```
Next.js 16 (App Router)
TypeScript (strict mode)
Tailwind CSS v3
Framer Motion ^12
Lucide React (icons)
flexsearch (client-side search)
```

Static export only — `output: 'export'` in next.config.ts. No API routes. No server actions.

## Design System

Inherited from 1T-Opta-Home obsidian glass design:
- `.obsidian-interactive` for hoverable dark cards
- `.text-moonlight` for primary headings
- `.glass-subtle` for nav and overlays
- `.prose-opta` for documentation content
- Framer Motion spring physics only (no linear easings)
- CSS variables only for colors (never hex/rgb literals)

## File Structure

```
app/
  globals.css        ← Design system (extended from 1T with prose-opta)
  layout.tsx         ← Root layout (fonts, metadata)
  page.tsx           ← Landing page
  docs/
    layout.tsx       ← Sidebar + content wrapper
    [section]/page.tsx  ← Individual doc pages
components/
  layout/            ← Nav, Sidebar, Footer, DocsLayout, Breadcrumb
  docs/              ← CodeBlock, CommandBlock, Callout, ApiEndpoint, etc.
  shared/            ← OptaRing
lib/
  utils.ts           ← cn()
  content.ts         ← Navigation tree + page metadata
  search-data.ts     ← Search corpus for flexsearch
```

## Build

```bash
npm run build    # must succeed with static output in out/
npm run dev      # local dev on port 3006
```

## Never Do

- No API routes or server actions (static export)
- No modifying OptaRing CSS keyframes
- No hex/rgb literals in component code — use CSS variables
- No adding new dependencies without instruction

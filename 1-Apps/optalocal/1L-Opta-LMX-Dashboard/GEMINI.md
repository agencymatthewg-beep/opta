# Opta LMX Dashboard — GEMINI.md

> AI coding instructions for lmx.optalocal.com management dashboard.

**Read APP.md first. Then this file.**

---

## What This Is

A Next.js 16 web dashboard that serves as the primary user-facing management surface for the Opta LMX inference engine. Lives at `lmx.optalocal.com`. Connects to the LMX REST API over LAN to display models, memory, metrics, and provide chat/inference capabilities.

The same relationship as Opta Code → Opta CLI: this dashboard is the visual companion for the headless LMX engine.

## Stack

```
Next.js 16 (App Router)
TypeScript (strict mode)
Tailwind CSS v3
Framer Motion ^12
Lucide React (icons)
SWR (API data fetching + polling)
```

No static export — needs client-side API polling to the LMX backend.

## Commands

```bash
npm run dev          # Dev server at http://localhost:3003
npm run build        # Production build
npm run typecheck    # tsc --noEmit
npm run lint         # ESLint
npm run check        # typecheck + lint + build
```

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `NEXT_PUBLIC_LMX_API_URL` | `http://192.168.188.11:1234` | LMX backend endpoint |

## Aesthetic Directives (NON-NEGOTIABLE)

Same rules as all Opta apps:

- **Background:** `#09090b` — NEVER pure #000
- **Primary:** `#8b5cf6` (Electric Violet)
- **Glass panels:** `.glass` / `.glass-subtle` / `.glass-strong`
- **Colors:** CSS variables only — never hex literals in component code
- **Font:** Sora (UI) + JetBrains Mono (code/stats)
- **Icons:** Lucide React only
- **Animation:** Framer Motion spring physics only — no CSS ease/linear
- **Dark mode only** — OLED-optimized

## File Structure

```
app/
  globals.css         ← Opta design system + dashboard utilities
  layout.tsx          ← Root layout, fonts, metadata
  page.tsx            ← Dashboard home (stats overview)
components/           ← Reusable UI components
lib/
  utils.ts            ← cn() utility
  api.ts              ← LMX API client (fetch wrapper + SWR fetcher)
public/
  favicon.svg         ← App icon
```

## API Client Pattern

All LMX API calls go through `lib/api.ts`:

```typescript
import { lmxFetch, lmxFetcher, LMX_API_URL } from '@/lib/api'

// Direct fetch
const status = await lmxFetch<StatusResponse>('/admin/status')

// SWR hook
const { data } = useSWR('/admin/status', lmxFetcher, {
  refreshInterval: 5000,
})
```

## Coding Standards

- TypeScript strict — no `any`
- `cn()` for conditional classes (clsx + tailwind-merge)
- Server Components by default; `'use client'` only when needed
- Named exports for all components
- No inline styles — Tailwind + CSS variables only
- SWR for all API data fetching with polling intervals

## What NOT To Do

- No API routes or server-side data fetching — all data comes from LMX client-side
- No storing state in the dashboard — LMX is the source of truth
- No hex/rgb literals in component code — use CSS variables
- No CSS ease/linear for animations — Framer Motion only
- No new dependencies without instruction
- No modifying the Opta design tokens without explicit instruction

## Deployment

```bash
cd 1L-Opta-LMX-Dashboard
vercel deploy --prod
```

Vercel with `lmx` subdomain CNAME → `cname.vercel-dns.com`.

### Autonomous Source Control

- **Proactive Commits:** Always attempt to commit changes autonomously and proactively at the end of a successful task if the changes are verified, safe, and appropriate, without asking for explicit permission.

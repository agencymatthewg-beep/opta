# Opta Accounts — CLAUDE.md

> AI Coding Instructions for accounts.optalocal.com

---

## What This Is

Centralized SSO portal for all Opta apps. Users sign in here and sessions are shared across `*.optalocal.com` via cookie domain. Supports Google/Apple OAuth, email/phone + password, and CLI browser-based auth.

## Stack

- Next.js 16 (App Router, SSR — not static export)
- React 19, TypeScript strict
- Tailwind CSS v4 + Opta design tokens
- Framer Motion (spring physics animations)
- Lucide React icons
- `@supabase/ssr` with `.optalocal.com` cookie domain
- Sora + JetBrains Mono via next/font

## Commands

```bash
npm run dev          # Dev server at http://localhost:3002
npm run build        # Production build
npm run typecheck    # tsc --noEmit
npm run lint         # ESLint
```

## Environment Variables

Copy `.env.local.example` → `.env.local`. Key vars:

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Shared Opta Supabase project |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase public key |
| `NEXT_PUBLIC_SITE_URL` | This portal's URL (e.g. `https://accounts.optalocal.com`) |

## Aesthetic Directives (NON-NEGOTIABLE)

Same rules as all Opta apps:
- **Background:** `#09090b` — NEVER pure #000
- **Primary:** `#8b5cf6` (Electric Violet)
- **Glass panels:** `.glass` / `.glass-subtle` / `.glass-strong`
- **Colors:** CSS variables only — never hex literals in component code
- **Font:** Sora (UI) + JetBrains Mono (code)
- **Icons:** Lucide React only
- **Animation:** Framer Motion spring physics only — no CSS ease/linear
- **Dark mode only** — OLED-optimized

## Cookie Domain (Critical)

All Supabase auth cookies are set with `domain: '.optalocal.com'` in production. This enables SSO across all `*.optalocal.com` subdomains. In development, domain is omitted (localhost).

## Redirect Security

All `redirect_to` and `next` query params are validated against `lib/allowed-redirects.ts`. Never allow open redirects.

## Coding Standards

- TypeScript strict — no `any`
- `cn()` for conditional classes (clsx + tailwind-merge)
- Server Components by default; `'use client'` only when needed
- Named exports for all components
- No inline styles — Tailwind + CSS variables only

## Deployment

- Vercel with `accounts` subdomain CNAME → `cname.vercel-dns.com`
- Cloudflare DNS: `accounts CNAME cname.vercel-dns.com`

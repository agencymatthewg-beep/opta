# CLAUDE.md — OptaPlus Web

## Project
Next.js 15 web client for OptaPlus. Connects to OpenClaw gateways via WebSocket.

## Stack
- **Framework:** Next.js 15, App Router, React 19, TypeScript strict
- **Styling:** Tailwind CSS 4 (no external UI libs)
- **Animation:** Framer Motion (spring physics only — never easeInOut)
- **Markdown:** react-markdown + remark-gfm + rehype-highlight

## Design: Cinematic Void
- Background: `#050505` (void), Surface: `#0A0A0A`, Elevated: `#121212`
- Primary: `#8B5CF6` (Electric Violet), Glow: `#A78BFA`
- Text: `#EDEDED` primary, `#A1A1AA` secondary, `#52525B` muted
- Font: Sora (Google Fonts)
- Glass panels: backdrop-blur + white/3-6% bg + white/6% border
- Dark mode ONLY (OLED black)

## Rules
1. TypeScript strict — no `any`, no implicit returns
2. Spring animations only (Framer Motion) — physical, not eased
3. Custom glass components — no Radix, shadcn, MUI, etc.
4. WebSocket via `GatewayClient` class — OpenClaw Protocol v3 (req/res/event frames)
5. All components are client components (`"use client"`)
6. Tailwind theme tokens defined in `globals.css` `@theme` block
7. Bot configs stored in localStorage (no server-side persistence)
8. File structure: `src/{app,components,hooks,lib,types}`

## Key Files
- `src/lib/gateway.ts` — WebSocket client with auto-reconnect
- `src/hooks/useGateway.ts` — React hook wrapping gateway operations
- `src/types/index.ts` — Shared TypeScript types
- `src/app/globals.css` — Tailwind theme + glass utilities

## Commands
```bash
npm run dev    # Development server
npm run build  # Production build
npm run lint   # ESLint
```

# Phase 1: Web Project Setup - Research

**Researched:** 2026-02-18
**Domain:** Next.js 16 + React 19 project scaffold with Opta design system
**Confidence:** HIGH

<research_summary>
## Summary

Researched the Next.js 16 ecosystem for scaffolding Opta Local's web client with @opta/ui integration, Tailwind CSS 4 design tokens, and LMX API client. The reference implementation (AICompare Web) runs Next.js 16.1.6 + React 19.2.3 + Tailwind CSS 4 — identical stack to target.

Key finding: @opta/ui only has 3 components (Card, Button, Badge) — no GlassPanel, Input, or streaming-specific components. Most glass UI will come from CSS utility classes defined in globals.css (`.glass`, `.glass-subtle`, `.glass-strong`). The LMX client should use native `fetch` with `ReadableStream` for chat and `EventSource` for SSE — no third-party HTTP libraries.

**Primary recommendation:** Clone AICompare Web's setup exactly (package.json deps, postcss.config.mjs, tsconfig.json, globals.css @theme block), then customize design tokens per SHARED.md and add LMX-specific client code.
</research_summary>

<standard_stack>
## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 16.1.6 | React framework with App Router | Matches AICompare Web, latest stable |
| react | 19.2.3 | UI library | Latest stable, matches ecosystem |
| react-dom | 19.2.3 | React DOM renderer | Paired with React |
| tailwindcss | ^4 | Utility-first CSS | Tailwind 4 uses @theme blocks, no config file |
| @tailwindcss/postcss | ^4 | PostCSS plugin for Tailwind 4 | Required for Next.js integration |
| typescript | ^5 | Type-safe JavaScript | Ecosystem standard, strict mode |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| framer-motion | ^12 | Animation library | All interactive animations (glass reveals, streaming indicators) |
| lucide-react | ^0.563 | Icon library | All icons (mandatory per CLAUDE.md) |
| @opta/ui | workspace:* | Shared components (Card, Button, Badge, cn()) | Glass cards, action buttons, status badges |
| class-variance-authority | ^0.7 | Component variant system | If building custom variants beyond @opta/ui |
| swr | ^2.3 | Data fetching + cache | Model list, session list (not SSE — SSE is custom) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| swr | react-query/TanStack Query | SWR simpler for read-heavy patterns; TanStack if mutations needed later |
| framer-motion | CSS animations | Framer mandatory per CLAUDE.md, richer spring physics |
| native fetch | axios | Fetch required per CLAUDE.md, simpler for streaming |
| Radix UI | headless-ui | AICompare uses Radix — proven in ecosystem |

**Installation:**
```bash
npx create-next-app@16.1.6 web --typescript --tailwind --app --src-dir --import-alias "@/*"
cd web
npm install framer-motion lucide-react swr
npm install -D @tailwindcss/postcss
# @opta/ui added via pnpm workspace
```
</standard_stack>

<architecture_patterns>
## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/
│   ├── layout.tsx           # Root layout (glass background, Sora font)
│   ├── page.tsx             # Dashboard (default route)
│   ├── chat/page.tsx        # Chat interface
│   ├── models/page.tsx      # Model library
│   ├── sessions/page.tsx    # Session history
│   └── settings/page.tsx    # Connection settings
├── components/
│   ├── dashboard/           # VRAM gauge, model list, throughput chart
│   ├── chat/                # Message list, input, streaming indicator
│   ├── models/              # Model cards, load/unload controls
│   └── shared/              # Layout, nav, glass panels, connection status
├── hooks/
│   ├── useServerStatus.ts   # SSE subscription to /admin/events
│   ├── useChatStream.ts     # Streaming chat with ReadableStream
│   ├── useConnection.ts     # Connection manager (LAN/WAN state)
│   └── useModels.ts         # Model CRUD via SWR
├── lib/
│   ├── lmx-client.ts        # LMX API client (typed, fetch-based)
│   ├── sse.ts               # EventSource wrapper with auto-reconnect
│   └── storage.ts           # localStorage helpers (encrypted admin key)
└── types/
    └── lmx.ts               # TypeScript types from SHARED.md
```

### Pattern 1: Tailwind CSS 4 Design Tokens via @theme
**What:** Tailwind CSS 4 uses `@theme` blocks in CSS instead of `tailwind.config.js`
**When to use:** All Opta projects (proven in AICompare)
**Example:**
```css
/* globals.css */
@import "tailwindcss";

@theme {
  --color-opta-bg: #09090b;          /* SHARED.md --void */
  --color-opta-surface: #18181b;      /* SHARED.md --surface */
  --color-opta-border: #3f3f46;       /* SHARED.md --border */
  --color-primary: #8b5cf6;           /* SHARED.md --primary */
  --color-neon-green: #22c55e;        /* Online status */
  --color-neon-amber: #f59e0b;        /* WAN mode */
  --color-neon-red: #ef4444;          /* Offline */
  --font-sans: "Sora", -apple-system, sans-serif;
  --font-mono: "SF Mono", "Fira Code", monospace;
}
```

### Pattern 2: PostCSS Config for Tailwind CSS 4
**What:** Minimal PostCSS config — no tailwind.config.js needed
**When to use:** All Next.js + Tailwind CSS 4 projects
**Example:**
```javascript
// postcss.config.mjs
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
export default config;
```

### Pattern 3: Glass Utility Classes (from AICompare)
**What:** Glass effects as Tailwind utility classes, not React components
**When to use:** All glass panel surfaces
**Example:**
```css
/* In globals.css @layer utilities */
.glass {
  background: linear-gradient(135deg, rgba(109, 40, 217, 0.2) 0%, rgba(139, 92, 246, 0.1) 50%, rgba(109, 40, 217, 0.15) 100%);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(139, 92, 246, 0.3);
  box-shadow: inset 0 1px 0 0 rgba(255, 255, 255, 0.1);
}
```

### Pattern 4: Next.js 16 Async APIs (BREAKING CHANGE)
**What:** All request APIs (params, cookies, headers) must be awaited
**When to use:** Any server component or route handler
**Example:**
```typescript
// Next.js 16 — params must be awaited
export default async function ChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <Chat sessionId={id} />;
}
```

### Anti-Patterns to Avoid
- **No `tailwind.config.js`:** Tailwind 4 uses `@theme` blocks in CSS. Config files are Tailwind 3.
- **No `middleware.ts`:** Next.js 16 renames middleware to `proxy.ts`. We don't need either for v1.
- **No synchronous params access:** Next.js 16 enforces async — `const { id } = await params`.
- **No `experimental.dynamicIO`:** Removed in Next.js 16.
- **No axios or third-party HTTP:** Native `fetch` only per CLAUDE.md.
</architecture_patterns>

<dont_hand_roll>
## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Glass UI cards | Custom glass div component | `@opta/ui` Card variant="glass" + `.glass` CSS | Already implemented, tested, matches design system |
| Conditional class merging | String concatenation | `cn()` from `@opta/ui` (clsx + tailwind-merge) | Handles Tailwind conflicts correctly |
| Button variants | Custom button styles | `@opta/ui` Button with variant prop | 4 variants already defined (primary/secondary/ghost/glass) |
| Status badges | Custom span styles | `@opta/ui` Badge with variant prop | 5 semantic variants ready to use |
| Design token system | Custom CSS variables | Copy AICompare's `@theme` block, adjust per SHARED.md | Proven token structure with 50+ tokens |
| Data fetching hooks | Custom useEffect + state | SWR with typed fetcher | Handles cache, revalidation, error states |
| Animation utilities | Raw CSS transitions | Framer Motion with AICompare's easing tokens | Spring physics, stagger, glass reveals |
| Glass depth hierarchy | Custom opacity math | AICompare's .glass / .glass-subtle / .glass-strong | 3-level system already tuned for OLED |

**Key insight:** The Opta ecosystem already has a proven design system in AICompare Web. Copying its globals.css (648 lines of tokens, glass classes, animations, typography) gives us the entire visual foundation in one file. Don't recreate what exists.
</dont_hand_roll>

<common_pitfalls>
## Common Pitfalls

### Pitfall 1: CORS Blocking LAN Requests
**What goes wrong:** Browser blocks `fetch("http://192.168.188.11:1234/admin/status")` due to CORS
**Why it happens:** Next.js dev server runs on localhost:3004, LMX runs on 192.168.188.11:1234 — different origins
**How to avoid:** Configure LMX (FastAPI) CORS middleware to allow `localhost:3004` and `*.trycloudflare.com`. Decision #4 in DECISIONS.md already anticipates this.
**Warning signs:** Network tab shows `CORS` error, fetch succeeds in curl but fails in browser

### Pitfall 2: @opta/ui Missing Components
**What goes wrong:** OPIS docs reference `GlassPanel` component from @opta/ui, but it doesn't exist
**Why it happens:** @opta/ui only has 3 components: Card (with glass variant), Button, Badge. No Input, GlassPanel, Modal, etc.
**How to avoid:** Use Card variant="glass" for glass containers. Build missing components locally in `src/components/shared/` using the same CVA + cn() pattern. Don't add to @opta/ui until proven across 2+ apps.
**Warning signs:** Import errors from `@opta/ui/components/GlassPanel`

### Pitfall 3: Tailwind 4 Token Naming Conflicts
**What goes wrong:** @opta/ui uses `opta-surface`, `glass-bg`, `neon-cyan` tokens. SHARED.md defines `--void`, `--surface`, `--primary`. Different naming schemes.
**Why it happens:** @opta/ui predates SHARED.md — token names diverged
**How to avoid:** In globals.css, define BOTH sets of tokens. Map SHARED.md tokens to @opta/ui-compatible names in `@theme`:
```css
@theme {
  --color-opta-bg: #09090b;           /* SHARED.md calls this --void */
  --color-opta-surface: rgba(139, 92, 246, 0.12);  /* @opta/ui expects this */
  --color-opta-border: rgba(139, 92, 246, 0.25);
  /* etc. */
}
```
**Warning signs:** @opta/ui components render with missing/wrong colors

### Pitfall 4: Admin Key in Browser Storage
**What goes wrong:** Admin key stored in plain localStorage is exposed to XSS
**Why it happens:** Web apps have no secure storage equivalent to iOS Keychain
**How to avoid:** Use `crypto.subtle.encrypt()` (Web Crypto API) to encrypt the key before storing. Store encrypted blob + IV in localStorage. Per web/CLAUDE.md this is mandatory.
**Warning signs:** Network tab shows admin key in headers without any encryption layer

### Pitfall 5: Next.js 16 Server Components and Client Boundary
**What goes wrong:** Components using `useState`, `useEffect`, EventSource, or browser APIs fail because they're Server Components by default
**Why it happens:** Next.js App Router defaults to Server Components. SSE, streaming chat, and connection management all need browser APIs.
**How to avoid:** Add `'use client'` to all components that use React hooks, browser APIs, or Framer Motion. Keep page-level components as Server Components where possible (for layout).
**Warning signs:** "useState is not a function" or "window is not defined" errors
</common_pitfalls>

<code_examples>
## Code Examples

### LMX API Client (typed, fetch-based)
```typescript
// Source: Pattern derived from SHARED.md API contracts
// lib/lmx-client.ts

import type { ServerStatus, LoadedModel, ChatMessage } from '@/types/lmx';

export class LMXClient {
  constructor(
    private baseUrl: string,
    private adminKey: string,
  ) {}

  private headers(): HeadersInit {
    return {
      'Content-Type': 'application/json',
      'X-Admin-Key': this.adminKey,
    };
  }

  async getStatus(): Promise<ServerStatus> {
    const res = await fetch(`${this.baseUrl}/admin/status`, {
      headers: this.headers(),
    });
    if (!res.ok) throw new LMXError(res.status, await res.text());
    return res.json();
  }

  async getModels(): Promise<{ data: LoadedModel[] }> {
    const res = await fetch(`${this.baseUrl}/v1/models`, {
      headers: this.headers(),
    });
    return res.json();
  }

  async *streamChat(
    model: string,
    messages: ChatMessage[],
  ): AsyncGenerator<string> {
    const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ model, messages, stream: true }),
    });

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      for (const line of chunk.split('\n')) {
        if (line.startsWith('data: ') && line !== 'data: [DONE]') {
          const json = JSON.parse(line.slice(6));
          const content = json.choices?.[0]?.delta?.content;
          if (content) yield content;
        }
      }
    }
  }
}
```

### SSE Auto-Reconnect Hook
```typescript
// Source: Pattern from MDN EventSource + web/ARCHITECTURE.md
// hooks/useServerStatus.ts

import { useEffect, useRef, useCallback, useState } from 'react';
import type { ServerStatus } from '@/types/lmx';

export function useServerStatus(baseUrl: string, adminKey: string) {
  const [status, setStatus] = useState<ServerStatus | null>(null);
  const [connected, setConnected] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  const connect = useCallback(() => {
    // EventSource doesn't support custom headers natively.
    // Pass admin key as query param (LMX must support this).
    const url = `${baseUrl}/admin/events?key=${encodeURIComponent(adminKey)}`;
    const es = new EventSource(url);

    es.onopen = () => setConnected(true);
    es.onmessage = (e) => setStatus(JSON.parse(e.data));
    es.onerror = () => {
      setConnected(false);
      es.close();
      setTimeout(connect, 3000); // Auto-reconnect
    };

    esRef.current = es;
  }, [baseUrl, adminKey]);

  useEffect(() => {
    connect();
    return () => esRef.current?.close();
  }, [connect]);

  return { status, connected };
}
```

### Root Layout with Glass Background
```typescript
// Source: Pattern from AICompare Web layout.tsx
// app/layout.tsx

import type { Metadata } from 'next';
import { Sora, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const sora = Sora({ subsets: ['latin'], variable: '--font-sora' });
const jetbrains = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains' });

export const metadata: Metadata = {
  title: 'Opta Local',
  description: 'Text your local AI from anywhere',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sora.variable} ${jetbrains.variable}`}>
      <body className="bg-opta-bg text-white antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
```
</code_examples>

<sota_updates>
## State of the Art (2025-2026)

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| tailwind.config.js | `@theme` block in CSS | Tailwind CSS 4 (2025) | No config file needed, tokens in CSS |
| middleware.ts | proxy.ts | Next.js 16 (2025) | Rename file if using middleware |
| Sync params/cookies | `await params`, `await cookies()` | Next.js 16 (2025) | All request APIs must be awaited |
| experimental.turbopack | Top-level turbopack config | Next.js 16 (2025) | Turbopack is default bundler |
| React 18 patterns | React 19.2 (ViewTransitions, useEffectEvent, Activity) | Next.js 16 | New APIs available for animations |
| Manual caching | `"use cache"` directive | Next.js 16 | Cache Components for explicit caching |

**New tools/patterns to consider:**
- **React ViewTransitions:** Could animate route changes (dashboard → chat) with CSS-like transitions
- **React Activity:** Could keep SSE connections alive while tab is "hidden" (dashboard in background)
- **"use cache" directive:** Could cache model list and session list responses

**Deprecated/outdated:**
- **tailwind.config.js:** Use @theme in CSS for Tailwind 4
- **middleware.ts filename:** Renamed to proxy.ts in Next.js 16
- **Synchronous request APIs:** Must await params, cookies, headers
- **Node.js 18:** Minimum is now 20.9.0
</sota_updates>

<open_questions>
## Open Questions

1. **EventSource custom headers**
   - What we know: EventSource API doesn't natively support custom headers (like X-Admin-Key)
   - What's unclear: Whether LMX supports query parameter auth for SSE endpoints
   - Recommendation: Check LMX `/admin/events` endpoint for query param auth. If not supported, use fetch-based SSE via ReadableStream instead of EventSource.

2. **@opta/ui workspace linking**
   - What we know: @opta/ui uses `workspace:*` in pnpm. AICompare already links to it.
   - What's unclear: Whether Opta Local (in 1-Apps/1L-Opta-Local/web/) needs adding to pnpm-workspace.yaml
   - Recommendation: Check root pnpm-workspace.yaml and add web/ if not already included.

3. **CORS configuration on LMX**
   - What we know: Direct browser→LMX requires CORS. Decision #4 acknowledges this.
   - What's unclear: Whether LMX already has CORS middleware configured for localhost origins
   - Recommendation: Check LMX CORS config before first integration test. May need to add `localhost:3004` to allowed origins.
</open_questions>

<sources>
## Sources

### Primary (HIGH confidence)
- Context7 /vercel/next.js v16.1.5 — App Router setup, breaking changes (middleware→proxy, async params), Tailwind CSS 4 integration
- @opta/ui source code (6-Packages/6D-UI/src/) — Exact component inventory: Card, Button, Badge, cn()
- AICompare Web source code (1-Apps/1B-AICompare-Web/) — Reference Next.js 16.1.6 implementation with full design token system

### Secondary (MEDIUM confidence)
- [Next.js 16 blog post](https://nextjs.org/blog/next-16) — Feature overview and breaking changes
- [Next.js 16 upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-16) — Migration steps from 15
- SHARED.md API contracts — LMX endpoint definitions and data models

### Tertiary (LOW confidence - needs validation)
- EventSource custom header limitation — needs validation against LMX implementation
- LMX CORS configuration status — needs runtime testing
</sources>

<metadata>
## Metadata

**Research scope:**
- Core technology: Next.js 16.1.6 + React 19.2.3 + Tailwind CSS 4
- Ecosystem: @opta/ui, Framer Motion, Lucide React, SWR
- Patterns: Tailwind 4 @theme tokens, glass utility classes, streaming fetch, SSE hooks
- Pitfalls: CORS, missing @opta/ui components, token naming, admin key storage, server/client boundary

**Confidence breakdown:**
- Standard stack: HIGH — verified against working AICompare Web app
- Architecture: HIGH — derived from AICompare reference + OPIS docs
- Pitfalls: HIGH — discovered from actual @opta/ui source and SHARED.md analysis
- Code examples: MEDIUM — patterns derived from docs, not tested against LMX yet

**Research date:** 2026-02-18
**Valid until:** 2026-03-18 (30 days — Next.js ecosystem stable at 16.1.x)
</metadata>

---

*Phase: 01-web-project-setup*
*Research completed: 2026-02-18*
*Ready for planning: yes*

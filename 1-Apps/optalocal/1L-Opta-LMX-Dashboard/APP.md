# Opta LMX Dashboard — APP.md

> The primary management surface for your local AI inference engine.

---

## 1. Identity

| Field | Value |
|-------|-------|
| **Name** | Opta LMX Dashboard |
| **Short Name** | LMX Dashboard |
| **Tagline** | Manage your local AI — simply |
| **Type** | Web dashboard (Next.js) |
| **Platform** | Browser (served from Vercel, connects to LMX over LAN/localhost) |
| **Language** | TypeScript (strict) |
| **Frameworks** | Next.js 16, React 19, Tailwind CSS v3, Framer Motion, Lucide React, SWR |
| **Location** | `~/Synced/Opta/1-Apps/optalocal/1L-Opta-LMX-Dashboard/` |
| **Domain** | `lmx.optalocal.com` |
| **Port** | 3003 (dev) |
| **Status** | Active — v0.1.1 (production hardening pass) |

---

## 2. Purpose

### What It Does

Opta LMX Dashboard is the primary user-facing management surface for the Opta LMX inference engine. It provides a visual interface for monitoring models, memory usage, inference throughput, and managing the full model lifecycle — loading, unloading, downloading, and configuring.

### Relationship to Opta LMX

The same way **Opta Code** is the desktop companion for **Opta CLI**, the **LMX Dashboard** is the web companion for **Opta LMX**. The dashboard consumes the LMX REST API and presents it in a visual, interactive format.

```
Opta LMX (1M) — headless inference engine (API server on port 1234)
     ↕ REST API + WebSocket
Opta LMX Dashboard (1L) — web UI for management and monitoring
```

### What It Does NOT Do

- ❌ Run inference directly — delegates to the LMX engine
- ❌ Replace the LMX API — the API remains the programmatic interface
- ❌ Store state — all data comes from the LMX engine at runtime
- ❌ Require authentication for LAN access (trust-LAN model inherited from LMX)

---

## 3. Navigation & Pages

Nav groups use plain-English labels (non-technical users first). Technical synonyms in parentheses for dev reference.

**Core:**
- Overview — live stats: memory used, speed, models loaded, requests
- Models — load, unload, download, browse available models
- Compress *(Quantize)* — reduce model size for faster loading

**Intelligence:**
- Agents — multi-step workflow management
- Skills — tool integrations and MCP bridge
- Presets — saved model behavior profiles
- Playground *(API Console)* — interactive API testing
- Knowledge *(RAG)* — document ingestion & vector search
- Audio — voice/speech features

**Monitor:**
- Metrics — live telemetry and health
- Forecasts *(Predictor)* — performance prediction
- Compare *(Arena)* — side-by-side model comparison
- Benchmark — throughput and latency tests
- Sessions — search and resume chats
- Logs — raw event log
- Diagnostics — system checks

**System:**
- Bot Connection *(Bridge)* — relay status for external bots and apps
- Health Check *(Setup)* — verify pairing, endpoint, AI engine readiness
- Pair Device — link this dashboard to a device
- Settings — server address, keys, performance

---

## 4. Architecture

### Connection Bootstrap & First-Run Resilience (v0.1.1)

- `/connect` now resolves a deterministic route strategy:
  - WAN + tunnel URL → use tunnel
  - WAN without tunnel URL → explicit direct-host fallback with warning
  - LAN → direct host/port
- Magic-link success is now gated by both:
  - `status === connected`
  - active connection URL exactly matching the requested target URL
  (prevents false-positive success when a stale previous connection is still alive)
- First-run/offline landing now surfaces actionable onboarding:
  - human-readable `connect_error` message when bootstrap params are invalid
  - direct CTA into `/settings` for endpoint recovery


### API Client

All data flows through `lib/api.ts` which wraps `fetch()` with:

- Configurable base URL (env `NEXT_PUBLIC_LMX_API_URL`, default `http://127.0.0.1:1234`)
- Timeout + AbortController
- SWR-compatible fetcher for reactive data

### Key LMX API Endpoints Consumed

| Endpoint | Dashboard Use |
|----------|---------------|
| `GET /healthz` | Connection status indicator |
| `GET /admin/status` | Memory, loaded models, uptime |
| `GET /v1/models` | Model list |
| `POST /v1/chat/completions` | Chat page (streaming) |
| `POST /admin/models/load` | Models page — load model |
| `POST /admin/models/unload` | Models page — unload model |
| `GET /admin/metrics/json` | Metrics page |
| `GET /admin/benchmark/*` | Benchmark page |

---

## 5. Design Directives (NON-NEGOTIABLE)

### Visual design — inherits Opta design system:

- **Background:** `#09090b` (void black — NEVER pure #000)
- **Primary:** `#8b5cf6` (Electric Violet)
- **Glass panels:** `.glass` / `.glass-subtle` / `.glass-strong`
- **Colors:** CSS variables only — never hex literals in components
- **Font:** Sora (UI) + JetBrains Mono (code/stats)
- **Icons:** Lucide React only
- **Animation:** Framer Motion spring physics only — no CSS ease/linear
- **Dark mode only** — OLED-optimized

### UX language — simplicity first:

All user-facing labels describe **what the user gets**, not how the system works.

- Status messages: user impact ("Your bots can reach your AI") not system state ("SSE relay active")
- Labels: plain English ("Memory Limit", "Server Address", "API Key") not tech jargon
- Technical details (raw endpoints, hex IDs, protocol names, ports): accessible via `<TechDisclosure>` collapsible sections, never foregrounded
- Nav items: outcome-first nouns/verbs ("Compress", "Playground", "Bot Connection")

---

## 6. Coding Standards

- TypeScript strict — no `any`
- `cn()` for conditional classes (clsx + tailwind-merge)
- Server Components by default; `'use client'` only when needed
- Named exports for all components
- No inline styles — Tailwind + CSS variables only
- SWR for all API data fetching (reactive, with polling)

---

## 7. Deployment

- Vercel with `lmx` subdomain CNAME → `cname.vercel-dns.com`
- No static export (needs client-side API polling)
- `cd 1L-Opta-LMX-Dashboard && vercel deploy --prod`

---

*Last updated: 2026-03-06*

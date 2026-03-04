# Opta LMX Dashboard — APP.md

> The primary management surface for your local AI inference engine.

---

## 1. Identity

| Field | Value |
|-------|-------|
| **Name** | Opta LMX Dashboard |
| **Short Name** | LMX Dashboard |
| **Tagline** | Your inference engine, visualized |
| **Type** | Web dashboard (Next.js) |
| **Platform** | Browser (served from Vercel, connects to LMX over LAN/localhost) |
| **Language** | TypeScript (strict) |
| **Frameworks** | Next.js 16, React 19, Tailwind CSS v3, Framer Motion, Lucide React, SWR |
| **Location** | `~/Synced/Opta/1-Apps/optalocal/1L-Opta-LMX-Dashboard/` |
| **Domain** | `lmx.optalocal.com` |
| **Port** | 3003 (dev) |
| **Status** | Active — v0.1.0 (scaffold) |

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

## 3. Target Pages

Based on the LMX API surface, the dashboard targets these page groups:

**Inference:**

- Dashboard (home) — stats overview, loaded models, memory, throughput
- Chat — stream AI responses via `/v1/chat/completions`
- Arena — side-by-side model comparison
- RAG Studio — document ingestion & vector search

**Management:**

- Models — load, unload, download, browse available models
- Presets — model behavior profiles
- Skills — tool integrations and MCP bridge
- Agents — multi-step workflow management
- Sessions — search and resume chats

**System:**

- Metrics — live telemetry and health
- Benchmark — throughput and latency tests
- Settings — connection and config

---

## 4. Architecture

### API Client

All data flows through `lib/api.ts` which wraps `fetch()` with:

- Configurable base URL (env `NEXT_PUBLIC_LMX_API_URL`, default `http://192.168.188.11:1234`)
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

Inherits all Opta design rules:

- **Background:** `#09090b` (void black — NEVER pure #000)
- **Primary:** `#8b5cf6` (Electric Violet)
- **Glass panels:** `.glass` / `.glass-subtle` / `.glass-strong`
- **Colors:** CSS variables only — never hex literals in components
- **Font:** Sora (UI) + JetBrains Mono (code/stats)
- **Icons:** Lucide React only
- **Animation:** Framer Motion spring physics only — no CSS ease/linear
- **Dark mode only** — OLED-optimized

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

*Last updated: 2026-03-04*

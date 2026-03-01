---
status: review
---

# Opta Local — Production Readiness Design

**Date:** 2026-02-26
**Goal:** Replace the TUI as the primary interface for Mono512. Access Opta Local from anywhere — monitor the server, swap models, manage sessions, and chat — without needing a terminal.

---

## Problem

Two blockers prevent daily use:

1. **No remote access** — the app only works on home LAN. There is no tunnel, no deployed web app, no OAuth configured for production.
2. **TUI dependency** — `opta chat`, `opta models`, `opta sessions` are the only real control surface. The web app exists but hasn't been validated as a complete replacement.

---

## Approach: Parallel Tracks

Infrastructure and feature work run simultaneously. They don't block each other.

- **Track 1** — Deploy infrastructure (one session, mostly config)
- **Track 2** — Audit and complete the four management-critical pages

---

## Track 1: Infrastructure

### Architecture

```
optalocal.com (Cloudflare DNS)
├── lmx.optalocal.com   → Cloudflare Tunnel → 192.168.188.11:1234  (Opta LMX API)
└── local.optalocal.com → Vercel                                     (Next.js web app)
```

The web app is a stateless Next.js shell on Vercel. It has no backend of its own — it talks directly to `lmx.optalocal.com` for all LMX operations. Supabase handles identity only.

### User Flow (from anywhere)

1. Visit `https://local.optalocal.com`
2. Sign in with Google (Supabase OAuth) — one-time setup
3. Settings → Tunnel shows `lmx.optalocal.com` pre-filled
4. ConnectionProvider probes it → `wan` mode → dashboard live

On home LAN, the same URL and flow applies. HTTPS always routes through the tunnel — no mental model switching between home and remote.

### Cloudflare Tunnel (Mono512)

- Install `cloudflared` as a `launchd` service on Mono512
- Route: `lmx.optalocal.com` → `http://localhost:1234`
- Mono512 stays off the public internet — no port forwarding, no firewall changes
- Enable "No response buffering" in Cloudflare dashboard (prevents SSE connections being killed at 100s timeout)

### Vercel Deployment

Environment variables to set in Vercel dashboard:

```
NEXT_PUBLIC_SUPABASE_URL=https://cytjsmezydytbmjrolyz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
NEXT_PUBLIC_SITE_URL=https://local.optalocal.com
NEXT_PUBLIC_DEFAULT_LMX_TUNNEL_URL=https://lmx.optalocal.com
```

The last variable (`NEXT_PUBLIC_DEFAULT_LMX_TUNNEL_URL`) pre-fills the tunnel URL in Settings for new users — they don't need to type it.

### Supabase Configuration

- Add `https://local.optalocal.com/auth/callback` to redirect URL allowlist
- Configure Google OAuth provider: add client ID + secret from Google Cloud Console
- Authorised redirect URI in Google Cloud Console: `https://cytjsmezydytbmjrolyz.supabase.co/auth/v1/callback`

### Web App Change (minor)

Add `NEXT_PUBLIC_DEFAULT_LMX_TUNNEL_URL` env var support to `lib/connection.ts` `DEFAULT_SETTINGS`:

```typescript
export const DEFAULT_SETTINGS: ConnectionSettings = {
  host: '192.168.188.11',
  port: 1234,
  adminKey: '',
  useTunnel: false,
  tunnelUrl: process.env.NEXT_PUBLIC_DEFAULT_LMX_TUNNEL_URL ?? '',
};
```

### Track 1 Done When

- [ ] `curl https://lmx.optalocal.com/v1/models` returns model list
- [ ] `https://local.optalocal.com` loads web app from Vercel
- [ ] Google sign-in completes OAuth round-trip correctly
- [ ] `cloudflared` survives Mono512 reboot (launchd service)
- [ ] Settings → Tunnel shows `lmx.optalocal.com` pre-filled

---

## Track 2: Feature Audit

### Scope

Four pages directly replace the TUI. Everything else (Arena, Agents, RAG, Pair, Devices) is deferred.

| TUI Command | Web Replacement |
|-------------|----------------|
| `opta chat --model X` | `/chat` — model picker + streaming |
| `opta models list/load/unload` | `/models` — browse, load, unload |
| `opta sessions list/resume` | `/sessions` — search, click to resume |
| Server health check | `/` Dashboard — always live |

### Audit Process Per Page

Each page is tested against live Mono512 over the tunnel. Three outcomes:

| Result | Action |
|--------|--------|
| ✅ Works end-to-end | Ship as-is |
| ⚠️ Partially working | Targeted fix (hours) |
| ❌ Scaffolding only | Build missing piece |

### Page Targets

**Dashboard `/`**
Likely complete. Verify: SSE reconnects after laptop sleep/wake. Loaded models list reflects actual state. Color-coded stats respond to real data.

**Chat `/chat` + `/chat/[id]`**
Likely mostly complete. Verify: model picker reflects currently-loaded models on Mono512. Session resume (`/chat/[id]`) correctly restores message context. Streaming degrades gracefully on slow tunnel.

**Models `/models`** *(highest risk)*
Unknown completeness. Complete means:
- Browse all available models (not just loaded ones)
- See VRAM cost per model before loading
- One-click load with status feedback (not just a spinner)
- One-click unload
- If ❌: wire `useModels` to a list + action buttons — half-day build

**Sessions `/sessions`** *(high risk)*
Unknown completeness. Complete means:
- List sessions with title, model, date
- Search/filter
- Click to resume → navigates to `/chat/[id]`
- Works with both LMX server sessions and local IndexedDB sessions
- If ❌: wire `useSessions` + `useSessionResume` to a list UI — one-day build

### Track 2 Done When

> Open `https://local.optalocal.com` on a phone with mobile data. Sign in. See the dashboard. Load a model. Start a chat. Resume a past session. The TUI is no longer needed for any of this.

---

## Risks

| Risk | Mitigation |
|------|-----------|
| Cloudflare 100s SSE timeout kills dashboard | Enable "No response buffering" in CF dashboard; `useSSE` has reconnect already |
| Admin key security over tunnel | Cloudflare Tunnel is TLS-terminated — key is encrypted in transit, no change needed |
| LAN latency at home when using tunnel | Expected and acceptable — 20-50ms overhead, no fix needed |
| Models or Sessions page is scaffolding | Scoped builds of ≤1 day each; unblocked by Track 1 progress |

---

## Sequence

```
Week 1
├── Track 1: Cloudflare tunnel setup
├── Track 1: Vercel deployment + env vars
├── Track 1: Supabase OAuth config
└── Track 2: Audit Dashboard + Chat

Week 2
├── Track 2: Audit + fix Models page
└── Track 2: Audit + fix Sessions page

Done: First fully remote session replacing TUI
```

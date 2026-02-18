# Phase 4: Web Anywhere - Research

**Researched:** 2026-02-18
**Domain:** Cloudflare Tunnel WAN access with LAN/WAN auto-failover and connection indicators
**Confidence:** HIGH

<research_summary>
## Summary

Researched Cloudflare Tunnel setup for exposing LMX (192.168.188.11:1234) to the internet, LAN vs WAN detection strategies for browser clients, auto-failover patterns, SSE/streaming through tunnels, and CORS implications. Cross-referenced findings against OptaPlus's existing Cloudflare Tunnel implementation (proven in production on optamize.biz domain).

Key findings:
1. **Named tunnels are mandatory** — Quick tunnels (trycloudflare.com) do NOT support SSE and have a 200 concurrent request hard limit. Named tunnels support SSE with the `X-Accel-Buffering: no` header and have no request limits on the free tier.
2. **LMX CORS is already permissive** — `allow_origins=["*"]` in main.py. No CORS changes needed for tunnel access. May want to tighten for production.
3. **LAN detection via health check with timeout** — `AbortSignal.timeout(1500)` on a LAN health check is the proven pattern. If LAN responds within 1.5s, use LAN. If timeout, fall back to tunnel URL. No need for WebRTC/navigator.connection hacks.
4. **Cloudflare provides free TLS** — Admin key travels over HTTPS (browser to Cloudflare edge) then encrypted tunnel (edge to LMX). Secure without any additional TLS config on LMX.
5. **OptaPlus precedent** — Already runs `gateway.optamize.biz` through a named Cloudflare Tunnel on the same infrastructure. Same `optamize.biz` domain can host `lmx.optamize.biz` as an additional ingress rule.

**Primary recommendation:** Use a named Cloudflare Tunnel with `lmx.optamize.biz` hostname, implement LAN-first health check with 1.5s timeout fallback to tunnel, and add connection state machine (LAN/WAN/offline) with visual indicators.
</research_summary>

<standard_stack>
## Standard Stack

### Server-Side (Mac Studio)
| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| cloudflared | latest | Tunnel daemon connecting LMX to Cloudflare edge | Official Cloudflare client, proven in OptaPlus |
| Cloudflare DNS | free tier | DNS management for optamize.biz | Already in use for OptaPlus tunnels |

### Client-Side (Browser)
| API/Pattern | Availability | Purpose | Why Standard |
|-------------|-------------|---------|--------------|
| AbortSignal.timeout() | All modern browsers | Health check timeout for LAN detection | Native API, no dependencies, cleaner than setTimeout+AbortController |
| AbortSignal.any() | Chrome 116+, Safari 17.4+, Firefox 124+ | Combine timeout + user cancellation signals | Native API for composing abort signals |
| fetch + ReadableStream | All modern browsers | Streaming chat through tunnel (same as LAN) | Already used by LMXClient |
| EventSource | All modern browsers | SSE dashboard metrics through tunnel | Already planned for dashboard phase |
| navigator.onLine | All browsers | Coarse online/offline detection | Quick pre-check before health probe |

### No Additional Dependencies
Phase 4 requires **zero new npm packages**. All LAN/WAN detection, failover, and connection indicators use native browser APIs and React state management already in the project. The tunnel is server-side infrastructure only.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Named tunnel | Quick tunnel (trycloudflare.com) | Quick tunnels don't support SSE, 200 request limit, random URLs that change on restart |
| Named tunnel | Tailscale Funnel | Requires VPN app on client device, ugly domain |
| Named tunnel | ngrok | Paid for custom domain, random URLs on free tier |
| AbortSignal.timeout | Promise.race + setTimeout | AbortSignal.timeout is cleaner, properly cancels fetch, no manual cleanup |
| Health check probe | WebRTC local IP detection | WebRTC IP detection deprecated in modern browsers for privacy |
| Health check probe | navigator.connection API | Unreliable, doesn't distinguish LAN vs WAN, limited browser support |
</standard_stack>

<architecture_patterns>
## Architecture Patterns

### Pattern 1: Connection State Machine
**What:** Finite state machine managing LAN/WAN/offline transitions
**When to use:** All connection-related logic in useConnection hook
**States and transitions:**
```
                    ┌─────────────────────┐
                    │      PROBING        │ (initial state)
                    │  health check LAN   │
                    └──────┬──────────────┘
                           │
              ┌────────────┼────────────────┐
              │ LAN ok     │ LAN timeout     │ both fail
              ▼            ▼                 ▼
        ┌──────────┐  ┌──────────┐    ┌──────────┐
        │   LAN    │  │   WAN    │    │ OFFLINE  │
        │  green   │  │  amber   │    │   red    │
        └────┬─────┘  └────┬─────┘    └────┬─────┘
             │              │               │
             │ periodic     │ periodic      │ periodic
             │ re-probe     │ re-probe      │ re-probe
             ▼              ▼               ▼
        ┌──────────────────────────────────────────┐
        │            RE-PROBE (every 30s)          │
        │  Try LAN → if ok, switch to LAN          │
        │  Try WAN → if ok, switch to WAN          │
        │  Both fail → OFFLINE                     │
        └──────────────────────────────────────────┘
```

**Example:**
```typescript
// Connection states
type ConnectionMode = 'probing' | 'lan' | 'wan' | 'offline';

interface ConnectionState {
  mode: ConnectionMode;
  baseUrl: string;
  latency: number | null;     // ms, from last health check
  lastProbe: number;          // timestamp
  consecutiveFailures: number;
}
```

### Pattern 2: LAN-First Health Check with Timeout Fallback
**What:** Probe LAN endpoint with short timeout; if unreachable, try tunnel URL
**When to use:** On app mount, on visibility change, and periodically (30s)
**Example:**
```typescript
const LAN_TIMEOUT_MS = 1500;   // 1.5s — LAN should respond in <100ms
const WAN_TIMEOUT_MS = 8000;   // 8s — tunnel adds ~50-200ms latency
const REPROBE_INTERVAL_MS = 30_000; // Re-check every 30s

async function probeConnection(
  lanUrl: string,
  wanUrl: string,
): Promise<{ mode: 'lan' | 'wan' | 'offline'; latency: number }> {
  // Try LAN first (fast timeout)
  try {
    const start = performance.now();
    const res = await fetch(`${lanUrl}/admin/health`, {
      signal: AbortSignal.timeout(LAN_TIMEOUT_MS),
      headers: { 'X-Admin-Key': adminKey },
    });
    if (res.ok) {
      return { mode: 'lan', latency: performance.now() - start };
    }
  } catch {
    // LAN unreachable — expected when off-network
  }

  // Try WAN (longer timeout)
  if (wanUrl) {
    try {
      const start = performance.now();
      const res = await fetch(`${wanUrl}/admin/health`, {
        signal: AbortSignal.timeout(WAN_TIMEOUT_MS),
        headers: { 'X-Admin-Key': adminKey },
      });
      if (res.ok) {
        return { mode: 'wan', latency: performance.now() - start };
      }
    } catch {
      // WAN also unreachable
    }
  }

  return { mode: 'offline', latency: 0 };
}
```

### Pattern 3: Cloudflare Named Tunnel Configuration
**What:** config.yml ingress rule routing lmx.optamize.biz to LMX server
**When to use:** Server-side setup on Mac Studio (one-time)
**Example:**
```yaml
# ~/.cloudflared/config.yml (add to existing OptaPlus tunnel config)
tunnel: <EXISTING_TUNNEL_UUID>
credentials-file: ~/.cloudflared/<TUNNEL_UUID>.json

ingress:
  # Existing OptaPlus routes
  - hostname: gateway.optamize.biz
    service: http://localhost:18793

  # NEW: Opta Local LMX route
  - hostname: lmx.optamize.biz
    service: http://192.168.188.11:1234
    originRequest:
      connectTimeout: 30s
      noTLSVerify: true    # LMX doesn't have TLS, tunnel handles it

  # Catch-all
  - service: http_status:404
```

```bash
# Route DNS
cloudflared tunnel route dns <TUNNEL_UUID> lmx.optamize.biz

# Restart tunnel to pick up new config
sudo launchctl stop com.cloudflare.cloudflared
sudo launchctl start com.cloudflare.cloudflared
```

### Pattern 4: SSE Through Named Tunnel (Anti-Buffering Headers)
**What:** LMX must send `X-Accel-Buffering: no` header on SSE responses to prevent Cloudflare buffering
**When to use:** All SSE endpoints (/admin/events) when accessed through tunnel
**Example (LMX server-side, FastAPI):**
```python
# In LMX SSE endpoint
from fastapi.responses import StreamingResponse

@router.get("/admin/events")
async def admin_events():
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-store",
            "X-Accel-Buffering": "no",         # Critical for Cloudflare Tunnel
            "Connection": "keep-alive",
        },
    )
```

### Pattern 5: Connection-Aware URL Switching
**What:** getBaseUrl returns LAN or tunnel URL based on current connection state
**When to use:** Every API call and SSE connection
**Example:**
```typescript
// Enhanced connection.ts — getBaseUrl uses live connection state
export function getActiveUrl(
  settings: ConnectionSettings,
  connectionMode: ConnectionMode,
): string {
  if (connectionMode === 'wan' && settings.tunnelUrl) {
    return settings.tunnelUrl.replace(/\/+$/, '');
  }
  // LAN, probing, or offline (try LAN as default)
  return `http://${settings.host}:${settings.port}`;
}
```

### Pattern 6: Visibility-Aware Re-Probing
**What:** Re-probe connection when tab becomes visible (user may have changed networks)
**When to use:** Always — handles laptop lid close/open, WiFi switch scenarios
**Example:**
```typescript
useEffect(() => {
  const handleVisibility = () => {
    if (document.visibilityState === 'visible') {
      // Re-probe immediately when tab becomes visible
      probe();
    }
  };
  document.addEventListener('visibilitychange', handleVisibility);
  return () => document.removeEventListener('visibilitychange', handleVisibility);
}, [probe]);
```

### Anti-Patterns to Avoid
- **No Quick Tunnels (trycloudflare.com):** They don't support SSE, have 200 concurrent request limit, and URL changes on every restart.
- **No WebRTC IP detection:** Deprecated for privacy reasons, unreliable across browsers.
- **No navigator.connection for LAN detection:** Doesn't distinguish LAN vs WAN, only reports connection type (wifi/cellular).
- **No simultaneous LAN+WAN requests (racing):** Wastes bandwidth, creates duplicate requests to LMX. Try sequentially: LAN first (fast timeout), then WAN.
- **No polling fallback:** If SSE works through the tunnel (with anti-buffering headers), don't add a polling fallback. SSE is the right pattern.
- **No CORS tightening yet:** LMX currently has `allow_origins=["*"]`. This is fine for personal use. Tighten when/if multi-user access is needed.
</architecture_patterns>

<dont_hand_roll>
## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| TLS for WAN access | Self-signed certs, Let's Encrypt on LMX | Cloudflare Tunnel (auto TLS at edge) | Tunnel provides TLS automatically, zero cert management |
| DNS management | Dynamic DNS, port forwarding | Cloudflare DNS + Tunnel | Already managing optamize.biz on Cloudflare |
| Reconnection backoff | Custom exponential backoff | Extend existing SSE reconnect (3s interval from Phase 3) | SSE auto-reconnect already designed in Phase 3 |
| Connection state management | useState + multiple booleans | Single useReducer with state machine | State machines prevent impossible states (e.g., LAN and offline simultaneously) |
| Network type detection | WebRTC, navigator.connection, mDNS | Simple health check with AbortSignal.timeout | Health check is the only reliable cross-browser method |
| Tunnel daemon management | systemd/launchd scripts from scratch | `cloudflared service install` | Official command installs and configures launchd plist |
| Header manipulation for SSE | Cloudflare Workers, custom proxy | `X-Accel-Buffering: no` response header on LMX | Single header solves the buffering problem |

**Key insight:** The heavy lifting is done by Cloudflare (TLS, DDoS protection, DNS, edge routing) and by the tunnel daemon (outbound-only connection, no firewall changes). The client-side work is minimal: a health check with timeout, a state machine, and URL switching.
</dont_hand_roll>

<common_pitfalls>
## Common Pitfalls

### Pitfall 1: Using Quick Tunnels Instead of Named Tunnels
**What goes wrong:** SSE streaming doesn't work, dashboard never updates, chat streaming buffers until completion
**Why it happens:** Quick tunnels (trycloudflare.com) do NOT support SSE — events buffer until the connection closes. Also limited to 200 concurrent requests.
**How to avoid:** Always use a named tunnel with a Cloudflare account. Named tunnels support SSE with proper anti-buffering headers. OptaPlus already has a named tunnel on optamize.biz — add an ingress rule.
**Warning signs:** Dashboard metrics arrive all at once instead of streaming; `429 Too Many Requests` responses

### Pitfall 2: SSE Buffering Through Named Tunnel
**What goes wrong:** SSE events through the tunnel arrive in batches instead of real-time, even with named tunnel
**Why it happens:** Cloudflare's edge may buffer responses unless explicitly told not to
**How to avoid:** Add `X-Accel-Buffering: no` header to ALL streaming responses from LMX (both SSE and chat streaming). Also add `Cache-Control: no-cache, no-store`.
**Warning signs:** Events arrive in ~100KB chunks; dashboard updates in bursts

### Pitfall 3: LAN Health Check Timeout Too Short or Too Long
**What goes wrong:** False negatives (LAN reported as offline when it's just slow) or slow failover (user waits 10s before WAN kicks in)
**Why it happens:** LAN should respond in <100ms. If timeout is 500ms, congested WiFi might false-negative. If timeout is 5s, the failover feels sluggish.
**How to avoid:** Use 1500ms LAN timeout. This accommodates slow WiFi while still being fast enough for good UX. If the first probe fails but subsequent ones succeed, bump to LAN.
**Warning signs:** Connection indicator flickering between LAN and WAN; users on slow WiFi constantly falling back to tunnel

### Pitfall 4: CORS Preflight on Tunneled Requests
**What goes wrong:** Browser sends OPTIONS preflight to tunnel URL, gets blocked or times out
**Why it happens:** LMX runs on a different origin (lmx.optamize.biz) from the web app (localhost:3004 or deployed URL). Requests with custom headers (X-Admin-Key) trigger CORS preflight.
**How to avoid:** LMX already has `allow_origins=["*"]` + `allow_methods=["*"]` + `allow_headers=["*"]` — this handles preflight correctly. Verify by checking OPTIONS response includes `Access-Control-Allow-Origin: *`. Tunnel preserves all origin-server headers.
**Warning signs:** Network tab shows CORS errors on PUT/POST but GET works; OPTIONS requests returning 404 or 403

### Pitfall 5: EventSource Doesn't Support Custom Headers
**What goes wrong:** Can't pass `X-Admin-Key` header via EventSource for tunneled SSE
**Why it happens:** The browser EventSource API doesn't support custom headers — by design
**How to avoid:** Pass admin key as query parameter: `/admin/events?key=<key>`. This is acceptable because the tunnel provides TLS encryption. Alternatively, use fetch-based SSE (ReadableStream) which supports custom headers. Decision from Phase 1 already notes this.
**Warning signs:** SSE connects but returns 401/403; EventSource onopen fires but no data arrives

### Pitfall 6: Mixed Content (HTTP LAN + HTTPS Tunnel)
**What goes wrong:** If the web app is served over HTTPS (e.g., deployed on Vercel), browser blocks fetch to `http://192.168.188.11:1234` (mixed content)
**Why it happens:** Browsers block HTTP requests from HTTPS pages for security
**How to avoid:** During development (localhost:3004 over HTTP), this isn't an issue. For production deployment, the app will need to detect deployment context: if served over HTTPS, only tunnel URL is available (also HTTPS). LAN mode only works when app is served over HTTP (local dev or self-hosted). Add a check: `window.location.protocol === 'https:' && connectionMode === 'lan'` should force WAN mode.
**Warning signs:** Fetch fails silently; network tab shows `net::ERR_BLOCKED_MIXED_CONTENT`

### Pitfall 7: Stale Connection State After Network Switch
**What goes wrong:** User moves from WiFi to cellular, but app still tries LAN URL for minutes
**Why it happens:** Periodic re-probe only runs every 30s; no event listener for network changes
**How to avoid:** Listen for `visibilitychange` (tab becomes visible) and `online` events. Re-probe immediately on these events. Also re-probe on any fetch failure (opportunistic).
**Warning signs:** App shows "connected (LAN)" but all requests fail; user has to manually refresh
</common_pitfalls>

<code_examples>
## Code Examples

### Cloudflare Tunnel Setup (Mac Studio, One-Time)
```bash
# Source: Cloudflare docs + OptaPlus precedent

# 1. Install cloudflared (if not already installed for OptaPlus)
brew install cloudflare/cloudflare/cloudflared

# 2. Login (if not already authenticated)
cloudflared tunnel login

# 3. If tunnel already exists (OptaPlus), just add DNS route:
cloudflared tunnel route dns <EXISTING_TUNNEL_NAME> lmx.optamize.biz

# 4. Add ingress rule to existing config.yml:
#    Edit ~/.cloudflared/config.yml (or /etc/cloudflared/config.yml if service)
#    Add before catch-all:
#      - hostname: lmx.optamize.biz
#        service: http://192.168.188.11:1234

# 5. Restart tunnel
sudo launchctl stop com.cloudflare.cloudflared
sudo launchctl start com.cloudflare.cloudflared

# 6. Verify
curl https://lmx.optamize.biz/admin/health -H "X-Admin-Key: <key>"
```

### Connection Manager Hook (useConnection.ts)
```typescript
// Source: Pattern derived from OptaPlus reconnect logic + AbortSignal.timeout MDN docs

import { useReducer, useEffect, useCallback, useRef } from 'react';
import { getConnectionSettings, type ConnectionSettings } from '@/lib/connection';

// --- Types ---

type ConnectionMode = 'probing' | 'lan' | 'wan' | 'offline';

interface ConnectionState {
  mode: ConnectionMode;
  latency: number | null;
  error: string | null;
}

type ConnectionAction =
  | { type: 'PROBE_START' }
  | { type: 'LAN_OK'; latency: number }
  | { type: 'WAN_OK'; latency: number }
  | { type: 'ALL_FAILED'; error: string }
  | { type: 'DISCONNECTED' };

// --- Reducer (state machine) ---

function connectionReducer(
  state: ConnectionState,
  action: ConnectionAction,
): ConnectionState {
  switch (action.type) {
    case 'PROBE_START':
      return { ...state, mode: 'probing', error: null };
    case 'LAN_OK':
      return { mode: 'lan', latency: action.latency, error: null };
    case 'WAN_OK':
      return { mode: 'wan', latency: action.latency, error: null };
    case 'ALL_FAILED':
      return { mode: 'offline', latency: null, error: action.error };
    case 'DISCONNECTED':
      return { ...state, mode: 'probing' };
    default:
      return state;
  }
}

// --- Constants ---

const LAN_TIMEOUT_MS = 1500;
const WAN_TIMEOUT_MS = 8000;
const REPROBE_INTERVAL_MS = 30_000;

// --- Hook ---

export function useConnection(settings: ConnectionSettings) {
  const [state, dispatch] = useReducer(connectionReducer, {
    mode: 'probing',
    latency: null,
    error: null,
  });

  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  const probe = useCallback(async () => {
    dispatch({ type: 'PROBE_START' });
    const lanUrl = `http://${settings.host}:${settings.port}`;

    // Try LAN first
    try {
      const start = performance.now();
      const res = await fetch(`${lanUrl}/admin/health`, {
        signal: AbortSignal.timeout(LAN_TIMEOUT_MS),
        headers: { 'X-Admin-Key': settings.adminKey },
      });
      if (res.ok) {
        dispatch({ type: 'LAN_OK', latency: Math.round(performance.now() - start) });
        return;
      }
    } catch {
      // LAN unavailable — expected off-network
    }

    // Try WAN
    if (settings.useTunnel && settings.tunnelUrl) {
      const wanUrl = settings.tunnelUrl.replace(/\/+$/, '');
      try {
        const start = performance.now();
        const res = await fetch(`${wanUrl}/admin/health`, {
          signal: AbortSignal.timeout(WAN_TIMEOUT_MS),
          headers: { 'X-Admin-Key': settings.adminKey },
        });
        if (res.ok) {
          dispatch({ type: 'WAN_OK', latency: Math.round(performance.now() - start) });
          return;
        }
      } catch {
        // WAN also unavailable
      }
    }

    dispatch({ type: 'ALL_FAILED', error: 'Server unreachable via LAN and WAN' });
  }, [settings]);

  // Initial probe + periodic re-probe
  useEffect(() => {
    probe();
    intervalRef.current = setInterval(probe, REPROBE_INTERVAL_MS);
    return () => clearInterval(intervalRef.current);
  }, [probe]);

  // Re-probe on visibility change (tab refocus, lid open)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') probe();
    };
    const handleOnline = () => probe();

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('online', handleOnline);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('online', handleOnline);
    };
  }, [probe]);

  // Active base URL based on connection state
  const baseUrl =
    state.mode === 'wan' && settings.tunnelUrl
      ? settings.tunnelUrl.replace(/\/+$/, '')
      : `http://${settings.host}:${settings.port}`;

  return { ...state, baseUrl, probe };
}
```

### Connection Status Indicator Component
```typescript
// Source: Pattern from Opta design system (glass + neon accents)
// components/shared/ConnectionIndicator.tsx

'use client';

import { cn } from '@opta/ui';
import type { ConnectionMode } from '@/hooks/useConnection';

const modeConfig = {
  probing: {
    label: 'Connecting...',
    color: 'bg-blue-400',
    pulse: true,
    textColor: 'text-blue-400',
  },
  lan: {
    label: 'LAN',
    color: 'bg-neon-green',
    pulse: false,
    textColor: 'text-neon-green',
  },
  wan: {
    label: 'WAN',
    color: 'bg-neon-amber',
    pulse: false,
    textColor: 'text-neon-amber',
  },
  offline: {
    label: 'Offline',
    color: 'bg-neon-red',
    pulse: true,
    textColor: 'text-neon-red',
  },
} as const;

interface ConnectionIndicatorProps {
  mode: ConnectionMode;
  latency: number | null;
  className?: string;
}

export function ConnectionIndicator({
  mode,
  latency,
  className,
}: ConnectionIndicatorProps) {
  const config = modeConfig[mode];

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* Status dot */}
      <span className="relative flex h-2.5 w-2.5">
        {config.pulse && (
          <span
            className={cn(
              'absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping',
              config.color,
            )}
          />
        )}
        <span
          className={cn(
            'relative inline-flex h-2.5 w-2.5 rounded-full',
            config.color,
          )}
        />
      </span>

      {/* Label + latency */}
      <span className={cn('text-xs font-medium', config.textColor)}>
        {config.label}
        {latency !== null && mode !== 'offline' && (
          <span className="text-zinc-500 ml-1">
            {latency}ms
          </span>
        )}
      </span>
    </div>
  );
}
```

### Tunnel Settings UI Section
```typescript
// Source: Pattern from existing connection settings + tunnel config
// In settings/tunnel/page.tsx or settings page tunnel section

// ConnectionSettings already has these fields:
// { host, port, adminKey, useTunnel, tunnelUrl }

// The tunnel settings section would include:
// - Toggle: "Enable Cloudflare Tunnel" (useTunnel boolean)
// - Input: "Tunnel URL" (tunnelUrl string, e.g., "https://lmx.optamize.biz")
// - Status: Live connection probe result showing LAN/WAN/offline
// - Test button: Manually trigger probe to verify settings

// The existing getBaseUrl() function already handles the switch:
export function getBaseUrl(settings: ConnectionSettings): string {
  if (settings.useTunnel && settings.tunnelUrl) {
    return settings.tunnelUrl.replace(/\/+$/, '');
  }
  return `http://${settings.host}:${settings.port}`;
}
// Phase 4 extends this by making the switch AUTOMATIC based on probe results
// rather than manual toggle only.
```

### Mixed Content Guard
```typescript
// Source: Browser security model (mixed content blocking)
// In useConnection hook or connection.ts

/**
 * Check if LAN mode is available given current page protocol.
 * HTTPS pages cannot fetch HTTP resources (mixed content).
 */
export function isLanAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  // LAN uses http:// — only works if page is also http://
  return window.location.protocol === 'http:';
}

// In probe logic:
// if (!isLanAvailable()) skip LAN probe, go straight to WAN
```
</code_examples>

<sota_updates>
## State of the Art (2025-2026)

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| ngrok for tunneling | Cloudflare Tunnel (free, custom domain, no limits) | 2023+ | Free tier with custom domains, no per-connection pricing |
| Quick tunnels for dev | Named tunnels even for dev | 2025 (SSE issue confirmed) | Quick tunnels don't support SSE, named tunnels do |
| WebRTC for LAN detection | AbortSignal.timeout health check | 2024+ (WebRTC IP deprecated) | WebRTC local IP detection blocked by browsers for privacy |
| setTimeout + AbortController | AbortSignal.timeout() static method | 2023 (shipped in all browsers) | Cleaner API, auto-cleanup, proper error types |
| Manual abort signal wiring | AbortSignal.any() for composing signals | 2024 (Chrome 116, Safari 17.4) | Combine timeout + user cancel without manual orchestration |
| Polling for connection check | visibilitychange + online events | Always available | Event-driven re-probe instead of wasteful polling |
| X-Forwarded-For trust | Cloudflare Tunnel trusted proxy | Standard | Tunnel daemon adds real client IP in trusted header |

**New tools/patterns to consider:**
- **Cloudflare Zero Trust Access:** Could add email OTP in front of tunnel for extra security. Skip for now (personal use), add later if sharing with others.
- **Cloudflare Tunnel run --protocol quic:** QUIC protocol option may improve latency for SSE. Default is HTTP/2. Worth testing.
- **React 19 `use()` for connection state:** Could replace useEffect-based connection management with Suspense-compatible patterns in future refactor.

**Deprecated/outdated:**
- **Quick tunnels for production use:** Explicitly documented as "demo product" by Cloudflare. SSE doesn't work.
- **WebRTC local IP detection:** Browsers now mask local IPs. Do not use.
- **navigator.connection.type:** Unreliable, limited browser support, doesn't distinguish LAN vs WAN.
- **Argo Tunnel (old name):** Renamed to Cloudflare Tunnel. Same product, new branding.
</sota_updates>

<open_questions>
## Open Questions

1. **LMX /admin/health endpoint existence**
   - What we know: LMX has `/admin/status` (returns full server status). The health check probe needs a lightweight endpoint.
   - What's unclear: Whether a dedicated `/admin/health` endpoint exists (200 OK, minimal payload)
   - Recommendation: If not, add one to LMX — simple 200 response with `{"ok": true}`. Using `/admin/status` for probing works but is heavier than needed.
   - Impact: LOW — can use `/admin/status` as fallback, just slightly more bandwidth per probe.

2. **Existing Cloudflare Tunnel on Mac Studio**
   - What we know: OptaPlus uses a named tunnel on optamize.biz with ingress rules for gateway.optamize.biz and bot subdomains.
   - What's unclear: Whether cloudflared runs on the MacBook (192.168.188.9) or Mac Studio (192.168.188.11). If on MacBook, routing to 192.168.188.11:1234 requires LAN access from cloudflared host.
   - Recommendation: Check where cloudflared is installed. Ideal: run on Mac Studio so it can route to localhost:1234. If on MacBook, route to 192.168.188.11:1234 (LAN).
   - Impact: MEDIUM — affects config.yml service URL (localhost vs 192.168.188.11).

3. **X-Accel-Buffering header on LMX streaming endpoints**
   - What we know: LMX uses FastAPI StreamingResponse for SSE. Named tunnels support SSE with anti-buffering headers.
   - What's unclear: Whether LMX already includes `X-Accel-Buffering: no` on streaming responses
   - Recommendation: Check LMX SSE endpoint code. If missing, add it — single line change.
   - Impact: HIGH — without this header, SSE through tunnel may buffer and break real-time dashboard.

4. **Mixed content on deployed web app**
   - What we know: If Opta Local Web is deployed on Vercel (HTTPS), LAN mode (HTTP) is blocked by mixed content policy
   - What's unclear: Whether Opta Local Web will be deployed publicly or only run locally
   - Recommendation: Build the mixed content guard (check `window.location.protocol`). If HTTPS, auto-force WAN mode. LAN mode only when running local dev server.
   - Impact: MEDIUM — affects deployment story. If local-only, no issue. If deployed, LAN mode unavailable.

5. **Admin key in query params for tunneled EventSource**
   - What we know: EventSource doesn't support custom headers. Phase 1 noted passing key as query param.
   - What's unclear: Whether `?key=<value>` appears in Cloudflare access logs or tunnel logs (potential key exposure)
   - Recommendation: Cloudflare encrypts the full URL (including query params) in transit via TLS. Query params may appear in Cloudflare's dashboard/logs. For personal use, acceptable. For enhanced security, switch to fetch-based SSE (ReadableStream) which supports custom headers.
   - Impact: LOW for personal use. Consider fetch-based SSE if sharing access.
</open_questions>

<sources>
## Sources

### Primary (HIGH confidence)
- [Cloudflare Quick Tunnels docs](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/trycloudflare/) — Quick tunnel limitations: no SSE, 200 concurrent request limit, random URLs
- [Cloudflare Tunnel: Create locally-managed tunnel](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/local-management/create-local-tunnel/) — Named tunnel setup: commands, config.yml format, DNS routing
- [Cloudflare Tunnel overview](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/) — Architecture: outbound-only connections, TLS termination at edge
- OptaPlus CLOUDFLARE-TUNNEL-RESEARCH.md (`1-Apps/1I-OptaPlus/docs/cloud-relay/research/`) — Proven tunnel setup on optamize.biz, ingress rules, launchd service, security analysis
- OptaPlus OPTAPLUS-NETWORKING-CURRENT.md — LAN/WAN detection patterns, reconnect logic, Origin header handling
- LMX main.py (`1-Apps/1J-Opta-LMX/src/opta_lmx/main.py`) — Confirmed CORS: `allow_origins=["*"]`, permissive for all origins
- Opta Local connection.ts (`1-Apps/1L-Opta-Local/web/src/lib/connection.ts`) — Existing ConnectionSettings type with useTunnel/tunnelUrl fields

### Secondary (MEDIUM confidence)
- [cloudflared GitHub: SSE Quick Tunnel issue #1449](https://github.com/cloudflare/cloudflared/issues/1449) — Confirmed SSE works on named tunnels, broken on quick tunnels. Cloudflare staff response.
- [Cloudflare CORS docs](https://developers.cloudflare.com/cloudflare-one/identity/authorization-cookie/cors/) — CORS handling through tunnels: preflight bypass, Access integration
- [MDN AbortSignal.timeout()](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static) — Browser API for fetch timeout, TimeoutError handling
- [MDN AbortSignal.any()](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal) — Composing multiple abort signals
- [Cloudflare Tunnel free setup guide](https://blockqueue.io/blog/2025-08-13-cloudflared-an-nginx-alternative) — Complete named tunnel setup with custom domain, free tier confirmation
- [cloudflared GitHub repository](https://github.com/cloudflare/cloudflared) — Official tunnel client
- Context7 /cloudflare/cloudflared — CLI commands, config.yml format, CORS middleware patterns

### Tertiary (LOW confidence - needs validation)
- SSE buffering with `X-Accel-Buffering: no` header — reported working by community members but edge behavior may vary; needs testing with actual LMX SSE endpoints through tunnel
- 30s re-probe interval — chosen heuristically; may need tuning based on real usage patterns (too frequent wastes bandwidth, too infrequent feels stale)
- Mixed content guard for deployed app — theoretical concern; actual deployment strategy not yet decided
</sources>

<metadata>
## Metadata

**Research scope:**
- Infrastructure: Cloudflare Tunnel (named), cloudflared daemon, DNS routing, TLS
- Client-side: LAN/WAN detection, AbortSignal.timeout, connection state machine, visual indicators
- Server-side: CORS verification, anti-buffering headers, ingress rules
- Security: TLS via tunnel, admin key over HTTPS, mixed content, query param exposure
- Cross-reference: OptaPlus tunnel research, LMX CORS config, existing connection.ts

**Confidence breakdown:**
- Cloudflare Tunnel setup: HIGH — verified against OptaPlus production deployment + official docs
- SSE through named tunnels: HIGH — confirmed by Cloudflare staff on GitHub issue #1449
- LAN detection via health check: HIGH — standard pattern, AbortSignal.timeout is well-supported
- Auto-failover state machine: MEDIUM — pattern is sound, timing constants need real-world tuning
- Mixed content implications: MEDIUM — theoretical, depends on deployment strategy
- Admin key query param security: MEDIUM — TLS protects in transit, but appears in server logs

**Research date:** 2026-02-18
**Valid until:** 2026-04-18 (60 days — Cloudflare Tunnel is stable, browser APIs are stable)
</metadata>

---

*Phase: 04-web-anywhere*
*Research completed: 2026-02-18*
*Ready for planning: yes*

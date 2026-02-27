# Auth-First Dashboard Design

> Date: 2026-02-28
> Status: Approved
> Scope: Opta Local Web (`1-Apps/1L-Opta-Local/web/`)

---

## Summary

Replace the current dual-mode (LAN anonymous / Cloud authenticated) architecture with a mandatory Supabase sign-in flow. The sign-in renders as a frosted overlay on top of the blurred dashboard, creating an animated reveal transition on authentication. Connection settings sync to Supabase per-user, with daemon handshake for zero-config auto-discovery.

---

## App Flow

```
Browser opens
  ├── Has valid Supabase session? → Dashboard (authenticated, live data)
  └── No session? → Sign-in overlay appears over blurred dashboard
        ├── Google OAuth
        ├── Apple OAuth
        └── Email / password
        → Overlay exits with spring animation → Dashboard revealed
```

After authentication, ConnectionProvider mounts and resolves the LMX server:

```
1. Fetch user_settings from Supabase (canonical, cross-device)
2. If no saved settings → probe daemon at localhost:9999/v3/config
   → Auto-populate host, port, admin key
   → Save to Supabase + localStorage cache
3. If no daemon → use hardcoded defaults (192.168.188.11:1234)
4. Probe LMX at resolved host:port → connected
```

---

## Visual Architecture

```
z-0   Dashboard page (renders with empty/placeholder data, CSS blur-xl)
z-10  Frosted scrim (backdrop-blur-xl + bg-black/80)
z-20  Opta ring (breathe animation, centered above card)
z-30  Sign-in glass card (max-w-[420px], centered)
```

### Reveal Transition (after successful auth)

| Step | Element | Animation | Timing |
|------|---------|-----------|--------|
| 1 | Sign-in card | scale(1→0.95), opacity(1→0), y(0→-8) | 200ms spring (stiffness 300, damping 25) |
| 2 | Opta ring | scale(1→1.2), opacity(0.6→0) | 500ms ease-out |
| 3 | Frosted scrim | opacity(1→0) | 400ms ease-out, 100ms delay |
| 4 | Dashboard | blur(24px→0), scale(1.01→1) | 500ms CSS transition (ease-out) |

Steps 1-3 use Framer Motion AnimatePresence exit variants.
Step 4 uses CSS `transition-[filter]` driven by session state.

---

## Sign-In Card Layout

```
┌──────────────────────┐
│                      │
│     ◯  Opta Ring     │
│    (breathe anim)    │
│                      │
│  ┌── glass card ──┐  │
│  │                │  │
│  │  ● Google      │  │
│  │  ● Apple       │  │
│  │  ─── or ───   │  │
│  │  Email input   │  │
│  │  Password      │  │
│  │  [Sign in]     │  │
│  │                │  │
│  └────────────────┘  │
│                      │
│  (blurred dashboard) │
└──────────────────────┘
```

No "Continue without account" link. Auth is mandatory.

---

## Supabase Schema: user_settings

```sql
create table user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  lmx_host text not null default '192.168.188.11',
  lmx_port int not null default 1234,
  admin_key_encrypted text,
  tunnel_url text,
  use_tunnel boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table user_settings enable row level security;

create policy "Users read own settings"
  on user_settings for select using (auth.uid() = user_id);

create policy "Users write own settings"
  on user_settings for all using (auth.uid() = user_id);
```

Settings load priority: Supabase → daemon handshake → hardcoded defaults.

---

## Daemon Handshake

Endpoint: `GET localhost:9999/v3/config`

Response:
```json
{
  "lmx_host": "192.168.188.11",
  "lmx_port": 1234,
  "admin_key": "sk-...",
  "tunnel_url": "https://lmx.optamize.biz"
}
```

Local-only (127.0.0.1 bound). No auth required. 50ms timeout.
Called only when Supabase has no saved settings for the user.

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/components/shared/SignInOverlay.tsx` | Glass card + Opta ring + frosted scrim overlay |
| `src/lib/daemon-handshake.ts` | `fetchDaemonConfig()` probe function |
| `supabase/migrations/004_user_settings.sql` | user_settings table + RLS policies |
| `src/lib/supabase/settings.ts` | `getUserSettings()` / `saveUserSettings()` Server Actions |

## Files to Modify

| File | Change |
|------|--------|
| `src/app/layout.tsx` | Mount SignInOverlay in AnimatePresence, add blur wrapper |
| `src/app/sign-in/page.tsx` | Minimal shell rendering SignInOverlay for /auth/callback returns |
| `src/components/shared/AppShell.tsx` | Remove auth-gating, sign-in nav items |
| `src/components/shared/AuthProvider.tsx` | Remove useAuthSafe(), simplify to useAuth() only |
| `src/components/shared/ConnectionProvider.tsx` | Add daemon handshake + Supabase settings fetch |
| `src/lib/connection.ts` | Integrate daemon handshake, Supabase settings read/write |
| `src/middleware.ts` | Route protection: unauthenticated → /sign-in |
| `src/app/settings/account/page.tsx` | Remove LAN-only and unauthed states |
| `src/app/pair/page.tsx` | Remove sign-in guard |
| `src/app/devices/page.tsx` | Remove sign-in CTA state |
| `src/app/page.tsx` | Replace useAuthSafe() with useAuth() |
| `src/components/chat/ChatContainer.tsx` | Replace useAuthSafe() with useAuth() |

## Dead Code to Remove

- `useAuthSafe()` export from AuthProvider.tsx
- `isLanAvailable()` from connection.ts
- "Continue without account" from sign-in page
- Three-state logic in settings/account
- `isCloudMode` flag from AuthProvider

---

## Implementation Order

1. **Supabase migration** — create user_settings table
2. **Middleware route protection** — enforce auth on all routes
3. **SignInOverlay component** — glass card with OAuth + email/password
4. **Layout integration** — mount overlay, add blur wrapper
5. **Auth simplification** — replace useAuthSafe → useAuth everywhere
6. **Daemon handshake** — auto-discovery function
7. **ConnectionProvider upgrade** — Supabase settings + daemon fallback
8. **Settings page update** — save to Supabase instead of only localStorage
9. **Cleanup** — remove dead code, LAN-only states, guards

---
status: review
---

# OptaLocal.com Completion Plan — 2026-02-26

## Current State Audit

### ✅ What already exists
1. **Migration file exists** at:
   - `/Users/matthewbyrden/Synced/Opta/1-Apps/optalocal/1L-Opta-Local/supabase/migrations/001_cloud_sync.sql`
2. **Supabase URL is configured**:
   - `NEXT_PUBLIC_SUPABASE_URL=https://cytjsmezydytbmjrolyz.supabase.co`
3. **Cloud tables are reachable via Supabase REST API** (HTTP 200):
   - `devices`
   - `cloud_sessions`
   - `cloud_messages`
4. **App code actively uses these tables** in:
   - `web/src/app/devices/page.tsx`
   - `web/src/app/pair/page.tsx`
   - `web/src/hooks/useDevices.ts`
   - `web/src/lib/cloud-sync.ts`
   - `web/src/types/cloud.ts`

### ⚠️ What is missing / needs confirmation
1. **Redirect URL likely not added yet** in Supabase Auth:
   - Needs wildcard: `https://lmx.optalocal.com/**`
2. **Migration location mismatch**:
   - Expected by instruction: `web/supabase/migrations/001_cloud_sync.sql`
   - Actual file: `supabase/migrations/001_cloud_sync.sql` (project root)
3. **Cloudflare Tunnel for WAN LMX access** needs to be run on Mono512.

---

## Step-by-Step Completion Actions

## 1) Add Supabase redirect URL
Open:
- https://supabase.com/dashboard/project/cytjsmezydytbmjrolyz/auth/url-configuration

In **Redirect URLs**, add:
- `https://lmx.optalocal.com/**`

Keep existing localhost redirect(s) for dev.

---

## 2) Run migration SQL in Supabase SQL Editor (only if needed)
Open SQL Editor in project `cytjsmezydytbmjrolyz` and paste the SQL below.

> If your tables already exist, this may error on duplicates. In that case, skip running and move to step 3.

```sql
-- ============================================================================
-- Opta Local — Cloud Sync Schema (Phase 6)
-- ============================================================================

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.devices (
  id             uuid        primary key default gen_random_uuid(),
  user_id        uuid        not null references auth.users(id) on delete cascade,
  name           text        not null,
  role           text        not null check (role in ('llm_host', 'workstation')),
  helper_enabled boolean     not null default false,
  helper_config  jsonb,
  hostname       text,
  lan_ip         text,
  lan_port       int         default 1234,
  tunnel_url     text,
  capabilities   jsonb,
  last_seen_at   timestamptz default now(),
  is_online      boolean     not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index idx_devices_user_id      on public.devices (user_id);
create index idx_devices_user_id_role on public.devices (user_id, role);

create trigger set_devices_updated_at
  before update on public.devices
  for each row
  execute function public.handle_updated_at();

create table public.cloud_sessions (
  id            uuid        primary key,
  user_id       uuid        not null references auth.users(id) on delete cascade,
  device_id     uuid        references public.devices(id) on delete set null,
  title         text        not null default 'New Chat',
  model         text        not null,
  message_count int         not null default 0,
  token_count   int         not null default 0,
  parent_id     uuid        references public.cloud_sessions(id) on delete set null,
  branch_point  int,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index idx_cloud_sessions_user_id            on public.cloud_sessions (user_id);
create index idx_cloud_sessions_user_id_updated_at on public.cloud_sessions (user_id, updated_at desc);
create index idx_cloud_sessions_device_id          on public.cloud_sessions (device_id);

create trigger set_cloud_sessions_updated_at
  before update on public.cloud_sessions
  for each row
  execute function public.handle_updated_at();

create table public.cloud_messages (
  id          text        primary key,
  session_id  uuid        not null references public.cloud_sessions(id) on delete cascade,
  user_id     uuid        not null references auth.users(id) on delete cascade,
  role        text        not null check (role in ('user', 'assistant', 'system', 'tool')),
  content     text        not null default '',
  model       text,
  tool_calls  jsonb,
  token_usage jsonb,
  created_at  timestamptz not null default now(),
  index       int         not null
);

create index idx_cloud_messages_session_id       on public.cloud_messages (session_id);
create index idx_cloud_messages_session_id_index on public.cloud_messages (session_id, index);

alter table public.devices enable row level security;
alter table public.cloud_sessions enable row level security;
alter table public.cloud_messages enable row level security;

create policy "devices_select_own" on public.devices for select using (user_id = auth.uid());
create policy "devices_insert_own" on public.devices for insert with check (user_id = auth.uid());
create policy "devices_update_own" on public.devices for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "devices_delete_own" on public.devices for delete using (user_id = auth.uid());

create policy "cloud_sessions_select_own" on public.cloud_sessions for select using (user_id = auth.uid());
create policy "cloud_sessions_insert_own" on public.cloud_sessions for insert with check (user_id = auth.uid());
create policy "cloud_sessions_update_own" on public.cloud_sessions for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "cloud_sessions_delete_own" on public.cloud_sessions for delete using (user_id = auth.uid());

create policy "cloud_messages_select_own" on public.cloud_messages for select using (user_id = auth.uid());
create policy "cloud_messages_insert_own" on public.cloud_messages for insert with check (user_id = auth.uid());
create policy "cloud_messages_update_own" on public.cloud_messages for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "cloud_messages_delete_own" on public.cloud_messages for delete using (user_id = auth.uid());
```

---

## 3) Start Cloudflare Tunnel on Mono512
On Mono512, run:

```bash
cloudflared tunnel --url http://192.168.188.11:1234
```

If needed for persistence later, convert to named tunnel + service.

---

## 4) Test checklist (must pass)
1. Open `https://lmx.optalocal.com`
2. Sign in with Supabase auth (redirect completes successfully)
3. Open **Devices** page
   - Device list loads without table errors
4. Create/update a chat session
5. Confirm cloud sync works:
   - `cloud_sessions` receives row
   - `cloud_messages` receives rows
6. Reload page / second device sanity check:
   - session appears and messages are consistent

---

## Estimated time to complete
- Redirect URL config: **2 minutes**
- Migration run/verify (if needed): **8–12 minutes**
- Cloudflare Tunnel command + check: **5–8 minutes**
- End-to-end testing: **10–15 minutes**

**Total estimate: 25–37 minutes**

---

## Notes
- The migration appears to have been applied already in at least one environment (REST endpoints return 200), but you should still confirm row-level access under your user session.
- If you want strict repo consistency, copy `001_cloud_sync.sql` into `web/supabase/migrations/` or update docs/scripts to point at root `supabase/migrations/`.

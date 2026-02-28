-- Accounts capability + device policy foundation (draft)
-- Apply in staging first.

create table if not exists public.accounts_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.accounts_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_label text not null,
  platform text not null,
  fingerprint_hash text,
  trust_state text not null default 'trusted',
  last_seen_at timestamptz,
  last_ip inet,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.accounts_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id uuid references public.accounts_devices(id) on delete set null,
  session_type text not null,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.accounts_capability_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id uuid references public.accounts_devices(id) on delete cascade,
  scope text not null,
  granted boolean not null default true,
  granted_by uuid references auth.users(id) on delete set null,
  reason text,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.accounts_provider_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  status text not null default 'connected',
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.accounts_audit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  device_id uuid references public.accounts_devices(id) on delete set null,
  event_type text not null,
  risk_level text not null default 'low',
  decision text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_accounts_devices_user on public.accounts_devices(user_id);
create index if not exists idx_accounts_sessions_user on public.accounts_sessions(user_id);
create index if not exists idx_accounts_capability_user_scope on public.accounts_capability_grants(user_id, scope);
create index if not exists idx_accounts_audit_user_created on public.accounts_audit_events(user_id, created_at desc);

alter table public.accounts_profiles enable row level security;
alter table public.accounts_devices enable row level security;
alter table public.accounts_sessions enable row level security;
alter table public.accounts_capability_grants enable row level security;
alter table public.accounts_provider_connections enable row level security;
alter table public.accounts_audit_events enable row level security;

-- User self-access policies
drop policy if exists accounts_profiles_self_select on public.accounts_profiles;
create policy accounts_profiles_self_select on public.accounts_profiles
for select using (auth.uid() = id);

drop policy if exists accounts_profiles_self_update on public.accounts_profiles;
create policy accounts_profiles_self_update on public.accounts_profiles
for update using (auth.uid() = id);

drop policy if exists accounts_devices_self_rw on public.accounts_devices;
create policy accounts_devices_self_rw on public.accounts_devices
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists accounts_sessions_self_select on public.accounts_sessions;
create policy accounts_sessions_self_select on public.accounts_sessions
for select using (auth.uid() = user_id);

drop policy if exists accounts_provider_connections_self_rw on public.accounts_provider_connections;
create policy accounts_provider_connections_self_rw on public.accounts_provider_connections
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists accounts_capability_grants_self_select on public.accounts_capability_grants;
create policy accounts_capability_grants_self_select on public.accounts_capability_grants
for select using (auth.uid() = user_id);

drop policy if exists accounts_audit_events_self_select on public.accounts_audit_events;
create policy accounts_audit_events_self_select on public.accounts_audit_events
for select using (auth.uid() = user_id);

-- NOTE: admin write policies for grants/audit insertion should be added via service role functions.

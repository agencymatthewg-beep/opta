-- ============================================================================
-- Opta Local — Cloud Sync Schema (Phase 6)
--
-- Creates the core tables for cross-device session sync:
--   - devices:         registered machines (LLM hosts + workstations)
--   - cloud_sessions:  synced chat sessions with branching support
--   - cloud_messages:  individual messages within sessions
--
-- All tables enforce row-level security scoped to auth.uid().
-- ============================================================================

-- --------------------------------------------------------------------------
-- Helper: updated_at trigger function
-- --------------------------------------------------------------------------

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

-- --------------------------------------------------------------------------
-- Table: devices
-- --------------------------------------------------------------------------

create table public.devices (
  id             uuid        primary key default gen_random_uuid(),
  user_id        uuid        not null references auth.users(id) on delete cascade,
  name           text        not null,
  role           text        not null check (role in ('llm_host', 'workstation')),
  helper_enabled boolean     not null default false,
  helper_config  jsonb,                          -- {endpoint_url, models[], max_vram_gb}
  hostname       text,
  lan_ip         text,
  lan_port       int         default 1234,
  tunnel_url     text,
  capabilities   jsonb,                          -- {models_loaded[], vram_gb, vram_total_gb, os, arch}
  last_seen_at   timestamptz default now(),
  is_online      boolean     not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table  public.devices is 'Registered machines in the Opta ecosystem.';
comment on column public.devices.role is 'Either llm_host (runs models) or workstation (consumes inference).';
comment on column public.devices.helper_config is 'JSON: {endpoint_url, models[], max_vram_gb}. Only meaningful when helper_enabled = true.';
comment on column public.devices.capabilities is 'JSON: {models_loaded[], vram_gb, vram_total_gb, os, arch}. Populated by heartbeat.';
comment on column public.devices.is_online is 'Set by the application based on last_seen_at freshness (within 2 minutes). Not a generated column — Postgres cannot use volatile functions in generated columns.';

-- Indexes
create index idx_devices_user_id      on public.devices (user_id);
create index idx_devices_user_id_role on public.devices (user_id, role);

-- Auto-update updated_at
create trigger set_devices_updated_at
  before update on public.devices
  for each row
  execute function public.handle_updated_at();

-- --------------------------------------------------------------------------
-- Table: cloud_sessions
-- --------------------------------------------------------------------------

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

comment on table  public.cloud_sessions is 'Cloud-synced chat sessions. Supports branching via parent_id + branch_point.';
comment on column public.cloud_sessions.parent_id is 'If this session was branched, the source session UUID.';
comment on column public.cloud_sessions.branch_point is 'Message index in the parent session where branching occurred.';

-- Indexes
create index idx_cloud_sessions_user_id            on public.cloud_sessions (user_id);
create index idx_cloud_sessions_user_id_updated_at on public.cloud_sessions (user_id, updated_at desc);
create index idx_cloud_sessions_device_id          on public.cloud_sessions (device_id);

-- Auto-update updated_at
create trigger set_cloud_sessions_updated_at
  before update on public.cloud_sessions
  for each row
  execute function public.handle_updated_at();

-- --------------------------------------------------------------------------
-- Table: cloud_messages
-- --------------------------------------------------------------------------

create table public.cloud_messages (
  id          text        primary key,            -- deterministic: {session_id}-msg-{index}
  session_id  uuid        not null references public.cloud_sessions(id) on delete cascade,
  user_id     uuid        not null references auth.users(id) on delete cascade,
  role        text        not null check (role in ('user', 'assistant', 'system', 'tool')),
  content     text        not null default '',
  model       text,
  tool_calls  jsonb,
  token_usage jsonb,                              -- {prompt: N, completion: N}
  created_at  timestamptz not null default now(),
  index       int         not null
);

comment on table  public.cloud_messages is 'Individual messages within cloud-synced sessions.';
comment on column public.cloud_messages.id is 'Deterministic ID: {session_id}-msg-{index}. Enables idempotent upserts.';
comment on column public.cloud_messages.token_usage is 'JSON: {prompt: N, completion: N}. Only present on assistant messages.';

-- Indexes
create index idx_cloud_messages_session_id       on public.cloud_messages (session_id);
create index idx_cloud_messages_session_id_index on public.cloud_messages (session_id, index);

-- ==========================================================================
-- Row-Level Security
-- ==========================================================================

-- --------------------------------------------------------------------------
-- RLS: devices
-- --------------------------------------------------------------------------

alter table public.devices enable row level security;

create policy "devices_select_own"
  on public.devices for select
  using (user_id = auth.uid());

create policy "devices_insert_own"
  on public.devices for insert
  with check (user_id = auth.uid());

create policy "devices_update_own"
  on public.devices for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "devices_delete_own"
  on public.devices for delete
  using (user_id = auth.uid());

-- --------------------------------------------------------------------------
-- RLS: cloud_sessions
-- --------------------------------------------------------------------------

alter table public.cloud_sessions enable row level security;

create policy "cloud_sessions_select_own"
  on public.cloud_sessions for select
  using (user_id = auth.uid());

create policy "cloud_sessions_insert_own"
  on public.cloud_sessions for insert
  with check (user_id = auth.uid());

create policy "cloud_sessions_update_own"
  on public.cloud_sessions for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "cloud_sessions_delete_own"
  on public.cloud_sessions for delete
  using (user_id = auth.uid());

-- --------------------------------------------------------------------------
-- RLS: cloud_messages
-- --------------------------------------------------------------------------

alter table public.cloud_messages enable row level security;

create policy "cloud_messages_select_own"
  on public.cloud_messages for select
  using (user_id = auth.uid());

create policy "cloud_messages_insert_own"
  on public.cloud_messages for insert
  with check (user_id = auth.uid());

create policy "cloud_messages_update_own"
  on public.cloud_messages for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "cloud_messages_delete_own"
  on public.cloud_messages for delete
  using (user_id = auth.uid());

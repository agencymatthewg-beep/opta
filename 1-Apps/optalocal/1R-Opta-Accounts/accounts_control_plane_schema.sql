-- Opta Accounts Control Plane Schema
-- Run in Supabase SQL editor for durable control-plane persistence.

create extension if not exists pgcrypto;

create table if not exists public.accounts_pairing_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code text not null,
  status text not null check (status in ('pending', 'claimed', 'expired', 'cancelled')),
  device_id uuid,
  device_label text,
  capability_scopes text[] not null default '{}',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  claimed_at timestamptz,
  bridge_token_id uuid
);

create index if not exists accounts_pairing_sessions_user_created_idx
  on public.accounts_pairing_sessions(user_id, created_at desc);

create index if not exists accounts_pairing_sessions_device_status_idx
  on public.accounts_pairing_sessions(device_id, status);

create unique index if not exists accounts_pairing_sessions_code_pending_uniq
  on public.accounts_pairing_sessions(code)
  where status = 'pending';

create index if not exists accounts_pairing_sessions_pending_expires_idx
  on public.accounts_pairing_sessions(expires_at asc)
  where status = 'pending';

create table if not exists public.accounts_bridge_tokens (
  token_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id uuid not null,
  trust_state text,
  scopes text[] not null default '{}',
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  status text not null check (status in ('active', 'revoked', 'expired')),
  token_hash text not null unique
);

create index if not exists accounts_bridge_tokens_user_issued_idx
  on public.accounts_bridge_tokens(user_id, issued_at desc);

create index if not exists accounts_bridge_tokens_device_status_idx
  on public.accounts_bridge_tokens(device_id, status);

create index if not exists accounts_bridge_tokens_active_device_expires_idx
  on public.accounts_bridge_tokens(device_id, expires_at asc)
  where status = 'active';

create table if not exists public.accounts_device_commands (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id uuid not null,
  command text not null,
  payload jsonb not null default '{}'::jsonb,
  scope text,
  idempotency_key text,
  status text not null check (
    status in ('queued', 'delivered', 'completed', 'failed', 'denied', 'expired')
  ),
  created_at timestamptz not null default now(),
  delivered_at timestamptz,
  completed_at timestamptz,
  result_hash text,
  result jsonb,
  error text
);

create unique index if not exists accounts_device_commands_user_idempotency_uniq
  on public.accounts_device_commands(user_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists accounts_device_commands_device_status_created_idx
  on public.accounts_device_commands(device_id, status, created_at asc);

create index if not exists accounts_device_commands_user_created_idx
  on public.accounts_device_commands(user_id, created_at desc);

create index if not exists accounts_device_commands_queue_delivery_idx
  on public.accounts_device_commands(device_id, created_at asc)
  where status = 'queued';

create table if not exists public.accounts_cli_replay_nonces (
  kind text not null check (kind in ('handoff', 'relay')),
  nonce text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (kind, nonce)
);

create index if not exists accounts_cli_replay_nonces_expires_idx
  on public.accounts_cli_replay_nonces(expires_at asc);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'accounts_pairing_sessions_code_not_blank_chk'
      and conrelid = 'public.accounts_pairing_sessions'::regclass
  ) then
    alter table public.accounts_pairing_sessions
      add constraint accounts_pairing_sessions_code_not_blank_chk
      check (length(btrim(code)) > 0);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'accounts_pairing_sessions_expires_after_created_chk'
      and conrelid = 'public.accounts_pairing_sessions'::regclass
  ) then
    alter table public.accounts_pairing_sessions
      add constraint accounts_pairing_sessions_expires_after_created_chk
      check (expires_at > created_at);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'accounts_pairing_sessions_claimed_state_chk'
      and conrelid = 'public.accounts_pairing_sessions'::regclass
  ) then
    alter table public.accounts_pairing_sessions
      add constraint accounts_pairing_sessions_claimed_state_chk
      check (
        (status = 'claimed' and claimed_at is not null)
        or (status <> 'claimed' and claimed_at is null)
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'accounts_pairing_sessions_bridge_token_id_fkey'
      and conrelid = 'public.accounts_pairing_sessions'::regclass
  ) then
    alter table public.accounts_pairing_sessions
      add constraint accounts_pairing_sessions_bridge_token_id_fkey
      foreign key (bridge_token_id)
      references public.accounts_bridge_tokens(token_id)
      on delete set null;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'accounts_bridge_tokens_expires_after_issued_chk'
      and conrelid = 'public.accounts_bridge_tokens'::regclass
  ) then
    alter table public.accounts_bridge_tokens
      add constraint accounts_bridge_tokens_expires_after_issued_chk
      check (expires_at > issued_at);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'accounts_bridge_tokens_token_hash_format_chk'
      and conrelid = 'public.accounts_bridge_tokens'::regclass
  ) then
    alter table public.accounts_bridge_tokens
      add constraint accounts_bridge_tokens_token_hash_format_chk
      check (token_hash ~ '^[0-9a-f]{64}$');
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'accounts_device_commands_command_not_blank_chk'
      and conrelid = 'public.accounts_device_commands'::regclass
  ) then
    alter table public.accounts_device_commands
      add constraint accounts_device_commands_command_not_blank_chk
      check (length(btrim(command)) > 0);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'accounts_device_commands_idempotency_key_not_blank_chk'
      and conrelid = 'public.accounts_device_commands'::regclass
  ) then
    alter table public.accounts_device_commands
      add constraint accounts_device_commands_idempotency_key_not_blank_chk
      check (idempotency_key is null or length(btrim(idempotency_key)) > 0);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'accounts_device_commands_delivery_after_create_chk'
      and conrelid = 'public.accounts_device_commands'::regclass
  ) then
    alter table public.accounts_device_commands
      add constraint accounts_device_commands_delivery_after_create_chk
      check (delivered_at is null or delivered_at >= created_at);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'accounts_device_commands_completion_after_create_chk'
      and conrelid = 'public.accounts_device_commands'::regclass
  ) then
    alter table public.accounts_device_commands
      add constraint accounts_device_commands_completion_after_create_chk
      check (completed_at is null or completed_at >= created_at);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'accounts_cli_replay_nonces_expires_after_created_chk'
      and conrelid = 'public.accounts_cli_replay_nonces'::regclass
  ) then
    alter table public.accounts_cli_replay_nonces
      add constraint accounts_cli_replay_nonces_expires_after_created_chk
      check (expires_at > created_at);
  end if;
end
$$;

alter table public.accounts_pairing_sessions enable row level security;
alter table public.accounts_bridge_tokens enable row level security;
alter table public.accounts_device_commands enable row level security;
alter table public.accounts_cli_replay_nonces enable row level security;

drop policy if exists "accounts_pairing_sessions_select_own" on public.accounts_pairing_sessions;
create policy "accounts_pairing_sessions_select_own"
  on public.accounts_pairing_sessions
  for select
  using (auth.uid() = user_id);

drop policy if exists "accounts_pairing_sessions_insert_own" on public.accounts_pairing_sessions;
create policy "accounts_pairing_sessions_insert_own"
  on public.accounts_pairing_sessions
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "accounts_pairing_sessions_update_own" on public.accounts_pairing_sessions;
create policy "accounts_pairing_sessions_update_own"
  on public.accounts_pairing_sessions
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "accounts_bridge_tokens_select_own" on public.accounts_bridge_tokens;
create policy "accounts_bridge_tokens_select_own"
  on public.accounts_bridge_tokens
  for select
  using (auth.uid() = user_id);

drop policy if exists "accounts_bridge_tokens_insert_own" on public.accounts_bridge_tokens;
create policy "accounts_bridge_tokens_insert_own"
  on public.accounts_bridge_tokens
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "accounts_bridge_tokens_update_own" on public.accounts_bridge_tokens;
create policy "accounts_bridge_tokens_update_own"
  on public.accounts_bridge_tokens
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "accounts_device_commands_select_own" on public.accounts_device_commands;
create policy "accounts_device_commands_select_own"
  on public.accounts_device_commands
  for select
  using (auth.uid() = user_id);

drop policy if exists "accounts_device_commands_insert_own" on public.accounts_device_commands;
create policy "accounts_device_commands_insert_own"
  on public.accounts_device_commands
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "accounts_device_commands_update_own" on public.accounts_device_commands;
create policy "accounts_device_commands_update_own"
  on public.accounts_device_commands
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "accounts_cli_replay_nonces_service_role_all" on public.accounts_cli_replay_nonces;
create policy "accounts_cli_replay_nonces_service_role_all"
  on public.accounts_cli_replay_nonces
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

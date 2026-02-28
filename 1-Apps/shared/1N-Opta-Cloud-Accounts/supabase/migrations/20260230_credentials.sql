-- Migration: Consolidated credentials table for cross-app credential storage
-- Used by: 1F-Opta-Life-Web (Google OAuth tokens), 1E-Opta-Life-IOS (encrypted credentials)
-- Canonical spec: shared/1N-Opta-Cloud-Accounts

-- 1. Create the table (idempotent)
create table if not exists public.credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  service_name text not null,
  credential_type text not null,
  encrypted_value text not null,
  credential_data jsonb,                          -- legacy: 1F stores { expires_at } here
  metadata jsonb not null default '{}'::jsonb,    -- new: replaces credential_data going forward
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, service_name, credential_type)
);

-- 2. Add columns if table exists from an older migration (idempotent)
alter table public.credentials add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.credentials add column if not exists credential_data jsonb;

-- 3. Indexes
create index if not exists idx_credentials_user_id on public.credentials(user_id);
create index if not exists idx_credentials_user_service on public.credentials(user_id, service_name);

-- 4. Enable RLS
alter table public.credentials enable row level security;

-- 5. Self-access policies (idempotent — drop + recreate)
drop policy if exists "Users can read own credentials." on public.credentials;
create policy "Users can read own credentials."
  on public.credentials for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own credentials." on public.credentials;
create policy "Users can insert own credentials."
  on public.credentials for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own credentials." on public.credentials;
create policy "Users can update own credentials."
  on public.credentials for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own credentials." on public.credentials;
create policy "Users can delete own credentials."
  on public.credentials for delete
  using (auth.uid() = user_id);

-- 6. Trigger for automatic timestamp updates (reuses handle_updated_at from core_schema)
drop trigger if exists trigger_set_timestamp_credentials on public.credentials;
create trigger trigger_set_timestamp_credentials
  before update on public.credentials
  for each row
  execute function public.handle_updated_at();

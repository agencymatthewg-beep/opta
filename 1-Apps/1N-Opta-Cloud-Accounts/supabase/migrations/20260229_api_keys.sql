-- Migration: API keys table for cloud-managed key storage across Opta ecosystem
-- Follows the pattern from 20260225132433_core_schema.sql

-- 1. public.api_keys setup
create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  provider text not null,
  label text,
  key_value text not null,
  is_active boolean default true not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  last_verified_at timestamptz,
  unique(user_id, provider, label)
);

-- Indexes for common query patterns
create index idx_api_keys_user_id on public.api_keys (user_id);
create index idx_api_keys_user_provider on public.api_keys (user_id, provider);

-- Enable RLS
alter table public.api_keys enable row level security;

-- Standard 4-policy RLS (matches profiles/devices pattern)
create policy "Users can read own keys."
  on public.api_keys for select
  using ( auth.uid() = user_id );

create policy "Users can insert own keys."
  on public.api_keys for insert
  with check ( auth.uid() = user_id );

create policy "Users can update own keys."
  on public.api_keys for update
  using ( auth.uid() = user_id )
  with check ( auth.uid() = user_id );

create policy "Users can delete own keys."
  on public.api_keys for delete
  using ( auth.uid() = user_id );

-- 2. Trigger for automatic timestamp updates (reuses handle_updated_at from core_schema)
create trigger trigger_set_timestamp_api_keys
  before update on public.api_keys
  for each row
  execute function public.handle_updated_at();

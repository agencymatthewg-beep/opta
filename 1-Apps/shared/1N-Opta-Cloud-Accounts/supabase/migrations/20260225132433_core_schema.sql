-- Migration: Core shared schema for Opta Cloud Accounts
-- Tables: public.profiles, public.devices

-- 1. Create a trigger function to automatically update timestamps
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql security definer;

-- 2. public.profiles setup
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Enable RLS for profiles
alter table public.profiles enable row level security;

create policy "Users can read own profile."
  on public.profiles for select
  using ( auth.uid() = user_id );

create policy "Users can insert own profile."
  on public.profiles for insert
  with check ( auth.uid() = user_id );

create policy "Users can update own profile."
  on public.profiles for update
  using ( auth.uid() = user_id )
  with check ( auth.uid() = user_id );

create policy "Users can delete own profile."
  on public.profiles for delete
  using ( auth.uid() = user_id );

-- 3. Trigger for updating profile timestamp
create trigger trigger_set_timestamp_profiles
  before update on public.profiles
  for each row
  execute function public.handle_updated_at();

-- 4. Automatically create profile on user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (user_id)
  values (new.id);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 5. public.devices setup
create table public.devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  app_id text not null,
  device_info jsonb default '{}'::jsonb,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Index for querying devices by user
create index devices_user_id_idx on public.devices (user_id);
-- Index for querying devices by app
create index devices_app_id_idx on public.devices (app_id);

-- Enable RLS for devices
alter table public.devices enable row level security;

create policy "Users can read own devices."
  on public.devices for select
  using ( auth.uid() = user_id );

create policy "Users can insert own devices."
  on public.devices for insert
  with check ( auth.uid() = user_id );

create policy "Users can update own devices."
  on public.devices for update
  using ( auth.uid() = user_id )
  with check ( auth.uid() = user_id );

create policy "Users can delete own devices."
  on public.devices for delete
  using ( auth.uid() = user_id );

-- 6. Trigger for updating devices timestamp
create trigger trigger_set_timestamp_devices
  before update on public.devices
  for each row
  execute function public.handle_updated_at();

-- Migration: updated_at triggers + auto-profile creation for accounts_* tables
-- The accounts tables (from 20260228) have updated_at columns but lack triggers.
-- Also adds an auto-create trigger for accounts_profiles on user signup.

-- 1. updated_at triggers for accounts_* tables
drop trigger if exists trigger_set_timestamp_accounts_profiles on public.accounts_profiles;
create trigger trigger_set_timestamp_accounts_profiles
  before update on public.accounts_profiles
  for each row
  execute function public.handle_updated_at();

drop trigger if exists trigger_set_timestamp_accounts_devices on public.accounts_devices;
create trigger trigger_set_timestamp_accounts_devices
  before update on public.accounts_devices
  for each row
  execute function public.handle_updated_at();

drop trigger if exists trigger_set_timestamp_accounts_provider_connections on public.accounts_provider_connections;
create trigger trigger_set_timestamp_accounts_provider_connections
  before update on public.accounts_provider_connections
  for each row
  execute function public.handle_updated_at();

-- 2. Auto-create accounts_profiles row on user signup
--    Runs alongside the existing handle_new_user() trigger (which creates public.profiles).
create or replace function public.handle_new_user_accounts_profile()
returns trigger as $$
begin
  insert into public.accounts_profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created_accounts_profile on auth.users;
create trigger on_auth_user_created_accounts_profile
  after insert on auth.users
  for each row execute function public.handle_new_user_accounts_profile();

-- 3. INSERT policy for accounts_profiles (the 20260228 migration only added SELECT + UPDATE)
drop policy if exists accounts_profiles_self_insert on public.accounts_profiles;
create policy accounts_profiles_self_insert on public.accounts_profiles
  for insert with check (auth.uid() = id);

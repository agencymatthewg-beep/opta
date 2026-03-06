-- Migration: sync file vault for cross-app policy/rules synchronization
-- Used by Opta CLI, Opta Code Desktop, and Opta Accounts rules UI.

create table if not exists public.sync_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  filename text not null,
  content text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, filename)
);

create index if not exists idx_sync_files_user_id
  on public.sync_files (user_id);

create index if not exists idx_sync_files_user_filename_active
  on public.sync_files (user_id, filename, is_active);

alter table public.sync_files enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'sync_files'
      and policyname = 'Users can read own sync files'
  ) then
    create policy "Users can read own sync files"
      on public.sync_files for select
      using (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'sync_files'
      and policyname = 'Users can insert own sync files'
  ) then
    create policy "Users can insert own sync files"
      on public.sync_files for insert
      with check (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'sync_files'
      and policyname = 'Users can update own sync files'
  ) then
    create policy "Users can update own sync files"
      on public.sync_files for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'sync_files'
      and policyname = 'Users can delete own sync files'
  ) then
    create policy "Users can delete own sync files"
      on public.sync_files for delete
      using (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if to_regprocedure('public.handle_updated_at()') is null then
    create function public.handle_updated_at()
    returns trigger as $fn$
    begin
      new.updated_at = now();
      return new;
    end;
    $fn$ language plpgsql;
  end if;
end $$;

drop trigger if exists trigger_set_timestamp_sync_files on public.sync_files;
create trigger trigger_set_timestamp_sync_files
  before update on public.sync_files
  for each row
  execute function public.handle_updated_at();

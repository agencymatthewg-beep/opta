-- Opta Accounts Control Plane Hardening v2 (DIFF-AWARE / incremental only)
-- Project: cytjsmezydytbmjrolyz
-- Rule: add missing objects only; do not reapply existing objects.

-- 0) shared updated_at trigger function (only if missing)
do $outer$
begin
  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'handle_updated_at'
      and pg_get_function_identity_arguments(p.oid) = ''
  ) then
    execute $create$
      create function public.handle_updated_at()
      returns trigger
      language plpgsql
      as $func$
      begin
        new.updated_at = now();
        return new;
      end;
      $func$
    $create$;
  end if;
end
$outer$;

-- 1) updated_at columns (only if missing)
alter table if exists public.accounts_pairing_sessions
  add column if not exists updated_at timestamptz not null default now();

alter table if exists public.accounts_bridge_tokens
  add column if not exists updated_at timestamptz not null default now();

alter table if exists public.accounts_device_commands
  add column if not exists updated_at timestamptz not null default now();

alter table if exists public.accounts_cli_replay_nonces
  add column if not exists updated_at timestamptz not null default now();

-- 2) updated_at triggers (only if missing)
do $$
begin
  if to_regclass('public.accounts_pairing_sessions') is not null
     and not exists (
       select 1 from pg_trigger
       where tgname = 'trigger_set_timestamp_accounts_pairing_sessions'
         and tgrelid = 'public.accounts_pairing_sessions'::regclass
         and not tgisinternal
     ) then
    execute 'create trigger trigger_set_timestamp_accounts_pairing_sessions
      before update on public.accounts_pairing_sessions
      for each row execute function public.handle_updated_at()';
  end if;
end
$$;

do $$
begin
  if to_regclass('public.accounts_bridge_tokens') is not null
     and not exists (
       select 1 from pg_trigger
       where tgname = 'trigger_set_timestamp_accounts_bridge_tokens'
         and tgrelid = 'public.accounts_bridge_tokens'::regclass
         and not tgisinternal
     ) then
    execute 'create trigger trigger_set_timestamp_accounts_bridge_tokens
      before update on public.accounts_bridge_tokens
      for each row execute function public.handle_updated_at()';
  end if;
end
$$;

do $$
begin
  if to_regclass('public.accounts_device_commands') is not null
     and not exists (
       select 1 from pg_trigger
       where tgname = 'trigger_set_timestamp_accounts_device_commands'
         and tgrelid = 'public.accounts_device_commands'::regclass
         and not tgisinternal
     ) then
    execute 'create trigger trigger_set_timestamp_accounts_device_commands
      before update on public.accounts_device_commands
      for each row execute function public.handle_updated_at()';
  end if;
end
$$;

do $$
begin
  if to_regclass('public.accounts_cli_replay_nonces') is not null
     and not exists (
       select 1 from pg_trigger
       where tgname = 'trigger_set_timestamp_accounts_cli_replay_nonces'
         and tgrelid = 'public.accounts_cli_replay_nonces'::regclass
         and not tgisinternal
     ) then
    execute 'create trigger trigger_set_timestamp_accounts_cli_replay_nonces
      before update on public.accounts_cli_replay_nonces
      for each row execute function public.handle_updated_at()';
  end if;
end
$$;

-- 3) time integrity constraints (safe style: NOT VALID then VALIDATE)
-- expires_at > created_at (or issued_at where created_at is not present)
-- completed_at >= created_at

do $$
begin
  if to_regclass('public.accounts_pairing_sessions') is not null
     and not exists (
       select 1 from pg_constraint
       where conname = 'accounts_pairing_sessions_expires_after_created_v2_chk'
         and conrelid = 'public.accounts_pairing_sessions'::regclass
     ) then
    execute 'alter table public.accounts_pairing_sessions
      add constraint accounts_pairing_sessions_expires_after_created_v2_chk
      check (expires_at > created_at) not valid';
    execute 'alter table public.accounts_pairing_sessions
      validate constraint accounts_pairing_sessions_expires_after_created_v2_chk';
  end if;
end
$$;

do $$
begin
  if to_regclass('public.accounts_bridge_tokens') is not null
     and not exists (
       select 1 from pg_constraint
       where conname = 'accounts_bridge_tokens_expires_after_issued_v2_chk'
         and conrelid = 'public.accounts_bridge_tokens'::regclass
     ) then
    execute 'alter table public.accounts_bridge_tokens
      add constraint accounts_bridge_tokens_expires_after_issued_v2_chk
      check (expires_at > issued_at) not valid';
    execute 'alter table public.accounts_bridge_tokens
      validate constraint accounts_bridge_tokens_expires_after_issued_v2_chk';
  end if;
end
$$;

do $$
begin
  if to_regclass('public.accounts_cli_replay_nonces') is not null
     and not exists (
       select 1 from pg_constraint
       where conname = 'accounts_cli_replay_nonces_expires_after_created_v2_chk'
         and conrelid = 'public.accounts_cli_replay_nonces'::regclass
     ) then
    execute 'alter table public.accounts_cli_replay_nonces
      add constraint accounts_cli_replay_nonces_expires_after_created_v2_chk
      check (expires_at > created_at) not valid';
    execute 'alter table public.accounts_cli_replay_nonces
      validate constraint accounts_cli_replay_nonces_expires_after_created_v2_chk';
  end if;
end
$$;

do $$
begin
  if to_regclass('public.accounts_device_commands') is not null
     and not exists (
       select 1 from pg_constraint
       where conname = 'accounts_device_commands_completion_after_created_v2_chk'
         and conrelid = 'public.accounts_device_commands'::regclass
     ) then
    execute 'alter table public.accounts_device_commands
      add constraint accounts_device_commands_completion_after_created_v2_chk
      check (completed_at is null or completed_at >= created_at) not valid';
    execute 'alter table public.accounts_device_commands
      validate constraint accounts_device_commands_completion_after_created_v2_chk';
  end if;
end
$$;

-- 4) function: claim_device_commands_for_delivery(... FOR UPDATE SKIP LOCKED) only if missing
do $outer$
begin
  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'claim_device_commands_for_delivery'
      and pg_get_function_identity_arguments(p.oid) = 'p_device_id uuid, p_limit integer'
  ) then
    execute $create$
      create function public.claim_device_commands_for_delivery(
        p_device_id uuid,
        p_limit int default 20
      )
      returns setof public.accounts_device_commands
      language plpgsql
      security definer
      set search_path = public
      as $func$
      begin
        return query
        with picked as (
          select id
          from public.accounts_device_commands
          where device_id = p_device_id
            and status = 'queued'
            and created_at <= now()
          order by created_at asc
          for update skip locked
          limit greatest(coalesce(p_limit, 20), 1)
        ), updated as (
          update public.accounts_device_commands d
          set status = 'delivered',
              delivered_at = now(),
              updated_at = now()
          from picked p
          where d.id = p.id
          returning d.*
        )
        select * from updated
        order by created_at asc;
      end;
      $func$
    $create$;
  end if;
end
$outer$;

-- 5) function: cleanup_control_plane_data() only if missing
do $outer$
begin
  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'cleanup_control_plane_data'
      and pg_get_function_identity_arguments(p.oid) = ''
  ) then
    execute $create$
      create function public.cleanup_control_plane_data()
      returns table(deleted_pairing_sessions bigint, deleted_bridge_tokens bigint, deleted_cli_nonces bigint)
      language plpgsql
      security definer
      set search_path = public
      as $func$
      declare
        v_pairing bigint := 0;
        v_tokens bigint := 0;
        v_nonces bigint := 0;
      begin
        delete from public.accounts_pairing_sessions
        where expires_at < now()
          and status in ('expired', 'cancelled');
        get diagnostics v_pairing = row_count;

        delete from public.accounts_bridge_tokens
        where expires_at < now()
          and status in ('expired', 'revoked');
        get diagnostics v_tokens = row_count;

        delete from public.accounts_cli_replay_nonces
        where expires_at < now();
        get diagnostics v_nonces = row_count;

        return query select v_pairing, v_tokens, v_nonces;
      end;
      $func$
    $create$;
  end if;
end
$outer$;

-- 6) view: accounts_device_command_queue_health only if missing
do $$
begin
  if to_regclass('public.accounts_device_command_queue_health') is null then
    execute $vw$
      create view public.accounts_device_command_queue_health as
      select
        device_id,
        count(*) filter (where status = 'queued') as queued_count,
        count(*) filter (where status = 'delivered') as delivered_count,
        count(*) filter (where status = 'failed') as failed_count,
        min(created_at) filter (where status = 'queued') as oldest_queued_at,
        max(created_at) as newest_command_at,
        now() as observed_at
      from public.accounts_device_commands
      group by device_id
    $vw$;
  end if;
end
$$;

-- 7) optional pg_cron schedule for cleanup (guarded)
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron')
     and to_regclass('cron.job') is not null then
    if not exists (
      select 1
      from cron.job
      where jobname = 'accounts_control_plane_cleanup_hourly'
    ) then
      perform cron.schedule(
        'accounts_control_plane_cleanup_hourly',
        '7 * * * *',
        $cron$select public.cleanup_control_plane_data();$cron$
      );
    end if;
  end if;
exception
  when undefined_table then
    null;
end
$$;
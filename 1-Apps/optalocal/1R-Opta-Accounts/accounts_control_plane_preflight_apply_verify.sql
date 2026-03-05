-- Opta Accounts Control Plane Rollout Helper
-- Purpose: preflight + legacy-row remediation + post-apply verification.
--
-- Safe for:
-- - first-time environments (tables may not exist yet)
-- - existing environments with legacy rows
--
-- Recommended run order in Supabase SQL editor:
-- 1) Run this helper (preflight + optional remediation).
-- 2) Run accounts_control_plane_schema.sql.
-- 3) Run this helper again (verification).

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- 1) Table presence and baseline object checks
-- -----------------------------------------------------------------------------

select
  to_regclass('public.accounts_pairing_sessions') is not null as has_accounts_pairing_sessions,
  to_regclass('public.accounts_bridge_tokens') is not null as has_accounts_bridge_tokens,
  to_regclass('public.accounts_device_commands') is not null as has_accounts_device_commands,
  to_regclass('public.accounts_cli_replay_nonces') is not null as has_accounts_cli_replay_nonces;

-- -----------------------------------------------------------------------------
-- 2) Preflight anomalies (safe even when tables do not yet exist)
-- -----------------------------------------------------------------------------

create temp table if not exists accounts_control_plane_anomaly_counts (
  check_name text primary key,
  row_count bigint not null,
  notes text not null
) on commit drop;

truncate table accounts_control_plane_anomaly_counts;

do $$
begin
  if to_regclass('public.accounts_pairing_sessions') is null then
    insert into accounts_control_plane_anomaly_counts(check_name, row_count, notes)
    values ('pairing_table_missing', 0, 'skipped: table does not exist');
  else
    insert into accounts_control_plane_anomaly_counts(check_name, row_count, notes)
    select 'pairing_blank_code', count(*)::bigint, 'ok when 0'
    from public.accounts_pairing_sessions
    where code is null or length(btrim(code)) = 0;

    insert into accounts_control_plane_anomaly_counts(check_name, row_count, notes)
    select 'pairing_expires_not_after_created', count(*)::bigint, 'ok when 0'
    from public.accounts_pairing_sessions
    where expires_at <= created_at;

    insert into accounts_control_plane_anomaly_counts(check_name, row_count, notes)
    select 'pairing_claimed_missing_claimed_at', count(*)::bigint, 'ok when 0'
    from public.accounts_pairing_sessions
    where status = 'claimed' and claimed_at is null;

    insert into accounts_control_plane_anomaly_counts(check_name, row_count, notes)
    select 'pairing_non_claimed_has_claimed_at', count(*)::bigint, 'ok when 0'
    from public.accounts_pairing_sessions
    where status <> 'claimed' and claimed_at is not null;

    insert into accounts_control_plane_anomaly_counts(check_name, row_count, notes)
    select 'pairing_pending_code_duplicates', count(*)::bigint, 'ok when 0'
    from (
      select code
      from public.accounts_pairing_sessions
      where status = 'pending'
      group by code
      having count(*) > 1
    ) duplicates;
  end if;

  if to_regclass('public.accounts_bridge_tokens') is null then
    insert into accounts_control_plane_anomaly_counts(check_name, row_count, notes)
    values ('bridge_tokens_table_missing', 0, 'skipped: table does not exist');
  else
    insert into accounts_control_plane_anomaly_counts(check_name, row_count, notes)
    select 'bridge_expires_not_after_issued', count(*)::bigint, 'ok when 0'
    from public.accounts_bridge_tokens
    where expires_at <= issued_at;

    insert into accounts_control_plane_anomaly_counts(check_name, row_count, notes)
    select 'bridge_invalid_token_hash_format', count(*)::bigint, 'ok when 0'
    from public.accounts_bridge_tokens
    where token_hash !~ '^[0-9a-f]{64}$';
  end if;

  if to_regclass('public.accounts_pairing_sessions') is not null
     and to_regclass('public.accounts_bridge_tokens') is not null then
    insert into accounts_control_plane_anomaly_counts(check_name, row_count, notes)
    select 'pairing_orphan_bridge_token_id', count(*)::bigint, 'ok when 0'
    from public.accounts_pairing_sessions pairing
    where pairing.bridge_token_id is not null
      and not exists (
        select 1
        from public.accounts_bridge_tokens tokens
        where tokens.token_id = pairing.bridge_token_id
      );
  else
    insert into accounts_control_plane_anomaly_counts(check_name, row_count, notes)
    values ('pairing_orphan_bridge_token_id', 0, 'skipped: dependency tables missing');
  end if;

  if to_regclass('public.accounts_device_commands') is null then
    insert into accounts_control_plane_anomaly_counts(check_name, row_count, notes)
    values ('device_commands_table_missing', 0, 'skipped: table does not exist');
  else
    insert into accounts_control_plane_anomaly_counts(check_name, row_count, notes)
    select 'device_command_blank_command', count(*)::bigint, 'ok when 0'
    from public.accounts_device_commands
    where command is null or length(btrim(command)) = 0;

    insert into accounts_control_plane_anomaly_counts(check_name, row_count, notes)
    select 'device_command_blank_idempotency_key', count(*)::bigint, 'ok when 0'
    from public.accounts_device_commands
    where idempotency_key is not null and length(btrim(idempotency_key)) = 0;

    insert into accounts_control_plane_anomaly_counts(check_name, row_count, notes)
    select 'device_command_duplicate_user_idempotency', count(*)::bigint, 'ok when 0'
    from (
      select user_id, idempotency_key
      from public.accounts_device_commands
      where idempotency_key is not null and length(btrim(idempotency_key)) > 0
      group by user_id, idempotency_key
      having count(*) > 1
    ) duplicates;

    insert into accounts_control_plane_anomaly_counts(check_name, row_count, notes)
    select 'device_command_delivered_before_created', count(*)::bigint, 'ok when 0'
    from public.accounts_device_commands
    where delivered_at is not null and delivered_at < created_at;

    insert into accounts_control_plane_anomaly_counts(check_name, row_count, notes)
    select 'device_command_completed_before_created', count(*)::bigint, 'ok when 0'
    from public.accounts_device_commands
    where completed_at is not null and completed_at < created_at;
  end if;

  if to_regclass('public.accounts_cli_replay_nonces') is null then
    insert into accounts_control_plane_anomaly_counts(check_name, row_count, notes)
    values ('replay_nonces_table_missing', 0, 'skipped: table does not exist');
  else
    insert into accounts_control_plane_anomaly_counts(check_name, row_count, notes)
    select 'replay_nonce_expires_not_after_created', count(*)::bigint, 'ok when 0'
    from public.accounts_cli_replay_nonces
    where expires_at <= created_at;
  end if;
end
$$;

select check_name, row_count, notes
from accounts_control_plane_anomaly_counts
order by check_name;

-- -----------------------------------------------------------------------------
-- 3) Safe remediation for legacy rows (skips missing tables)
-- -----------------------------------------------------------------------------
-- Notes:
-- - Repeatable and non-destructive.
-- - Only updates rows that violate incoming constraints.

do $$
begin
  if to_regclass('public.accounts_pairing_sessions') is not null then
    update public.accounts_pairing_sessions
    set code = upper(encode(gen_random_bytes(4), 'hex'))
    where code is null or length(btrim(code)) = 0;

    with ranked as (
      select
        id,
        row_number() over (
          partition by code
          order by created_at desc, id desc
        ) as rn
      from public.accounts_pairing_sessions
      where status = 'pending'
    )
    update public.accounts_pairing_sessions pairing
    set code = upper(encode(gen_random_bytes(4), 'hex'))
    from ranked
    where pairing.id = ranked.id
      and ranked.rn > 1;

    update public.accounts_pairing_sessions
    set expires_at = greatest(created_at + interval '5 minutes', now() + interval '1 minute')
    where expires_at <= created_at;

    update public.accounts_pairing_sessions
    set claimed_at = coalesce(claimed_at, created_at, now())
    where status = 'claimed' and claimed_at is null;

    update public.accounts_pairing_sessions
    set claimed_at = null
    where status <> 'claimed' and claimed_at is not null;
  end if;

  if to_regclass('public.accounts_pairing_sessions') is not null
     and to_regclass('public.accounts_bridge_tokens') is not null then
    update public.accounts_pairing_sessions pairing
    set bridge_token_id = null
    where pairing.bridge_token_id is not null
      and not exists (
        select 1
        from public.accounts_bridge_tokens tokens
        where tokens.token_id = pairing.bridge_token_id
      );
  end if;

  if to_regclass('public.accounts_bridge_tokens') is not null then
    update public.accounts_bridge_tokens
    set expires_at = greatest(issued_at + interval '30 minutes', now() + interval '1 minute')
    where expires_at <= issued_at;

    update public.accounts_bridge_tokens
    set token_hash = encode(digest(coalesce(token_hash, '') || ':' || token_id::text, 'sha256'), 'hex')
    where token_hash !~ '^[0-9a-f]{64}$';
  end if;

  if to_regclass('public.accounts_device_commands') is not null then
    update public.accounts_device_commands
    set command = 'unknown.command'
    where command is null or length(btrim(command)) = 0;

    update public.accounts_device_commands
    set idempotency_key = null
    where idempotency_key is not null and length(btrim(idempotency_key)) = 0;

    with ranked as (
      select
        id,
        row_number() over (
          partition by user_id, idempotency_key
          order by created_at desc, id desc
        ) as rn
      from public.accounts_device_commands
      where idempotency_key is not null and length(btrim(idempotency_key)) > 0
    )
    update public.accounts_device_commands commands
    set idempotency_key = null
    from ranked
    where commands.id = ranked.id
      and ranked.rn > 1;

    update public.accounts_device_commands
    set delivered_at = created_at
    where delivered_at is not null and delivered_at < created_at;

    update public.accounts_device_commands
    set completed_at = created_at
    where completed_at is not null and completed_at < created_at;
  end if;

  if to_regclass('public.accounts_cli_replay_nonces') is not null then
    update public.accounts_cli_replay_nonces
    set expires_at = greatest(created_at + interval '5 minutes', now() + interval '1 minute')
    where expires_at <= created_at;
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- 4) Post-apply verification (safe with partial table presence)
-- -----------------------------------------------------------------------------

-- Constraint inventory
with target_tables as (
  select to_regclass('public.accounts_pairing_sessions') as table_oid
  union all select to_regclass('public.accounts_bridge_tokens')
  union all select to_regclass('public.accounts_device_commands')
  union all select to_regclass('public.accounts_cli_replay_nonces')
)
select
  constraints.conrelid::regclass::text as table_name,
  constraints.conname as constraint_name,
  constraints.contype as constraint_type
from pg_constraint constraints
join target_tables on constraints.conrelid = target_tables.table_oid
where target_tables.table_oid is not null
order by table_name, constraint_name;

-- Index inventory
select
  tablename,
  indexname
from pg_indexes
where schemaname = 'public'
  and tablename in (
    'accounts_pairing_sessions',
    'accounts_bridge_tokens',
    'accounts_device_commands',
    'accounts_cli_replay_nonces'
  )
order by tablename, indexname;

-- RLS policy inventory
select
  tablename,
  policyname,
  cmd
from pg_policies
where schemaname = 'public'
  and tablename in (
    'accounts_pairing_sessions',
    'accounts_bridge_tokens',
    'accounts_device_commands',
    'accounts_cli_replay_nonces'
  )
order by tablename, policyname;

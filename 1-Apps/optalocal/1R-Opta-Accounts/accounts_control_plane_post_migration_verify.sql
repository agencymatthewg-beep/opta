-- Opta Accounts Control Plane Post-Migration Verification (read-only)
--
-- Run this after:
-- 1) accounts_control_plane_schema.sql
-- 2) accounts_control_plane_hardening_v2.sql
--
-- This script performs read-only validation of:
-- - required tables/views/rpcs/triggers
-- - key constraints/indexes/policies + RLS
-- - control-plane anomaly counts expected to be zero

create temp table if not exists accounts_control_plane_verify_results (
  check_group text not null,
  check_name text not null,
  ok boolean not null,
  details text not null,
  primary key (check_group, check_name)
) on commit drop;

truncate table accounts_control_plane_verify_results;

insert into accounts_control_plane_verify_results (check_group, check_name, ok, details)
with flags as (
  select
    to_regclass('public.accounts_pairing_sessions') as pairing_table,
    to_regclass('public.accounts_bridge_tokens') as bridge_table,
    to_regclass('public.accounts_device_commands') as commands_table,
    to_regclass('public.accounts_cli_replay_nonces') as replay_table,
    to_regclass('public.accounts_device_command_queue_health') as queue_health_view
)
select
  checks.check_group,
  checks.check_name,
  checks.ok,
  checks.details
from (
  -- Required tables/views
  select
    'objects'::text as check_group,
    'table.accounts_pairing_sessions'::text as check_name,
    pairing_table is not null as ok,
    case when pairing_table is not null then 'present' else 'missing' end as details
  from flags
  union all
  select
    'objects',
    'table.accounts_bridge_tokens',
    bridge_table is not null,
    case when bridge_table is not null then 'present' else 'missing' end
  from flags
  union all
  select
    'objects',
    'table.accounts_device_commands',
    commands_table is not null,
    case when commands_table is not null then 'present' else 'missing' end
  from flags
  union all
  select
    'objects',
    'table.accounts_cli_replay_nonces',
    replay_table is not null,
    case when replay_table is not null then 'present' else 'missing' end
  from flags
  union all
  select
    'objects',
    'view.accounts_device_command_queue_health',
    queue_health_view is not null,
    case when queue_health_view is not null then 'present' else 'missing' end
  from flags

  -- Required functions (RPC targets)
  union all
  select
    'objects',
    'function.handle_updated_at()',
    exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = 'handle_updated_at'
        and pg_get_function_identity_arguments(p.oid) = ''
    ),
    case
      when exists (
        select 1
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and p.proname = 'handle_updated_at'
          and pg_get_function_identity_arguments(p.oid) = ''
      ) then 'present'
      else 'missing'
    end
  from flags
  union all
  select
    'objects',
    'function.claim_device_commands_for_delivery(uuid,integer)',
    exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = 'claim_device_commands_for_delivery'
        and pg_get_function_identity_arguments(p.oid) = 'p_device_id uuid, p_limit integer'
    ),
    case
      when exists (
        select 1
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and p.proname = 'claim_device_commands_for_delivery'
          and pg_get_function_identity_arguments(p.oid) = 'p_device_id uuid, p_limit integer'
      ) then 'present'
      else 'missing'
    end
  from flags
  union all
  select
    'objects',
    'function.cleanup_control_plane_data()',
    exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = 'cleanup_control_plane_data'
        and pg_get_function_identity_arguments(p.oid) = ''
    ),
    case
      when exists (
        select 1
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and p.proname = 'cleanup_control_plane_data'
          and pg_get_function_identity_arguments(p.oid) = ''
      ) then 'present'
      else 'missing'
    end
  from flags

  -- Optional cron readiness: must exist when pg_cron is available.
  union all
  select
    'objects',
    'cron.accounts_control_plane_cleanup_hourly',
    case
      when exists (select 1 from pg_extension where extname = 'pg_cron')
           and to_regclass('cron.job') is not null
      then exists (
        select 1
        from cron.job
        where jobname = 'accounts_control_plane_cleanup_hourly'
      )
      else true
    end,
    case
      when exists (select 1 from pg_extension where extname = 'pg_cron')
           and to_regclass('cron.job') is not null
      then case
        when exists (
          select 1
          from cron.job
          where jobname = 'accounts_control_plane_cleanup_hourly'
        ) then 'present'
        else 'missing'
      end
      else 'not_applicable_pg_cron_unavailable'
    end
  from flags

  -- Trigger readiness
  union all
  select
    'objects',
    'trigger.accounts_pairing_sessions.updated_at',
    exists (
      select 1
      from pg_trigger
      where tgname = 'trigger_set_timestamp_accounts_pairing_sessions'
        and tgrelid = 'public.accounts_pairing_sessions'::regclass
        and not tgisinternal
    ),
    case
      when exists (
        select 1
        from pg_trigger
        where tgname = 'trigger_set_timestamp_accounts_pairing_sessions'
          and tgrelid = 'public.accounts_pairing_sessions'::regclass
          and not tgisinternal
      ) then 'present'
      else 'missing'
    end
  from flags
  union all
  select
    'objects',
    'trigger.accounts_bridge_tokens.updated_at',
    exists (
      select 1
      from pg_trigger
      where tgname = 'trigger_set_timestamp_accounts_bridge_tokens'
        and tgrelid = 'public.accounts_bridge_tokens'::regclass
        and not tgisinternal
    ),
    case
      when exists (
        select 1
        from pg_trigger
        where tgname = 'trigger_set_timestamp_accounts_bridge_tokens'
          and tgrelid = 'public.accounts_bridge_tokens'::regclass
          and not tgisinternal
      ) then 'present'
      else 'missing'
    end
  from flags
  union all
  select
    'objects',
    'trigger.accounts_device_commands.updated_at',
    exists (
      select 1
      from pg_trigger
      where tgname = 'trigger_set_timestamp_accounts_device_commands'
        and tgrelid = 'public.accounts_device_commands'::regclass
        and not tgisinternal
    ),
    case
      when exists (
        select 1
        from pg_trigger
        where tgname = 'trigger_set_timestamp_accounts_device_commands'
          and tgrelid = 'public.accounts_device_commands'::regclass
          and not tgisinternal
      ) then 'present'
      else 'missing'
    end
  from flags
  union all
  select
    'objects',
    'trigger.accounts_cli_replay_nonces.updated_at',
    exists (
      select 1
      from pg_trigger
      where tgname = 'trigger_set_timestamp_accounts_cli_replay_nonces'
        and tgrelid = 'public.accounts_cli_replay_nonces'::regclass
        and not tgisinternal
    ),
    case
      when exists (
        select 1
        from pg_trigger
        where tgname = 'trigger_set_timestamp_accounts_cli_replay_nonces'
          and tgrelid = 'public.accounts_cli_replay_nonces'::regclass
          and not tgisinternal
      ) then 'present'
      else 'missing'
    end
  from flags

  -- RLS readiness
  union all
  select
    'security',
    'rls.accounts_pairing_sessions.enabled',
    coalesce((select relrowsecurity from pg_class where oid = 'public.accounts_pairing_sessions'::regclass), false),
    case
      when coalesce((select relrowsecurity from pg_class where oid = 'public.accounts_pairing_sessions'::regclass), false)
      then 'enabled'
      else 'disabled_or_missing'
    end
  from flags
  union all
  select
    'security',
    'rls.accounts_bridge_tokens.enabled',
    coalesce((select relrowsecurity from pg_class where oid = 'public.accounts_bridge_tokens'::regclass), false),
    case
      when coalesce((select relrowsecurity from pg_class where oid = 'public.accounts_bridge_tokens'::regclass), false)
      then 'enabled'
      else 'disabled_or_missing'
    end
  from flags
  union all
  select
    'security',
    'rls.accounts_device_commands.enabled',
    coalesce((select relrowsecurity from pg_class where oid = 'public.accounts_device_commands'::regclass), false),
    case
      when coalesce((select relrowsecurity from pg_class where oid = 'public.accounts_device_commands'::regclass), false)
      then 'enabled'
      else 'disabled_or_missing'
    end
  from flags
  union all
  select
    'security',
    'rls.accounts_cli_replay_nonces.enabled',
    coalesce((select relrowsecurity from pg_class where oid = 'public.accounts_cli_replay_nonces'::regclass), false),
    case
      when coalesce((select relrowsecurity from pg_class where oid = 'public.accounts_cli_replay_nonces'::regclass), false)
      then 'enabled'
      else 'disabled_or_missing'
    end
  from flags

  -- Key constraints/indexes/policies
  union all
  select
    'integrity',
    'constraints.required_count',
    (
      select count(*)
      from pg_constraint
      where conname in (
        'accounts_pairing_sessions_code_not_blank_chk',
        'accounts_pairing_sessions_expires_after_created_chk',
        'accounts_pairing_sessions_claimed_state_chk',
        'accounts_pairing_sessions_bridge_token_id_fkey',
        'accounts_bridge_tokens_expires_after_issued_chk',
        'accounts_bridge_tokens_token_hash_format_chk',
        'accounts_device_commands_command_not_blank_chk',
        'accounts_device_commands_idempotency_key_not_blank_chk',
        'accounts_device_commands_delivery_after_create_chk',
        'accounts_device_commands_completion_after_create_chk',
        'accounts_cli_replay_nonces_expires_after_created_chk',
        'accounts_pairing_sessions_expires_after_created_v2_chk',
        'accounts_bridge_tokens_expires_after_issued_v2_chk',
        'accounts_device_commands_completion_after_created_v2_chk',
        'accounts_cli_replay_nonces_expires_after_created_v2_chk'
      )
    ) = 15,
    format(
      'present=%s expected=15',
      (
        select count(*)
        from pg_constraint
        where conname in (
          'accounts_pairing_sessions_code_not_blank_chk',
          'accounts_pairing_sessions_expires_after_created_chk',
          'accounts_pairing_sessions_claimed_state_chk',
          'accounts_pairing_sessions_bridge_token_id_fkey',
          'accounts_bridge_tokens_expires_after_issued_chk',
          'accounts_bridge_tokens_token_hash_format_chk',
          'accounts_device_commands_command_not_blank_chk',
          'accounts_device_commands_idempotency_key_not_blank_chk',
          'accounts_device_commands_delivery_after_create_chk',
          'accounts_device_commands_completion_after_create_chk',
          'accounts_cli_replay_nonces_expires_after_created_chk',
          'accounts_pairing_sessions_expires_after_created_v2_chk',
          'accounts_bridge_tokens_expires_after_issued_v2_chk',
          'accounts_device_commands_completion_after_created_v2_chk',
          'accounts_cli_replay_nonces_expires_after_created_v2_chk'
        )
      )
    )
  from flags
  union all
  select
    'integrity',
    'indexes.required_count',
    (
      select count(*)
      from pg_indexes
      where schemaname = 'public'
        and indexname in (
          'accounts_pairing_sessions_user_created_idx',
          'accounts_pairing_sessions_device_status_idx',
          'accounts_pairing_sessions_code_pending_uniq',
          'accounts_pairing_sessions_pending_expires_idx',
          'accounts_bridge_tokens_user_issued_idx',
          'accounts_bridge_tokens_device_status_idx',
          'accounts_bridge_tokens_active_device_expires_idx',
          'accounts_device_commands_user_idempotency_uniq',
          'accounts_device_commands_device_status_created_idx',
          'accounts_device_commands_user_created_idx',
          'accounts_device_commands_queue_delivery_idx',
          'accounts_cli_replay_nonces_expires_idx'
        )
    ) = 12,
    format(
      'present=%s expected=12',
      (
        select count(*)
        from pg_indexes
        where schemaname = 'public'
          and indexname in (
            'accounts_pairing_sessions_user_created_idx',
            'accounts_pairing_sessions_device_status_idx',
            'accounts_pairing_sessions_code_pending_uniq',
            'accounts_pairing_sessions_pending_expires_idx',
            'accounts_bridge_tokens_user_issued_idx',
            'accounts_bridge_tokens_device_status_idx',
            'accounts_bridge_tokens_active_device_expires_idx',
            'accounts_device_commands_user_idempotency_uniq',
            'accounts_device_commands_device_status_created_idx',
            'accounts_device_commands_user_created_idx',
            'accounts_device_commands_queue_delivery_idx',
            'accounts_cli_replay_nonces_expires_idx'
          )
      )
    )
  from flags
  union all
  select
    'security',
    'policies.required_count',
    (
      select count(*)
      from pg_policies
      where schemaname = 'public'
        and policyname in (
          'accounts_pairing_sessions_select_own',
          'accounts_pairing_sessions_insert_own',
          'accounts_pairing_sessions_update_own',
          'accounts_bridge_tokens_select_own',
          'accounts_bridge_tokens_insert_own',
          'accounts_bridge_tokens_update_own',
          'accounts_device_commands_select_own',
          'accounts_device_commands_insert_own',
          'accounts_device_commands_update_own',
          'accounts_cli_replay_nonces_service_role_all'
        )
    ) = 10,
    format(
      'present=%s expected=10',
      (
        select count(*)
        from pg_policies
        where schemaname = 'public'
          and policyname in (
            'accounts_pairing_sessions_select_own',
            'accounts_pairing_sessions_insert_own',
            'accounts_pairing_sessions_update_own',
            'accounts_bridge_tokens_select_own',
            'accounts_bridge_tokens_insert_own',
            'accounts_bridge_tokens_update_own',
            'accounts_device_commands_select_own',
            'accounts_device_commands_insert_own',
            'accounts_device_commands_update_own',
            'accounts_cli_replay_nonces_service_role_all'
          )
      )
    )
  from flags

  -- Read-only anomaly readiness checks (all expected to be 0)
  union all
  select
    'readiness',
    'anomaly.pairing_blank_code',
    case
      when pairing_table is null then false
      else (
        select count(*) = 0
        from public.accounts_pairing_sessions
        where code is null or length(btrim(code)) = 0
      )
    end,
    case
      when pairing_table is null then 'table_missing'
      else format(
        'count=%s',
        (
          select count(*)
          from public.accounts_pairing_sessions
          where code is null or length(btrim(code)) = 0
        )
      )
    end
  from flags
  union all
  select
    'readiness',
    'anomaly.pairing_expires_not_after_created',
    case
      when pairing_table is null then false
      else (
        select count(*) = 0
        from public.accounts_pairing_sessions
        where expires_at <= created_at
      )
    end,
    case
      when pairing_table is null then 'table_missing'
      else format(
        'count=%s',
        (
          select count(*)
          from public.accounts_pairing_sessions
          where expires_at <= created_at
        )
      )
    end
  from flags
  union all
  select
    'readiness',
    'anomaly.bridge_invalid_token_hash_format',
    case
      when bridge_table is null then false
      else (
        select count(*) = 0
        from public.accounts_bridge_tokens
        where token_hash !~ '^[0-9a-f]{64}$'
      )
    end,
    case
      when bridge_table is null then 'table_missing'
      else format(
        'count=%s',
        (
          select count(*)
          from public.accounts_bridge_tokens
          where token_hash !~ '^[0-9a-f]{64}$'
        )
      )
    end
  from flags
  union all
  select
    'readiness',
    'anomaly.device_command_blank_command',
    case
      when commands_table is null then false
      else (
        select count(*) = 0
        from public.accounts_device_commands
        where command is null or length(btrim(command)) = 0
      )
    end,
    case
      when commands_table is null then 'table_missing'
      else format(
        'count=%s',
        (
          select count(*)
          from public.accounts_device_commands
          where command is null or length(btrim(command)) = 0
        )
      )
    end
  from flags
  union all
  select
    'readiness',
    'anomaly.replay_nonce_expires_not_after_created',
    case
      when replay_table is null then false
      else (
        select count(*) = 0
        from public.accounts_cli_replay_nonces
        where expires_at <= created_at
      )
    end,
    case
      when replay_table is null then 'table_missing'
      else format(
        'count=%s',
        (
          select count(*)
          from public.accounts_cli_replay_nonces
          where expires_at <= created_at
        )
      )
    end
  from flags
) as checks;

select
  check_group,
  check_name,
  ok,
  details
from accounts_control_plane_verify_results
order by check_group, check_name;

select
  bool_and(ok) as ready,
  count(*) filter (where not ok) as failed_checks,
  coalesce(array_agg(check_name order by check_name) filter (where not ok), '{}') as failed_check_names
from accounts_control_plane_verify_results;

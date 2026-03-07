-- Migration: Add OAuth token columns to accounts_provider_connections
-- Needed by: 1R-Opta-Accounts (copilot/device/poll, gemini-cli/callback, codex/device/poll)
-- These columns are written when an OAuth provider authorises successfully.
-- All token values are AES-256-GCM encrypted via token-crypto.ts before storage.
-- Additive only — no columns dropped, no data altered.

-- 1. New columns (idempotent)
alter table public.accounts_provider_connections
  add column if not exists token_encrypted         text,
  add column if not exists token_refresh_encrypted text,
  add column if not exists token_scope             text,
  add column if not exists token_expires_at        timestamptz,
  add column if not exists connected_via           text;

-- 2. UNIQUE constraint on (user_id, provider) — required for ON CONFLICT upserts.
--    Use a DO block so this is idempotent: only add the constraint if it doesn't exist.
do $$
begin
  if not exists (
    select 1
    from   pg_constraint
    where  conname   = 'accounts_provider_connections_user_id_provider_key'
      and  conrelid  = 'public.accounts_provider_connections'::regclass
  ) then
    alter table public.accounts_provider_connections
      add constraint accounts_provider_connections_user_id_provider_key
      unique (user_id, provider);
  end if;
end;
$$;

-- 3. Index to speed up the sync/connections endpoint (filters on user_id + status).
create index if not exists idx_accounts_provider_connections_user_status
  on public.accounts_provider_connections(user_id, status);

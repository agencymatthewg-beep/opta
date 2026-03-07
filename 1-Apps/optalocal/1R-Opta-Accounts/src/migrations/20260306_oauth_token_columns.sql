-- Migration: Add OAuth token storage columns to accounts_provider_connections
-- Run in Supabase SQL editor (or via supabase db push).
--
-- Adds encrypted token storage for OAuth providers (GitHub Copilot, Gemini CLI).
-- Existing rows are unaffected (all columns nullable).

ALTER TABLE accounts_provider_connections
  ADD COLUMN IF NOT EXISTS token_encrypted          TEXT,          -- AES-256-GCM ciphertext (iv.authTag.data, base64url)
  ADD COLUMN IF NOT EXISTS token_refresh_encrypted  TEXT,          -- AES-256-GCM ciphertext for refresh_token (if any)
  ADD COLUMN IF NOT EXISTS token_expires_at         TIMESTAMPTZ,   -- When the access_token expires (null if non-expiring)
  ADD COLUMN IF NOT EXISTS token_scope              TEXT,          -- Space-separated OAuth scopes granted
  ADD COLUMN IF NOT EXISTS connected_via            TEXT;          -- 'device_flow' | 'oauth_pkce' | 'setup_token' | 'api_key'

-- UNIQUE constraint required for ON CONFLICT (user_id, provider) upserts.
-- Safe to run multiple times; DROP + re-add avoids duplicate constraint errors.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'accounts_provider_connections_user_id_provider_key'
      AND conrelid = 'accounts_provider_connections'::regclass
  ) THEN
    ALTER TABLE accounts_provider_connections
      ADD CONSTRAINT accounts_provider_connections_user_id_provider_key
      UNIQUE (user_id, provider);
  END IF;
END $$;

-- RLS: ensure sessions table allows self INSERT and UPDATE
-- (run only if these policies don't already exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'accounts_sessions'
      AND policyname = 'accounts_sessions_self_insert'
  ) THEN
    EXECUTE 'CREATE POLICY accounts_sessions_self_insert
      ON public.accounts_sessions
      FOR INSERT
      WITH CHECK (auth.uid() = user_id)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'accounts_sessions'
      AND policyname = 'accounts_sessions_self_update'
  ) THEN
    EXECUTE 'CREATE POLICY accounts_sessions_self_update
      ON public.accounts_sessions
      FOR UPDATE
      USING (auth.uid() = user_id)';
  END IF;
END $$;

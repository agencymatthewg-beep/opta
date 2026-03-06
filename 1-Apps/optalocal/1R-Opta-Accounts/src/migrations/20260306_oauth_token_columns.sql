-- Migration: Add OAuth token storage columns to accounts_provider_connections
-- Run in Supabase SQL editor (or via supabase db push).
--
-- Adds encrypted token storage for OAuth providers (GitHub Copilot, Gemini CLI).
-- Existing rows are unaffected (all columns nullable).

ALTER TABLE accounts_provider_connections
  ADD COLUMN IF NOT EXISTS token_encrypted  TEXT,          -- AES-256-GCM ciphertext (iv.authTag.data, base64url)
  ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ,   -- When the access_token expires (null if non-expiring)
  ADD COLUMN IF NOT EXISTS token_scope      TEXT,           -- Space-separated OAuth scopes granted
  ADD COLUMN IF NOT EXISTS connected_via    TEXT;           -- 'device_flow' | 'oauth_pkce' | 'setup_token' | 'api_key'

-- Ensure the provider enum/check constraint (if it exists) includes new providers.
-- If you have a CHECK constraint on `provider`, update it here.
-- Example (adjust constraint name as needed):
-- ALTER TABLE accounts_provider_connections DROP CONSTRAINT IF EXISTS accounts_provider_connections_provider_check;
-- ALTER TABLE accounts_provider_connections ADD CONSTRAINT accounts_provider_connections_provider_check
--   CHECK (provider IN ('google', 'apple', 'openai', 'anthropic', 'gemini', 'github-copilot', 'gemini-cli'));

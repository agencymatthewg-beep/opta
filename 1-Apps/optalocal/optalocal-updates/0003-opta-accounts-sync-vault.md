# Opta Accounts Sync Vault Expansion

**Date:** 2026-03-04T15:00:00+11:00
**Target:** Opta Accounts
**Update Type:** Feature
**Commit:** Pending

## Summary

Transformed Opta Accounts into a centralized "Sync Vault" for configuring the entire local coding ecosystem. Added support for syncing robust arrays of credentials (GitHub, Vercel, Cloudflare, Perplexity, OpenCode, Codex, Google, and Twitter) and launched the Global AI Rules Vault (`/rules`) for syncing persistent user `non-negotiables.md` instructions into all AI contexts.

## Detailed Changes

- **[Provider Detection]:** Expanded `provider-detection.ts` heuristical patterns to detect 8 new specific API keys and tokens. Supported keys are now categorized into `AI Models`, `Research Tools`, and `Developer Platforms`.
- **[Keys Interface]:** Refactored the `/keys` UI to categorize and dynamically layout user API keys, drastically improving readability given the larger volume of supported integrations.
- **[Database]:** Drafted a standalone Supabase migration (`sync_vault_migration.sql`) to define the native `sync_files` table with appropriate RLS policies for strict user access control.
- **[Global Rules Interface]:** Implemented the `/rules` route for users to author their `non-negotiables.md` which is asynchronously saved to the `sync_files` vault table via Server Actions (`vault-actions.ts`).

## Rollout Impact

Requires administrators to run `sync_vault_migration.sql` in the Supabase SQL editor to create the `sync_files` table before the `/rules` page will function correctly in production. API Key additions are live immediately.

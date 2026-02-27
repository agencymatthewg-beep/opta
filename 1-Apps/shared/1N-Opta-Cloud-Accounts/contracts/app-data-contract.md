# App Data Contract

## Core Rules

- All user-owned rows must include `user_id` = Supabase `auth.users.id`.
- Row-level access is controlled with RLS policies keyed by `auth.uid()`.
- Cross-app records must include `app_id` for ownership and filtering.

## Minimum Shared Columns

For user-scoped tables, include at least:

- `id` (UUID primary key)
- `user_id` (UUID, required)
- `app_id` (text, required for shared/multi-app tables)
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

## Data Safety

- No app reads another user's rows.
- No app writes with service role from client runtimes.
- Sensitive server operations run only through `3A` with service role credentials.

## Migration Ownership

- Canonical migration path: `1-Apps/1N-Opta-Cloud-Accounts/supabase/migrations`.
- Seed data path: `1-Apps/1N-Opta-Cloud-Accounts/supabase/seeds`.

# Environment Matrix

This matrix defines concrete environment variable expectations for:

- `1L-Opta-Local`
- `1D-Opta-CLI-TS`
- `1M-Opta-LMX`
- `1E-Opta-Life-IOS`
- `1F-Opta-Life-Web`
- `3A-Opta-Gateway`

## Canonical Shared Values

- `OPTA_SUPABASE_URL`: Supabase project URL
- `OPTA_SUPABASE_ANON_KEY`: public anon key
- `OPTA_SUPABASE_SERVICE_ROLE_KEY`: service key for backend/admin flows
- `OPTA_SUPABASE_PROJECT_REF`: Supabase project ref
- `OPTA_SUPABASE_JWT_SECRET`: JWT secret for trusted backend verification

## Workspace Expectations

| Workspace | Required env vars | Notes |
|---|---|---|
| `1L-Opta-Local` | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Web auth uses Supabase JS client and server helpers. |
| `1L-Opta-Local` E2E | `E2E_SUPABASE_TEST_EMAIL`, `E2E_SUPABASE_TEST_PASSWORD` | Optional: `E2E_SUPABASE_SERVICE_ROLE_KEY` to bootstrap fixture users. |
| `1D-Opta-CLI-TS` | `OPTA_SUPABASE_URL`, `OPTA_SUPABASE_ANON_KEY` | Fallbacks supported: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. |
| `1M-Opta-LMX` | Config file (`security.inference_api_key`, `security.supabase_jwt_*`) | LMX auth behavior is configured in YAML (`config/default-config.yaml` / active config), not direct env by default. |
| `1E-Opta-Life-IOS` | app config values for Supabase URL + anon key | Uses Supabase-native auth methods on iOS client. |
| `1F-Opta-Life-Web` | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Standard Supabase web env names. |
| `3A-Opta-Gateway` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PROJECT_REF`, `SUPABASE_JWT_SECRET` | Server-only integration and token verification boundary. |

## Rules

- Client runtimes (`1L`, `1D`, `1E`, `1F`) authenticate via anon key + user session.
- Service role keys are backend/test-runner only (`3A` and controlled E2E bootstrap contexts).
- Google and Apple OAuth callback URLs must be registered per app environment.
- Keep auth methods limited to canonical Supabase-native methods in `AUTH-METHODS.md`.

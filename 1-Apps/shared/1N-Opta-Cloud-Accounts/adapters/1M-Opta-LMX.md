# Adapter: 1M-Opta-LMX

## Required Config (YAML)

- `security.inference_api_key` (optional legacy bearer key mode)
- `security.supabase_jwt_enabled`
- `security.supabase_jwt_require`
- `security.supabase_jwt_issuer`
- `security.supabase_jwt_audience`
- `security.supabase_jwt_jwks_url`
- `security.supabase_jwt_claim_user_id`

## Auth Responsibility

- LMX does not perform user sign-up/sign-in flows.
- LMX verifies bearer tokens on inference endpoints.
- When Supabase JWT verification is enabled:
  - valid Supabase JWT bearer tokens are accepted
  - resolved user id is attached to request state (`supabase_user_id`)

## Notes

- Supabase JWT verification is implemented in:
  - `/Users/matthewbyrden/Synced/Opta/1-Apps/1M-Opta-LMX/src/opta_lmx/security/jwt_verifier.py`
- Dependency gate logic lives in:
  - `/Users/matthewbyrden/Synced/Opta/1-Apps/1M-Opta-LMX/src/opta_lmx/api/deps.py`

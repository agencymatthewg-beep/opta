# Runbook: Rollback

## Trigger conditions

- Elevated auth failure rate
- OAuth callback breakage
- Token verification failures in `3A`

## Immediate actions

1. Freeze new rollout traffic.
2. Revert latest app release(s) in reverse order: `1D/1E/1M/1L/1F`, then `3A` if needed.
3. Restore previous env version for affected workspace.

## Supabase-side actions

- Revert provider callback URL changes if they caused failures.
- Keep canonical auth method set unchanged (do not add non-canonical methods).

## Verification after rollback

- Confirm email/password and phone/password sign-in.
- Confirm Google and Apple OAuth sign-in.
- Confirm protected API requests succeed with valid bearer tokens.

# Auth Test Matrix

## Methods

- `signUp(email/password)`
- `signUp(phone/password)`
- `signInWithPassword(email/password)`
- `signInWithPassword(phone/password)`
- `signInWithOAuth(google)`
- `signInWithOAuth(apple)`

## Coverage Matrix

| Workspace | Email/Password | Phone/Password | OAuth Google | OAuth Apple | Session Refresh |
|---|---|---|---|---|---|
| `1L-Opta-Local` | Required | Required | Required | Required | Required |
| `1D-Opta-CLI-TS` | Required | Required | Required | Required | Required |
| `1M-Opta-LMX` | Required | Required | Required | Required | Required |
| `1E-Opta-Life-IOS` | Required | Required | Required | Required | Required |
| `1F-Opta-Life-Web` | Required | Required | Required | Required | Required |
| `3A-Opta-Gateway` | Token verify only | Token verify only | Token verify only | Token verify only | Required |

## Pass Criteria

- Successful auth produces valid Supabase session.
- `user.id` is stable and shared across apps.
- Protected endpoints reject invalid/expired tokens.

## Implemented Smoke Coverage (Current)

- Canonical runner:
  - `/Users/matthewbyrden/Synced/Opta/1-Apps/1N-Opta-Cloud-Accounts/tests/cross-app-auth-smoke.sh`
- Verified paths:
  - `1D-Opta-CLI-TS`: `opta account login --identifier --password`
  - `1L-Opta-Local`: authenticated e2e (`devices` + `pair` success-state)
  - `1M-Opta-LMX`: bearer request to `/v1/models`

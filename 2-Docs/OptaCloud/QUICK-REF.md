# Opta Cloud — Quick Reference Card

## Credentials

| Service | Key | Where to Find |
|---------|-----|---------------|
| Supabase URL | `https://cytjsmezyldytbmjrolyz.supabase.co` | This file |
| Supabase Anon | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` | SOT: MASTER.CREDS.md |
| Supabase Service | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` | SOT: MASTER.CREDS.md |
| Google Client ID | — | Google Cloud Console |
| Apple Team ID | — | Apple Developer Portal |

## Database

```sql
-- Connect
psql "$DATABASE_URL" -h db.cytjsmezyldytbmjrolyz.supabase.co -U postgres

-- Tables
profiles        -- User profiles
app_configs      -- Per-app settings
user_api_keys   -- Encrypted API keys
```

## Quick Links

| Resource | URL |
|----------|-----|
| Supabase Dashboard | https://supabase.com/dashboard |
| Auth Providers | Supabase → Authentication → Providers |
| Google Cloud Console | https://console.cloud.google.com |
| Apple Developer | https://developer.apple.com |

## Shared Libraries

| Platform | Package |
|----------|---------|
| iOS | `~/Documents/Opta/OptaCloud/shared-libs/swift/` |
| Web | `~/Documents/Opta/OptaCloud/shared-libs/typescript/` |

## Environment Template

```bash
# iOS (Info.plist)
CFBundleURLTypes: com.yourapp://oauth/callback

# .env (Web)
NEXT_PUBLIC_SUPABASE_URL=https://cytjsmezyldytbmjrolyz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

---

*Last updated: 2026-02-19*

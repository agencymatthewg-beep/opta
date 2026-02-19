# Auth Providers Setup

## Google Sign-In

### Supabase Dashboard

1. Go to **Authentication → Providers → Google**
2. Enable Google
3. Enter credentials from Google Cloud Console

### Google Cloud Console Setup

1. Create project at https://console.cloud.google.com
2. Enable "Google+ API" or "Google People API"
3. Go to Credentials → Create OAuth Client ID
4. Set authorized redirect URIs:
   - `https://your-project.supabase.co/auth/v1/callback`
5. Copy Client ID and Client Secret to Supabase

### Environment Variables

```bash
# .env
NEXT_PUBLIC_SUPABASE_URL=https://cytjsmezyldytbmjrolyz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

---

## Apple Sign-In

### Supabase Dashboard

1. Go to **Authentication → Providers → Apple**
2. Enable Apple
3. Enter:
   - Client ID (Bundle ID, e.g., `com.yourteam.yourapp`)
   - Team ID (from Apple Developer)
   - Key ID (create in Apple Developer → Keys)
   - Private Key (.p8 file)

### Xcode Setup (iOS)

1. Add "Sign in with Apple" capability
2. In Signing & Capabilities, enable "Sign in with Apple"
3. Add redirect URL in Capabilities → Associated Domains:
   - `applinks:your-app.supabase.co`

---

## Email / Password

### Supabase Dashboard

1. Go to **Authentication → Providers → Email**
2. Enable "Enable Email Signups"
3. Optionally configure "Confirm email" (default: off)

### Security

- Passwords hashed by Supabase
- Use RLS to protect user data

---

## Testing

### Test Emails

Supabase provides test emails:
- Use any email with `test+anything@` prefix
- Real emails require SMTP configuration

### Test Google/Apple

Must use real accounts from:
- Google: https://accounts.google.com
- Apple: https://appleid.apple.com

---

*Last updated: 2026-02-19*

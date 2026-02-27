# Supabase Auth Migration Notes

## Completed Migration (Option C)

**Date:** February 18, 2026

### Changes Made

1. **Installed Supabase packages:**
   - `@supabase/ssr@0.5.2`
   - `@supabase/supabase-js@2.96.0`

2. **Created Supabase client utilities:**
   - `lib/supabase/server.ts` - Server-side client with cookie handling
   - `lib/supabase/client.ts` - Browser-side client
   - `lib/supabase/middleware.ts` - Session refresh middleware helper
   - `lib/supabase/auth.ts` - Auth helper functions (getUser, getSession, getGoogleToken)
   - `lib/supabase/tokens.ts` - Google OAuth token management with automatic refresh

3. **Created middleware:**
   - `middleware.ts` at project root
   - Refreshes Supabase session on every request
   - Matches all routes except static files and _next

4. **Created auth callback route:**
   - `app/auth/callback/route.ts`
   - Handles OAuth callback from Supabase
   - Captures and stores Google provider tokens in credentials table

5. **Updated authentication flow:**
   - Replaced NextAuth's `auth()` with Supabase `getUser()`
   - Updated `lib/actions.ts` to use Supabase auth
   - Updated all mobile API routes to accept both cookie-based (web) and Bearer token (iOS) auth

6. **Updated UI components:**
   - `lib/auth-actions.ts` - Uses Supabase OAuth with Google scopes
   - `app/page.tsx` - Uses Supabase session

7. **Backed up old auth:**
   - `auth.ts` → `auth.ts.bak` (kept as reference)
   - NextAuth handlers route deprecated with 410 Gone status

### Environment Variables Required

Add these to Vercel:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://cytjsmezydytbmjrolyz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your_anon_key>

# Google OAuth (existing)
GOOGLE_CLIENT_ID=88000480710-u0oftrjncotchck28pc8pjp9ok1gkp47.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=<your_secret>

# Site URL (for OAuth redirects)
NEXT_PUBLIC_SITE_URL=https://your-production-url.vercel.app

# Todoist (no changes)
TODOIST_API_TOKEN=<your_token>

# Google AI (no changes)
GOOGLE_API_KEY=<your_key>
```

### Supabase Configuration

1. **Google OAuth Provider:**
   - Enabled in Supabase dashboard
   - Added authorized redirect URLs:
     - `https://cytjsmezydytbmjrolyz.supabase.co/auth/v1/callback`
     - `https://your-production-url.vercel.app/auth/callback`
     - `http://localhost:3000/auth/callback` (development)

2. **Credentials Table:**
   - Schema already exists with columns:
     - `id` (uuid)
     - `user_id` (uuid, references auth.users)
     - `service_name` (text) - "google"
     - `credential_type` (text) - "oauth_access_token" or "oauth_refresh_token"
     - `encrypted_value` (text) - the token value
     - `credential_data` (jsonb) - metadata like expiry
     - `created_at`, `updated_at` (timestamptz)

3. **RLS Policies:**
   - Users can only access their own credentials
   - Service role can manage all credentials (for token refresh)

### Testing Checklist

- [ ] Web sign-in with Google
- [ ] Calendar API access
- [ ] Gmail API access  
- [ ] Token refresh on expiry
- [ ] iOS app can authenticate (uses existing Supabase auth)
- [ ] Mobile API endpoints work with both cookie and Bearer auth
- [ ] Sign-out flow

### Known Issues

None currently. Build passed successfully.

### Rollback Plan

If needed:
1. Rename `auth.ts.bak` back to `auth.ts`
2. Restore the old `lib/auth-actions.ts`, `app/page.tsx`, and API routes
3. Remove Supabase middleware and callback route
4. Deploy previous version from git

### Next Steps

1. Update Vercel environment variables
2. Test in production
3. Monitor Supabase auth logs
4. Remove `next-auth` from package.json once stable (keep as fallback for now)

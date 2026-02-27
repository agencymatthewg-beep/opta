# optalocal.com Dashboard - Supabase Setup

## Environment Variables

Create `.env.local`:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://cytjsmezydytbmjrolyz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5dGpzbWV6eWR5dGJtanJvbHl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5OTcyNDUsImV4cCI6MjA4NjU3MzI0NX0.DuYyYixsjdl9R5Uq4hIL4TQMGvCCssw_1wNo-J7De6Q
SUPABASE_SERVICE_ROLE_KEY=<your-supabase-service-role-key>
NEXT_PUBLIC_SITE_URL=https://optalocal.com

# Auth Providers (configure in Supabase Dashboard)
NEXT_PUBLIC_ENABLE_APPLE=true
NEXT_PUBLIC_ENABLE_GOOGLE=true
```

> Security warning: Never commit or share `SUPABASE_SERVICE_ROLE_KEY`. Keep it only in private server-side environment variables.

Configure Supabase Authentication providers to match app behavior:
- `Google` OAuth provider
- `Apple` OAuth provider
- `Email` (password auth enabled)
- `Phone` (password auth enabled)

## Supported Web Auth Actions

Source: `web/src/lib/supabase/auth-actions.ts`

| Method | Type | Behavior |
|--------|------|----------|
| `signInWithGoogle()` | OAuth | Starts Google OAuth and redirects to Supabase URL |
| `signInWithApple()` | OAuth | Starts Apple OAuth and redirects to Supabase URL |
| `signInWithPasswordIdentifier(identifier, password)` | Password | Uses Supabase `signInWithPassword` with email-or-phone routing; returns `{ ok, error? }` |
| `signUpWithPasswordIdentifier(identifier, password, name?)` | Password | Uses Supabase `signUp` with email-or-phone routing and optional profile metadata; returns `{ ok, error? }` |

## Supabase SQL Schema

Run this in Supabase SQL Editor:

```sql
-- Enable auth providers
-- (Configure in Authentication → Providers in Supabase Dashboard)

-- Profiles table (extends auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  setup_complete BOOLEAN DEFAULT FALSE,
  lmx_server_url TEXT,
  lmx_server_token TEXT
);

-- User LMX configurations
CREATE TABLE public.user_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  config_name TEXT NOT NULL,
  config_data JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User API keys (encrypted)
CREATE TABLE public.user_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  encrypted_key TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_api_keys ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view own configs" ON public.user_configs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own configs" ON public.user_configs
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own API keys" ON public.user_api_keys
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own API keys" ON public.user_api_keys
  FOR ALL USING (auth.uid() = user_id);

-- Function to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for auto profile creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

## Auth Flow

```
1. User visits optalocal.com
2. Not authenticated → Show landing page with "Sign In" button
3. User signs in on /sign-in using one of four methods:
   - Continue with Google
   - Continue with Apple
   - Email + password
   - Phone + password
4. Supabase returns session → Check if profile.setup_complete
5. IF setup_complete = FALSE:
   → Redirect to /setup wizard
   → Dashboard LOCKED until wizard completes
6. IF setup_complete = TRUE:
   → Load user config from Supabase
   → Show personalized dashboard
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/auth/callback` | GET | Supabase OAuth callback (code exchange) |
| `/api/config` | GET/POST | Get/Update user config |
| `/api/keys` | GET/POST/DELETE | Manage API keys |
| `/api/lmx/status` | GET | Check LMX server status |
| `/api/lmx/chat` | POST | Chat with LMX |

## Security

- All user data isolated by RLS
- API keys encrypted with Supabase Vault or user-specific key
- LMX server token stored encrypted
- Rate limiting via Vercel

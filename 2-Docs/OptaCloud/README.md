> **Canonical source moved (2026-02-23):** The authoritative cloud accounts docs now live at `/Users/matthewbyrden/Synced/Opta/1-Apps/1N-Opta-Cloud-Accounts` (under `1-Apps`, not `Documents`). This file is retained for legacy reference.

# Opta Cloud — Account & Data Sync Architecture

**Purpose:** Central reference for all Opta apps to understand iCloud, Supabase, and Google Sign-In setup.
**Created:** 2026-02-19
**Location:** `~/Documents/Opta/OptaCloud/`

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Opta Cloud                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   iCloud     │  │  Supabase    │  │    Google   │      │
│  │   (Apple)    │  │   (Auth+DB)  │  │  Sign-In    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         │                  │                  │               │
│         └──────────────────┼──────────────────┘               │
│                            │                                  │
│                    ┌───────▼───────┐                         │
│                    │  Opta Apps    │                         │
│                    │  (All use)    │                         │
│                    └───────────────┘                         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 1. Supabase Configuration

### Credentials

| Item | Value |
|------|-------|
| **URL** | `https://cytjsmezyldytbmjrolyz.supabase.co` |
| **Anon Key** | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5dGpzbWV6eWR5dGJtanJvbHl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5OTcyNDUsImV4cCI6MjA4NjU3MzI0NX0.DuYyYixsjdl9R5Uq4hIL4TQMGvCCssw_1wNo-J7De6Q` |
| **Service Role** | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5dGpzbWV6eWx5dGJtanJvbHl6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDk5NzI0NSwiZXhwIjoyMDg2NTczMjQ1fQ.XLpqeLBcPTGNFE4SHhfcxS6YL3YD-ngb0fbHoq6c2CA` |

### Database Schema (All Apps Use)

```sql
-- Every app uses these tables:

-- User profiles (extends Supabase Auth)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  app_specific_data JSONB DEFAULT '{}'
);

-- App configurations (per-user, per-app)
CREATE TABLE public.app_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id),
  app_id TEXT NOT NULL,        -- e.g., 'optalife', 'optaplan'
  config_key TEXT NOT NULL,
  config_value JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- API keys (encrypted, per-user)
CREATE TABLE public.user_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id),
  provider TEXT NOT NULL,       -- 'openai', 'anthropic', 'groq'
  encrypted_key TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### RLS Policies (Security)

All tables have Row-Level Security:
- Users can only see their own data
- Service role can see all (for admin functions)

---

## 2. Google Sign-In

### Setup (Supabase Dashboard)

1. Go to **Authentication → Providers → Google**
2. Enable Google
3. Enter credentials from Google Cloud Console:
   - Client ID
   - Client Secret
4. Add redirect URL: `https://your-app.supabase.co/auth/v1/callback`

### Implementation

```swift
// Swift (iOS)
import Supabase

let session = try await supabase.auth.signInWithOAuth(
  provider: .google,
  options: SignInWithOAuthOptions(
    redirectURL: "your-app://oauth/callback"
  )
)
```

```typescript
// Next.js (Web)
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: 'https://yourapp.com/auth/callback',
  },
})
```

---

## 3. Apple Sign-In

### Setup (Supabase Dashboard)

1. Go to **Authentication → Providers → Apple**
2. Enable Apple
3. Enter:
   - Client ID (Bundle ID)
   - Team ID
   - Key ID
   - Private Key (.p8 file)
4. Add redirect URL

### Implementation

```swift
// iOS - Use Sign in with Apple button
import AuthenticationServices

// Handle callback in SceneDelegate
func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
  guard let url = URLContexts.first?.url else { return }
  _ = try? supabase.auth.session(from: url)
}
```

---

## 4. iCloud Sync (CloudKit)

### Setup (Xcode)

1. Enable CloudKit capability in Xcode
2. Create iCloud container: `iCloud.com.yourteam.yourapp`
3. Enable Key-Value storage or CloudKit database

### Implementation

```swift
// Swift - NSUbiquitousKeyValueStore (Simple Key-Value)
let store = NSUbiquitousKeyValueStore.default

// Save
store.set(encodedConfig, forKey: "app_config")

// Listen for changes
NotificationCenter.default.addObserver(
  forName: NSUbiquitousKeyValueStore.didChangeExternallyNotification,
  object: store,
  queue: .main
) { notification in
  // Handle sync
}
```

---

## 5. Shared Library

**Location:** `~/Documents/Opta/OptaCloud/shared-libs/`

For each platform, create a shared library:

```
shared-libs/
├── swift/           # OptaCloud Swift Package
│   ├── Sources/
│   │   └── OptaCloud/
│   │       ├── Auth.swift
│   │       ├── Database.swift
│   │       └── Sync.swift
│   └── Package.swift
│
├── typescript/      # OptaCloud NPM Package
│   ├── src/
│   │   ├── auth.ts
│   │   ├── database.ts
│   │   └── sync.ts
│   └── package.json
│
└── common/          # Shared types
    └── types.ts
```

### Swift Package Example

```swift
// Sources/OptaCloud/Auth.swift
import Foundation
import Supabase

public struct OptaCloud {
  public static let supabaseURL = "https://cytjsmezyldytbmjrolyz.supabase.co"
  public static let anonKey = "eyJ..."
  
  public static func signInWithGoogle() async throws -> Session {
    let client = SupabaseClient(supabaseURL: supabaseURL, supabaseKey: anonKey)
    return try await client.auth.signInWithOAuth(provider: .google)
  }
}
```

---

## 6. App Integration Checklist

When adding Opta Cloud to a new app:

- [ ] Add Supabase dependency
- [ ] Configure bundle identifier in Supabase
- [ ] Add Google Sign-In to Xcode (iOS) or Google Console (Web)
- [ ] Add Apple Sign-In entitlement
- [ ] Implement Auth flow using shared library
- [ ] Set up RLS policies for new tables
- [ ] Test on real device (not simulator for iCloud)

---

## 7. Environment Variables

For web apps:

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://cytjsmezyldytbmjrolyz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

For server-side (service role):

```bash
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

---

## 8. Current Apps Using Opta Cloud

| App | Platform | Auth | Database | iCloud |
|-----|----------|------|----------|--------|
| Opta Life | iOS | ✅ Apple | ✅ | ✅ |
| Opta Life | Web (Next.js) | ✅ Google | ✅ | — |
| Opta Scan | iOS | ✅ Apple | ✅ | ✅ |
| optalocal.com | Web | ✅ Google/Apple | ✅ | — |

---

## 9. Adding New Providers

### To add a new auth provider:

1. Configure in Supabase Dashboard
2. Add to this document
3. Update shared library
4. Test in one app first

### Current Supported Providers

| Provider | iOS | Web |
|----------|-----|-----|
| Apple | ✅ Native | ✅ |
| Google | ✅ Native + Supabase | ✅ Supabase |
| Email | ✅ | ✅ |

---

## 10. Support

- **Issues:** Check `~/Documents/Opta/OptaCloud/docs/`
- **Credentials:** `~/Synced/AI26/1-SOT/1C-Accounts/`
- **Shared libs:** `~/Documents/Opta/OptaCloud/shared-libs/`

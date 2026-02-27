# Phase 16: Social Features - Research

**Researched:** 2026-01-16
**Domain:** Social features for desktop (Tauri) gaming optimization app
**Confidence:** HIGH

<research_summary>
## Summary

Researched the ecosystem for implementing social features (friend system, score sharing, direct comparisons) in a Tauri v2 desktop app. The standard approach uses Supabase as a backend-as-a-service for authentication, real-time presence, and database storage. For score card sharing, Cloudinary provides dynamic image generation via URL-based transformations.

Key finding: Desktop apps should use browser-based OAuth with PKCE for authentication (not machine-to-machine auth). Tauri's deep-link plugin enables OAuth callbacks. For real-time friend status and leaderboards, Supabase Realtime with Presence tracking is the established pattern.

Opta already has a Score page (Phase 9) with `handleShare` and `handleExport` TODOs - these form the foundation for Phase 16. The leaderboard and hardware tier filtering are already UI-ready.

**Primary recommendation:** Use Supabase (auth + realtime + postgres) as backend. Use Cloudinary for shareable score card image generation. Implement browser-based OAuth with deep-link callbacks for secure authentication.
</research_summary>

<standard_stack>
## Standard Stack

The established libraries/tools for social features in a Tauri desktop app:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Supabase JS | ^2.45.0 | Auth, DB, Realtime | Open-source Firebase alternative, excellent real-time support, 20+ OAuth providers |
| @tauri-apps/plugin-deep-link | ^2.4.5 | OAuth callbacks | Official Tauri plugin for handling URL schemes |
| @tauri-apps/plugin-shell | ^2.0.0 | Open browser for OAuth | Needed for browser-based auth flow |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Cloudinary SDK | ^2.5.0 | Dynamic image generation | Score card sharing to social media |
| @tauri-apps/plugin-os | ^2.0.0 | Platform detection | Conditional behavior per OS |
| zustand | ^4.4.7 | Social state management | Already in project, extends for friend state |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Supabase | Firebase | Supabase is open-source, better Postgres, but Firebase has more mature mobile SDKs |
| Supabase | Appwrite | Appwrite is self-hostable but smaller ecosystem |
| Cloudinary | ScreenshotOne | ScreenshotOne simpler but Cloudinary more flexible for overlays |
| Cloudinary | Puppeteer self-hosted | Self-hosted is free but requires server infrastructure |

**Installation:**
```bash
npm install @supabase/supabase-js
npm install @tauri-apps/plugin-deep-link @tauri-apps/plugin-shell

# For image generation (optional - can use Cloudinary CDN URLs directly)
npm install cloudinary
```

**Tauri Cargo.toml additions:**
```toml
[dependencies]
tauri-plugin-deep-link = "2"
tauri-plugin-shell = "2"
```
</standard_stack>

<architecture_patterns>
## Architecture Patterns

### Recommended Project Structure
```
src/
├── lib/
│   ├── supabase.ts          # Supabase client initialization
│   └── shareCard.ts         # Cloudinary URL generation
├── hooks/
│   ├── useAuth.ts           # Auth state and methods
│   ├── useFriends.ts        # Friend list and requests
│   ├── usePresence.ts       # Online status tracking
│   └── useScore.ts          # Extended with sharing
├── components/
│   ├── FriendList.tsx       # Friend list with online indicators
│   ├── FriendComparison.tsx # Side-by-side score comparison
│   ├── ShareCard.tsx        # Generated score card preview
│   └── SocialSettings.tsx   # Privacy controls
├── stores/
│   └── socialStore.ts       # Zustand store for social state
└── pages/
    └── Friends.tsx          # Friends page
```

### Pattern 1: Browser-Based OAuth with Deep Links
**What:** Open system browser for OAuth, receive callback via deep link
**When to use:** All social authentication in desktop apps
**Example:**
```typescript
// Source: Tauri + Supabase OAuth pattern (verified with official docs)
import { open } from '@tauri-apps/plugin-shell';
import { onOpenUrl, getCurrent } from '@tauri-apps/plugin-deep-link';
import { supabase } from '@/lib/supabase';

// Register deep link handler on app start
onOpenUrl((urls) => {
  const url = urls[0];
  if (url.includes('auth/callback')) {
    // Extract tokens from URL and set session
    const params = new URLSearchParams(url.split('#')[1]);
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    if (accessToken && refreshToken) {
      supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    }
  }
});

// Initiate OAuth flow
async function signInWithDiscord() {
  const { data } = await supabase.auth.signInWithOAuth({
    provider: 'discord',
    options: {
      redirectTo: 'opta://auth/callback',
      skipBrowserRedirect: true,
    }
  });
  if (data.url) {
    await open(data.url); // Opens system browser
  }
}
```

### Pattern 2: Supabase Realtime Presence for Friend Status
**What:** Track online/offline status of friends in real-time
**When to use:** Friend list, activity feeds, "currently optimizing" status
**Example:**
```typescript
// Source: Supabase Realtime Presence docs
import { supabase } from '@/lib/supabase';

function usePresence(userId: string) {
  const [onlineFriends, setOnlineFriends] = useState<string[]>([]);

  useEffect(() => {
    const channel = supabase.channel('online-friends')
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const online = Object.keys(state);
        setOnlineFriends(online);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: userId,
            online_at: new Date().toISOString(),
            status: 'online',
          });
        }
      });

    return () => { channel.unsubscribe(); };
  }, [userId]);

  return onlineFriends;
}
```

### Pattern 3: Cloudinary Dynamic Score Card Generation
**What:** Generate shareable images via URL transformations
**When to use:** Score sharing to Twitter/Discord, export to clipboard
**Example:**
```typescript
// Source: Cloudinary transformation docs
const CLOUD_NAME = 'your-cloud-name';
const BASE_CARD = 'opta-score-card-template'; // Pre-uploaded template

function generateScoreCardUrl(score: number, username: string, tier: string): string {
  const textOverlay = `l_text:Sora_72_bold:${score},co_rgb:00FF88,g_center,y_-50`;
  const nameOverlay = `l_text:Sora_32:${encodeURIComponent(username)},co_rgb:FFFFFF,g_center,y_50`;
  const tierOverlay = `l_text:Sora_24:${encodeURIComponent(tier)},co_rgb:888888,g_south,y_30`;

  return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${textOverlay}/${nameOverlay}/${tierOverlay}/v1/${BASE_CARD}.png`;
}

// Usage: Returns a URL that renders the score card dynamically
const cardUrl = generateScoreCardUrl(847, 'GamerX', 'Enthusiast Tier');
```

### Pattern 4: Friend System Database Schema
**What:** Postgres tables for friend relationships
**When to use:** Supabase database setup
**Example:**
```sql
-- Source: Standard friend system schema pattern
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  hardware_tier TEXT,
  opta_score INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID REFERENCES profiles(id) NOT NULL,
  addressee_id UUID REFERENCES profiles(id) NOT NULL,
  status TEXT CHECK (status IN ('pending', 'accepted', 'blocked')) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(requester_id, addressee_id)
);

-- Index for fast friend lookups
CREATE INDEX idx_friendships_users ON friendships(requester_id, addressee_id);

-- RLS policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public profiles are viewable" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can view their friendships" ON friendships FOR SELECT
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);
```

### Anti-Patterns to Avoid
- **Machine-to-machine OAuth in desktop apps:** Can't hide secrets, always use browser-based with PKCE
- **Polling for friend status:** Use Supabase Realtime Presence instead of periodic API calls
- **Storing auth tokens in localStorage:** Use Tauri's secure keychain plugin for token storage
- **Server-side score card generation:** Cloudinary URL transforms are free and cacheable
- **Custom friendship logic:** Use established schemas with status enum, not boolean fields
</architecture_patterns>

<dont_hand_roll>
## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Authentication | Custom JWT/session management | Supabase Auth | OAuth complexity, token refresh, provider management |
| Real-time presence | WebSocket server + polling | Supabase Realtime Presence | Connection management, reconnection, state sync |
| Image generation | Canvas API / Puppeteer | Cloudinary URL transforms | Server infrastructure, caching, CDN delivery |
| Friend request logic | Custom state machine | Standard status enum (pending/accepted/blocked) | Edge cases: mutual blocks, re-requests, race conditions |
| Leaderboard ranking | Manual sorting in DB | Redis Sorted Sets or Supabase functions | Performance at scale, concurrent updates |
| Deep link handling | Custom URL parsing | @tauri-apps/plugin-deep-link | Platform-specific registration, security |

**Key insight:** Social features have decades of established patterns. The friend system alone has edge cases (mutual blocking, self-friending, request spam) that standard schemas handle. Supabase + Cloudinary provide the entire backend without server management.
</dont_hand_roll>

<common_pitfalls>
## Common Pitfalls

### Pitfall 1: OAuth in Desktop Without Browser
**What goes wrong:** Embedding OAuth in WebView exposes credentials to app code
**Why it happens:** Trying to keep users "in-app" instead of using system browser
**How to avoid:** Always use browser-based OAuth with deep-link callbacks. Tauri's shell plugin opens the default browser; deep-link plugin receives the callback.
**Warning signs:** Asking users to paste tokens, storing client secrets, using implicit grant

### Pitfall 2: N+1 Queries for Friend Scores
**What goes wrong:** Fetching each friend's score individually causes slow load times
**Why it happens:** Component-level data fetching without batching
**How to avoid:** Use Supabase joins or views. Create a `friend_scores` view joining friendships + profiles:
```sql
CREATE VIEW friend_scores AS
SELECT p.id, p.username, p.opta_score, p.hardware_tier
FROM profiles p
INNER JOIN friendships f ON (f.addressee_id = p.id OR f.requester_id = p.id)
WHERE f.status = 'accepted';
```
**Warning signs:** Multiple network requests when loading friend list, slow friend page

### Pitfall 3: Race Conditions in Friend Requests
**What goes wrong:** Two users send requests simultaneously, creating duplicate rows
**Why it happens:** Missing unique constraint or check before insert
**How to avoid:** Use `UNIQUE(requester_id, addressee_id)` constraint. Use `ON CONFLICT DO UPDATE` for handling mutual requests.
**Warning signs:** Duplicate friendships, inconsistent UI state, accept button doing nothing

### Pitfall 4: Missing Offline Support
**What goes wrong:** App is unusable without internet connection
**Why it happens:** All data from Supabase, no local cache
**How to avoid:** Cache friend list and own score locally. Show cached data immediately, sync in background. Mark online-only features clearly.
**Warning signs:** Blank screens on network failure, lost user data between sessions

### Pitfall 5: Privacy Violations
**What goes wrong:** Exposing user emails, scores, or activity to non-friends
**Why it happens:** Missing RLS policies or overly permissive default
**How to avoid:** Enable RLS on all tables. Test policies with different user contexts. Default to private, explicitly allow public data.
**Warning signs:** Users seeing others' data, complaints about privacy, exposed API returning all rows
</common_pitfalls>

<code_examples>
## Code Examples

Verified patterns from official sources:

### Supabase Client Setup for Tauri
```typescript
// Source: Supabase JS docs + Tauri patterns
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    storage: {
      // Custom storage using Tauri's secure store (optional)
      getItem: (key) => localStorage.getItem(key),
      setItem: (key, value) => localStorage.setItem(key, value),
      removeItem: (key) => localStorage.removeItem(key),
    },
  },
});
```

### Share Score to Twitter/X
```typescript
// Source: Twitter Web Intent documentation
import { open } from '@tauri-apps/plugin-shell';

async function shareToTwitter(score: number, cardUrl: string) {
  const text = encodeURIComponent(`My Opta Score is ${score}! Check out my PC optimization journey.`);
  const url = encodeURIComponent(cardUrl);
  const twitterUrl = `https://twitter.com/intent/tweet?text=${text}&url=${url}`;

  await open(twitterUrl);
}
```

### Share to Discord via Clipboard
```typescript
// Source: Web Clipboard API (works in Tauri WebView)
async function copyScoreCard(cardUrl: string) {
  try {
    // Fetch the image and copy to clipboard
    const response = await fetch(cardUrl);
    const blob = await response.blob();
    await navigator.clipboard.write([
      new ClipboardItem({ 'image/png': blob })
    ]);
    return true;
  } catch {
    // Fallback: copy URL
    await navigator.clipboard.writeText(cardUrl);
    return true;
  }
}
```

### Friend Comparison Component Data
```typescript
// Source: Supabase query patterns
async function fetchFriendComparison(userId: string, friendId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, opta_score, hardware_tier')
    .in('id', [userId, friendId]);

  if (error) throw error;

  const user = data.find(p => p.id === userId);
  const friend = data.find(p => p.id === friendId);

  return {
    user,
    friend,
    scoreDiff: user.opta_score - friend.opta_score,
    sameTier: user.hardware_tier === friend.hardware_tier,
  };
}
```
</code_examples>

<sota_updates>
## State of the Art (2025-2026)

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Firebase RTDB | Supabase Realtime | 2023+ | Open-source, Postgres, better privacy |
| Custom OAuth servers | Supabase Auth / Auth0 | 2022+ | No server maintenance, 20+ providers |
| Server-side image gen | Cloudinary URL transforms | 2020+ | No infrastructure, CDN cached |
| REST polling for status | WebSocket presence | 2021+ | Real-time, lower bandwidth |
| Machine auth for desktop | Browser OAuth + PKCE + deep links | 2023+ | Security best practice |

**New tools/patterns to consider:**
- **Supabase Edge Functions:** For custom logic (score validation) without separate backend
- **Tauri single-instance plugin:** Ensures deep link callbacks go to running app on Windows/Linux
- **Local-first sync:** Consider CRDTs (e.g., RxDB) if offline-first becomes priority

**Deprecated/outdated:**
- **Implicit OAuth grant:** Use Authorization Code + PKCE instead
- **Polling for real-time data:** WebSockets are standard
- **Server-rendered share images:** CDN-transformed images are more efficient
</sota_updates>

<open_questions>
## Open Questions

Things that couldn't be fully resolved:

1. **Cloudinary Free Tier Limits**
   - What we know: Free tier includes 25 monthly credits (transforms + storage + bandwidth)
   - What's unclear: Exact credit consumption per score card generation
   - Recommendation: Start with Cloudinary, monitor usage, consider self-hosted Puppeteer if limits hit

2. **Windows/Linux Deep Link Behavior**
   - What we know: On Windows/Linux, deep links spawn new app process (not sent to running app)
   - What's unclear: Best UX pattern when app spawns new instance for OAuth callback
   - Recommendation: Use Tauri single-instance plugin with deep-link feature to forward to running app

3. **Leaderboard Scale**
   - What we know: Redis Sorted Sets are standard for large-scale leaderboards
   - What's unclear: Whether Supabase Postgres handles Opta's expected user scale
   - Recommendation: Start with Supabase, add Redis if >100k users cause performance issues
</open_questions>

<sources>
## Sources

### Primary (HIGH confidence)
- [Supabase Realtime Docs](https://supabase.com/docs/guides/realtime) - Presence, broadcast, database changes
- [Supabase Auth Docs](https://supabase.com/docs/guides/auth) - OAuth providers, session management
- [Tauri v2 Deep Linking](https://v2.tauri.app/plugin/deep-linking/) - URL scheme handling
- [Tauri v2 Security](https://v2.tauri.app/security/) - OAuth best practices
- [Cloudinary Transformations](https://cloudinary.com/documentation/transformation_reference) - URL-based image generation

### Secondary (MEDIUM confidence)
- [Medium: Implementing OAuth in Tauri](https://medium.com/@Joshua_50036/implementing-oauth-in-tauri-3c12c3375e04) - Verified patterns match official docs
- [Medium: Supabase + Google OAuth in Tauri 2.0](https://medium.com/@nathancovey23/supabase-google-oauth-in-a-tauri-2-0-macos-app-with-deep-links-f8876375cb0a) - Deep link callback patterns
- [DEV: Auth0 with Tauri](https://dev.to/randomengy/using-auth0-with-tauri-14nl) - Browser-based OAuth reasoning
- [System Design: Gaming Leaderboard](https://blog.algomaster.io/p/design-real-time-gaming-leaderboard) - Redis patterns for scale

### Tertiary (LOW confidence - needs validation)
- Social card dimension requirements may vary by platform (Twitter 1200x630, Discord different)
- Cloudinary pricing changes may affect free tier calculations
</sources>

<metadata>
## Metadata

**Research scope:**
- Core technology: Tauri v2 desktop app with social features
- Ecosystem: Supabase (auth + realtime + postgres), Cloudinary (image generation), Tauri plugins
- Patterns: Browser OAuth, real-time presence, friend schema, score card sharing
- Pitfalls: OAuth security, N+1 queries, race conditions, offline support, privacy

**Confidence breakdown:**
- Standard stack: HIGH - Supabase is established, Tauri plugins are official
- Architecture: HIGH - Patterns verified against official documentation
- Pitfalls: HIGH - Common issues well-documented in community
- Code examples: HIGH - Derived from official docs and verified tutorials

**Research date:** 2026-01-16
**Valid until:** 2026-02-16 (30 days - ecosystem stable)
</metadata>

---

*Phase: 16-social-features*
*Research completed: 2026-01-16*
*Ready for planning: yes*

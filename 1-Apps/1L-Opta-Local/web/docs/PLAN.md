# optalocal.com — Opta LMX Dashboard

**Project:** Live web dashboard for Opta LMX (Local Model Management)
**Status:** Planning
**Created:** 2026-02-19

---

## 1. Core Vision

A web-based dashboard at **optalocal.com** that:
- Manages Opta LMX (local model inference)
- Provides UI for model selection, monitoring, control
- **Cloud-synced** — user config stored in Supabase
- **Auth-gated** — requires login to access dashboard
- Multi-user support with per-user settings

---

## 2. Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js 15 (React 19) + Tailwind CSS |
| **Backend API** | Next.js API Routes / Server Actions |
| **Auth** | Supabase Auth (Apple, Google, Email) |
| **Database** | Supabase PostgreSQL |
| **Storage** | Supabase Storage (user configs) |
| **Real-time** | Supabase Realtime |
| **Local Inference** | Opta LMX (your local Mac Studio) |
| **Deployment** | Vercel (frontend) + your server (LMX) |

---

## 3. Authentication Flow

```
User visits optalocal.com
        ↓
Not logged in → Show landing page
        ↓
Click "Sign In" → Supabase Auth (Apple/Google/Email)
        ↓
Check if user exists in `users` table
        ↓
IF new user:
  → Create user record with default config
  → Show "Setup Your Dashboard" wizard
  → (Dashboard locked until setup complete)
IF returning user:
  → Load their config from Supabase
  → Show their personalized dashboard
```

---

## 4. Database Schema (Supabase)

```sql
-- Users table (extends Supabase auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  username TEXT UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  setup_complete BOOLEAN DEFAULT FALSE
);

-- User LMX configurations
CREATE TABLE user_configs (
  id UUID PRIMARY KEY DEFAULT UUID_GENERATE_V4(),
  user_id UUID REFERENCES profiles(id),
  config_name TEXT,
  config_data JSONB,
  is_active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- API keys per user (encrypted)
CREATE TABLE user_api_keys (
  id UUID PRIMARY KEY DEFAULT UUID_GENERATE_V4(),
  user_id UUID REFERENCES profiles(id),
  provider TEXT, -- 'openai', 'anthropic', 'groq', etc.
  encrypted_key TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 5. Setup Wizard (First-Time Users)

When user first logs in:

1. **Welcome** — "Let's set up your local AI"
2. **Connect LMX** — Enter server URL (your Mac Studio)
3. **Add API Keys** — Optional: add own keys for cloud fallbacks
4. **Choose Models** — Select preferred models
5. **Done** — `setup_complete = TRUE`, dashboard unlocks

---

## 6. Dashboard Features

| Feature | Description |
|---------|-------------|
| **Model Selector** | Choose which local model to use |
| **Server Status** | See LMX server health, memory, GPU |
| **Chat Interface** | Direct chat with local model |
| **Config Editor** | Adjust temperature, system prompts |
| **API Key Manager** | Add/remove cloud API keys |
| **Sync Status** | Cloud sync indicator |

---

## 7. Security Model

- **No shared state** — Each user's config is isolated
- **Encrypted keys** — API keys stored encrypted in Supabase
- **Server validation** — Only allow connecting to authorized LMX servers
- **Rate limiting** — Supabase handles this

---

## 8. Deployment

```
optalocal.com (Vercel)
       ↓
   Supabase (Auth + DB)
       ↓
Your Mac Studio (LMX) ← User connects via API
```

---

## 9. Next Steps

1. **Initialize Next.js project** with Supabase
2. **Set up Supabase project** (auth, database)
3. **Build landing page** with auth flow
4. **Create setup wizard**
5. **Build dashboard UI**
6. **Connect to LMX API**

---

## 10. Questions

- [ ] Which Supabase project to use?
- [ ] Vercel account for deployment?
- [ ] Custom domain already points to Vercel?
- [ ] Priority: MVP first or full feature set?


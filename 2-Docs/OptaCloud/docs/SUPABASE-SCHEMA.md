# Supabase Schema

## Core Tables

### profiles

```sql
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  app_specific_data JSONB DEFAULT '{}'
);
```

### app_configs

```sql
CREATE TABLE public.app_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  app_id TEXT NOT NULL,
  config_key TEXT NOT NULL,
  config_value JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, app_id, config_key)
);
```

### user_api_keys

```sql
CREATE TABLE public.user_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  encrypted_key TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## RLS Policies

All tables have:
- `FOR SELECT USING (auth.uid() = user_id)`
- `FOR INSERT WITH CHECK (auth.uid() = user_id)`
- `FOR UPDATE USING (auth.uid() = user_id)`
- `FOR DELETE USING (auth.uid() = user_id)`

## Trigger: Auto-create profile on signup

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

---

## App-Specific Tables

### optalocal-dashboard

```sql
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
```

---

*Last updated: 2026-02-19*

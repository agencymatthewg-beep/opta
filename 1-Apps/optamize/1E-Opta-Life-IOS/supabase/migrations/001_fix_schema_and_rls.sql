-- ============================================================
-- Opta Life — Supabase Schema Setup
-- Project: opta-ecosystem (cytjsmezydytbmjrolyz)
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================

-- ============================================================
-- 1. Fix credentials table to match iOS app schema
-- ============================================================

-- Drop old table (empty, no data loss)
DROP TABLE IF EXISTS credentials CASCADE;

-- Recreate with correct columns matching iOS OptaCredentialService
CREATE TABLE credentials (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    service_name VARCHAR(100) NOT NULL,
    credential_type VARCHAR(100) NOT NULL,
    encrypted_value TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, service_name, credential_type)
);

-- ============================================================
-- 2. Fix users table — link to auth.users
-- ============================================================

-- Drop and recreate to reference auth.users properly
DROP TABLE IF EXISTS settings CASCADE;
DROP TABLE IF EXISTS ai_provider_keys CASCADE;
DROP TABLE IF EXISTS users CASCADE;

CREATE TABLE users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    avatar_url TEXT,
    subscription_tier VARCHAR(50) DEFAULT 'free',
    email_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    last_login TIMESTAMPTZ
);

-- ============================================================
-- 3. Recreate settings table
-- ============================================================

CREATE TABLE settings (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    setting_key VARCHAR(100) NOT NULL,
    setting_value JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, setting_key)
);

-- ============================================================
-- 4. Recreate ai_provider_keys table
-- ============================================================

CREATE TABLE ai_provider_keys (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL,
    api_key_encrypted TEXT NOT NULL,
    key_name VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    last_used TIMESTAMPTZ,
    usage_count INTEGER DEFAULT 0,
    UNIQUE(user_id, provider, key_name)
);

-- ============================================================
-- 5. Auto-create public.users row on signup
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email, full_name, avatar_url)
    VALUES (
        NEW.id,
        COALESCE(NEW.email, ''),
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', '')
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), users.full_name),
        avatar_url = COALESCE(NULLIF(EXCLUDED.avatar_url, ''), users.avatar_url),
        last_login = now(),
        updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if any
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 6. Enable RLS on all tables
-- ============================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_provider_keys ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 7. RLS Policies — users can only access their own data
-- ============================================================

-- Users table
CREATE POLICY "Users can view own profile"
    ON users FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON users FOR UPDATE
    USING (auth.uid() = id);

-- Credentials table
CREATE POLICY "Users can view own credentials"
    ON credentials FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own credentials"
    ON credentials FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own credentials"
    ON credentials FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own credentials"
    ON credentials FOR DELETE
    USING (auth.uid() = user_id);

-- Settings table
CREATE POLICY "Users can view own settings"
    ON settings FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings"
    ON settings FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own settings"
    ON settings FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own settings"
    ON settings FOR DELETE
    USING (auth.uid() = user_id);

-- AI Provider Keys table
CREATE POLICY "Users can view own keys"
    ON ai_provider_keys FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own keys"
    ON ai_provider_keys FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own keys"
    ON ai_provider_keys FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own keys"
    ON ai_provider_keys FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================================
-- 8. Updated_at auto-trigger
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_credentials_updated_at
    BEFORE UPDATE ON credentials
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_settings_updated_at
    BEFORE UPDATE ON settings
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_ai_provider_keys_updated_at
    BEFORE UPDATE ON ai_provider_keys
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- 9. Indexes for performance
-- ============================================================

CREATE INDEX idx_credentials_user_id ON credentials(user_id);
CREATE INDEX idx_settings_user_id ON settings(user_id);
CREATE INDEX idx_ai_provider_keys_user_id ON ai_provider_keys(user_id);
CREATE INDEX idx_ai_provider_keys_provider ON ai_provider_keys(user_id, provider);

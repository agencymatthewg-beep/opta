-- ============================================================
-- Opta Life — Schema Alignment Migration
-- Fixes credentials table to match iOS OptaCredentialService
-- Adds auth.users trigger for auto user creation
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ============================================================
-- 1. Fix credentials table — add iOS-expected columns
-- ============================================================

-- Add new columns that iOS expects
ALTER TABLE credentials ADD COLUMN IF NOT EXISTS service_name VARCHAR(100);
ALTER TABLE credentials ADD COLUMN IF NOT EXISTS credential_type VARCHAR(100);
ALTER TABLE credentials ADD COLUMN IF NOT EXISTS encrypted_value TEXT;

-- Migrate any existing data from old format (provider → service_name, credential_data → encrypted_value)
UPDATE credentials
SET service_name = provider,
    credential_type = 'default',
    encrypted_value = credential_data::text
WHERE service_name IS NULL AND provider IS NOT NULL;

-- Now make the new columns NOT NULL (after migration)
-- Only if table is empty or all rows have been migrated
ALTER TABLE credentials ALTER COLUMN service_name SET NOT NULL;
ALTER TABLE credentials ALTER COLUMN credential_type SET NOT NULL;
ALTER TABLE credentials ALTER COLUMN encrypted_value SET NOT NULL;

-- Drop old unique constraint and add new one matching iOS upsert
ALTER TABLE credentials DROP CONSTRAINT IF EXISTS credentials_user_id_provider_key;
ALTER TABLE credentials ADD CONSTRAINT credentials_user_service_type_key
    UNIQUE(user_id, service_name, credential_type);

-- Old columns kept for backward compat but made nullable
ALTER TABLE credentials ALTER COLUMN provider DROP NOT NULL;
ALTER TABLE credentials ALTER COLUMN credential_data DROP NOT NULL;

-- ============================================================
-- 2. Add full_name and avatar_url to users table
-- ============================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- ============================================================
-- 3. Link users.id to auth.users for new signups
--    (existing rows won't have auth.users refs, that's OK)
-- ============================================================

-- Auto-create public.users row when someone signs up via Supabase Auth
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

-- Fire on every new auth signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Also fire on sign-in to update last_login
CREATE OR REPLACE FUNCTION public.handle_user_login()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.users
    SET last_login = now(), updated_at = now()
    WHERE id = NEW.id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_login ON auth.users;
CREATE TRIGGER on_auth_user_login
    AFTER UPDATE OF last_sign_in_at ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_user_login();

-- ============================================================
-- 4. Auto-update updated_at columns
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_credentials_updated_at ON credentials;
CREATE TRIGGER update_credentials_updated_at
    BEFORE UPDATE ON credentials
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_settings_updated_at ON settings;
CREATE TRIGGER update_settings_updated_at
    BEFORE UPDATE ON settings
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_ai_provider_keys_updated_at ON ai_provider_keys;
CREATE TRIGGER update_ai_provider_keys_updated_at
    BEFORE UPDATE ON ai_provider_keys
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- 5. Additional RLS policies (INSERT was missing for users)
-- ============================================================

-- Allow the trigger (SECURITY DEFINER) to insert users
-- But also allow service_role to manage users
DO $$
BEGIN
    -- Only create if not exists
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role can manage users' AND tablename = 'users') THEN
        CREATE POLICY "Service role can manage users"
            ON users FOR ALL
            USING (auth.role() = 'service_role');
    END IF;
END $$;

-- ============================================================
-- Done! Test by signing up in the iOS app.
-- ============================================================

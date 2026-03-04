-- Opta Accounts Sync Vault Migration
-- Run this in your Supabase SQL Editor to create the sync_files table and RLS policies.

CREATE TABLE IF NOT EXISTS public.sync_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  content TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, filename)
);

-- Enable RLS
ALTER TABLE public.sync_files ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own sync files"
  ON public.sync_files FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sync files"
  ON public.sync_files FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sync files"
  ON public.sync_files FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sync files"
  ON public.sync_files FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at ON public.sync_files;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.sync_files
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

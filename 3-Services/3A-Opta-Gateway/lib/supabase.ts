import { createClient } from '@supabase/supabase-js'

// Client-side Supabase client (uses anon key)
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Server-side Supabase client (uses service role key for admin operations)
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

// Database types
export interface User {
  id: string
  email: string
  name?: string
  created_at: string
  updated_at: string
}

export interface AIProviderKeys {
  user_id: string
  gemini_key?: string
  claude_key?: string
  opencode_key?: string
  minimax_key?: string
  default_provider?: string
  updated_at: string
}

export interface UserSettings {
  user_id: string
  theme?: string
  notifications_enabled?: boolean
  opta_life_enabled?: boolean
  updated_at: string
}

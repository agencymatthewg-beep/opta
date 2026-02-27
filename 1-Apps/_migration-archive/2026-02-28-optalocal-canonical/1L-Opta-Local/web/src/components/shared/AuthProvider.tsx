'use client';

/**
 * AuthProvider — Global authentication context.
 *
 * Wraps the app in a Supabase auth listener that tracks sign-in/sign-out
 * state. Always provides context to descendants (even when Supabase is
 * not configured — supabase will be null in that case).
 *
 * Auth is mandatory in the auth-first architecture. The SignInOverlay
 * gates access when user is not signed in.
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { createClient, type SupabaseBrowserClient } from '@/lib/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Context value
// ---------------------------------------------------------------------------

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  supabase: SupabaseBrowserClient | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function AuthProvider({ children }: { children: ReactNode }) {
  const [supabase] = useState(() => createClient());
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // No Supabase client — env vars not configured
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      setIsLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  // Always provide context — even when Supabase is not configured
  return (
    <AuthContext.Provider value={{ user, session, isLoading, supabase }}>
      {children}
    </AuthContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/** Access auth state from any descendant. Throws if used outside AuthProvider. */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

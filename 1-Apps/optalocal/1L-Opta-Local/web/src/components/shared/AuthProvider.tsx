'use client';

/**
 * AuthProvider — Global authentication context.
 *
 * Wraps the app in a Supabase auth listener that tracks sign-in/sign-out
 * state. Exposes the current user, session, loading flag, and whether the
 * app is running in cloud mode (HTTPS) vs LAN mode (HTTP).
 *
 * Three hooks are provided:
 * - useAuth()     — throws if used outside provider (strict)
 * - useAuthSafe() — returns null outside provider (lenient)
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
  isCloudMode: boolean;
  supabase: SupabaseBrowserClient;
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
  const [isCloudMode, setIsCloudMode] = useState(false);

  useEffect(() => {
    setIsCloudMode(window.location.protocol === 'https:');
  }, []);

  useEffect(() => {
    // No Supabase client — env vars not configured (build time or LAN-only)
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    // Get initial session — must handle network errors so isLoading never freezes
    supabase.auth
      .getSession()
      .then(({ data: { session: s } }) => {
        if (cancelled) return;
        setSession(s);
        setUser(s?.user ?? null);
        setIsLoading(false);
      })
      .catch(() => {
        // Supabase unreachable (offline / misconfigured). Unblock the UI.
        if (!cancelled) setIsLoading(false);
      });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      if (cancelled) return;
      setSession(s);
      setUser(s?.user ?? null);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [supabase]);

  // No Supabase configured — render children without auth context
  if (!supabase) {
    return <>{children}</>;
  }

  return (
    <AuthContext.Provider
      value={{ user, session, isLoading, isCloudMode, supabase }}
    >
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

/** Safe version that returns null outside provider (for components that may render in both contexts). */
export function useAuthSafe(): AuthContextValue | null {
  return useContext(AuthContext);
}

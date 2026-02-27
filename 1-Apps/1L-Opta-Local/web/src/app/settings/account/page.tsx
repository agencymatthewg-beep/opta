'use client';

/**
 * Account settings page.
 *
 * Shows the signed-in user's profile, cloud sync status, and a sign-out
 * action. Auth is mandatory — the SignInOverlay handles unauthenticated state.
 */

import { useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Cloud,
  LogOut,
  Loader2,
  User,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { Button, cn } from '@opta/ui';
import { OptaSurface } from '@/components/shared/OptaPrimitives';
import { useAuth } from '@/components/shared/AuthProvider';
import { signOut } from '@/lib/supabase/auth-actions';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AccountSettingsPage() {
  const { user, isLoading } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  const handleSignOut = useCallback(async () => {
    setIsSigningOut(true);
    setSignOutError(null);
    try {
      await signOut();
    } catch {
      setSignOutError('Failed to sign out. Please try again.');
      setIsSigningOut(false);
    }
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
      </div>
    );
  }

  if (!user) return null;

  // ---- Signed in ----
  const displayName = user.user_metadata?.full_name ?? null;
  const email = user.email ?? null;
  const initial = (displayName ?? email ?? '?').charAt(0).toUpperCase();
  const provider = user.app_metadata?.provider as string | undefined;

  return (
    <div className="max-w-xl space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-text-primary">Account</h2>
        <p className="text-sm text-text-secondary mt-1">
          Manage your Opta identity and cloud sync preferences.
        </p>
      </div>

      {/* Profile card */}
      <OptaSurface hierarchy="raised" padding="lg" className="space-y-5">
        <div className="flex items-center gap-3">
          <Cloud className="h-5 w-5 text-neon-cyan" />
          <h3 className="text-base font-semibold text-text-primary">Profile</h3>
        </div>

        <div className="flex items-center gap-4">
          {/* Avatar */}
          <div
            className={cn(
              'flex h-12 w-12 shrink-0 items-center justify-center rounded-full',
              'bg-primary/20 text-primary text-lg font-semibold',
              'border border-primary/30 shadow-[0_0_12px_rgba(168,85,247,0.2)]',
            )}
          >
            {initial}
          </div>

          {/* Identity */}
          <div className="min-w-0">
            {displayName && (
              <p className="text-sm font-semibold text-text-primary truncate">
                {displayName}
              </p>
            )}
            {email && (
              <p className="text-xs text-text-secondary truncate">{email}</p>
            )}
            {provider && (
              <p className="mt-0.5 text-[11px] uppercase tracking-[0.12em] text-text-muted">
                via {provider}
              </p>
            )}
          </div>
        </div>

        {/* Sync status */}
        <div className="flex items-center gap-2 rounded-lg border border-neon-green/20 bg-neon-green/5 px-3 py-2">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-neon-green" />
          <p className="text-xs text-text-secondary">
            Cloud sync is <span className="font-medium text-neon-green">active</span>.
            Sessions and device presence sync automatically.
          </p>
        </div>
      </OptaSurface>

      {/* User ID (useful for debugging/support) */}
      <OptaSurface hierarchy="base" padding="md">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">
              User ID
            </p>
            <p className="mt-0.5 font-mono text-xs text-text-secondary truncate">
              {user.id}
            </p>
          </div>
          <User className="h-4 w-4 shrink-0 text-text-muted" />
        </div>
      </OptaSurface>

      {/* Sign out */}
      <div className="space-y-3">
        {signOutError && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="flex items-center gap-2 rounded-lg border border-neon-red/20 bg-neon-red/10 px-3 py-2"
          >
            <AlertCircle className="h-3.5 w-3.5 shrink-0 text-neon-red" />
            <p className="text-xs text-neon-red">{signOutError}</p>
          </motion.div>
        )}

        <Button
          variant="ghost"
          size="md"
          onClick={handleSignOut}
          disabled={isSigningOut}
          className="text-text-secondary hover:text-neon-red"
        >
          {isSigningOut ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Signing out...
            </>
          ) : (
            <>
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

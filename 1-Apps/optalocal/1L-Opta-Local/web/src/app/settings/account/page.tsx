'use client';

/**
 * Account settings page.
 *
 * Shows the signed-in user's profile, cloud sync status, and a sign-out
 * action. Handles three display states:
 *  1. LAN-only mode (no Supabase configured)  — no-account info panel
 *  2. Cloud mode, not signed in               — sign-in CTA
 *  3. Cloud mode, signed in                   — profile + sign-out
 */

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Cloud,
  CloudOff,
  LogOut,
  Loader2,
  User,
  CheckCircle2,
  AlertCircle,
  Wifi,
} from 'lucide-react';
import { Button, cn } from '@opta/ui';
import { OptaSurface } from '@/components/shared/OptaPrimitives';
import { useAuthSafe } from '@/components/shared/AuthProvider';
import { signOut } from '@/lib/supabase/auth-actions';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AccountSettingsPage() {
  const auth = useAuthSafe();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  const handleSignOut = useCallback(async () => {
    setIsSigningOut(true);
    setSignOutError(null);
    try {
      // signOut() calls Next.js redirect() internally, so on success the page
      // navigates away automatically. The catch only runs on actual failures.
      await signOut();
    } catch {
      setSignOutError('Failed to sign out. Please try again.');
      setIsSigningOut(false);
    }
  }, []);

  // ---- LAN-only: no Supabase configured ----
  if (!auth) {
    return (
      <div className="max-w-xl space-y-8">
        <div>
          <h2 className="text-xl font-semibold text-text-primary">Account</h2>
          <p className="text-sm text-text-secondary mt-1">
            Manage your Opta identity and cloud sync preferences.
          </p>
        </div>

        <OptaSurface hierarchy="raised" padding="lg">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-full bg-opta-surface border border-opta-border">
              <Wifi className="h-5 w-5 text-text-secondary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-text-primary">
                LAN mode — no cloud account
              </p>
              <p className="text-xs text-text-secondary mt-1 leading-relaxed">
                Opta Local is running in LAN-only mode. Cloud sync features
                (session history across devices, device registry, remote access
                via Cloudflare Tunnel) require an Opta account and HTTPS.
              </p>
            </div>
          </div>
        </OptaSurface>
      </div>
    );
  }

  const { user, isLoading, isCloudMode } = auth;

  // ---- Cloud mode, not signed in ----
  if (!isLoading && !user && isCloudMode) {
    return (
      <div className="max-w-xl space-y-8">
        <div>
          <h2 className="text-xl font-semibold text-text-primary">Account</h2>
          <p className="text-sm text-text-secondary mt-1">
            Manage your Opta identity and cloud sync preferences.
          </p>
        </div>

        <OptaSurface hierarchy="raised" padding="lg" className="space-y-4">
          <div className="flex items-center gap-3">
            <CloudOff className="h-5 w-5 text-text-secondary" />
            <h3 className="text-base font-semibold text-text-primary">
              Not signed in
            </h3>
          </div>
          <p className="text-sm text-text-secondary">
            Sign in with your Opta account to enable cross-device session sync,
            device registry, and remote access.
          </p>
          <Link
            href="/sign-in?next=%2Fsettings%2Faccount"
            className={cn(
              'inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium',
              'bg-primary/20 text-primary border border-primary/40',
              'hover:bg-primary/30 hover:shadow-[0_0_16px_rgba(168,85,247,0.3)] transition-all',
            )}
          >
            <Cloud className="h-4 w-4" />
            Sign In with Opta
          </Link>
        </OptaSurface>
      </div>
    );
  }

  // ---- Loading ----
  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
      </div>
    );
  }

  // ---- LAN mode (HTTP), auth context exists but no cloud mode ----
  if (!isCloudMode && !user) {
    return (
      <div className="max-w-xl space-y-8">
        <div>
          <h2 className="text-xl font-semibold text-text-primary">Account</h2>
          <p className="text-sm text-text-secondary mt-1">
            Cloud sync and identity features require HTTPS.
          </p>
        </div>

        <OptaSurface hierarchy="raised" padding="lg">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-full bg-opta-surface border border-opta-border">
              <Wifi className="h-5 w-5 text-neon-cyan" />
            </div>
            <div>
              <p className="text-sm font-semibold text-text-primary">
                LAN mode — cloud features unavailable
              </p>
              <p className="text-xs text-text-secondary mt-1 leading-relaxed">
                You&apos;re accessing Opta Local over HTTP. To use cloud sync and
                account features, access the app via HTTPS or configure a
                Cloudflare Tunnel.
              </p>
            </div>
          </div>
        </OptaSurface>
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
              'flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full',
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
          <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-neon-green" />
          <p className="text-xs text-text-secondary">
            Cloud sync is <span className="font-medium text-neon-green">active</span>.
            Sessions, connection settings, and device presence sync automatically.
            Admin key is device-specific and stays local.
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
          <User className="h-4 w-4 flex-shrink-0 text-text-muted" />
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
            <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 text-neon-red" />
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

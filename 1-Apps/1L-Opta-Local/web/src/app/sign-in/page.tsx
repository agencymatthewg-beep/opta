/**
 * Sign-in page — cloud mode authentication.
 *
 * Displayed when a user accesses Opta Local over HTTPS (cloud mode)
 * without an active session. Features an animated Opta Ring hero,
 * Moonlight gradient heading, and Google / Apple OAuth sign-in.
 *
 * Design: OLED atmospheric background, centred glass panel with the
 * Opta Ring as the primary brand element, Sora typography hierarchy,
 * Framer Motion staggered entrance animation.
 */

'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@opta/ui';
import { AlertCircle } from 'lucide-react';
import { signInWithGoogle, signInWithApple } from '@/lib/supabase/auth-actions';

// ---------------------------------------------------------------------------
// Google icon (brand colours)
// ---------------------------------------------------------------------------

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Apple icon
// ---------------------------------------------------------------------------

function AppleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Animation variants
// ---------------------------------------------------------------------------

const containerVariants = {
  hidden: { opacity: 0, y: 28, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: 'spring' as const,
      stiffness: 240,
      damping: 26,
      staggerChildren: 0.09,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 300, damping: 28 },
  },
};

// ---------------------------------------------------------------------------
// Sign-in form
// ---------------------------------------------------------------------------

function SignInForm() {
  const searchParams = useSearchParams();
  const hasError = searchParams.get('error') === 'auth';

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="glass-strong rounded-2xl px-8 pb-8 pt-10 w-full max-w-sm shadow-2xl"
    >
      {/* Opta Ring + branding */}
      <motion.div variants={itemVariants} className="text-center mb-8">
        {/* Animated ring */}
        <div className="flex justify-center mb-6">
          <div className="opta-ring-wrap">
            <div className="opta-ring opta-ring-80" />
          </div>
        </div>

        {/* "OPTA LOCAL" — Moonlight gradient hero heading */}
        <h1
          className="opta-moonlight text-3xl font-bold tracking-[0.12em] mb-3"
        >
          OPTA LOCAL
        </h1>

        {/* Opta badge */}
        <span className="opta-badge">CLOUD SYNC</span>

        {/* Subtitle — Opta subtitle style */}
        <p className="mt-4 text-xs font-light tracking-[0.22em] uppercase text-text-secondary">
          Sign in to sync your devices
        </p>

        {/* Accent line */}
        <div className="opta-accent-line mt-5 mx-auto w-32" />
      </motion.div>

      {/* Error banner */}
      {hasError && (
        <motion.div
          variants={itemVariants}
          className={cn(
            'mb-6 flex items-center gap-2 rounded-lg px-4 py-3',
            'border border-neon-red/20 bg-neon-red/10',
          )}
        >
          <AlertCircle className="h-4 w-4 shrink-0 text-neon-red" />
          <p className="text-sm text-neon-red">
            Authentication failed. Please try again.
          </p>
        </motion.div>
      )}

      {/* OAuth buttons */}
      <div className="space-y-3">
        <motion.button
          variants={itemVariants}
          onClick={() => void signInWithGoogle()}
          className={cn(
            'glass w-full flex items-center justify-center gap-3',
            'rounded-xl px-4 py-3 text-sm font-medium text-text-primary',
            'hover:border-primary/60 hover:shadow-[0_0_20px_rgba(139,92,246,0.25)]',
            'transition-all cursor-pointer',
          )}
        >
          <GoogleIcon className="h-5 w-5" />
          Continue with Google
        </motion.button>

        <motion.button
          variants={itemVariants}
          onClick={() => void signInWithApple()}
          className={cn(
            'glass w-full flex items-center justify-center gap-3',
            'rounded-xl px-4 py-3 text-sm font-medium text-text-primary',
            'hover:border-primary/60 hover:shadow-[0_0_20px_rgba(139,92,246,0.25)]',
            'transition-all cursor-pointer',
          )}
        >
          <AppleIcon className="h-5 w-5" />
          Continue with Apple
        </motion.button>
      </div>

      {/* Divider */}
      <motion.div
        variants={itemVariants}
        className="my-6 flex items-center gap-3"
      >
        <div className="h-px flex-1 bg-opta-border" />
        <span className="text-xs text-text-muted tracking-widest">or</span>
        <div className="h-px flex-1 bg-opta-border" />
      </motion.div>

      {/* LAN-only escape hatch */}
      <motion.div variants={itemVariants} className="text-center">
        <a
          href="/"
          className={cn(
            'text-sm text-text-secondary hover:text-primary',
            'transition-colors underline underline-offset-4',
          )}
        >
          Continue without account
        </a>
        <p className="mt-2 text-[11px] tracking-wider text-text-muted">
          For LAN-only access without cloud sync
        </p>
      </motion.div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Page component — atmospheric background layers
// ---------------------------------------------------------------------------

export default function SignInPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center bg-opta-bg px-4 overflow-hidden">
      {/* Atmospheric fog layers — fixed, full screen */}
      <div className="fixed inset-0 pointer-events-none z-0" aria-hidden>
        {/* Primary top glow — mimics ring ambient from above */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[500px] rounded-full bg-purple-950/25 blur-[120px]" />
        {/* Secondary bottom-right */}
        <div className="absolute bottom-1/4 right-1/5 w-[400px] h-[400px] rounded-full bg-violet-950/15 blur-[100px]" />
        {/* Tertiary top-left */}
        <div className="absolute top-1/3 left-1/6 w-[300px] h-[280px] rounded-full bg-purple-950/10 blur-[80px]" />
      </div>

      {/* Centred form */}
      <div className="relative z-10 w-full flex items-center justify-center">
        <Suspense
          fallback={
            <div className="glass-strong rounded-2xl px-8 pb-8 pt-10 w-full max-w-sm animate-pulse">
              <div className="flex justify-center mb-6">
                <div className="w-20 h-20 rounded-full border-[13px] border-opta-surface" />
              </div>
              <div className="h-8 w-36 mx-auto rounded bg-opta-surface mb-3" />
              <div className="h-4 w-24 mx-auto rounded bg-opta-surface" />
            </div>
          }
        >
          <SignInForm />
        </Suspense>
      </div>
    </main>
  );
}

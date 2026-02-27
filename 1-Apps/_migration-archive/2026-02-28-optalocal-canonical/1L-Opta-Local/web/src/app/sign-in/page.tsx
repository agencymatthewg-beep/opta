/**
 * Sign-in page — cloud mode authentication.
 *
 * Displayed when a user accesses Opta Local over HTTPS (cloud mode)
 * without an active session.
 */

'use client';

import { Suspense, useCallback, useMemo, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@opta/ui';
import { AlertCircle, Info, Loader2 } from 'lucide-react';
import {
  signInWithGoogle,
  signInWithApple,
  signInWithPasswordIdentifier,
  signUpWithPasswordIdentifier,
} from '@/lib/supabase/auth-actions';
import { POST_SIGN_IN_NEXT_KEY, sanitizeNextPath } from '@/lib/auth-utils';

type Provider = 'google' | 'apple';
type AuthMode = 'signIn' | 'signUp';

const defaultContainerVariants = {
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

const reducedMotionContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      duration: 0.2,
      staggerChildren: 0.03,
    },
  },
};

const defaultItemVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 300, damping: 28 },
  },
};

const reducedMotionItemVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.16 },
  },
};

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

function ProviderButton({
  provider,
  pendingProvider,
  onClick,
  reducedMotion,
  disabled = false,
}: {
  provider: Provider;
  pendingProvider: Provider | null;
  onClick: (provider: Provider) => void;
  reducedMotion: boolean;
  disabled?: boolean;
}) {
  const isPending = pendingProvider === provider;
  const isDisabled = pendingProvider !== null || disabled;

  const Icon = provider === 'google' ? GoogleIcon : AppleIcon;
  const providerLabel = provider === 'google' ? 'Google' : 'Apple';

  return (
    <motion.button
      variants={reducedMotion ? reducedMotionItemVariants : defaultItemVariants}
      onClick={() => onClick(provider)}
      disabled={isDisabled}
      className={cn(
        'glass w-full cursor-pointer rounded-xl px-4 py-3 text-sm font-medium text-text-primary',
        'flex items-center justify-center gap-3',
        'transition-all motion-reduce:transition-none',
        'hover:border-primary/60 hover:shadow-[0_0_20px_rgba(139,92,246,0.25)]',
        'disabled:cursor-not-allowed disabled:opacity-65 disabled:hover:shadow-none disabled:hover:border-opta-border',
      )}
      aria-busy={isPending}
    >
      {isPending ? (
        <Loader2 className={cn('h-5 w-5', reducedMotion ? '' : 'animate-spin')} />
      ) : (
        <Icon className="h-5 w-5" />
      )}
      {isPending ? `Redirecting to ${providerLabel}...` : `Continue with ${providerLabel}`}
    </motion.button>
  );
}

// ---------------------------------------------------------------------------
// Sign-in form
// ---------------------------------------------------------------------------

function SignInForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const shouldReduceMotion = useReducedMotion();

  const [authMode, setAuthMode] = useState<AuthMode>('signIn');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [pendingProvider, setPendingProvider] = useState<Provider | null>(null);
  const [pendingPasswordAuth, setPendingPasswordAuth] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const nextPath = useMemo(
    () => sanitizeNextPath(searchParams.get('next')) ?? '/',
    [searchParams],
  );

  const isAuthActionPending = pendingProvider !== null || pendingPasswordAuth;

  const callbackError = searchParams.get('error');
  const callbackErrorMessage =
    callbackError === 'auth'
      ? 'Authentication did not complete. Please retry your provider sign-in.'
      : null;

  const combinedError = actionError ?? callbackErrorMessage;

  const setNextIntent = useCallback(() => {
    if (nextPath === '/') {
      window.sessionStorage.removeItem(POST_SIGN_IN_NEXT_KEY);
    } else {
      window.sessionStorage.setItem(POST_SIGN_IN_NEXT_KEY, nextPath);
    }
  }, [nextPath]);

  const startSignIn = useCallback(
    async (provider: Provider) => {
      if (pendingPasswordAuth) return;

      setActionError(null);
      setPendingProvider(provider);
      setNextIntent();

      try {
        if (provider === 'google') {
          await signInWithGoogle();
          return;
        }

        await signInWithApple();
      } catch {
        setActionError('Unable to start sign-in right now. Check your connection and try again.');
      } finally {
        setPendingProvider(null);
      }
    },
    [pendingPasswordAuth, setNextIntent],
  );

  const submitPasswordAuth = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (pendingProvider) return;

      setActionError(null);
      setPendingPasswordAuth(true);
      setNextIntent();

      try {
        const result =
          authMode === 'signIn'
            ? await signInWithPasswordIdentifier(identifier, password)
            : await signUpWithPasswordIdentifier(identifier, password, name || undefined);

        if (!result.ok) {
          setActionError(
            result.error ??
              (authMode === 'signIn'
                ? 'Unable to sign in right now. Please try again.'
                : 'Unable to sign up right now. Please try again.'),
          );
          return;
        }

        router.push(nextPath);
        router.refresh();
      } finally {
        setPendingPasswordAuth(false);
      }
    },
    [authMode, identifier, name, nextPath, password, pendingProvider, router, setNextIntent],
  );

  return (
    <motion.div
      variants={shouldReduceMotion ? reducedMotionContainerVariants : defaultContainerVariants}
      initial="hidden"
      animate="visible"
      className="glass-strong w-full max-w-sm rounded-2xl px-8 pb-8 pt-10 shadow-2xl"
    >
      {/* Opta Ring + branding */}
      <motion.div
        variants={shouldReduceMotion ? reducedMotionItemVariants : defaultItemVariants}
        className="mb-8 text-center"
      >
        <div className="mb-6 flex justify-center">
          <div className="opta-ring-wrap">
            <div
              className="opta-ring opta-ring-80"
              style={
                shouldReduceMotion
                  ? {
                      animationPlayState: 'paused',
                      transform: 'scale(1)',
                    }
                  : undefined
              }
            />
          </div>
        </div>

        <h1 className="opta-moonlight mb-2 text-3xl font-bold tracking-[0.12em]">
          OPTA LOCAL
        </h1>
        <span className="opta-badge">CLOUD SYNC</span>

        <p className="mt-4 text-xs font-light uppercase tracking-[0.22em] text-text-secondary">
          Sign in to sync your devices
        </p>

        <div className="opta-accent-line mx-auto mt-5 w-32" />
      </motion.div>

      <motion.div
        variants={shouldReduceMotion ? reducedMotionItemVariants : defaultItemVariants}
        className="mb-5 rounded-lg border border-opta-border bg-opta-surface/35 px-3 py-2"
      >
        <p className="flex items-start gap-2 text-xs text-text-secondary">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          <span>
            After sign-in, you will continue to{' '}
            <span className="font-mono text-text-primary">{nextPath}</span>.
          </span>
        </p>
      </motion.div>

      {combinedError && (
        <motion.div
          variants={shouldReduceMotion ? reducedMotionItemVariants : defaultItemVariants}
          className={cn(
            'mb-5 rounded-lg border px-4 py-3',
            'border-neon-red/20 bg-neon-red/10',
          )}
          role="alert"
        >
          <p className="flex items-start gap-2 text-sm text-neon-red">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{combinedError}</span>
          </p>
          <p className="mt-2 pl-6 text-xs text-text-secondary">
            If this persists, close any open provider tabs and try again.
          </p>
        </motion.div>
      )}

      {pendingProvider && (
        <motion.p
          variants={shouldReduceMotion ? reducedMotionItemVariants : defaultItemVariants}
          className="mb-4 text-center text-xs uppercase tracking-[0.18em] text-text-muted"
          aria-live="polite"
        >
          Waiting for provider response
        </motion.p>
      )}

      {pendingPasswordAuth && (
        <motion.p
          variants={shouldReduceMotion ? reducedMotionItemVariants : defaultItemVariants}
          className="mb-4 text-center text-xs uppercase tracking-[0.18em] text-text-muted"
          aria-live="polite"
        >
          {authMode === 'signIn' ? 'Signing in with password' : 'Creating account'}
        </motion.p>
      )}

      <div className="space-y-3">
        <ProviderButton
          provider="google"
          pendingProvider={pendingProvider}
          onClick={startSignIn}
          reducedMotion={Boolean(shouldReduceMotion)}
          disabled={pendingPasswordAuth}
        />
        <ProviderButton
          provider="apple"
          pendingProvider={pendingProvider}
          onClick={startSignIn}
          reducedMotion={Boolean(shouldReduceMotion)}
          disabled={pendingPasswordAuth}
        />
      </div>

      <motion.div
        variants={shouldReduceMotion ? reducedMotionItemVariants : defaultItemVariants}
        className="my-6 flex items-center gap-3"
      >
        <div className="h-px flex-1 bg-opta-border" />
        <span className="text-xs tracking-widest text-text-muted">or</span>
        <div className="h-px flex-1 bg-opta-border" />
      </motion.div>

      <motion.div
        variants={shouldReduceMotion ? reducedMotionItemVariants : defaultItemVariants}
        className="mb-6 rounded-xl border border-opta-border bg-opta-surface/20 p-4"
      >
        <h2 className="text-sm font-medium text-text-primary">Password sign-in</h2>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              setActionError(null);
              setAuthMode('signIn');
            }}
            className={cn(
              'rounded-lg border px-3 py-2 text-xs font-medium uppercase tracking-[0.12em] transition-colors',
              authMode === 'signIn'
                ? 'border-primary/70 bg-primary/20 text-primary'
                : 'border-opta-border bg-opta-surface/10 text-text-secondary hover:text-text-primary',
              'disabled:cursor-not-allowed disabled:opacity-60',
            )}
            aria-pressed={authMode === 'signIn'}
            disabled={isAuthActionPending}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setActionError(null);
              setAuthMode('signUp');
            }}
            className={cn(
              'rounded-lg border px-3 py-2 text-xs font-medium uppercase tracking-[0.12em] transition-colors',
              authMode === 'signUp'
                ? 'border-primary/70 bg-primary/20 text-primary'
                : 'border-opta-border bg-opta-surface/10 text-text-secondary hover:text-text-primary',
              'disabled:cursor-not-allowed disabled:opacity-60',
            )}
            aria-pressed={authMode === 'signUp'}
            disabled={isAuthActionPending}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={submitPasswordAuth} className="mt-4 space-y-3">
          {authMode === 'signUp' && (
            <div className="space-y-1.5">
              <label
                htmlFor="password-auth-name"
                className="text-xs uppercase tracking-[0.14em] text-text-secondary"
              >
                Name (optional)
              </label>
              <input
                id="password-auth-name"
                name="name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={isAuthActionPending}
                className={cn(
                  'w-full rounded-lg border border-opta-border bg-opta-surface/25 px-3 py-2 text-sm text-text-primary',
                  'placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/60',
                  'disabled:cursor-not-allowed disabled:opacity-60',
                )}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <label
              htmlFor="password-auth-identifier"
              className="text-xs uppercase tracking-[0.14em] text-text-secondary"
            >
              Email or phone
            </label>
            <input
              id="password-auth-identifier"
              name="identifier"
              type="text"
              autoComplete="username"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              placeholder="you@example.com or +15551234567"
              disabled={isAuthActionPending}
              className={cn(
                'w-full rounded-lg border border-opta-border bg-opta-surface/25 px-3 py-2 text-sm text-text-primary',
                'placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/60',
                'disabled:cursor-not-allowed disabled:opacity-60',
              )}
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="password-auth-password"
              className="text-xs uppercase tracking-[0.14em] text-text-secondary"
            >
              Password
            </label>
            <input
              id="password-auth-password"
              name="password"
              type="password"
              autoComplete={authMode === 'signIn' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={isAuthActionPending}
              className={cn(
                'w-full rounded-lg border border-opta-border bg-opta-surface/25 px-3 py-2 text-sm text-text-primary',
                'placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/60',
                'disabled:cursor-not-allowed disabled:opacity-60',
              )}
            />
          </div>

          <button
            type="submit"
            disabled={!identifier.trim() || !password || isAuthActionPending}
            className={cn(
              'glass w-full rounded-xl px-4 py-3 text-sm font-medium',
              'flex items-center justify-center gap-2',
              'transition-all motion-reduce:transition-none',
              'hover:border-primary/60 hover:shadow-[0_0_20px_rgba(139,92,246,0.25)]',
              'disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:shadow-none disabled:hover:border-opta-border',
            )}
          >
            {pendingPasswordAuth ? (
              <>
                <Loader2 className={cn('h-4 w-4', shouldReduceMotion ? '' : 'animate-spin')} />
                {authMode === 'signIn' ? 'Signing in...' : 'Creating account...'}
              </>
            ) : authMode === 'signIn' ? (
              'Sign in with password'
            ) : (
              'Create account'
            )}
          </button>
        </form>
      </motion.div>

    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Page component — atmospheric background layers
// ---------------------------------------------------------------------------

export default function SignInPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-opta-bg px-4">
      <div className="pointer-events-none fixed inset-0 z-0" aria-hidden>
        <div className="absolute left-1/2 top-0 h-[500px] w-[700px] -translate-x-1/2 rounded-full bg-purple-950/25 blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/5 h-[400px] w-[400px] rounded-full bg-violet-950/15 blur-[100px]" />
        <div className="absolute left-1/6 top-1/3 h-[280px] w-[300px] rounded-full bg-purple-950/10 blur-[80px]" />
      </div>

      <div className="relative z-10 flex w-full items-center justify-center">
        <Suspense
          fallback={
            <div className="glass-strong w-full max-w-sm animate-pulse rounded-2xl px-8 pb-8 pt-10 motion-reduce:animate-none">
              <div className="mb-6 flex justify-center">
                <div className="h-20 w-20 rounded-full border-[13px] border-opta-surface" />
              </div>
              <div className="mx-auto mb-3 h-8 w-36 rounded bg-opta-surface" />
              <div className="mx-auto h-4 w-24 rounded bg-opta-surface" />
            </div>
          }
        >
          <SignInForm />
        </Suspense>
      </div>
    </main>
  );
}

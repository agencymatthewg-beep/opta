'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { signInWithGoogle, signInWithApple, signInWithGithub, signInWithMicrosoft } from '@/lib/supabase/auth-actions';

interface OAuthButtonsProps {
  redirectAfter?: string;
}

export function OAuthButtons({ redirectAfter }: OAuthButtonsProps) {
  const [loading, setLoading] = useState<'google' | 'apple' | 'github' | 'microsoft' | null>(null);

  async function handleGoogle() {
    setLoading('google');
    await signInWithGoogle(redirectAfter);
  }

  async function handleApple() {
    setLoading('apple');
    await signInWithApple(redirectAfter);
  }

  async function handleGithub() {
    setLoading('github');
    await signInWithGithub(redirectAfter);
  }

  async function handleMicrosoft() {
    setLoading('microsoft');
    await signInWithMicrosoft(redirectAfter);
  }

  return (
    <div className="flex flex-col gap-3">
      <motion.button
        type="button"
        onClick={handleGoogle}
        disabled={loading !== null}
        whileHover={{ scale: 1.01, y: -1 }}
        whileTap={{ scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 400, damping: 17 }}
        className={cn(
          'flex items-center justify-center gap-3 w-full px-4 py-3 rounded-lg',
          'bg-white text-zinc-900 font-medium text-sm',
          'hover:bg-zinc-100 transition-colors',
          'disabled:opacity-50 disabled:cursor-not-allowed',
        )}
      >
        <GoogleIcon />
        {loading === 'google' ? 'Redirecting...' : 'Continue with Google'}
      </motion.button>

      <motion.button
        type="button"
        onClick={handleApple}
        disabled={loading !== null}
        whileHover={{ scale: 1.01, y: -1 }}
        whileTap={{ scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 400, damping: 17 }}
        className={cn(
          'flex items-center justify-center gap-3 w-full px-4 py-3 rounded-lg',
          'bg-zinc-900 text-white font-medium text-sm',
          'border border-zinc-700 hover:border-zinc-600 transition-colors',
          'disabled:opacity-50 disabled:cursor-not-allowed',
        )}
      >
        <AppleIcon />
        {loading === 'apple' ? 'Redirecting...' : 'Continue with Apple'}
      </motion.button>

      <motion.button
        type="button"
        onClick={handleGithub}
        disabled={loading !== null}
        whileHover={{ scale: 1.01, y: -1 }}
        whileTap={{ scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 400, damping: 17 }}
        className={cn(
          'flex items-center justify-center gap-3 w-full px-4 py-3 rounded-lg',
          'bg-[#24292e] text-white font-medium text-sm',
          'border border-zinc-700 hover:border-zinc-600 transition-colors',
          'disabled:opacity-50 disabled:cursor-not-allowed',
        )}
      >
        <GithubIcon />
        {loading === 'github' ? 'Redirecting...' : 'Continue with GitHub'}
      </motion.button>

      <motion.button
        type="button"
        onClick={handleMicrosoft}
        disabled={loading !== null}
        whileHover={{ scale: 1.01, y: -1 }}
        whileTap={{ scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 400, damping: 17 }}
        className={cn(
          'flex items-center justify-center gap-3 w-full px-4 py-3 rounded-lg',
          'bg-[#0078d4] text-white font-medium text-sm',
          'hover:bg-[#106ebe] transition-colors',
          'disabled:opacity-50 disabled:cursor-not-allowed',
        )}
      >
        <MicrosoftIcon />
        {loading === 'microsoft' ? 'Redirecting...' : 'Continue with Microsoft'}
      </motion.button>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  );
}

function GithubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.53 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.379.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.161 22 16.418 22 12c0-5.523-4.477-10-10-10z"
      />
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 21 21" fill="none">
      <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
      <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
      <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
    </svg>
  );
}

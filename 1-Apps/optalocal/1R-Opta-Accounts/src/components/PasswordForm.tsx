'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  signInWithPassword,
  signUpWithPassword,
} from '@/lib/supabase/auth-actions';

interface PasswordFormProps {
  mode: 'sign-in' | 'sign-up';
  redirectAfter?: string;
}

export function PasswordForm({ mode, redirectAfter }: PasswordFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const result =
        mode === 'sign-in'
          ? await signInWithPassword(identifier, password)
          : await signUpWithPassword(identifier, password, name);

      if (result.ok) {
        if (mode === 'sign-up') {
          setSuccess(true);
          return;
        }
        router.push(redirectAfter ?? '/profile');
        router.refresh();
      } else {
        setError(result.error ?? 'Something went wrong.');
      }
    });
  }

  if (success) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 24 }}
        className="text-center py-4"
      >
        <p className="text-opta-neon-green font-medium">Check your email</p>
        <p className="text-opta-text-secondary text-sm mt-2">
          We sent a confirmation link to verify your account.
        </p>
      </motion.div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {mode === 'sign-up' && (
        <div>
          <label
            htmlFor="name"
            className="block text-sm text-opta-text-secondary mb-1.5"
          >
            Name
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className={cn(
              'w-full px-4 py-2.5 rounded-lg text-sm',
              'bg-opta-surface border border-opta-border text-white',
              'placeholder:text-opta-text-muted',
              'focus:outline-none focus:border-opta-primary focus:ring-1 focus:ring-opta-primary/30',
              'transition-colors',
            )}
          />
        </div>
      )}

      <div>
        <label
          htmlFor="identifier"
          className="block text-sm text-opta-text-secondary mb-1.5"
        >
          Email or phone
        </label>
        <input
          id="identifier"
          type="text"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder="you@example.com"
          required
          autoComplete={mode === 'sign-in' ? 'username' : 'email'}
          className={cn(
            'w-full px-4 py-2.5 rounded-lg text-sm',
            'bg-opta-surface border border-opta-border text-white',
            'placeholder:text-opta-text-muted',
            'focus:outline-none focus:border-opta-primary focus:ring-1 focus:ring-opta-primary/30',
            'transition-colors',
          )}
        />
      </div>

      <div>
        <label
          htmlFor="password"
          className="block text-sm text-opta-text-secondary mb-1.5"
        >
          Password
        </label>
        <div className="relative">
          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            required
            minLength={6}
            autoComplete={
              mode === 'sign-in' ? 'current-password' : 'new-password'
            }
            className={cn(
              'w-full px-4 py-2.5 pr-11 rounded-lg text-sm',
              'bg-opta-surface border border-opta-border text-white',
              'placeholder:text-opta-text-muted',
              'focus:outline-none focus:border-opta-primary focus:ring-1 focus:ring-opta-primary/30',
              'transition-colors',
            )}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-opta-text-muted hover:text-opta-text-secondary transition-colors"
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>

      {error && (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-opta-neon-red text-sm"
        >
          {error}
        </motion.p>
      )}

      <motion.button
        type="submit"
        disabled={isPending}
        whileHover={isPending ? undefined : { scale: 1.01 }}
        whileTap={isPending ? undefined : { scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 400, damping: 17 }}
        className={cn(
          'w-full px-4 py-2.5 rounded-lg font-medium text-sm',
          'bg-opta-primary text-white',
          'hover:bg-opta-primary-glow transition-colors',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'flex items-center justify-center gap-2',
        )}
      >
        {isPending && <Loader2 size={16} className="animate-spin" />}
        {mode === 'sign-in' ? 'Sign in' : 'Create account'}
      </motion.button>
    </form>
  );
}

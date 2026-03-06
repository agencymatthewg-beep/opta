'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, ChevronDown, Eye, EyeOff, Loader2, Terminal } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AnthropicSetupCardProps {
  onConnected?: () => void;
  className?: string;
}

const SPRING = { type: 'spring', stiffness: 220, damping: 26 } as const;

export function AnthropicSetupCard({ onConnected, className }: AnthropicSetupCardProps) {
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [state, setState] = useState<'idle' | 'loading' | 'connected' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleVerify = async () => {
    const trimmed = token.trim();
    if (!trimmed) return;
    setState('loading');
    setErrorMsg('');

    try {
      const res = await fetch('/api/oauth/anthropic/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setup_token: trimmed }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };

      if (res.ok && data.ok) {
        setState('connected');
        onConnected?.();
      } else {
        setState('error');
        setErrorMsg(
          data.error === 'invalid_setup_token'
            ? 'Token rejected — check it was copied in full.'
            : data.error ?? `Unexpected error (${res.status})`,
        );
      }
    } catch {
      setState('error');
      setErrorMsg('Network error — check your connection.');
    }
  };

  return (
    <div className={cn('glass rounded-2xl p-5 flex flex-col gap-4', className)}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-[#d97706]/15 flex items-center justify-center flex-shrink-0">
          <span className="text-[#d97706] font-bold text-sm font-mono">A</span>
        </div>
        <div>
          <p className="text-sm font-semibold text-opta-text-primary">Anthropic</p>
          <p className="text-xs text-opta-text-muted">Setup token · paste from CLI</p>
        </div>
        {state === 'connected' && (
          <div className="ml-auto">
            <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/25">
              Connected
            </span>
          </div>
        )}
      </div>

      {/* Success */}
      {state === 'connected' ? (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={SPRING}
          className="flex items-center gap-3 py-1"
        >
          <CheckCircle size={18} className="text-green-400 flex-shrink-0" />
          <p className="text-sm text-opta-text-primary">Anthropic connected successfully.</p>
        </motion.div>
      ) : (
        <>
          {/* How-to guide toggle */}
          <button
            onClick={() => setShowGuide(v => !v)}
            className="flex items-center gap-2 text-xs text-opta-text-muted hover:text-opta-primary transition-colors"
          >
            <motion.div animate={{ rotate: showGuide ? 180 : 0 }} transition={SPRING}>
              <ChevronDown size={14} />
            </motion.div>
            How to get your setup token
          </button>

          <AnimatePresence>
            {showGuide && (
              <motion.div
                key="guide"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={SPRING}
                className="overflow-hidden"
              >
                <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-4 flex flex-col gap-2.5 text-xs">
                  <p className="text-opta-text-secondary">Run either command in your terminal:</p>
                  <div className="flex items-center gap-2 bg-zinc-950 rounded-lg px-3 py-2 font-mono text-opta-primary">
                    <Terminal size={12} className="flex-shrink-0" />
                    opta auth token
                  </div>
                  <div className="flex items-center gap-2 bg-zinc-950 rounded-lg px-3 py-2 font-mono text-opta-text-muted">
                    <Terminal size={12} className="flex-shrink-0" />
                    claude setup-token
                  </div>
                  <p className="text-opta-text-muted">Copy the token it outputs and paste below.</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Token input */}
          <div className="relative">
            <input
              type={showToken ? 'text' : 'password'}
              value={token}
              onChange={e => { setToken(e.target.value); if (state === 'error') setState('idle'); }}
              placeholder="Paste your setup token…"
              className={cn(
                'w-full px-3 py-2.5 pr-10 rounded-lg text-sm font-mono',
                'bg-zinc-900 border text-opta-text-primary placeholder:text-opta-text-muted',
                'focus:outline-none focus:ring-1 focus:ring-opta-primary/50 transition-colors',
                state === 'error' ? 'border-red-500/50' : 'border-zinc-800 focus:border-opta-primary/50',
              )}
            />
            <button
              type="button"
              onClick={() => setShowToken(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-opta-text-muted hover:text-opta-primary transition-colors"
            >
              {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>

          {/* Error */}
          <AnimatePresence>
            {state === 'error' && (
              <motion.div
                key="err"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={SPRING}
                className="flex items-start gap-2 text-xs text-red-400"
              >
                <XCircle size={13} className="flex-shrink-0 mt-0.5" />
                {errorMsg}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Verify button */}
          <motion.button
            onClick={handleVerify}
            disabled={!token.trim() || state === 'loading'}
            whileHover={{ scale: token.trim() ? 1.01 : 1, y: token.trim() ? -1 : 0 }}
            whileTap={{ scale: 0.98 }}
            transition={SPRING}
            className={cn(
              'flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg text-sm font-medium transition-colors',
              token.trim() && state !== 'loading'
                ? 'bg-opta-primary text-white hover:bg-opta-primary-glow'
                : 'bg-zinc-800 text-opta-text-muted cursor-not-allowed',
            )}
          >
            {state === 'loading' ? (
              <><Loader2 size={14} className="animate-spin" />Verifying…</>
            ) : (
              'Verify & Connect'
            )}
          </motion.button>
        </>
      )}
    </div>
  );
}

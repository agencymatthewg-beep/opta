'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Github, ExternalLink, CheckCircle, XCircle, AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── State Machine ────────────────────────────────────────────────────────────

type FlowPhase =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'waiting'; userCode: string; verificationUri: string; intervalSec: number; expiresAt: number }
  | { phase: 'authorized' }
  | { phase: 'expired' }
  | { phase: 'denied' }
  | { phase: 'error'; message: string };

interface DeviceFlowCardProps {
  onConnected?: () => void;
  className?: string;
}

const SPRING = { type: 'spring', stiffness: 220, damping: 26 } as const;

// ─── Component ────────────────────────────────────────────────────────────────

export function DeviceFlowCard({ onConnected, className }: DeviceFlowCardProps) {
  const [flow, setFlow] = useState<FlowPhase>({ phase: 'idle' });
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef(false);

  const clearPoll = () => {
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    pollTimerRef.current = null;
  };

  // Recursive poll — waits for each response before scheduling next
  const schedulePoll = useCallback((intervalSec: number) => {
    clearPoll();
    pollTimerRef.current = setTimeout(async () => {
      if (abortRef.current) return;
      try {
        const res = await fetch('/api/oauth/copilot/device/poll', { method: 'POST' });
        const data = await res.json() as { status?: string; error?: string };
        if (abortRef.current) return;

        switch (data.status) {
          case 'authorized':
            clearPoll();
            setFlow({ phase: 'authorized' });
            onConnected?.();
            break;
          case 'pending':
            schedulePoll(intervalSec);
            break;
          case 'expired':
            clearPoll();
            setFlow({ phase: 'expired' });
            break;
          case 'denied':
            clearPoll();
            setFlow({ phase: 'denied' });
            break;
          default:
            clearPoll();
            setFlow({ phase: 'error', message: data.error ?? 'Unknown error from poll' });
        }
      } catch {
        if (!abortRef.current) {
          setFlow({ phase: 'error', message: 'Network error — check your connection' });
        }
      }
    }, intervalSec * 1000);
  }, [onConnected]);

  useEffect(() => {
    abortRef.current = false;
    return () => {
      abortRef.current = true;
      clearPoll();
    };
  }, []);

  const startFlow = async () => {
    setFlow({ phase: 'loading' });
    abortRef.current = false;
    try {
      const res = await fetch('/api/oauth/copilot/device/start', { method: 'POST' });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        setFlow({ phase: 'error', message: data.error ?? `HTTP ${res.status}` });
        return;
      }
      const data = await res.json() as {
        user_code: string;
        verification_uri: string;
        expires_in: number;
        interval: number;
      };
      setFlow({
        phase: 'waiting',
        userCode: data.user_code,
        verificationUri: data.verification_uri,
        intervalSec: data.interval ?? 5,
        expiresAt: Date.now() + data.expires_in * 1000,
      });
      schedulePoll(data.interval ?? 5);
    } catch {
      setFlow({ phase: 'error', message: 'Failed to reach Opta Accounts' });
    }
  };

  const reset = () => {
    abortRef.current = true;
    clearPoll();
    setTimeout(() => {
      abortRef.current = false;
      setFlow({ phase: 'idle' });
    }, 50);
  };

  return (
    <div className={cn('glass rounded-2xl p-5 flex flex-col gap-4', className)}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-zinc-800 flex items-center justify-center flex-shrink-0">
          <Github size={18} className="text-opta-text-primary" />
        </div>
        <div>
          <p className="text-sm font-semibold text-opta-text-primary">GitHub Copilot</p>
          <p className="text-xs text-opta-text-muted">Device authorization · no redirect</p>
        </div>
        <div className="ml-auto">
          {flow.phase === 'authorized' && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/25">
              Connected
            </span>
          )}
          {(flow.phase === 'idle' || flow.phase === 'expired' || flow.phase === 'denied' || flow.phase === 'error') &&
            flow.phase !== 'idle' && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/25">
              {flow.phase === 'expired' ? 'Expired' : flow.phase === 'denied' ? 'Denied' : 'Error'}
            </span>
          )}
        </div>
      </div>

      {/* State content */}
      <AnimatePresence mode="wait" initial={false}>
        {flow.phase === 'idle' && (
          <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={SPRING}>
            <p className="text-xs text-opta-text-secondary mb-3">
              Authorize Opta to use your GitHub Copilot subscription. You&apos;ll enter a code on GitHub — no redirects needed.
            </p>
            <motion.button
              onClick={startFlow}
              whileHover={{ scale: 1.01, y: -1 }}
              whileTap={{ scale: 0.98 }}
              transition={SPRING}
              className="w-full px-4 py-2.5 rounded-lg bg-opta-primary text-white text-sm font-medium hover:bg-opta-primary-glow transition-colors"
            >
              Connect Copilot
            </motion.button>
          </motion.div>
        )}

        {flow.phase === 'loading' && (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={SPRING}
            className="flex items-center justify-center gap-2 py-4 text-opta-text-muted text-sm"
          >
            <Loader2 size={16} className="animate-spin" />
            Requesting code from GitHub…
          </motion.div>
        )}

        {flow.phase === 'waiting' && (
          <motion.div key="waiting" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={SPRING}
            className="flex flex-col gap-3"
          >
            {/* User code display */}
            <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-4 text-center">
              <p className="text-xs text-opta-text-muted mb-1">Enter this code on GitHub</p>
              <p className="font-mono text-2xl font-bold tracking-[0.2em] text-opta-primary select-all">
                {flow.userCode}
              </p>
            </div>

            {/* Open GitHub button */}
            <a
              href={flow.verificationUri}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                'flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg text-sm font-medium',
                'bg-[#24292e] text-white border border-zinc-700 hover:border-zinc-500 transition-colors',
              )}
            >
              <ExternalLink size={14} />
              Open {flow.verificationUri.replace('https://', '')}
            </a>

            {/* Polling indicator */}
            <div className="flex items-center gap-2 text-xs text-opta-text-muted">
              <Loader2 size={12} className="animate-spin flex-shrink-0" />
              Waiting for authorization…
              <button onClick={reset} className="ml-auto text-opta-text-muted hover:text-opta-primary transition-colors underline underline-offset-2">
                Cancel
              </button>
            </div>
          </motion.div>
        )}

        {flow.phase === 'authorized' && (
          <motion.div key="authorized" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={SPRING}
            className="flex items-center gap-3 py-2"
          >
            <CheckCircle size={20} className="text-green-400 flex-shrink-0" />
            <p className="text-sm text-opta-text-primary">GitHub Copilot connected successfully.</p>
          </motion.div>
        )}

        {flow.phase === 'expired' && (
          <motion.div key="expired" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={SPRING}
            className="flex flex-col gap-3"
          >
            <div className="flex items-center gap-2 text-sm text-amber-400">
              <AlertCircle size={16} />
              Code expired — please try again.
            </div>
            <motion.button onClick={reset} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} transition={SPRING}
              className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm font-medium text-opta-text-primary transition-colors"
            >
              <RefreshCw size={14} />
              Try again
            </motion.button>
          </motion.div>
        )}

        {flow.phase === 'denied' && (
          <motion.div key="denied" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={SPRING}
            className="flex flex-col gap-3"
          >
            <div className="flex items-center gap-2 text-sm text-red-400">
              <XCircle size={16} />
              Authorization denied on GitHub.
            </div>
            <motion.button onClick={reset} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} transition={SPRING}
              className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm font-medium text-opta-text-primary transition-colors"
            >
              <RefreshCw size={14} />
              Try again
            </motion.button>
          </motion.div>
        )}

        {flow.phase === 'error' && (
          <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={SPRING}
            className="flex flex-col gap-3"
          >
            <div className="flex items-start gap-2 text-sm text-red-400">
              <XCircle size={16} className="flex-shrink-0 mt-0.5" />
              {flow.message}
            </div>
            <motion.button onClick={reset} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} transition={SPRING}
              className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm font-medium text-opta-text-primary transition-colors"
            >
              <RefreshCw size={14} />
              Try again
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

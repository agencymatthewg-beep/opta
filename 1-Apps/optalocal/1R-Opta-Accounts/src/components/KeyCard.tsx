'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot, Sparkles, Gem, Zap, Search, Cpu, Shield, Globe,
  Eye, EyeOff, Copy, Trash2, CheckCircle, XCircle, Plus, Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ProviderInfo } from '@/lib/provider-detection';
import type { ApiKey } from '@/lib/supabase/key-actions';
import { getApiKeyValue } from '@/lib/supabase/key-actions';

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Bot, Sparkles, Gem, Zap, Search, Cpu, Shield, Globe,
};

interface KeyCardProps {
  provider: ProviderInfo;
  apiKey: ApiKey | null;
  onAdd: () => void;
  onDelete: (id: string) => Promise<void>;
  onVerify: (id: string) => Promise<boolean>;
}

export function KeyCard({ provider, apiKey, onAdd, onDelete, onVerify }: KeyCardProps) {
  const [revealed, setRevealed] = useState(false);
  const [revealedValue, setRevealedValue] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [copied, setCopied] = useState(false);

  const Icon = ICON_MAP[provider.icon] ?? Bot;
  const isConfigured = apiKey !== null;

  const handleReveal = useCallback(async () => {
    if (!apiKey) return;
    if (revealed) {
      setRevealed(false);
      setRevealedValue(null);
      return;
    }
    const value = await getApiKeyValue(apiKey.id);
    if (value) {
      setRevealedValue(value);
      setRevealed(true);
      setTimeout(() => {
        setRevealed(false);
        setRevealedValue(null);
      }, 5000);
    }
  }, [apiKey, revealed]);

  const handleCopy = useCallback(async () => {
    if (!apiKey) return;
    const value = await getApiKeyValue(apiKey.id);
    if (value) {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [apiKey]);

  const handleVerify = useCallback(async () => {
    if (!apiKey) return;
    setVerifying(true);
    await onVerify(apiKey.id);
    setVerifying(false);
  }, [apiKey, onVerify]);

  const handleDelete = useCallback(async () => {
    if (!apiKey) return;
    setDeleting(true);
    await onDelete(apiKey.id);
    setDeleting(false);
    setConfirmDelete(false);
  }, [apiKey, onDelete]);

  return (
    <div
      className={cn(
        'glass rounded-xl px-4 py-3 transition-colors',
        isConfigured && 'border-opta-neon-green/10',
      )}
    >
      <div className="flex items-center gap-3">
        {/* Provider Icon */}
        <div
          className={cn(
            'flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center',
            isConfigured
              ? 'bg-opta-neon-green/10 text-opta-neon-green'
              : 'bg-white/[0.03] text-opta-text-muted',
          )}
        >
          <Icon size={16} />
        </div>

        {/* Provider Name + Status */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-opta-text-primary">
              {provider.name}
            </span>
            <span
              className={cn(
                'w-1.5 h-1.5 rounded-full flex-shrink-0',
                isConfigured ? 'bg-opta-neon-green' : 'bg-opta-text-muted/40',
              )}
            />
          </div>

          {/* Key Preview */}
          {apiKey && (
            <p className="text-xs font-mono text-opta-text-muted truncate mt-0.5">
              {revealed && revealedValue ? revealedValue : apiKey.maskedValue}
            </p>
          )}
          {!apiKey && (
            <p className="text-xs text-opta-text-muted mt-0.5">Not configured</p>
          )}
        </div>

        {/* Actions */}
        {isConfigured ? (
          <div className="flex items-center gap-1">
            <ActionButton
              onClick={handleReveal}
              title={revealed ? 'Hide' : 'Reveal'}
            >
              {revealed ? <EyeOff size={13} /> : <Eye size={13} />}
            </ActionButton>

            <ActionButton
              onClick={handleCopy}
              title="Copy"
            >
              {copied ? (
                <CheckCircle size={13} className="text-opta-neon-green" />
              ) : (
                <Copy size={13} />
              )}
            </ActionButton>

            <ActionButton
              onClick={handleVerify}
              title="Verify"
              disabled={verifying}
            >
              {verifying ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <CheckCircle size={13} />
              )}
            </ActionButton>

            <ActionButton
              onClick={() => setConfirmDelete(true)}
              title="Delete"
              variant="danger"
            >
              <Trash2 size={13} />
            </ActionButton>
          </div>
        ) : (
          <button
            type="button"
            onClick={onAdd}
            className={cn(
              'flex items-center gap-1 text-xs text-opta-text-muted',
              'hover:text-opta-primary transition-colors px-2 py-1 rounded',
            )}
          >
            <Plus size={12} />
            Add
          </button>
        )}
      </div>

      {/* Verification badge */}
      {apiKey?.lastVerifiedAt && (
        <p className="text-[10px] text-opta-text-muted mt-1 ml-11">
          Verified {new Date(apiKey.lastVerifiedAt).toLocaleDateString()}
        </p>
      )}

      {/* Delete confirmation */}
      <AnimatePresence>
        {confirmDelete && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 24 }}
            className="overflow-hidden"
          >
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/[0.04]">
              <span className="text-xs text-opta-neon-red">Delete this key?</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="text-xs text-opta-text-muted hover:text-opta-text-secondary transition-colors px-2 py-1"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className={cn(
                    'text-xs text-opta-neon-red hover:text-red-300 transition-colors px-2 py-1 rounded',
                    'bg-opta-neon-red/10',
                    deleting && 'opacity-50',
                  )}
                >
                  {deleting ? 'Deleting...' : 'Confirm'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ActionButton({
  children,
  onClick,
  title,
  disabled,
  variant,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  disabled?: boolean;
  variant?: 'danger';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'p-1.5 rounded transition-colors',
        variant === 'danger'
          ? 'text-opta-text-muted hover:text-opta-neon-red hover:bg-opta-neon-red/10'
          : 'text-opta-text-muted hover:text-opta-text-secondary hover:bg-white/[0.03]',
        disabled && 'opacity-50 cursor-not-allowed',
      )}
    >
      {children}
    </button>
  );
}

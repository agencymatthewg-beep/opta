'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ClipboardPaste, ChevronDown, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  PROVIDERS,
  detectProvider,
  isValidKeyFormat,
  type ApiKeyProvider,
} from '@/lib/provider-detection';

interface AddKeySheetProps {
  open: boolean;
  onClose: () => void;
  onSave: (provider: ApiKeyProvider, keyValue: string, label?: string) => Promise<void>;
  existingProviders: ApiKeyProvider[];
}

export function AddKeySheet({ open, onClose, onSave, existingProviders }: AddKeySheetProps) {
  const [keyValue, setKeyValue] = useState('');
  const [detectedProvider, setDetectedProvider] = useState<ApiKeyProvider | null>(null);
  const [manualProvider, setManualProvider] = useState<ApiKeyProvider | null>(null);
  const [label, setLabel] = useState('');
  const [saving, setSaving] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const activeProvider = manualProvider ?? detectedProvider;
  const isExisting = activeProvider ? existingProviders.includes(activeProvider) : false;
  const canSave = activeProvider && keyValue.trim().length > 0 && isValidKeyFormat(keyValue);

  // Auto-detect provider on input change
  useEffect(() => {
    const detected = detectProvider(keyValue);
    setDetectedProvider(detected);
    if (detected) setManualProvider(null);
  }, [keyValue]);

  // Focus input when sheet opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setKeyValue('');
      setDetectedProvider(null);
      setManualProvider(null);
      setLabel('');
      setDropdownOpen(false);
    }
  }, [open]);

  const handleSave = useCallback(async () => {
    if (!canSave || !activeProvider) return;
    setSaving(true);
    await onSave(activeProvider, keyValue.trim(), label.trim() || undefined);
    setSaving(false);
  }, [canSave, activeProvider, keyValue, label, onSave]);

  const providerInfo = activeProvider
    ? PROVIDERS.find((p) => p.id === activeProvider)
    : null;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          />

          {/* Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto"
          >
            <div className="max-w-lg mx-auto glass-strong rounded-t-2xl p-6">
              {/* Sheet Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <ClipboardPaste size={16} className="text-opta-primary" />
                  <h2 className="text-base font-semibold text-opta-text-primary">
                    Add API Key
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 rounded text-opta-text-muted hover:text-opta-text-secondary transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Key Input */}
              <div className="mb-4">
                <label
                  htmlFor="key-input"
                  className="block text-xs text-opta-text-secondary mb-1.5"
                >
                  API Key
                </label>
                <textarea
                  ref={inputRef}
                  id="key-input"
                  value={keyValue}
                  onChange={(e) => setKeyValue(e.target.value)}
                  placeholder="Paste your API key here..."
                  rows={3}
                  className={cn(
                    'w-full rounded-lg px-3 py-2.5 text-sm font-mono',
                    'bg-opta-surface border border-opta-border',
                    'text-opta-text-primary placeholder:text-opta-text-muted',
                    'focus:outline-none focus:border-opta-primary/50 focus:ring-1 focus:ring-opta-primary/20',
                    'resize-none transition-colors',
                  )}
                />
              </div>

              {/* Detection Badge */}
              <AnimatePresence mode="wait">
                {detectedProvider && (
                  <motion.div
                    key={detectedProvider}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 24 }}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full mb-4',
                      'bg-opta-neon-green/10 text-opta-neon-green text-xs font-medium',
                    )}
                  >
                    <Check size={12} />
                    Detected: {PROVIDERS.find((p) => p.id === detectedProvider)?.name}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Manual Provider Selection */}
              {!detectedProvider && keyValue.trim().length > 0 && (
                <div className="mb-4">
                  <label className="block text-xs text-opta-text-secondary mb-1.5">
                    Select Provider
                  </label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setDropdownOpen(!dropdownOpen)}
                      className={cn(
                        'w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm',
                        'bg-opta-surface border border-opta-border',
                        'text-opta-text-primary transition-colors',
                        'hover:border-opta-primary/30',
                      )}
                    >
                      <span>
                        {manualProvider
                          ? PROVIDERS.find((p) => p.id === manualProvider)?.name
                          : 'Choose provider...'}
                      </span>
                      <ChevronDown
                        size={14}
                        className={cn(
                          'text-opta-text-muted transition-transform',
                          dropdownOpen && 'rotate-180',
                        )}
                      />
                    </button>

                    <AnimatePresence>
                      {dropdownOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={{ type: 'spring', stiffness: 400, damping: 24 }}
                          className={cn(
                            'absolute left-0 right-0 top-full mt-1 z-10',
                            'glass-strong rounded-lg overflow-hidden',
                          )}
                        >
                          {PROVIDERS.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => {
                                setManualProvider(p.id);
                                setDropdownOpen(false);
                              }}
                              className={cn(
                                'w-full text-left px-3 py-2 text-sm',
                                'hover:bg-white/[0.03] transition-colors',
                                manualProvider === p.id
                                  ? 'text-opta-primary'
                                  : 'text-opta-text-secondary',
                              )}
                            >
                              {p.name}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              )}

              {/* Optional Label */}
              <div className="mb-6">
                <label
                  htmlFor="key-label"
                  className="block text-xs text-opta-text-secondary mb-1.5"
                >
                  Label{' '}
                  <span className="text-opta-text-muted">(optional)</span>
                </label>
                <input
                  id="key-label"
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder='e.g. "work", "personal"'
                  className={cn(
                    'w-full rounded-lg px-3 py-2.5 text-sm',
                    'bg-opta-surface border border-opta-border',
                    'text-opta-text-primary placeholder:text-opta-text-muted',
                    'focus:outline-none focus:border-opta-primary/50 focus:ring-1 focus:ring-opta-primary/20',
                    'transition-colors',
                  )}
                />
              </div>

              {/* Existing key warning */}
              {isExisting && (
                <p className="text-xs text-yellow-500/80 mb-4">
                  This will replace your existing {providerInfo?.name} key.
                </p>
              )}

              {/* Save Button */}
              <motion.button
                type="button"
                onClick={handleSave}
                disabled={!canSave || saving}
                whileHover={canSave ? { scale: 1.01 } : undefined}
                whileTap={canSave ? { scale: 0.98 } : undefined}
                transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                className={cn(
                  'w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl',
                  'text-sm font-medium transition-colors',
                  canSave && !saving
                    ? 'bg-opta-primary text-white hover:bg-opta-primary-glow'
                    : 'bg-opta-surface text-opta-text-muted cursor-not-allowed',
                )}
              >
                {saving ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Key'
                )}
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

'use client';

/**
 * Presets Page — Browse and inspect LMX model presets.
 *
 * Shows preset cards (listPresets), inline detail panel (getPreset),
 * and a reload button (reloadPresets).
 */

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Settings2, RefreshCw, ChevronRight, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@opta/ui';

import { useConnectionContextSafe } from '@/components/shared/ConnectionProvider';
import { OptaSurface, OptaStatusPill } from '@/components/shared/OptaPrimitives';
import type { Preset } from '@/types/lmx';

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PresetsPage() {
  const connection = useConnectionContextSafe();
  const client = connection?.client ?? null;

  const [presets, setPresets] = useState<Preset[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<Preset | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isReloading, setIsReloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPresets = useCallback(async () => {
    if (!client) return;
    setIsLoading(true);
    setError(null);
    try {
      const list = await client.getPresets();
      setPresets(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load presets');
    } finally {
      setIsLoading(false);
    }
  }, [client]);

  useEffect(() => { void fetchPresets(); }, [fetchPresets]);

  const handleSelectPreset = useCallback(async (name: string) => {
    if (!client) return;
    setDetailLoading(true);
    try {
      const detail = await client.getPreset(name);
      setSelectedPreset(detail);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load preset');
    } finally {
      setDetailLoading(false);
    }
  }, [client]);

  const handleReload = useCallback(async () => {
    if (!client) return;
    setIsReloading(true);
    setError(null);
    try {
      await client.reloadPresets();
      await fetchPresets();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to reload presets');
    } finally {
      setIsReloading(false);
    }
  }, [client, fetchPresets]);

  return (
    <main className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="glass border-b border-opta-border px-6 py-3 flex items-center gap-4 flex-shrink-0">
        <Link
          href="/"
          className={cn('p-1.5 rounded-lg transition-colors',
            'text-text-secondary hover:text-text-primary hover:bg-primary/10')}
          aria-label="Back to dashboard"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <Settings2 className="w-5 h-5 text-primary" />
        <h1 className="text-lg font-semibold text-text-primary">Presets</h1>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => void handleReload()}
            disabled={isReloading || !client}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
              'bg-primary/10 text-primary hover:bg-primary/20',
              'disabled:opacity-50 disabled:pointer-events-none',
            )}
          >
            <RotateCcw className={cn('w-3.5 h-3.5', isReloading && 'animate-spin')} />
            Reload Config
          </button>
          <button
            onClick={() => void fetchPresets()}
            disabled={isLoading}
            className={cn(
              'p-1.5 rounded-lg transition-colors',
              'text-text-secondary hover:text-text-primary hover:bg-primary/10',
              isLoading && 'animate-spin',
            )}
            aria-label="Refresh presets"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Left: preset list */}
        <div className="w-72 border-r border-opta-border overflow-y-auto p-4 space-y-2 flex-shrink-0">
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="glass-subtle rounded-lg px-3 py-2 text-xs text-neon-amber border border-neon-amber/20"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {!client && (
            <p className="text-xs text-text-muted text-center py-8">Not connected.</p>
          )}

          {isLoading && presets.length === 0 && (
            <p className="text-xs text-text-muted text-center py-8">Loading presets…</p>
          )}

          {presets.map((preset) => (
            <button
              key={preset.name}
              onClick={() => void handleSelectPreset(preset.name)}
              className={cn(
                'w-full text-left rounded-xl p-3 transition-all',
                'border',
                selectedPreset?.name === preset.name
                  ? 'border-primary/40 bg-primary/10'
                  : 'border-transparent glass-subtle hover:border-opta-border',
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-text-primary truncate max-w-[180px]">
                  {preset.name}
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-text-muted shrink-0" />
              </div>
              <p className="text-xs text-text-muted mt-0.5 truncate">
                {preset.model}
              </p>
              {preset.routing_alias && (
                <div className="mt-1.5">
                  <OptaStatusPill label={preset.routing_alias} status="info" />
                </div>
              )}
            </button>
          ))}

          {!isLoading && presets.length === 0 && client && (
            <p className="text-xs text-text-muted text-center py-8">No presets found.</p>
          )}
        </div>

        {/* Right: detail */}
        <div className="flex-1 overflow-y-auto p-6">
          <AnimatePresence mode="wait">
            {detailLoading ? (
              <motion.p
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-sm text-text-muted"
              >
                Loading…
              </motion.p>
            ) : selectedPreset ? (
              <motion.div
                key={selectedPreset.name}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.15 }}
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl glass flex items-center justify-center">
                    <Settings2 className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-text-primary">{selectedPreset.name}</h2>
                    {selectedPreset.description && (
                      <p className="text-sm text-text-secondary">{selectedPreset.description}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <OptaSurface hierarchy="raised" padding="md" className="rounded-xl">
                    <h3 className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-3">Config</h3>
                    <dl className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <dt className="text-text-muted">Model</dt>
                        <dd className="text-text-primary font-mono text-xs">{selectedPreset.model}</dd>
                      </div>
                      {selectedPreset.routing_alias && (
                        <div className="flex justify-between text-sm">
                          <dt className="text-text-muted">Routing alias</dt>
                          <dd><OptaStatusPill label={selectedPreset.routing_alias} status="info" /></dd>
                        </div>
                      )}
                      {selectedPreset.auto_load !== undefined && (
                        <div className="flex justify-between text-sm">
                          <dt className="text-text-muted">Auto-load</dt>
                          <dd>
                            <OptaStatusPill
                              label={selectedPreset.auto_load ? 'Yes' : 'No'}
                              status={selectedPreset.auto_load ? 'success' : 'neutral'}
                            />
                          </dd>
                        </div>
                      )}
                    </dl>
                  </OptaSurface>

                  {selectedPreset.parameters && Object.keys(selectedPreset.parameters).length > 0 && (
                    <OptaSurface hierarchy="raised" padding="md" className="rounded-xl">
                      <h3 className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-3">Parameters</h3>
                      <dl className="space-y-2">
                        {Object.entries(selectedPreset.parameters).map(([k, v]) => (
                          <div key={k} className="flex justify-between text-sm">
                            <dt className="text-text-muted">{k}</dt>
                            <dd className="text-text-primary font-mono text-xs">{JSON.stringify(v)}</dd>
                          </div>
                        ))}
                      </dl>
                    </OptaSurface>
                  )}

                  {selectedPreset.system_prompt && (
                    <OptaSurface hierarchy="raised" padding="md" className="rounded-xl lg:col-span-2">
                      <h3 className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-3">System Prompt</h3>
                      <pre className="text-xs text-text-secondary whitespace-pre-wrap break-words font-mono bg-opta-surface/50 rounded-lg p-3">
                        {selectedPreset.system_prompt}
                      </pre>
                    </OptaSurface>
                  )}

                  {selectedPreset.performance && Object.keys(selectedPreset.performance).length > 0 && (
                    <OptaSurface hierarchy="raised" padding="md" className="rounded-xl">
                      <h3 className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-3">Performance</h3>
                      <pre className="text-xs text-text-secondary whitespace-pre-wrap font-mono bg-opta-surface/50 rounded-lg p-3">
                        {JSON.stringify(selectedPreset.performance, null, 2)}
                      </pre>
                    </OptaSurface>
                  )}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full flex items-center justify-center"
              >
                <div className="text-center">
                  <Settings2 className="w-10 h-10 text-text-muted mx-auto mb-3" />
                  <p className="text-sm text-text-muted">Select a preset to view details</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </main>
  );
}

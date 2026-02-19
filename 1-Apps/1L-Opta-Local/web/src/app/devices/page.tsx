'use client';

/**
 * Devices page — Shows all registered devices in the user's Opta ecosystem.
 *
 * Displays device cards with live presence via Supabase Realtime.
 * Shows recent sessions across all devices. Includes "Register device"
 * CTA for adding new machines.
 */

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  RefreshCw,
  Cloud,
  CloudOff,
  Terminal,
  History,
} from 'lucide-react';
import { Button } from '@opta/ui';
import { cn } from '@opta/ui';

import { useDevices } from '@/hooks/useDevices';
import { useAuthSafe } from '@/components/shared/AuthProvider';
import { useCloudSync } from '@/hooks/useCloudSync';
import { DeviceCard } from '@/components/devices/DeviceCard';

// ---------------------------------------------------------------------------
// Devices page
// ---------------------------------------------------------------------------

export default function DevicesPage() {
  const auth = useAuthSafe();
  const { devices, isLoading, error, refetch } = useDevices();
  const { hasSynced, isSyncing, lastImportCount, hasMigrated, migrateLocalToCloud } =
    useCloudSync();
  const [showPairGuide, setShowPairGuide] = useState(false);

  const handleToggleHelper = useCallback(
    async (deviceId: string, enabled: boolean) => {
      if (!auth?.supabase) return;
      await auth.supabase
        .from('devices')
        .update({ helper_enabled: enabled })
        .eq('id', deviceId);
    },
    [auth?.supabase],
  );

  const handleMigrate = useCallback(async () => {
    const hostDevice = devices.find((d) => d.role === 'llm_host');
    await migrateLocalToCloud(hostDevice?.id ?? null);
  }, [devices, migrateLocalToCloud]);

  // Not signed in
  if (!auth?.user) {
    return (
      <main className="min-h-screen p-6 flex items-center justify-center">
        <div className="max-w-sm w-full text-center">
          {/* Mini ring as visual anchor */}
          <div className="flex justify-center mb-6">
            <div className="opta-ring-wrap">
              <div className="opta-ring opta-ring-64" />
            </div>
          </div>
          <h1 className="opta-moonlight text-2xl font-bold tracking-[0.08em] mb-3">
            DEVICE SYNC
          </h1>
          <p className="text-sm text-text-secondary mb-6 leading-relaxed">
            Connect your Opta account to see all your devices, sync sessions
            across machines, and manage your inference network.
          </p>
          <a
            href="/sign-in"
            className={cn(
              'inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium',
              'bg-primary/20 text-primary border border-primary/40',
              'hover:bg-primary/30 hover:shadow-[0_0_20px_rgba(168,85,247,0.3)] transition-all',
            )}
          >
            <Cloud className="h-4 w-4" />
            Sign In with Opta
          </a>
        </div>
      </main>
    );
  }

  const hosts = devices.filter((d) => d.role === 'llm_host');
  const workstations = devices.filter((d) => d.role === 'workstation');

  return (
    <main className="min-h-screen p-6">
      {/* Header */}
      <header className="mb-6 flex items-center justify-between">
        <div>
          <div className="opta-section-header mb-1">
            <h1 className="opta-section-title">My Devices</h1>
            <div className="opta-section-line" />
          </div>
          <p className="text-xs text-text-muted tracking-wider">
            {devices.length} device{devices.length !== 1 ? 's' : ''} registered
            {' \u00b7 '}
            {devices.filter((d) => d.is_online).length} online
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={refetch}
            aria-label="Refresh devices"
          >
            <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
          </Button>
          <Button
            variant="glass"
            size="sm"
            onClick={() => setShowPairGuide((prev) => !prev)}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Register Device
          </Button>
        </div>
      </header>

      {/* Migration banner (first sign-in) */}
      <AnimatePresence>
        {!hasMigrated && hasSynced && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-5 glass-subtle rounded-xl p-4 border border-primary/20"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-text-primary">
                  Upload local sessions to cloud?
                </p>
                <p className="text-xs text-text-muted mt-0.5">
                  Your existing chat history will sync across all devices.
                </p>
              </div>
              <Button
                variant="glass"
                size="sm"
                onClick={handleMigrate}
                disabled={isSyncing}
              >
                {isSyncing ? 'Syncing...' : 'Upload Sessions'}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sync status */}
      {hasSynced && lastImportCount > 0 && (
        <p className="text-xs text-neon-green mb-4 flex items-center gap-1.5">
          <History className="h-3 w-3" />
          Imported {lastImportCount} session{lastImportCount !== 1 ? 's' : ''}{' '}
          from cloud
        </p>
      )}

      {/* Pairing guide */}
      <AnimatePresence>
        {showPairGuide && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-5 glass-subtle rounded-xl p-5 border border-opta-border"
          >
            <h2 className="text-sm font-semibold text-text-primary mb-3">
              Register a device
            </h2>
            <div className="space-y-3">
              <PairStep
                step={1}
                title="On your LMX Host (Mac Studio)"
                command="opta lmx register"
              />
              <PairStep
                step={2}
                title="On a Workstation (MacBook, PC)"
                command="opta register"
              />
              <p className="text-xs text-text-muted">
                Both commands open a browser to sign in and claim the device to
                your account.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error state */}
      {error && (
        <div className="mb-4 glass-subtle rounded-xl p-4 border border-neon-red/20">
          <p className="text-sm text-neon-red">{error}</p>
        </div>
      )}

      {/* Loading state */}
      {isLoading && devices.length === 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="glass-subtle rounded-xl p-5 h-40 animate-pulse"
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && devices.length === 0 && (
        <div className="text-center mt-16">
          <div className="flex justify-center mb-6">
            <div className="opta-ring-wrap">
              <div className="opta-ring opta-ring-64" style={{ animationPlayState: 'paused', opacity: 0.5 }} />
            </div>
          </div>
          <h2 className="text-base font-semibold text-text-secondary uppercase tracking-[0.15em] mb-2">
            No Devices Registered
          </h2>
          <p className="text-sm text-text-muted mb-5">
            Register your first device to start syncing.
          </p>
          <Button
            variant="glass"
            size="sm"
            onClick={() => setShowPairGuide(true)}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Register Device
          </Button>
        </div>
      )}

      {/* LLM Hosts */}
      {hosts.length > 0 && (
        <section className="mb-8">
          <div className="opta-section-header mb-4">
            <h2 className="text-xs font-semibold text-primary uppercase tracking-[0.2em] flex items-center gap-2">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_6px_rgba(168,85,247,0.8)]" />
              LLM Hosts
            </h2>
            <div className="opta-section-line opacity-50" />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {hosts.map((device) => (
              <DeviceCard key={device.id} device={device} />
            ))}
          </div>
        </section>
      )}

      {/* Workstations */}
      {workstations.length > 0 && (
        <section>
          <div className="opta-section-header mb-4">
            <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-[0.2em] flex items-center gap-2">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-text-muted" />
              Workstations
            </h2>
            <div className="opta-section-line opacity-40" />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {workstations.map((device) => (
              <DeviceCard
                key={device.id}
                device={device}
                onToggleHelper={handleToggleHelper}
              />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function PairStep({
  step,
  title,
  command,
}: {
  step: number;
  title: string;
  command: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/15 text-primary text-[10px] font-bold flex items-center justify-center">
        {step}
      </span>
      <div>
        <p className="text-xs font-medium text-text-primary">{title}</p>
        <code className="text-xs text-primary font-mono bg-opta-surface/50 px-2 py-0.5 rounded mt-0.5 inline-block">
          {command}
        </code>
      </div>
    </div>
  );
}

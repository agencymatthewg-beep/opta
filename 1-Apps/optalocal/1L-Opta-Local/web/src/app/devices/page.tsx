"use client";

/**
 * Devices page — Shows all registered devices in the user's Opta ecosystem.
 *
 * Displays device cards with live presence via Supabase Realtime.
 * Shows recent sessions across all devices. Includes "Register device"
 * CTA for adding new machines.
 */

import { useState, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  Plus,
  RefreshCw,
  Cloud,
  History,
} from "lucide-react";
import { Button, cn } from "@opta/ui";

import { useDevices } from "@/hooks/useDevices";
import { useAuthSafe } from "@/components/shared/AuthProvider";
import { useCloudSync } from "@/hooks/useCloudSync";
import { DeviceCard } from "@/components/devices/DeviceCard";
import { OptaRing } from "@/components/shared/OptaRing";

// ---------------------------------------------------------------------------
// Devices page
// ---------------------------------------------------------------------------

export default function DevicesPage() {
  const auth = useAuthSafe();
  const { devices, isLoading, error, refetch } = useDevices();
  const {
    hasSynced,
    isSyncing,
    lastImportCount,
    hasMigrated,
    migrateLocalToCloud,
  } = useCloudSync();
  const [showPairGuide, setShowPairGuide] = useState(false);
  const [migrationFeedback, setMigrationFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);

  const handleToggleHelper = useCallback(
    async (deviceId: string, enabled: boolean) => {
      if (!auth?.supabase) return;
      await auth.supabase
        .from("devices")
        .update({ helper_enabled: enabled })
        .eq("id", deviceId);
    },
    [auth?.supabase],
  );

  const handleMigrate = useCallback(async () => {
    if (!auth?.user) return;
    setMigrationFeedback(null);

    const hostDevice = devices.find((d) => d.role === "llm_host");
    const uploadedCount = await migrateLocalToCloud(hostDevice?.id ?? null);
    const migrationKey = `opta-local:cloud-migration-done:${auth.user.id}`;
    const migrationCompleted = localStorage.getItem(migrationKey) === "true";

    if (migrationCompleted) {
      setMigrationFeedback({
        tone: "success",
        message:
          uploadedCount > 0
            ? `Uploaded ${uploadedCount} local session${uploadedCount !== 1 ? "s" : ""} to cloud.`
            : "Migration complete. No unsynced local sessions were found.",
      });
      return;
    }

    setMigrationFeedback({
      tone: "error",
      message: "Could not upload local sessions. Try again in a moment.",
    });
  }, [auth?.user, devices, migrateLocalToCloud]);

  // Not signed in
  if (!auth?.user) {
    return (
      <main className="min-h-screen p-6 flex items-center justify-center">
        <div className="max-w-sm w-full text-center">
          {/* Mini ring as visual anchor */}
          <div className="flex justify-center mb-6">
            <OptaRing size={64} />
          </div>
          <h1 className="opta-moonlight text-2xl font-bold tracking-[0.08em] mb-3">
            DEVICE SYNC
          </h1>
          <p className="text-sm text-text-secondary mb-6 leading-relaxed">
            Connect your Opta account to see all your devices, sync sessions
            across machines, and manage your inference network.
          </p>
          <Link
            href="/sign-in?next=%2Fdevices"
            className={cn(
              "inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium",
              "bg-primary/20 text-primary border border-primary/40",
              "hover:bg-primary/30 hover:shadow-[0_0_20px_rgba(168,85,247,0.3)] transition-all",
            )}
          >
            <Cloud className="h-4 w-4" />
            Sign In with Opta
          </Link>
        </div>
      </main>
    );
  }

  const hosts = devices.filter((d) => d.role === "llm_host");
  const workstations = devices.filter((d) => d.role === "workstation");
  const onlineCount = devices.filter((d) => d.is_online).length;

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
            {isLoading && devices.length === 0
              ? "Loading device registry..."
              : `${devices.length} device${devices.length !== 1 ? "s" : ""} registered \u00b7 ${onlineCount} online`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={refetch}
            aria-label="Refresh devices"
          >
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
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
            animate={{ opacity: 1, height: "auto" }}
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
                {isSyncing ? "Syncing..." : "Upload Sessions"}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sync status */}
      <div className="mb-4 space-y-2">
        {isSyncing && (
          <p className="text-xs text-text-muted flex items-center gap-1.5">
            <RefreshCw className="h-3 w-3 animate-spin" />
            Syncing cloud state...
          </p>
        )}
        {hasSynced && lastImportCount > 0 && (
          <p className="text-xs text-neon-green flex items-center gap-1.5">
            <History className="h-3 w-3" />
            Imported {lastImportCount} session{lastImportCount !== 1 ? "s" : ""}{" "}
            from cloud
          </p>
        )}
        {hasSynced && !isSyncing && lastImportCount === 0 && (
          <p className="text-xs text-text-muted flex items-center gap-1.5">
            <Info className="h-3 w-3" />
            Cloud sync is up to date. No new remote sessions found.
          </p>
        )}
        {migrationFeedback && (
          <div
            className={cn(
              "glass-subtle rounded-lg p-3 border",
              migrationFeedback.tone === "success"
                ? "border-neon-green/20"
                : "border-neon-red/20",
            )}
          >
            <p
              className={cn(
                "text-xs flex items-center gap-1.5",
                migrationFeedback.tone === "success"
                  ? "text-neon-green"
                  : "text-neon-red",
              )}
            >
              {migrationFeedback.tone === "success" ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : (
                <AlertTriangle className="h-3.5 w-3.5" />
              )}
              {migrationFeedback.message}
            </p>
          </div>
        )}
      </div>

      {/* Pairing guide */}
      <AnimatePresence>
        {showPairGuide && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-5 glass-subtle rounded-xl p-5 border border-opta-border"
          >
            <h2 className="text-sm font-semibold text-text-primary mb-3">
              Register a device
            </h2>
            <p className="text-xs text-text-muted mb-4">
              Run the command that matches this machine, then finish pairing in
              the browser tab that opens.
            </p>
            <div className="space-y-3">
              <PairStep
                step={1}
                title="On your LMX Host (Mac Studio)"
                command="opta lmx register"
                detail="Use this on the machine that runs your host model service."
              />
              <PairStep
                step={2}
                title="On a Workstation (MacBook, PC)"
                command="opta register"
                detail="Use this on any client machine that connects to your host."
              />
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                <p className="text-xs text-text-secondary">
                  Pairing failed? Re-run the same command. Existing devices are
                  updated safely without creating duplicates.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error state */}
      {error && (
        <div className="mb-4 glass-subtle rounded-xl p-4 border border-neon-red/20">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-neon-red flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Could not load devices
              </p>
              <p className="text-xs text-text-muted mt-1">{error}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={refetch}
              disabled={isLoading}
            >
              Retry
            </Button>
          </div>
        </div>
      )}

      {/* Loading state */}
      {isLoading && devices.length === 0 && (
        <>
          <div className="glass-subtle rounded-xl p-4 border border-opta-border mb-4">
            <p className="text-sm text-text-secondary">
              Loading registered devices and presence data...
            </p>
            <p className="text-xs text-text-muted mt-1">
              This can take a few seconds after signing in or waking a machine.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="glass-subtle rounded-xl p-5 h-40 animate-pulse"
              />
            ))}
          </div>
        </>
      )}

      {/* Empty state */}
      {!isLoading && devices.length === 0 && (
        <div className="text-center mt-12">
          <div className="flex justify-center mb-6">
            <OptaRing size={64} paused />
          </div>
          <h2 className="text-base font-semibold text-text-secondary uppercase tracking-[0.15em] mb-2">
            No Devices Registered
          </h2>
          <p className="text-sm text-text-muted mb-5 max-w-xl mx-auto">
            Pair your first host or workstation to enable cloud sync and
            multi-device routing.
          </p>
          <div className="mx-auto mb-6 max-w-md text-left glass-subtle rounded-xl p-4 border border-opta-border space-y-3">
            <p className="text-xs uppercase tracking-[0.12em] text-text-muted">
              Quick Start
            </p>
            <PairStep
              step={1}
              title="Run on host machine"
              command="opta lmx register"
            />
            <PairStep
              step={2}
              title="Run on workstation"
              command="opta register"
            />
          </div>
          <Button
            variant="glass"
            size="sm"
            onClick={() => setShowPairGuide(true)}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            View Full Pairing Guide
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
  detail,
}: {
  step: number;
  title: string;
  command: string;
  detail?: string;
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
        {detail && <p className="text-xs text-text-muted mt-1">{detail}</p>}
      </div>
    </div>
  );
}

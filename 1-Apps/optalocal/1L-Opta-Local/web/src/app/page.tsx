"use client";

/**
 * Dashboard — Root page (/).
 *
 * Shell: Opta Design System v5 "Terminal Core / Structural HUD" aesthetic.
 * Data:  All live hooks from the original dashboard are preserved unchanged:
 *   - useSSE → /admin/events (status, model_change, throughput events)
 *   - useBufferedState → 500ms VRAM/status flush
 *   - CircularBuffer + 1s interval flush → ThroughputChart
 *   - useHeartbeat → ping health + latency
 *   - LMXClient.loadModel / unloadModel
 *
 * Layout:
 *   Left column  (w-72) — identity, daemon/connection telemetry, silicon pressure,
 *                          live TPS readout, heartbeat.
 *   Right panel  (flex-1) — VRAMGauge, ModelList, ThroughputChart, ServerStats.
 *   Footer bar   (32px) — full-width monospace status row.
 *
 * HUD aesthetics injected via a <style> block so they don't pollute globals.css:
 *   .hud-grid, .film-grain, .momentum-border animations.
 * All color values use CSS vars — no hex literals in JSX.
 */

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  RefreshCw,
  Plus,
  AlertCircle,
  WifiOff,
  AlertTriangle,
  Cloud,
  Terminal as TerminalIcon,
  Cpu,
  Zap,
  Activity,
  Database,
  Network,
} from "lucide-react";
import { Button, cn } from "@opta/ui";

import { useSSE } from "@/hooks/useSSE";
import { useBufferedState } from "@/hooks/useBufferedState";
import { useHeartbeat } from "@/hooks/useHeartbeat";
import { useConnectionContextSafe } from "@/components/shared/ConnectionProvider";
import { useAuthSafe } from "@/components/shared/AuthProvider";
import type { ServerStatus } from "@/types/lmx";
import { CircularBuffer } from "@/lib/circular-buffer";
import type { ThroughputPoint } from "@/lib/circular-buffer";

import { VRAMGauge } from "@/components/dashboard/VRAMGauge";
import { ModelList } from "@/components/dashboard/ModelList";
import { ThroughputChart } from "@/components/dashboard/ThroughputChart";
import { ModelLoadDialog } from "@/components/dashboard/ModelLoadDialog";
import { HeartbeatIndicator } from "@/components/dashboard/HeartbeatIndicator";

// ---------------------------------------------------------------------------
// SSE event shape
// ---------------------------------------------------------------------------

interface SSEEvent {
  type: "status" | "model_change" | "throughput";
  data: ServerStatus | ThroughputPoint;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const THROUGHPUT_BUFFER_CAPACITY = 300;
const CHART_FLUSH_INTERVAL_MS = 1000;

// ---------------------------------------------------------------------------
// Framer Motion variants — "Ignition" stagger
// ---------------------------------------------------------------------------

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.1 },
  },
};

const panelVariants = {
  hidden: { opacity: 0, y: 24, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring" as const, stiffness: 280, damping: 26 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.07,
      duration: 0.4,
      ease: [0.22, 1, 0.36, 1] as const,
    },
  }),
};

// ---------------------------------------------------------------------------
// ObsidianPanel — glass block with travelling momentum border on hover
// ---------------------------------------------------------------------------

function ObsidianPanel({
  children,
  className = "",
  noPadding = false,
}: {
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
}) {
  return (
    <motion.div
      variants={panelVariants}
      className={cn(
        "group relative overflow-hidden rounded-xl",
        "bg-[rgba(5,3,10,0.8)] backdrop-blur-xl",
        "border border-white/5",
        "transition-colors duration-500",
        "hover:border-white/10 hover:bg-[rgba(10,6,20,0.85)]",
        className,
      )}
    >
      {/* Momentum border — four travelling glows, visible on hover only */}
      <div className="pointer-events-none absolute inset-0 z-20 opacity-0 transition-opacity duration-500 group-hover:opacity-100">
        <div className="hud-momentum-top absolute left-0 top-0 h-px w-full bg-gradient-to-r from-transparent via-[var(--color-neon-purple)] to-transparent" />
        <div className="hud-momentum-bottom absolute bottom-0 right-0 h-px w-full bg-gradient-to-r from-transparent via-[var(--color-neon-purple)] to-transparent" />
        <div className="hud-momentum-right absolute right-0 top-0 h-full w-px bg-gradient-to-b from-transparent via-[var(--color-neon-purple)] to-transparent" />
        <div className="hud-momentum-left absolute bottom-0 left-0 h-full w-px bg-gradient-to-b from-transparent via-[var(--color-neon-purple)] to-transparent" />
      </div>

      <div
        className={cn("relative z-10 h-full w-full", noPadding ? "" : "p-5")}
      >
        {children}
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// MoonlightHeading — gradient text heading
// ---------------------------------------------------------------------------

function MoonlightHeading({
  children,
  className = "",
  as: Tag = "h2",
}: {
  children: React.ReactNode;
  className?: string;
  as?: "h1" | "h2" | "h3" | "h4";
}) {
  return (
    <Tag
      className={cn(
        "bg-clip-text font-semibold text-transparent",
        "bg-[linear-gradient(135deg,var(--color-text-primary)_0%,var(--color-text-primary)_50%,var(--color-neon-purple)_100%)]",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

// ---------------------------------------------------------------------------
// TelemetryRow — compact monospace key/value line
// ---------------------------------------------------------------------------

function TelemetryRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  accent?: string; // CSS color string
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
        {label}
      </span>
      <span
        className="font-mono text-[11px] font-medium"
        style={{ color: accent ?? "var(--color-text-secondary)" }}
      >
        {value}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dashboard page
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  // ---- Auth context (optional — cloud mode only) ----
  const auth = useAuthSafe();

  // ---- Connection from global provider ----
  const connection = useConnectionContextSafe();
  const baseUrl = connection?.baseUrl ?? "";
  const isConnected = connection?.isConnected ?? false;
  const client = connection?.client ?? null;
  const connectionType = connection?.connectionType ?? "probing";
  const adminKey = connection?.adminKey ?? "";
  const recheckConnection = connection?.recheckNow;

  // ---- SSE URL (reacts to LAN/WAN changes) ----
  const sseUrl = useMemo(() => {
    if (!isConnected) return "";
    return `${baseUrl}/admin/events`;
  }, [baseUrl, isConnected]);

  const sseHeaders = useMemo(() => {
    if (!adminKey) return undefined;
    return { "X-Admin-Key": adminKey };
  }, [adminKey]);

  // ---- Buffered server status (500ms flush) ----
  const [status, pushStatus] = useBufferedState<ServerStatus | null>(null, 500);

  // ---- Throughput circular buffer + 1s flush ----
  const throughputBufferRef = useRef(
    new CircularBuffer<ThroughputPoint>(THROUGHPUT_BUFFER_CAPACITY),
  );
  const [chartData, setChartData] = useState<ThroughputPoint[]>([]);

  useEffect(() => {
    const id = setInterval(() => {
      setChartData(throughputBufferRef.current.toArray());
    }, CHART_FLUSH_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  const averageTps = useMemo(() => {
    if (chartData.length === 0) return undefined;
    const sum = chartData.reduce((acc, p) => acc + p.tokensPerSecond, 0);
    return sum / chartData.length;
  }, [chartData]);

  // ---- SSE message handler ----
  const handleMessage = useCallback(
    (event: SSEEvent) => {
      switch (event.type) {
        case "status":
        case "model_change":
          pushStatus(() => event.data as ServerStatus);
          break;
        case "throughput":
          throughputBufferRef.current.push(event.data as ThroughputPoint);
          break;
      }
    },
    [pushStatus],
  );

  const { connectionState, reconnect } = useSSE<SSEEvent>({
    url: sseUrl,
    headers: sseHeaders,
    onMessage: handleMessage,
    enabled: isConnected && sseUrl !== "",
  });

  // ---- Heartbeat ----
  const { isHealthy, consecutiveFailures, lastPingMs } = useHeartbeat({
    baseUrl,
    adminKey,
    enabled: isConnected,
  });

  // ---- Synthesise throughput from status TPS ----
  const lastStatusTpsRef = useRef<number | null>(null);
  useEffect(() => {
    if (status?.tokens_per_second != null) {
      const tps = status.tokens_per_second;
      if (lastStatusTpsRef.current !== tps) {
        lastStatusTpsRef.current = tps;
        throughputBufferRef.current.push({
          timestamp: Date.now(),
          tokensPerSecond: tps,
        });
      }
    }
  }, [status]);

  // ---- Model actions ----
  const [unloadingId, setUnloadingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleUnload = useCallback(
    async (modelId: string) => {
      if (!client) return;
      setUnloadingId(modelId);
      setActionError(null);
      try {
        await client.unloadModel(modelId);
      } catch (err) {
        setActionError(
          err instanceof Error ? err.message : "Failed to unload model",
        );
      } finally {
        setUnloadingId(null);
      }
    },
    [client],
  );

  const [isLoadOpen, setIsLoadOpen] = useState(false);
  const [isLoadingModel, setIsLoadingModel] = useState(false);

  const handleLoadModel = useCallback(
    async (modelPath: string, quantization?: string) => {
      if (!client) return;
      setIsLoadingModel(true);
      setActionError(null);
      try {
        await client.loadModel({ model_path: modelPath, quantization });
        setIsLoadOpen(false);
      } catch (err) {
        setActionError(
          err instanceof Error ? err.message : "Failed to load model",
        );
      } finally {
        setIsLoadingModel(false);
      }
    },
    [client],
  );

  // ---- Derived display values ----
  const activeModel = status?.loaded_models?.[0];
  const memPct =
    status && status.vram_total_gb > 0
      ? Math.min((status.vram_used_gb / status.vram_total_gb) * 100, 100)
      : 0;
  const isOnline = connectionType !== "offline" && isConnected;
  const tpsDisplay =
    status?.tokens_per_second != null
      ? status.tokens_per_second.toFixed(1)
      : "0.0";

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      {/* ── HUD-specific CSS (scoped to this page, uses CSS vars) ── */}
      <style>{`
        .hud-grid {
          background-size: 4rem 4rem;
          background-image:
            linear-gradient(to right,  rgba(255,255,255,0.028) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255,255,255,0.028) 1px, transparent 1px);
          mask-image: radial-gradient(ellipse 80% 70% at 50% 40%, black 30%, transparent 100%);
        }

        .film-grain {
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
          opacity: 0.035;
        }

        @keyframes momentum-x         { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
        @keyframes momentum-x-reverse { 0% { transform: translateX( 100%); } 100% { transform: translateX(-100%); } }
        @keyframes momentum-y         { 0% { transform: translateY(-100%); } 100% { transform: translateY(100%); } }
        @keyframes momentum-y-reverse { 0% { transform: translateY( 100%); } 100% { transform: translateY(-100%); } }

        .hud-momentum-top    { animation: momentum-x         3s linear infinite; }
        .hud-momentum-bottom { animation: momentum-x-reverse 3s linear infinite; }
        .hud-momentum-right  { animation: momentum-y         3s linear infinite; }
        .hud-momentum-left   { animation: momentum-y-reverse 3s linear infinite; }
      `}</style>

      <div className="relative flex h-screen flex-col overflow-hidden bg-opta-bg text-text-primary selection:bg-neon-purple/30">
        {/* ── Environment layers ── */}
        <div className="hud-grid pointer-events-none absolute inset-0 z-0" />
        <div className="film-grain pointer-events-none fixed inset-0 z-50" />

        {/* ── Ambient inference glow (bottom-right, fades in with TPS) ── */}
        <motion.div
          className="pointer-events-none fixed bottom-[8%] right-[4%] -z-10 h-[35vw] w-[35vw] rounded-full blur-[140px] mix-blend-screen"
          style={{ background: "var(--color-neon-cyan)" }}
          animate={{
            opacity:
              averageTps != null && averageTps > 0
                ? Math.min(averageTps / 40, 0.45)
                : 0,
          }}
          transition={{ duration: 1.5, ease: "easeOut" }}
        />

        {/* ══════════════════════════════════════════════════════════════
            MAIN BODY — left telemetry column + right content
        ══════════════════════════════════════════════════════════════ */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="relative z-10 flex flex-1 gap-5 overflow-hidden p-5"
        >
          {/* ── LEFT COLUMN: telemetry ── */}
          <section className="flex w-72 shrink-0 flex-col gap-4">
            {/* Identity */}
            <motion.div
              variants={panelVariants}
              className="flex items-center gap-3 px-1"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-md border border-white/20 bg-white/10 shadow-[0_0_14px_rgba(255,255,255,0.08)]">
                <TerminalIcon className="h-4 w-4 text-text-primary" />
              </div>
              <div>
                <h1 className="text-base font-bold leading-none tracking-tight text-text-primary">
                  OPTA LMX
                </h1>
                <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
                  Core Dashboard
                </span>
              </div>
              {/* User badge (cloud mode) */}
              {auth?.user && (
                <Cloud className="ml-auto h-3.5 w-3.5 shrink-0 text-text-muted" />
              )}
            </motion.div>

            {/* Daemon / connection status */}
            <ObsidianPanel>
              <div className="mb-3 flex items-center justify-between">
                <MoonlightHeading
                  as="h3"
                  className="text-[11px] uppercase tracking-widest"
                >
                  Daemon Status
                </MoonlightHeading>
                <Activity
                  className="h-3.5 w-3.5 transition-colors"
                  style={{
                    color: isOnline
                      ? "var(--color-neon-green)"
                      : "var(--color-neon-red)",
                    filter: isOnline
                      ? "drop-shadow(0 0 6px var(--color-neon-green))"
                      : "none",
                  }}
                />
              </div>
              <div className="flex flex-col gap-2">
                <TelemetryRow
                  label="STATE"
                  value={
                    isOnline
                      ? "ONLINE"
                      : connectionType === "probing"
                        ? "PROBING"
                        : "OFFLINE"
                  }
                  accent={
                    isOnline
                      ? "var(--color-neon-green)"
                      : connectionType === "probing"
                        ? "var(--color-neon-amber)"
                        : "var(--color-neon-red)"
                  }
                />
                <TelemetryRow
                  label="TYPE"
                  value={connection?.connectionType?.toUpperCase() ?? "—"}
                />
                <TelemetryRow
                  label="LATENCY"
                  value={lastPingMs !== null ? `${lastPingMs}ms` : "—"}
                  accent={
                    lastPingMs !== null && lastPingMs < 10
                      ? "var(--color-neon-green)"
                      : lastPingMs !== null && lastPingMs > 50
                        ? "var(--color-neon-amber)"
                        : undefined
                  }
                />
                <TelemetryRow
                  label="SSE"
                  value={connectionState}
                  accent={
                    connectionState === "open"
                      ? "var(--color-neon-green)"
                      : connectionState === "error"
                        ? "var(--color-neon-red)"
                        : "var(--color-neon-amber)"
                  }
                />
              </div>
            </ObsidianPanel>

            {/* Active model */}
            <ObsidianPanel>
              <div className="mb-3 flex items-center justify-between">
                <MoonlightHeading
                  as="h3"
                  className="text-[11px] uppercase tracking-widest"
                >
                  Active Matrix
                </MoonlightHeading>
                <Database className="h-3.5 w-3.5 text-text-muted transition-colors group-hover:text-neon-purple" />
              </div>

              {activeModel ? (
                <>
                  <div className="mb-3 rounded-lg border border-white/5 bg-black/40 p-3">
                    <p
                      className="truncate font-mono text-[11px] font-medium"
                      style={{ color: "var(--color-neon-purple)" }}
                      title={activeModel.id}
                    >
                      {activeModel.name ?? activeModel.id}
                    </p>
                    <p className="mt-0.5 font-mono text-[10px] text-text-muted">
                      {activeModel.vram_gb != null
                        ? `${activeModel.vram_gb.toFixed(1)} GB`
                        : ""}
                      {activeModel.quantization
                        ? `${activeModel.vram_gb != null ? " · " : ""}${activeModel.quantization}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2 w-2 animate-pulse rounded-full shadow-[0_0_8px_var(--color-neon-green)]"
                      style={{ background: "var(--color-neon-green)" }}
                    />
                    <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
                      Ready
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div className="mb-3 rounded-lg border border-white/5 bg-black/40 p-3">
                    <p className="font-mono text-[11px] text-text-muted">
                      No model loaded
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-white/20" />
                    <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
                      Standby
                    </span>
                  </div>
                </>
              )}
            </ObsidianPanel>

            {/* Silicon pressure */}
            <ObsidianPanel>
              <div className="mb-3 flex items-center justify-between">
                <MoonlightHeading
                  as="h3"
                  className="text-[11px] uppercase tracking-widest"
                >
                  Silicon Pressure
                </MoonlightHeading>
                <Cpu className="h-3.5 w-3.5 text-text-muted" />
              </div>

              {/* Unified memory bar */}
              <div className="mb-4">
                <div className="mb-1.5 flex justify-between font-mono text-[10px]">
                  <span className="text-text-muted">UNIFIED MEM</span>
                  <span className="text-text-secondary">
                    {status
                      ? `${status.vram_used_gb.toFixed(1)} / ${status.vram_total_gb.toFixed(0)} GB`
                      : "— / —"}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                  <motion.div
                    className="h-full rounded-full"
                    style={{
                      background:
                        memPct >= 80
                          ? "var(--color-neon-red)"
                          : memPct >= 60
                            ? "var(--color-neon-amber)"
                            : "var(--color-neon-purple)",
                    }}
                    animate={{ width: `${memPct}%` }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                  />
                </div>
              </div>

              {/* Active requests */}
              <div>
                <div className="mb-1.5 flex justify-between font-mono text-[10px]">
                  <span className="text-text-muted">ACTIVE REQ</span>
                  <span className="text-text-secondary">
                    {status?.active_requests ?? 0}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                  <motion.div
                    className="h-full rounded-full"
                    style={{
                      background: "var(--color-neon-green)",
                      boxShadow:
                        (status?.active_requests ?? 0) > 0
                          ? "0 0 10px var(--color-neon-green)"
                          : "none",
                    }}
                    animate={{
                      width: (status?.active_requests ?? 0) > 0 ? "100%" : "0%",
                    }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                  />
                </div>
              </div>
            </ObsidianPanel>

            {/* Live TPS readout — grows to fill remaining space */}
            <ObsidianPanel className="relative flex flex-1 flex-col items-center justify-center overflow-hidden">
              <Zap
                className="absolute right-3 top-3 h-14 w-14 opacity-[0.04]"
                style={{ color: "var(--color-neon-purple)" }}
              />
              <motion.div
                key={tpsDisplay}
                initial={{ opacity: 0.6, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
                className="font-mono text-5xl font-light leading-none tracking-tighter text-text-primary tabular-nums"
              >
                {tpsDisplay}
              </motion.div>
              <p className="mt-1.5 font-mono text-[10px] uppercase tracking-widest text-text-muted">
                Tokens / Sec
              </p>

              {/* Heartbeat pill */}
              {isConnected && (
                <div className="mt-4 flex items-center gap-2">
                  <HeartbeatIndicator
                    isHealthy={isHealthy}
                    consecutiveFailures={consecutiveFailures}
                    lastPingMs={lastPingMs}
                  />
                  <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
                    {isHealthy ? "Nominal" : "Degraded"}
                  </span>
                </div>
              )}
            </ObsidianPanel>
          </section>

          {/* ── RIGHT PANEL: main data ── */}
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto no-scrollbar">
            {/* Action bar */}
            <motion.div
              variants={panelVariants}
              className="flex shrink-0 items-center justify-between"
            >
              <div className="flex items-center gap-2">
                {/* SSE error badge */}
                {connectionType !== "offline" &&
                  connectionState === "error" && (
                    <span className="inline-flex items-center rounded-full border border-neon-red/30 bg-neon-red/10 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-widest text-neon-red">
                      SSE off
                    </span>
                  )}
                {auth?.user && (
                  <p className="flex items-center gap-1.5 text-xs text-text-muted">
                    <Cloud className="h-3 w-3" />
                    <span className="text-text-secondary">
                      {auth.user.user_metadata?.full_name ??
                        auth.user.email ??
                        "unknown"}
                    </span>
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="glass"
                  size="sm"
                  onClick={() => setIsLoadOpen((p) => !p)}
                  aria-label="Load a model"
                >
                  <Plus className="mr-1.5 h-4 w-4" />
                  Load Model
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={reconnect}
                  aria-label="Reconnect SSE"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </motion.div>

            {/* ── Banners ── */}

            {/* Offline */}
            {connectionType === "offline" && (
              <motion.div
                variants={panelVariants}
                className="glass-subtle shrink-0 rounded-xl p-6 text-center"
              >
                <WifiOff className="mx-auto mb-3 h-8 w-8 text-neon-red" />
                <p className="mb-1 text-sm font-medium text-text-primary">
                  Server unreachable
                </p>
                <p className="mb-4 text-xs text-text-muted">
                  {connection?.error ?? "Could not connect via LAN or WAN"}
                </p>
                <Button variant="glass" size="sm" onClick={recheckConnection}>
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                  Retry Connection
                </Button>
              </motion.div>
            )}

            {/* Heartbeat unstable */}
            <AnimatePresence>
              {!isHealthy && connectionType !== "offline" && (
                <motion.div
                  initial={{ opacity: 0, y: -8, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: "auto" }}
                  exit={{ opacity: 0, y: -8, height: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  className="flex shrink-0 items-center gap-2 rounded-lg border border-neon-amber/30 glass-subtle px-4 py-3"
                >
                  <AlertTriangle className="h-4 w-4 shrink-0 text-neon-amber" />
                  <p className="flex-1 text-sm text-neon-amber">
                    Connection unstable — reconnecting...
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      reconnect();
                      recheckConnection?.();
                    }}
                    className="text-xs text-neon-amber hover:text-neon-amber/80"
                  >
                    <RefreshCw className="mr-1 h-3 w-3" />
                    Retry
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Action error */}
            <AnimatePresence>
              {actionError && (
                <motion.div
                  initial={{ opacity: 0, y: -8, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: "auto" }}
                  exit={{ opacity: 0, y: -8, height: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  className="flex shrink-0 items-center gap-2 rounded-lg border border-neon-red/20 bg-neon-red/10 px-4 py-3"
                >
                  <AlertCircle className="h-4 w-4 shrink-0 text-neon-red" />
                  <p className="flex-1 text-sm text-neon-red">{actionError}</p>
                  <button
                    onClick={() => setActionError(null)}
                    className="text-xs text-neon-red/60 hover:text-neon-red"
                    aria-label="Dismiss error"
                  >
                    Dismiss
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Model load dialog */}
            <div className="shrink-0">
              <ModelLoadDialog
                onLoad={handleLoadModel}
                isLoading={isLoadingModel}
                isOpen={isLoadOpen}
                onClose={() => setIsLoadOpen(false)}
              />
            </div>

            {/* ── Data grid ── */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <motion.div
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                custom={0}
              >
                <VRAMGauge
                  usedGB={status?.vram_used_gb ?? 0}
                  totalGB={status?.vram_total_gb ?? 0}
                />
              </motion.div>

              <motion.div
                className="md:col-span-1 xl:col-span-2"
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                custom={1}
              >
                <ModelList
                  models={status?.loaded_models ?? []}
                  onUnload={handleUnload}
                  isUnloading={unloadingId}
                  onLoad={() => setIsLoadOpen(true)}
                />
              </motion.div>

              <motion.div
                className="col-span-full"
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                custom={2}
              >
                <ThroughputChart data={chartData} averageTps={averageTps} />
              </motion.div>

              {/* Server Stats */}
              <motion.div
                className="glass-subtle col-span-full rounded-xl p-5"
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                custom={3}
              >
                <div className="mb-4 flex items-center gap-3">
                  <Network className="h-3.5 w-3.5 text-text-muted" />
                  <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-text-muted">
                    Server Info
                  </h2>
                  <div className="flex-1 border-t border-white/5" />
                </div>
                <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-5">
                  <StatItem
                    label="Active Requests"
                    value={status?.active_requests ?? 0}
                    accent={
                      (status?.active_requests ?? 0) > 0
                        ? "var(--color-neon-cyan)"
                        : undefined
                    }
                  />
                  <StatItem label="Tokens/sec" value={tpsDisplay} />
                  <StatItem
                    label="Temperature"
                    value={
                      status?.temperature_celsius != null
                        ? `${status.temperature_celsius.toFixed(0)}\u00B0C`
                        : "\u2014"
                    }
                    accent={getTempAccent(status?.temperature_celsius ?? null)}
                  />
                  <StatItem
                    label="Uptime"
                    value={formatUptime(status?.uptime_seconds ?? 0)}
                  />
                  <StatItem
                    label="Ping"
                    value={lastPingMs !== null ? `${lastPingMs}ms` : "\u2014"}
                    accent={getPingAccent(lastPingMs)}
                  />
                </div>
              </motion.div>
            </div>
          </div>
        </motion.div>

        {/* ══════════════════════════════════════════════════════════════
            FOOTER — full-width monospace status bar
        ══════════════════════════════════════════════════════════════ */}
        <motion.footer
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.4 }}
          className="relative z-10 flex h-8 w-full shrink-0 items-center border-t border-white/[0.06] bg-opta-bg/80 px-5 backdrop-blur-xl"
        >
          <div className="flex w-full items-center gap-6 font-mono text-[10px] uppercase tracking-widest text-text-muted">
            {/* Online indicator */}
            <div className="flex items-center gap-2">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{
                  background: isOnline
                    ? "var(--color-neon-green)"
                    : "var(--color-neon-red)",
                  boxShadow: isOnline
                    ? "0 0 8px var(--color-neon-green)"
                    : "none",
                }}
              />
              <span
                className="font-semibold"
                style={{
                  color: isOnline
                    ? "var(--color-text-primary)"
                    : "var(--color-neon-red)",
                }}
              >
                {isOnline ? "SYS.NOMINAL" : "SYS.OFFLINE"}
              </span>
            </div>

            <span className="hidden h-3 w-px bg-white/10 md:block" />

            <span
              className="hidden max-w-[200px] truncate md:block"
              title={baseUrl}
            >
              {baseUrl.replace("http://", "").replace("https://", "") ||
                "DISCONNECTED"}
            </span>

            <span className="hidden h-3 w-px bg-white/10 md:block" />

            <span className="hidden md:block">
              MEM{" "}
              {status
                ? `${status.vram_used_gb.toFixed(1)}/${status.vram_total_gb.toFixed(0)} GB`
                : "—"}
            </span>

            <span className="hidden h-3 w-px bg-white/10 lg:block" />

            <span className="hidden lg:block">
              MODELS {status?.loaded_models?.length ?? 0}
            </span>

            {/* Right-aligned */}
            <div className="ml-auto flex items-center gap-4">
              {status?.temperature_celsius != null && (
                <>
                  <span
                    style={{
                      color:
                        getTempAccent(status.temperature_celsius) ??
                        "var(--color-neon-amber)",
                    }}
                  >
                    TEMP {status.temperature_celsius.toFixed(0)}&deg;C
                  </span>
                  <span className="h-3 w-px bg-white/10" />
                </>
              )}
              <span style={{ color: "var(--color-text-primary)" }}>
                OPTA.OS v5.0
              </span>
            </div>
          </div>
        </motion.footer>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatItem({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: string;
}) {
  return (
    <div className="space-y-2">
      <p className="font-mono text-[10px] font-medium uppercase tracking-[0.15em] text-text-muted">
        {label}
      </p>
      <p
        className="text-2xl font-bold leading-none tabular-nums"
        style={{ color: accent ?? "var(--color-text-primary)" }}
      >
        {value}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getTempAccent(celsius: number | null): string | undefined {
  if (celsius == null) return undefined;
  if (celsius >= 85) return "var(--color-neon-red)";
  if (celsius >= 70) return "var(--color-neon-amber)";
  return undefined;
}

function getPingAccent(ms: number | null): string | undefined {
  if (ms == null) return undefined;
  if (ms < 10) return "var(--color-neon-green)";
  if (ms > 50) return "var(--color-neon-amber)";
  return undefined;
}

function formatUptime(seconds: number): string {
  if (seconds <= 0) return "\u2014";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

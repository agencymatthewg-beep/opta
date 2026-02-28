"use client";

/**
 * Dashboard — Root page (/).
 *
 * Aesthetic: Google Gemini — luminous depth, soft ambient orbs,
 * iridescent card shimmer, fluid blue→violet→teal gradient language.
 * Replaces Terminal Core HUD. All live data hooks unchanged.
 *
 * Data:
 *   - useSSE → /admin/events (status, model_change, throughput events)
 *   - useBufferedState → 500ms VRAM/status flush
 *   - CircularBuffer + 1s interval flush → ThroughputChart
 *   - useHeartbeat → ping health + latency
 *   - LMXClient.loadModel / unloadModel
 */

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import {
  RefreshCw,
  Plus,
  AlertCircle,
  WifiOff,
  AlertTriangle,
  Cloud,
  Cpu,
  Zap,
  Activity,
  Database,
  Network,
  Sparkles,
  MessageSquare,
  Swords,
  BookOpen,
  Bot,
  History,
  Layers,
  Monitor,
  BarChart2,
  FlaskConical,
  Package,
  Settings,
  ArrowRight,
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
// Framer Motion variants — gentle float-up stagger
// ---------------------------------------------------------------------------

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.05 },
  },
};

const floatUp = {
  hidden: { opacity: 0, y: 20, scale: 0.99 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring" as const, stiffness: 220, damping: 28 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.08,
      duration: 0.5,
      ease: [0.22, 1, 0.36, 1] as const,
    },
  }),
};

const featureCardHover = { scale: 1.03, y: -2 } as const;
const featureCardTap = { scale: 0.97 } as const;
const featureCardTransition = {
  duration: 0.4,
  ease: [0.22, 1, 0.36, 1] as const,
} as const;

// ---------------------------------------------------------------------------
// GeminiCard — iridescent glass card, Gemini-style
// ---------------------------------------------------------------------------

function GeminiCard({
  children,
  className = "",
  noPadding = false,
  glow = false,
}: {
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
  glow?: boolean;
}) {
  return (
    <motion.div
      variants={floatUp}
      className={cn(
        "group relative overflow-hidden rounded-2xl",
        "gemini-card",
        glow && "gemini-card--glow",
        className,
      )}
    >
      {/* Iridescent shimmer rim — visible on hover */}
      <div className="pointer-events-none absolute inset-0 z-10 rounded-2xl opacity-0 transition-opacity duration-700 group-hover:opacity-100 gemini-shimmer-rim" />

      <div
        className={cn("relative z-20 h-full w-full", noPadding ? "" : "p-5")}
      >
        {children}
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// SectionLabel — muted small label + optional icon
// ---------------------------------------------------------------------------

function SectionLabel({
  children,
  icon: Icon,
}: {
  children: React.ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <div className="mb-3 flex items-center gap-2">
      {Icon && (
        <Icon className="h-3.5 w-3.5 text-[var(--color-text-muted)] opacity-70" />
      )}
      <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
        {children}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TelemetryRow — compact key/value line (Gemini style: softer)
// ---------------------------------------------------------------------------

function TelemetryRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  accent?: string;
}) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-[10px] tracking-wide text-[var(--color-text-muted)]">
        {label}
      </span>
      <span
        className="text-[11px] font-medium tabular-nums"
        style={{ color: accent ?? "var(--color-text-secondary)" }}
      >
        {value}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// GeminiStatusDot
// ---------------------------------------------------------------------------

function StatusDot({ online }: { online: boolean }) {
  return (
    <span
      className={cn(
        "inline-block h-2 w-2 rounded-full transition-all duration-500",
        online ? "shadow-[0_0_8px_var(--opta-neon-green)]" : "opacity-40",
      )}
      style={{
        background: online
          ? "var(--color-neon-green)"
          : "var(--color-text-muted)",
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Feature discovery grid
// ---------------------------------------------------------------------------

const FEATURE_CARDS = [
  { label: "Chat",      href: "/chat",      icon: MessageSquare, desc: "Stream AI responses",    accent: "--opta-neon-purple" },
  { label: "Arena",     href: "/arena",     icon: Swords,        desc: "Side-by-side comparison",accent: "--opta-neon-blue"   },
  { label: "RAG Studio",href: "/rag",       icon: BookOpen,      desc: "Document Q&A",           accent: "--opta-neon-cyan"   },
  { label: "Agents",    href: "/agents",    icon: Bot,           desc: "Automate workflows",      accent: "--opta-neon-green"  },
  { label: "Models",    href: "/models",    icon: Layers,        desc: "Browse & load models",    accent: "--opta-primary"     },
  { label: "Sessions",  href: "/sessions",  icon: History,       desc: "Chat history",            accent: "--opta-neon-amber"  },
  { label: "Devices",   href: "/devices",   icon: Monitor,       desc: "Device registry",         accent: "--opta-neon-indigo" },
  { label: "Metrics",   href: "/metrics",   icon: BarChart2,     desc: "Live telemetry",          accent: "--opta-neon-green"  },
  { label: "Benchmark", href: "/benchmark", icon: FlaskConical,  desc: "Model evaluations",       accent: "--opta-neon-orange" },
  { label: "Quantize",  href: "/quantize",  icon: Package,       desc: "Compress models",         accent: "--opta-neon-pink"   },
  { label: "Stack",     href: "/stack",     icon: Network,       desc: "Stack overview",          accent: "--opta-neon-cyan"   },
  { label: "Settings",  href: "/settings",  icon: Settings,      desc: "Configuration",           accent: "--opta-text-muted"  },
] as const;

function FeatureCard({
  label,
  href,
  icon: Icon,
  desc,
  accent,
  delay,
}: {
  label: string;
  href: string;
  icon: LucideIcon;
  desc: string;
  /** CSS variable name, e.g. "--opta-neon-cyan" */
  accent: string;
  delay: number;
}) {
  const accentRef = `var(${accent})`;
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...featureCardTransition, delay }}
      whileHover={featureCardHover}
      whileTap={featureCardTap}
    >
      <Link href={href} className="group relative flex flex-col gap-2.5 rounded-xl p-3 feature-card-link">
        <div
          className="flex h-7 w-7 items-center justify-center rounded-lg"
          style={{
            background: `color-mix(in srgb, ${accentRef} 13%, transparent)`,
            border: `1px solid color-mix(in srgb, ${accentRef} 22%, transparent)`,
          }}
        >
          <Icon className="h-3.5 w-3.5" style={{ color: accentRef }} />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-[var(--color-text-primary)] truncate leading-tight">
            {label}
          </p>
          <p className="mt-0.5 text-[10px] text-[var(--color-text-muted)] truncate leading-tight">
            {desc}
          </p>
        </div>
        <ArrowRight
          className="absolute top-3 right-3 h-3 w-3 opacity-0 transition-opacity duration-200 group-hover:opacity-40"
          style={{ color: "var(--color-text-muted)" }}
        />
      </Link>
    </motion.div>
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

  // ---- Ambient glow intensity from TPS ----
  const glowOpacity =
    averageTps != null && averageTps > 0 ? Math.min(averageTps / 40, 0.55) : 0;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      <div className="relative flex h-screen flex-col overflow-hidden bg-opta-bg text-text-primary">
        {/* ── BACKGROUND: Deep space + animated Gemini orbs ── */}
        <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
          {/* Deep gradient backdrop */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 80% 60% at 20% 10%, rgba(30,10,60,0.8) 0%, transparent 55%), " +
                "radial-gradient(ellipse 60% 50% at 80% 90%, rgba(10,20,50,0.6) 0%, transparent 50%), " +
                "var(--opta-bg)",
            }}
          />

          {/* Orb A — violet, top-left */}
          <motion.div
            className="absolute rounded-full blur-[120px]"
            style={{
              width: "45vw",
              height: "45vw",
              top: "-10%",
              left: "-5%",
              background:
                "radial-gradient(circle, rgba(88,28,135,0.35) 0%, rgba(139,92,246,0.15) 50%, transparent 70%)",
              animation: "gemini-drift-a 22s ease-in-out infinite",
            }}
          />
          {/* Orb B — cyan, bottom-right */}
          <motion.div
            className="absolute rounded-full blur-[100px]"
            style={{
              width: "40vw",
              height: "40vw",
              bottom: "-8%",
              right: "-5%",
              background:
                "radial-gradient(circle, rgba(6,182,212,0.2) 0%, rgba(59,130,246,0.12) 50%, transparent 70%)",
              animation: "gemini-drift-b 28s ease-in-out infinite",
            }}
          />
          {/* Orb C — blue-indigo, center */}
          <motion.div
            className="absolute rounded-full blur-[140px]"
            style={{
              width: "30vw",
              height: "30vw",
              top: "35%",
              left: "40%",
              background:
                "radial-gradient(circle, rgba(59,130,246,0.15) 0%, rgba(99,102,241,0.1) 50%, transparent 70%)",
              animation: "gemini-drift-c 18s ease-in-out infinite",
            }}
          />

          {/* Inference activity glow — brightens with TPS */}
          <motion.div
            className="absolute rounded-full blur-[160px]"
            style={{
              width: "50vw",
              height: "50vw",
              bottom: "0%",
              right: "10%",
              background:
                "radial-gradient(circle, rgba(168,85,247,0.5) 0%, transparent 70%)",
            }}
            animate={{ opacity: glowOpacity }}
            transition={{ duration: 1.8, ease: "easeOut" }}
          />
        </div>

        {/* ══════════════════════════════════════════════════════════════
            MAIN BODY — left sidebar + right content
        ══════════════════════════════════════════════════════════════ */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="relative z-10 flex flex-1 gap-4 overflow-hidden p-5"
        >
          {/* ── LEFT COLUMN ── */}
          <section className="flex w-72 shrink-0 flex-col gap-3">
            {/* Identity header */}
            <motion.div
              variants={floatUp}
              className="flex items-center gap-3 px-1 pb-1"
            >
              {/* Gemini-style icon — iridescent ring */}
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(88,28,135,0.6), rgba(6,182,212,0.3))",
                  border: "1px solid rgba(139,92,246,0.4)",
                  boxShadow: "0 0 16px rgba(139,92,246,0.25)",
                }}
              >
                <Sparkles
                  className="h-4 w-4"
                  style={{ color: "var(--color-neon-purple)" }}
                />
              </div>
              <div>
                <h1
                  className="text-[15px] font-semibold leading-none tracking-tight"
                  style={{
                    background:
                      "linear-gradient(90deg, #fafafa 0%, #a5b4fc 60%, #c084fc 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}
                >
                  Opta LMX
                </h1>
                <span className="text-[10px] tracking-widest text-[var(--color-text-muted)]">
                  Local inference
                </span>
              </div>
              {auth?.user && (
                <Cloud className="ml-auto h-3.5 w-3.5 shrink-0 text-[var(--color-text-muted)] opacity-50" />
              )}
            </motion.div>

            {/* Connection */}
            <GeminiCard>
              <SectionLabel icon={Activity}>Connection</SectionLabel>
              <div className="flex flex-col gap-1.5">
                <TelemetryRow
                  label="State"
                  value={
                    isOnline
                      ? "Online"
                      : connectionType === "probing"
                        ? "Probing"
                        : "Offline"
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
                  label="Mode"
                  value={connection?.connectionType ?? "—"}
                />
                <TelemetryRow
                  label="Latency"
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
                  label="Stream"
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
              <div className="gemini-divider mt-4 mb-3" />
              <div className="flex items-center gap-2">
                <StatusDot online={isOnline} />
                <span className="text-[10px] text-[var(--color-text-muted)]">
                  {isOnline ? "Nominal" : "Unreachable"}
                </span>
                {isConnected && (
                  <div className="ml-auto">
                    <HeartbeatIndicator
                      isHealthy={isHealthy}
                      consecutiveFailures={consecutiveFailures}
                      lastPingMs={lastPingMs}
                    />
                  </div>
                )}
              </div>
            </GeminiCard>

            {/* Active model */}
            <GeminiCard>
              <SectionLabel icon={Database}>Active model</SectionLabel>
              {activeModel ? (
                <div
                  className="rounded-xl p-3"
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(88,28,135,0.2), rgba(59,130,246,0.1))",
                    border: "1px solid rgba(139,92,246,0.2)",
                  }}
                >
                  <p
                    className="truncate text-[12px] font-medium leading-snug"
                    style={{ color: "var(--color-neon-purple)" }}
                    title={activeModel.id}
                  >
                    {activeModel.name ?? activeModel.id}
                  </p>
                  <p className="mt-1 text-[10px] text-[var(--color-text-muted)]">
                    {activeModel.vram_gb != null
                      ? `${activeModel.vram_gb.toFixed(1)} GB VRAM`
                      : ""}
                    {activeModel.quantization
                      ? ` · ${activeModel.quantization}`
                      : ""}
                  </p>
                  <div className="mt-2 flex items-center gap-1.5">
                    <span
                      className="h-1.5 w-1.5 animate-pulse rounded-full"
                      style={{
                        background: "var(--color-neon-green)",
                        boxShadow: "0 0 6px var(--color-neon-green)",
                      }}
                    />
                    <span className="text-[10px] text-[var(--color-neon-green)]">
                      Ready
                    </span>
                  </div>
                </div>
              ) : (
                <div
                  className="rounded-xl p-3"
                  style={{
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.05)",
                  }}
                >
                  <p className="text-[11px] text-[var(--color-text-muted)]">
                    No model loaded
                  </p>
                  <p className="mt-0.5 text-[10px] text-[var(--color-text-muted)] opacity-60">
                    Use + Load Model to begin
                  </p>
                </div>
              )}
            </GeminiCard>

            {/* Memory pressure */}
            <GeminiCard>
              <SectionLabel icon={Cpu}>Unified memory</SectionLabel>
              <div className="mb-3">
                <div className="mb-2 flex items-end justify-between">
                  <span
                    className="text-2xl font-light tabular-nums leading-none"
                    style={{ color: "var(--color-text-primary)" }}
                  >
                    {memPct.toFixed(0)}
                    <span className="ml-0.5 text-xs text-[var(--color-text-muted)]">
                      %
                    </span>
                  </span>
                  <span className="text-[10px] text-[var(--color-text-muted)]">
                    {status
                      ? `${status.vram_used_gb.toFixed(1)} / ${status.vram_total_gb.toFixed(0)} GB`
                      : "— / —"}
                  </span>
                </div>
                <div className="gemini-track">
                  <motion.div
                    className="gemini-track-fill"
                    style={{
                      background:
                        memPct >= 80
                          ? "linear-gradient(90deg, var(--color-neon-amber), var(--color-neon-red))"
                          : memPct >= 60
                            ? "linear-gradient(90deg, var(--color-neon-purple), var(--color-neon-amber))"
                            : "linear-gradient(90deg, var(--opta-neon-blue), var(--color-neon-purple), var(--opta-neon-cyan))",
                    }}
                    animate={{ width: `${memPct}%` }}
                    transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                  />
                </div>
              </div>

              <div className="gemini-divider mb-3" />

              {/* Active requests */}
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-[10px] text-[var(--color-text-muted)]">
                    Active requests
                  </span>
                  <span
                    className="text-[11px] font-medium tabular-nums"
                    style={{
                      color:
                        (status?.active_requests ?? 0) > 0
                          ? "var(--opta-neon-cyan)"
                          : "var(--color-text-muted)",
                    }}
                  >
                    {status?.active_requests ?? 0}
                  </span>
                </div>
                <div className="gemini-track">
                  <motion.div
                    className="gemini-track-fill"
                    style={{
                      background:
                        "linear-gradient(90deg, var(--opta-neon-cyan), var(--opta-neon-blue))",
                      boxShadow:
                        (status?.active_requests ?? 0) > 0
                          ? "0 0 8px var(--opta-neon-cyan)"
                          : "none",
                    }}
                    animate={{
                      width: (status?.active_requests ?? 0) > 0 ? "100%" : "0%",
                    }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                  />
                </div>
              </div>
            </GeminiCard>

            {/* TPS readout — fills remaining space */}
            <GeminiCard
              glow
              className="relative flex flex-1 flex-col items-center justify-center overflow-hidden"
            >
              {/* Background icon watermark */}
              <Zap
                className="absolute right-2 bottom-3 h-20 w-20 opacity-[0.03]"
                style={{ color: "var(--color-neon-purple)" }}
              />

              <p className="mb-2 text-[10px] tracking-[0.16em] text-[var(--color-text-muted)] uppercase">
                Tokens / sec
              </p>
              <motion.div
                key={tpsDisplay}
                initial={{ opacity: 0.5, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.35 }}
                className="gemini-tps-number text-6xl font-extralight leading-none tracking-tighter tabular-nums"
              >
                {tpsDisplay}
              </motion.div>

              {averageTps != null && averageTps > 0 && (
                <p className="mt-2 text-[10px] text-[var(--color-text-muted)]">
                  avg {averageTps.toFixed(1)} t/s
                </p>
              )}
            </GeminiCard>
          </section>

          {/* ── RIGHT PANEL ── */}
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto no-scrollbar">
            {/* Action bar */}
            <motion.div
              variants={floatUp}
              className="flex shrink-0 items-center justify-between"
            >
              <div className="flex items-center gap-3">
                {connectionType !== "offline" &&
                  connectionState === "error" && (
                    <span
                      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider"
                      style={{
                        background: "rgba(239,68,68,0.12)",
                        border: "1px solid rgba(239,68,68,0.3)",
                        color: "var(--color-neon-red)",
                      }}
                    >
                      Stream off
                    </span>
                  )}
                {auth?.user && (
                  <p className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
                    <Cloud className="h-3 w-3 opacity-50" />
                    <span className="text-[var(--color-text-secondary)] opacity-70">
                      {auth.user.user_metadata?.full_name ??
                        auth.user.email ??
                        ""}
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
                  Load model
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={reconnect}
                  aria-label="Reconnect stream"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </motion.div>

            {/* ── Banners ── */}
            {connectionType === "offline" && (
              <motion.div
                variants={floatUp}
                className="glass-subtle shrink-0 rounded-2xl p-8 text-center"
              >
                <WifiOff
                  className="mx-auto mb-3 h-8 w-8 opacity-60"
                  style={{ color: "var(--color-neon-red)" }}
                />
                <p className="mb-1 text-sm font-medium text-[var(--color-text-primary)]">
                  Server unreachable
                </p>
                <p className="mb-4 text-xs text-[var(--color-text-muted)]">
                  {connection?.error ?? "Could not connect via LAN or WAN"}
                </p>
                <Button variant="glass" size="sm" onClick={recheckConnection}>
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                  Retry
                </Button>
              </motion.div>
            )}

            <AnimatePresence>
              {!isHealthy && connectionType !== "offline" && (
                <motion.div
                  initial={{ opacity: 0, y: -8, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: "auto" }}
                  exit={{ opacity: 0, y: -8, height: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  className="flex shrink-0 items-center gap-2 rounded-xl px-4 py-3"
                  style={{
                    background: "rgba(245,158,11,0.08)",
                    border: "1px solid rgba(245,158,11,0.25)",
                  }}
                >
                  <AlertTriangle
                    className="h-4 w-4 shrink-0"
                    style={{ color: "var(--color-neon-amber)" }}
                  />
                  <p
                    className="flex-1 text-sm"
                    style={{ color: "var(--color-neon-amber)" }}
                  >
                    Connection unstable — reconnecting...
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      reconnect();
                      recheckConnection?.();
                    }}
                    className="text-xs"
                    style={{ color: "var(--color-neon-amber)" }}
                  >
                    <RefreshCw className="mr-1 h-3 w-3" />
                    Retry
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {actionError && (
                <motion.div
                  initial={{ opacity: 0, y: -8, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: "auto" }}
                  exit={{ opacity: 0, y: -8, height: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  className="flex shrink-0 items-center gap-2 rounded-xl px-4 py-3"
                  style={{
                    background: "rgba(239,68,68,0.08)",
                    border: "1px solid rgba(239,68,68,0.2)",
                  }}
                >
                  <AlertCircle
                    className="h-4 w-4 shrink-0"
                    style={{ color: "var(--color-neon-red)" }}
                  />
                  <p
                    className="flex-1 text-sm"
                    style={{ color: "var(--color-neon-red)" }}
                  >
                    {actionError}
                  </p>
                  <button
                    onClick={() => setActionError(null)}
                    className="text-xs opacity-50 hover:opacity-80 transition-opacity"
                    style={{ color: "var(--color-neon-red)" }}
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

              {/* Server stats */}
              <motion.div
                className="col-span-full"
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                custom={3}
              >
                <div
                  className="rounded-2xl p-5"
                  style={{
                    background:
                      "linear-gradient(145deg, rgba(15,10,30,0.75), rgba(10,8,22,0.7))",
                    border: "1px solid rgba(139,92,246,0.1)",
                    backdropFilter: "blur(16px)",
                  }}
                >
                  <div className="mb-4 flex items-center gap-3">
                    <Network
                      className="h-3.5 w-3.5 opacity-40"
                      style={{ color: "var(--color-text-muted)" }}
                    />
                    <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                      Server
                    </span>
                    <div className="gemini-divider flex-1" />
                  </div>
                  <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5">
                    <StatItem
                      label="Requests"
                      value={status?.active_requests ?? 0}
                      accent={
                        (status?.active_requests ?? 0) > 0
                          ? "var(--opta-neon-cyan)"
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
                      accent={getTempAccent(
                        status?.temperature_celsius ?? null,
                      )}
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
                </div>
              </motion.div>

              {/* Quick access — feature discovery grid */}
              <motion.div
                className="col-span-full"
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                custom={4}
              >
                <div
                  className="rounded-2xl p-5"
                  style={{
                    background: "linear-gradient(145deg, rgba(15,10,30,0.6), rgba(10,8,22,0.55))",
                    border: "1px solid rgba(139,92,246,0.08)",
                    backdropFilter: "blur(16px)",
                  }}
                >
                  <div className="mb-4 flex items-center gap-3">
                    <Sparkles
                      className="h-3.5 w-3.5 opacity-40"
                      style={{ color: "var(--color-text-muted)" }}
                    />
                    <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                      Quick Access
                    </span>
                    <div className="gemini-divider flex-1" />
                  </div>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                    {FEATURE_CARDS.map((card, i) => (
                      <FeatureCard
                        key={card.href}
                        label={card.label}
                        href={card.href}
                        icon={card.icon}
                        desc={card.desc}
                        accent={card.accent}
                        delay={Math.min(0.36 + i * 0.04, 0.6)}
                      />
                    ))}
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </motion.div>

        {/* ══════════════════════════════════════════════════════════════
            FOOTER — slim Gemini-style status bar
        ══════════════════════════════════════════════════════════════ */}
        <motion.footer
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="relative z-10 flex h-9 w-full shrink-0 items-center px-5"
          style={{
            borderTop: "1px solid rgba(139,92,246,0.08)",
            background: "rgba(9,9,11,0.85)",
            backdropFilter: "blur(20px)",
          }}
        >
          <div className="flex w-full items-center gap-5 text-[10px] text-[var(--color-text-muted)]">
            {/* Status pill */}
            <div className="flex items-center gap-2">
              <StatusDot online={isOnline} />
              <span
                className="font-medium"
                style={{
                  color: isOnline
                    ? "var(--color-text-secondary)"
                    : "var(--color-neon-red)",
                }}
              >
                {isOnline ? "Connected" : "Offline"}
              </span>
            </div>

            <span className="hidden h-3 w-px opacity-20 bg-white md:block" />
            <span
              className="hidden max-w-[180px] truncate md:block opacity-50"
              title={baseUrl}
            >
              {baseUrl.replace("http://", "").replace("https://", "") || "—"}
            </span>

            <span className="hidden h-3 w-px opacity-20 bg-white md:block" />
            <span className="hidden md:block opacity-60">
              {status
                ? `${status.vram_used_gb.toFixed(1)} / ${status.vram_total_gb.toFixed(0)} GB`
                : "— GB"}
            </span>

            <span className="hidden h-3 w-px opacity-20 bg-white lg:block" />
            <span className="hidden lg:block opacity-60">
              {status?.loaded_models?.length ?? 0} model
              {(status?.loaded_models?.length ?? 0) !== 1 ? "s" : ""}
            </span>

            <div className="ml-auto flex items-center gap-4">
              {status?.temperature_celsius != null && (
                <span
                  style={{
                    color:
                      getTempAccent(status.temperature_celsius) ??
                      "var(--color-text-muted)",
                  }}
                >
                  {status.temperature_celsius.toFixed(0)}&deg;C
                </span>
              )}
              <span
                className="gemini-tps-number"
                style={{
                  background: "linear-gradient(90deg, #a5b4fc, #c084fc)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                Opta LMX
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
    <div className="space-y-1.5">
      <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-muted)] opacity-70">
        {label}
      </p>
      <p
        className="text-2xl font-light leading-none tabular-nums"
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

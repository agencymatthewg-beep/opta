"use client";

/**
 * MetricsPanel (P2B)
 *
 * Polls /admin/metrics every 15s and renders a grid of metric cards:
 *   - Total Requests (comma-formatted)
 *   - Error Rate (%, color-coded)
 *   - Avg Latency (ms, color-coded)
 *   - P95 Latency (ms, color-coded)
 *   - Tokens/Sec
 *   - Total Tokens (abbreviated, e.g. "1.2M")
 *   - Speculative Accept Ratio (%, if non-null)
 *   - In-flight Requests (animated if >0)
 *
 * 4-column on wide screens, 2-column on narrow.
 */

import { useEffect, useCallback, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart3,
  Zap,
  Clock,
  TrendingUp,
  RefreshCw,
  Activity,
} from "lucide-react";
import { cn } from "@opta/ui";
import type { LMXClient } from "@/lib/lmx-client";
import type { MetricsJson } from "@/types/lmx";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface MetricsPanelProps {
  client: LMXClient | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = 15_000;

// ---------------------------------------------------------------------------
// Number formatters
// ---------------------------------------------------------------------------

function formatCommas(n: number): string {
  return n.toLocaleString();
}

function formatTokens(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatPct(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`;
}

// ---------------------------------------------------------------------------
// Color helpers
// ---------------------------------------------------------------------------

function errorRateColor(rate: number): string {
  if (rate > 5) return "var(--opta-neon-red)";
  if (rate > 1) return "var(--opta-neon-amber)";
  return "var(--opta-neon-green)";
}

function latencyColor(ms: number): string {
  if (ms > 500) return "var(--opta-neon-red)";
  if (ms > 100) return "var(--opta-neon-amber)";
  return "var(--opta-neon-green)";
}

function tpsColor(tps: number): string {
  if (tps >= 20) return "var(--opta-neon-green)";
  if (tps >= 5) return "var(--opta-neon-purple)";
  return "var(--opta-text-secondary)";
}

// ---------------------------------------------------------------------------
// Framer variants
// ---------------------------------------------------------------------------

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.02 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 10, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring" as const, stiffness: 260, damping: 28 },
  },
};

// ---------------------------------------------------------------------------
// MetricCard
// ---------------------------------------------------------------------------

interface MetricCardDef {
  label: string;
  value: string;
  accent?: string;
  icon: React.ElementType;
  animated?: boolean;
  subtext?: string;
}

function MetricCard({
  label,
  value,
  accent,
  icon: Icon,
  animated = false,
  subtext,
}: MetricCardDef) {
  return (
    <motion.div
      variants={cardVariants}
      className="relative flex flex-col gap-1.5 overflow-hidden rounded-xl p-4"
      style={{
        background:
          "linear-gradient(145deg, rgba(15,10,30,0.70) 0%, rgba(10,8,22,0.65) 100%)",
        border: accent
          ? `1px solid ${accent}22`
          : "1px solid rgba(139,92,246,0.1)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      {/* Subtle accent glow in corner */}
      {accent && (
        <div
          className="pointer-events-none absolute right-0 top-0 h-20 w-20 rounded-full opacity-10 blur-2xl"
          style={{ background: accent }}
        />
      )}

      <div className="flex items-center gap-1.5">
        <Icon
          className="h-3 w-3 shrink-0 opacity-60"
          style={{ color: accent ?? "var(--opta-text-muted)" }}
        />
        <span
          className="text-[10px] uppercase tracking-[0.16em]"
          style={{ color: "var(--opta-text-muted)" }}
        >
          {label}
        </span>
        {animated && (
          <span
            className="ml-auto h-1.5 w-1.5 animate-pulse rounded-full"
            style={{
              background: "var(--opta-neon-cyan)",
              boxShadow: "0 0 6px var(--opta-neon-cyan)",
            }}
          />
        )}
      </div>

      <AnimatePresence mode="wait">
        <motion.p
          key={value}
          initial={{ opacity: 0.4, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="text-2xl font-light leading-none tabular-nums"
          style={{ color: accent ?? "var(--opta-text-primary)" }}
        >
          {value}
        </motion.p>
      </AnimatePresence>

      {subtext && (
        <p
          className="text-[10px]"
          style={{ color: "var(--opta-text-muted)", opacity: 0.6 }}
        >
          {subtext}
        </p>
      )}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton card
// ---------------------------------------------------------------------------

function SkeletonCard() {
  return (
    <div
      className="flex animate-pulse flex-col gap-2 rounded-xl p-4"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      <div
        className="h-2.5 w-20 rounded"
        style={{ background: "rgba(255,255,255,0.06)" }}
      />
      <div
        className="h-6 w-16 rounded"
        style={{ background: "rgba(255,255,255,0.08)" }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Build card defs from MetricsJson
// ---------------------------------------------------------------------------

function buildCards(m: MetricsJson): MetricCardDef[] {
  const errorRate =
    m.total_requests > 0 ? (m.total_errors / m.total_requests) * 100 : 0;

  const cards: MetricCardDef[] = [
    {
      label: "Total Requests",
      value: formatCommas(m.total_requests),
      icon: BarChart3,
      accent: "var(--opta-neon-blue)",
    },
    {
      label: "Error Rate",
      value: `${errorRate.toFixed(1)}%`,
      accent: errorRateColor(errorRate),
      icon: AlertIcon,
      subtext: `${m.total_errors.toLocaleString()} errors`,
    },
    {
      label: "Avg Latency",
      value: `${m.avg_latency_ms.toFixed(0)} ms`,
      accent: latencyColor(m.avg_latency_ms),
      icon: Clock,
    },
    ...(m.p95_latency_ms != null
      ? [
          {
            label: "P95 Latency",
            value: `${m.p95_latency_ms.toFixed(0)} ms`,
            accent: latencyColor(m.p95_latency_ms),
            icon: TrendingUp as React.ElementType,
          } satisfies MetricCardDef,
        ]
      : []),
    {
      label: "Tokens / Sec",
      value: m.tokens_per_second.toFixed(1),
      accent: tpsColor(m.tokens_per_second),
      icon: Zap,
    },
    {
      label: "Total Tokens",
      value: formatTokens(m.total_tokens),
      icon: Activity,
      accent: "var(--opta-neon-purple)",
    },
    ...(m.speculative_accept_ratio != null
      ? [
          {
            label: "Speculative AR",
            value: formatPct(m.speculative_accept_ratio),
            accent:
              m.speculative_accept_ratio > 0.7
                ? "var(--opta-neon-green)"
                : m.speculative_accept_ratio > 0.4
                  ? "var(--opta-neon-amber)"
                  : "var(--opta-neon-red)",
            icon: TrendingUp as React.ElementType,
            subtext: "accept ratio",
          } satisfies MetricCardDef,
        ]
      : []),
    {
      label: "In-flight",
      value: String(m.in_flight_requests),
      accent:
        m.in_flight_requests > 0
          ? "var(--opta-neon-cyan)"
          : "var(--opta-text-muted)",
      icon: Activity,
      animated: m.in_flight_requests > 0,
      subtext: m.in_flight_requests > 0 ? "active" : "idle",
    },
  ];

  return cards;
}

// Small inline icon proxy to avoid importing AlertTriangle in the map
function AlertIcon({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth={2}
      stroke="currentColor"
      className={className}
      style={style}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function MetricsPanel({ client }: MetricsPanelProps) {
  const [data, setData] = useState<MetricsJson | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isStale, setIsStale] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);

  const fetchData = useCallback(
    async (manual = false) => {
      if (!client) return;
      if (manual) setIsRefreshing(true);
      try {
        const metrics = await client.getMetricsJson();
        setData(metrics);
        setLastUpdatedAt(Date.now());
        setIsStale(false);
      } catch {
        setIsStale(true);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [client],
  );

  // Auto-poll
  useEffect(() => {
    if (!client) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    void fetchData();
    const id = setInterval(() => void fetchData(), POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [client, fetchData]);

  // ── Not connected ──────────────────────────────────────────────────────────
  if (!client) {
    return (
      <PanelShell>
        <PanelHeader />
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <BarChart3
            className="mb-3 h-8 w-8 opacity-30"
            style={{ color: "var(--opta-text-muted)" }}
          />
          <p
            className="text-sm font-medium"
            style={{ color: "var(--opta-text-secondary)" }}
          >
            Not connected
          </p>
          <p
            className="mt-1 text-xs"
            style={{ color: "var(--opta-text-muted)" }}
          >
            Connect to an LMX server to view metrics
          </p>
        </div>
      </PanelShell>
    );
  }

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <PanelShell>
        <PanelHeader />
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </PanelShell>
    );
  }

  // ── No data ────────────────────────────────────────────────────────────────
  if (!data) {
    return (
      <PanelShell>
        <PanelHeader onRefresh={() => void fetchData(true)} />
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <BarChart3
            className="mb-3 h-8 w-8 opacity-40"
            style={{ color: "var(--opta-neon-amber)" }}
          />
          <p
            className="text-sm font-medium"
            style={{ color: "var(--opta-neon-amber)" }}
          >
            Failed to load metrics
          </p>
          <button
            onClick={() => void fetchData(true)}
            className="mt-3 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-opacity hover:opacity-80"
            style={{
              background: "rgba(245,158,11,0.1)",
              border: "1px solid rgba(245,158,11,0.25)",
              color: "var(--opta-neon-amber)",
            }}
          >
            <RefreshCw className="h-3 w-3" />
            Retry
          </button>
        </div>
      </PanelShell>
    );
  }

  // ── Main render ────────────────────────────────────────────────────────────
  const cards = buildCards(data);

  return (
    <PanelShell>
      <PanelHeader
        onRefresh={() => void fetchData(true)}
        isRefreshing={isRefreshing}
        isStale={isStale}
        lastUpdatedAt={lastUpdatedAt}
      />

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-2 gap-3 xl:grid-cols-4"
      >
        {cards.map((card, i) => (
          <MetricCard key={i} {...card} />
        ))}
      </motion.div>
    </PanelShell>
  );
}

// ---------------------------------------------------------------------------
// PanelShell
// ---------------------------------------------------------------------------

function PanelShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl p-5"
      style={{
        background:
          "linear-gradient(145deg, rgba(15,10,30,0.82) 0%, rgba(10,8,22,0.78) 50%, rgba(12,10,28,0.82) 100%)",
        border: "1px solid rgba(139,92,246,0.12)",
        boxShadow:
          "0 1px 0 inset rgba(255,255,255,0.04), 0 20px 40px -20px rgba(0,0,0,0.6)",
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
      }}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PanelHeader
// ---------------------------------------------------------------------------

function PanelHeader({
  onRefresh,
  isRefreshing = false,
  isStale = false,
  lastUpdatedAt = null,
}: {
  onRefresh?: () => void;
  isRefreshing?: boolean;
  isStale?: boolean;
  lastUpdatedAt?: number | null;
}) {
  const [secsAgo, setSecsAgo] = useState<string | null>(null);

  useEffect(() => {
    if (lastUpdatedAt === null) {
      setSecsAgo(null);
      return;
    }
    function update() {
      if (lastUpdatedAt === null) return;
      const s = Math.round((Date.now() - lastUpdatedAt) / 1000);
      setSecsAgo(s < 60 ? `${s}s ago` : `${Math.floor(s / 60)}m ago`);
    }
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [lastUpdatedAt]);

  return (
    <div className="mb-4 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <BarChart3
          className="h-3.5 w-3.5 opacity-60"
          style={{ color: "var(--opta-neon-purple)" }}
        />
        <span
          className="text-[11px] font-semibold uppercase tracking-[0.16em]"
          style={{ color: "var(--opta-text-secondary)" }}
        >
          Metrics
        </span>
        {isStale && (
          <span
            className="rounded px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider"
            style={{
              background: "rgba(245,158,11,0.12)",
              border: "1px solid rgba(245,158,11,0.25)",
              color: "var(--opta-neon-amber)",
            }}
          >
            Stale
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {secsAgo && (
          <div
            className="flex items-center gap-1 rounded-full px-2 py-0.5"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <Clock
              className="h-2.5 w-2.5 opacity-50"
              style={{ color: "var(--opta-text-muted)" }}
            />
            <span
              className={cn("text-[9px] tabular-nums")}
              style={{ color: "var(--opta-text-muted)" }}
            >
              {secsAgo}
            </span>
          </div>
        )}
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="flex h-6 w-6 items-center justify-center rounded-md opacity-50 transition-opacity duration-150 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
            aria-label="Refresh metrics"
          >
            <RefreshCw
              className={cn("h-3 w-3", isRefreshing && "animate-spin")}
              style={{ color: "var(--opta-text-secondary)" }}
            />
          </button>
        )}
      </div>
    </div>
  );
}

"use client";

/**
 * DiagnosticsPanel (P2A)
 *
 * Polls /admin/diagnostics every 30s and renders:
 *   - Health verdict badge (healthy / degraded / critical)
 *   - System memory breakdown + progress bar + threshold indicator
 *   - Inference stats (requests, errors, error rate %, avg latency)
 *   - Recent errors list (up to 5), expandable rows
 *   - Auto-refresh "last updated Xs ago" badge
 *   - Stale indicator when fetch fails
 *   - Loading skeleton on first load
 */

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Clock,
} from "lucide-react";
import { cn } from "@opta/ui";
import type { LMXClient } from "@/lib/lmx-client";
import type { DiagnosticsReport } from "@/types/lmx";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface DiagnosticsPanelProps {
  client: LMXClient | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = 30_000;

// ---------------------------------------------------------------------------
// Framer variants
// ---------------------------------------------------------------------------

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.07, delayChildren: 0.02 },
  },
};

const rowVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 260, damping: 28 },
  },
};

// ---------------------------------------------------------------------------
// Verdict config
// ---------------------------------------------------------------------------

type Verdict = DiagnosticsReport["verdict"];

interface VerdictConfig {
  label: string;
  color: string;
  border: string;
  bg: string;
  glow: string;
  pulse: boolean;
  Icon: React.ElementType;
}

const VERDICT_CONFIG: Record<Verdict, VerdictConfig> = {
  healthy: {
    label: "Healthy",
    color: "var(--opta-neon-green)",
    border: "rgba(34,197,94,0.35)",
    bg: "rgba(34,197,94,0.1)",
    glow: "0 0 12px rgba(34,197,94,0.4)",
    pulse: false,
    Icon: CheckCircle,
  },
  degraded: {
    label: "Degraded",
    color: "var(--opta-neon-amber)",
    border: "rgba(245,158,11,0.35)",
    bg: "rgba(245,158,11,0.1)",
    glow: "0 0 12px rgba(245,158,11,0.35)",
    pulse: false,
    Icon: AlertTriangle,
  },
  critical: {
    label: "Critical",
    color: "var(--opta-neon-red)",
    border: "rgba(239,68,68,0.35)",
    bg: "rgba(239,68,68,0.12)",
    glow: "0 0 16px rgba(239,68,68,0.5)",
    pulse: true,
    Icon: XCircle,
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatSecondsAgo(ms: number): string {
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  return `${m}m ago`;
}

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

function memBarColor(pct: number): string {
  if (pct >= 85)
    return "linear-gradient(90deg, var(--opta-neon-amber), var(--opta-neon-red))";
  if (pct >= 60)
    return "linear-gradient(90deg, var(--opta-neon-blue), var(--opta-neon-amber))";
  return "linear-gradient(90deg, var(--opta-neon-blue), var(--opta-neon-purple), var(--opta-neon-cyan))";
}

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

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse rounded-lg", className)}
      style={{ background: "rgba(255,255,255,0.05)" }}
    />
  );
}

function SectionLabel({
  children,
  icon: Icon,
}: {
  children: React.ReactNode;
  icon?: React.ElementType;
}) {
  return (
    <div className="mb-3 flex items-center gap-2">
      {Icon && (
        <Icon
          className="h-3.5 w-3.5 opacity-60"
          style={{ color: "var(--opta-text-muted)" }}
        />
      )}
      <span
        className="text-[10px] font-medium uppercase tracking-[0.18em]"
        style={{ color: "var(--opta-text-muted)" }}
      >
        {children}
      </span>
    </div>
  );
}

function StatRow({
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
      <span
        className="text-[10px] tracking-wide"
        style={{ color: "var(--opta-text-muted)" }}
      >
        {label}
      </span>
      <span
        className="text-[11px] font-medium tabular-nums"
        style={{ color: accent ?? "var(--opta-text-secondary)" }}
      >
        {value}
      </span>
    </div>
  );
}

function Divider() {
  return (
    <div
      className="my-3"
      style={{
        height: "1px",
        background:
          "linear-gradient(90deg, transparent, rgba(139,92,246,0.2), transparent)",
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// ErrorRow — expandable
// ---------------------------------------------------------------------------

function ErrorRow({
  entry,
}: {
  entry: DiagnosticsReport["recent_errors"][number];
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      variants={rowVariants}
      className="cursor-pointer rounded-lg px-3 py-2 transition-colors duration-150"
      style={{
        background: expanded
          ? "rgba(239,68,68,0.08)"
          : "rgba(255,255,255,0.02)",
        border: "1px solid rgba(239,68,68,0.12)",
      }}
      onClick={() => setExpanded((p) => !p)}
      role="button"
      aria-expanded={expanded}
    >
      <div className="flex items-start gap-2">
        <XCircle
          className="mt-px h-3 w-3 shrink-0 opacity-60"
          style={{ color: "var(--opta-neon-red)" }}
        />
        <div className="min-w-0 flex-1">
          <p
            className="text-[10px] tabular-nums"
            style={{ color: "var(--opta-text-muted)" }}
          >
            {formatTimestamp(entry.timestamp)}
          </p>
          <p
            className={cn(
              "mt-0.5 text-[11px] leading-snug",
              !expanded && "truncate",
            )}
            style={{ color: "var(--opta-neon-red)" }}
          >
            {entry.error}
          </p>
        </div>
        <span
          className="mt-0.5 shrink-0 text-[9px] uppercase tracking-wider transition-transform duration-200"
          style={{
            color: "var(--opta-text-muted)",
            transform: expanded ? "rotate(180deg)" : "none",
          }}
        >
          ▾
        </span>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function DiagnosticsPanel({ client }: DiagnosticsPanelProps) {
  const [data, setData] = useState<DiagnosticsReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStale, setIsStale] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const [secsAgo, setSecsAgo] = useState<string>("—");

  const fetchData = useCallback(async () => {
    if (!client) return;
    try {
      const report = await client.getDiagnostics();
      setData(report);
      setLastUpdatedAt(Date.now());
      setIsStale(false);
    } catch {
      setIsStale(true);
    } finally {
      setIsLoading(false);
    }
  }, [client]);

  // Initial fetch + polling
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

  // "last updated Xs ago" ticker
  useEffect(() => {
    if (lastUpdatedAt === null) return;
    const id = setInterval(() => {
      setSecsAgo(formatSecondsAgo(lastUpdatedAt));
    }, 1000);
    setSecsAgo(formatSecondsAgo(lastUpdatedAt));
    return () => clearInterval(id);
  }, [lastUpdatedAt]);

  // ── Not connected ──────────────────────────────────────────────────────────
  if (!client) {
    return (
      <PanelShell>
        <PanelHeader />
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Activity
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
            Connect to an LMX server to view diagnostics
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
        <div className="space-y-4">
          <Skeleton className="h-10 w-36" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-2 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-full" />
          </div>
        </div>
      </PanelShell>
    );
  }

  // ── No data (error on first fetch) ─────────────────────────────────────────
  if (!data) {
    return (
      <PanelShell>
        <PanelHeader />
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <AlertTriangle
            className="mb-3 h-8 w-8 opacity-50"
            style={{ color: "var(--opta-neon-amber)" }}
          />
          <p
            className="text-sm font-medium"
            style={{ color: "var(--opta-neon-amber)" }}
          >
            Failed to load diagnostics
          </p>
          <button
            onClick={() => void fetchData()}
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
  const verdict = VERDICT_CONFIG[data.verdict];
  const memPct =
    data.system_memory.total_gb > 0
      ? Math.min(
          (data.system_memory.used_gb / data.system_memory.total_gb) * 100,
          100,
        )
      : 0;
  const totalReqs = data.inference_stats.total_requests;
  const errorCount = data.inference_stats.errors;
  const errorRate = totalReqs > 0 ? (errorCount / totalReqs) * 100 : 0;

  return (
    <PanelShell>
      <PanelHeader
        onRefresh={() => void fetchData()}
        secsAgo={secsAgo}
        isStale={isStale}
      />

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-4"
      >
        {/* ── Verdict badge ── */}
        <motion.div variants={rowVariants}>
          <div
            className="inline-flex items-center gap-2.5 rounded-xl px-4 py-2.5"
            style={{
              background: verdict.bg,
              border: `1px solid ${verdict.border}`,
              boxShadow: verdict.glow,
            }}
          >
            <verdict.Icon
              className={cn("h-4 w-4", verdict.pulse && "animate-pulse")}
              style={{ color: verdict.color }}
            />
            <span
              className="text-sm font-semibold tracking-wide"
              style={{ color: verdict.color }}
            >
              {verdict.label}
            </span>
          </div>
        </motion.div>

        <Divider />

        {/* ── Memory breakdown ── */}
        <motion.div variants={rowVariants}>
          <SectionLabel icon={Activity}>System memory</SectionLabel>
          <div className="space-y-2">
            <div className="flex items-end justify-between">
              <span
                className="text-xl font-light tabular-nums leading-none"
                style={{ color: "var(--opta-text-primary)" }}
              >
                {memPct.toFixed(0)}
                <span
                  className="ml-0.5 text-xs"
                  style={{ color: "var(--opta-text-muted)" }}
                >
                  %
                </span>
              </span>
              <span
                className="text-[10px] tabular-nums"
                style={{ color: "var(--opta-text-muted)" }}
              >
                {data.system_memory.used_gb.toFixed(1)} /{" "}
                {data.system_memory.total_gb.toFixed(0)} GB
              </span>
            </div>

            {/* Progress bar */}
            <div
              className="relative overflow-hidden rounded-full"
              style={{
                height: "5px",
                background: "rgba(255,255,255,0.06)",
              }}
            >
              <motion.div
                className="absolute inset-y-0 left-0 rounded-full"
                style={{ background: memBarColor(memPct) }}
                initial={{ width: 0 }}
                animate={{ width: `${memPct}%` }}
                transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              />
              {/* Threshold indicator at 85% */}
              <div
                className="absolute top-0 h-full w-px"
                style={{
                  left: "85%",
                  background: "rgba(245,158,11,0.7)",
                  boxShadow: "0 0 4px rgba(245,158,11,0.8)",
                }}
              />
            </div>

            <p
              className="text-[9px] uppercase tracking-wider"
              style={{ color: "var(--opta-text-muted)", opacity: 0.6 }}
            >
              ▲ 85% threshold
            </p>
          </div>
        </motion.div>

        <Divider />

        {/* ── Inference stats ── */}
        <motion.div variants={rowVariants}>
          <SectionLabel icon={Activity}>Inference</SectionLabel>
          <div className="space-y-0.5">
            <StatRow
              label="Total requests"
              value={totalReqs.toLocaleString()}
            />
            <StatRow
              label="Errors"
              value={errorCount.toLocaleString()}
              accent={
                errorCount > 0
                  ? "var(--opta-neon-red)"
                  : "var(--opta-neon-green)"
              }
            />
            <StatRow
              label="Error rate"
              value={`${errorRate.toFixed(1)}%`}
              accent={errorRateColor(errorRate)}
            />
            <StatRow
              label="Avg latency"
              value={`${data.inference_stats.avg_latency_ms.toFixed(0)} ms`}
              accent={latencyColor(data.inference_stats.avg_latency_ms)}
            />
          </div>
        </motion.div>

        <Divider />

        {/* ── Recent errors ── */}
        <motion.div variants={rowVariants}>
          <SectionLabel icon={AlertTriangle}>Recent errors</SectionLabel>
          <AnimatePresence mode="wait">
            {data.recent_errors.length === 0 ? (
              <motion.div
                key="no-errors"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2 rounded-lg px-3 py-2"
                style={{
                  background: "rgba(34,197,94,0.06)",
                  border: "1px solid rgba(34,197,94,0.15)",
                }}
              >
                <CheckCircle
                  className="h-3.5 w-3.5 shrink-0"
                  style={{ color: "var(--opta-neon-green)" }}
                />
                <span
                  className="text-[11px]"
                  style={{ color: "var(--opta-neon-green)" }}
                >
                  No recent errors
                </span>
              </motion.div>
            ) : (
              <motion.div
                key="errors-list"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="space-y-1.5"
              >
                {data.recent_errors.slice(0, 5).map((entry, i) => (
                  <ErrorRow key={i} entry={entry} />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </PanelShell>
  );
}

// ---------------------------------------------------------------------------
// PanelShell — GeminiCard-style wrapper
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
  secsAgo,
  isStale,
}: {
  onRefresh?: () => void;
  secsAgo?: string;
  isStale?: boolean;
}) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Activity
          className="h-3.5 w-3.5 opacity-60"
          style={{ color: "var(--opta-neon-purple)" }}
        />
        <span
          className="text-[11px] font-semibold uppercase tracking-[0.16em]"
          style={{ color: "var(--opta-text-secondary)" }}
        >
          Diagnostics
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
        {secsAgo && secsAgo !== "—" && (
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
              className="text-[9px] tabular-nums"
              style={{ color: "var(--opta-text-muted)" }}
            >
              {secsAgo}
            </span>
          </div>
        )}
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="flex h-6 w-6 items-center justify-center rounded-md opacity-50 transition-opacity duration-150 hover:opacity-90"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
            aria-label="Refresh diagnostics"
          >
            <RefreshCw
              className="h-3 w-3"
              style={{ color: "var(--opta-text-secondary)" }}
            />
          </button>
        )}
      </div>
    </div>
  );
}

"use client";

/**
 * HelpersPanel — P6B
 *
 * Monitor helper node health, latency metrics, and circuit-breaker state.
 * Auto-refreshes every 30s.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Server,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Wifi,
  RefreshCw,
  Activity,
} from "lucide-react";
import { cn } from "@opta/ui";
import type { LMXClient } from "@/lib/lmx-client";
import type { HelperNodeStatus } from "@/types/lmx";

// ---------------------------------------------------------------------------
// Motion variants
// ---------------------------------------------------------------------------

const floatUp = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 240, damping: 28 },
  },
};

const stagger = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const cardAnim = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 220, damping: 28 },
  },
  exit: { opacity: 0, y: -4, transition: { duration: 0.2 } },
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionLabel({
  children,
  icon: Icon,
}: {
  children: React.ReactNode;
  icon?: React.ElementType;
}) {
  return (
    <div className="flex items-center gap-2">
      {Icon && (
        <Icon
          className="h-3.5 w-3.5 opacity-60"
          style={{ color: "var(--color-text-muted)" }}
        />
      )}
      <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
        {children}
      </span>
    </div>
  );
}

function HealthDot({ healthy }: { healthy: boolean }) {
  return (
    <span className="relative flex h-2.5 w-2.5 shrink-0">
      {healthy && (
        <span
          className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-50"
          style={{ background: "var(--color-neon-green)" }}
        />
      )}
      <span
        className={cn("relative inline-flex h-2.5 w-2.5 rounded-full")}
        style={{
          background: healthy
            ? "var(--color-neon-green)"
            : "var(--color-neon-red)",
          boxShadow: healthy
            ? "0 0 6px var(--color-neon-green)"
            : "0 0 6px var(--color-neon-red)",
        }}
      />
    </span>
  );
}

function MetricPill({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div
      className="flex flex-col gap-0.5 rounded-lg px-2.5 py-1.5"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      <span
        className="text-[9px] uppercase tracking-[0.12em]"
        style={{ color: "var(--color-text-muted)" }}
      >
        {label}
      </span>
      <span
        className="text-[12px] font-medium tabular-nums leading-none"
        style={{ color: accent ?? "var(--color-text-secondary)" }}
      >
        {value}
      </span>
    </div>
  );
}

interface HelperCardProps {
  node: HelperNodeStatus;
}

function HelperCard({ node }: HelperCardProps) {
  const successPct =
    node.success_rate != null
      ? `${(node.success_rate * 100).toFixed(1)}%`
      : "—";

  const successAccent =
    node.success_rate == null
      ? undefined
      : node.success_rate >= 0.95
        ? "var(--color-neon-green)"
        : node.success_rate >= 0.8
          ? "var(--color-neon-amber)"
          : "var(--color-neon-red)";

  return (
    <motion.div
      variants={cardAnim}
      layout
      className="rounded-xl p-4"
      style={{
        background: "rgba(255,255,255,0.02)",
        border: node.healthy
          ? "1px solid rgba(34,197,94,0.12)"
          : "1px solid rgba(239,68,68,0.12)",
      }}
    >
      {/* Header */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <HealthDot healthy={node.healthy} />
          <div className="min-w-0">
            <p
              className="truncate text-[12px] font-medium leading-none"
              style={{ color: "var(--color-text-primary)" }}
              title={node.name}
            >
              {node.name}
            </p>
            <p
              className="mt-0.5 truncate text-[10px]"
              style={{ color: "var(--color-text-muted)" }}
              title={node.url}
            >
              {node.url}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1">
          {node.healthy ? (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{
                background: "rgba(34,197,94,0.1)",
                border: "1px solid rgba(34,197,94,0.25)",
                color: "var(--color-neon-green)",
              }}
            >
              <CheckCircle className="h-2.5 w-2.5" />
              Healthy
            </span>
          ) : (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{
                background: "rgba(239,68,68,0.1)",
                border: "1px solid rgba(239,68,68,0.25)",
                color: "var(--color-neon-red)",
              }}
            >
              <XCircle className="h-2.5 w-2.5" />
              Unhealthy
            </span>
          )}

          {node.circuit_open && (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{
                background: "rgba(245,158,11,0.1)",
                border: "1px solid rgba(245,158,11,0.3)",
                color: "var(--color-neon-amber)",
              }}
            >
              <AlertTriangle className="h-2.5 w-2.5" />
              Circuit Open
            </span>
          )}
        </div>
      </div>

      {/* Metrics row */}
      <div className="flex gap-2">
        <MetricPill
          label="P50 latency"
          value={
            node.latency_p50_ms != null
              ? `${node.latency_p50_ms.toFixed(0)}ms`
              : "—"
          }
          accent={
            node.latency_p50_ms != null && node.latency_p50_ms < 50
              ? "var(--color-neon-green)"
              : node.latency_p50_ms != null && node.latency_p50_ms > 200
                ? "var(--color-neon-amber)"
                : undefined
          }
        />
        <MetricPill
          label="P95 latency"
          value={
            node.latency_p95_ms != null
              ? `${node.latency_p95_ms.toFixed(0)}ms`
              : "—"
          }
          accent={
            node.latency_p95_ms != null && node.latency_p95_ms > 500
              ? "var(--color-neon-red)"
              : undefined
          }
        />
        <MetricPill
          label="Success rate"
          value={successPct}
          accent={successAccent}
        />
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface HelpersPanelProps {
  client: LMXClient | null;
}

const REFRESH_INTERVAL_MS = 30_000;

export function HelpersPanel({ client }: HelpersPanelProps) {
  const [nodes, setNodes] = useState<HelperNodeStatus[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchHelpers = useCallback(async () => {
    if (!client) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await client.getHelpers();
      setNodes(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load helpers");
    } finally {
      setIsLoading(false);
    }
  }, [client]);

  // Initial fetch + 30s poll
  useEffect(() => {
    void fetchHelpers();
    intervalRef.current = setInterval(
      () => void fetchHelpers(),
      REFRESH_INTERVAL_MS,
    );
    return () => {
      if (intervalRef.current != null) clearInterval(intervalRef.current);
    };
  }, [fetchHelpers]);

  // ---------------------------------------------------------------------------
  // Summary counts
  // ---------------------------------------------------------------------------

  const healthyCount = nodes.filter((n) => n.healthy).length;
  const total = nodes.length;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <motion.div
      variants={floatUp}
      initial="hidden"
      animate="visible"
      className="rounded-2xl p-5"
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
      {/* Header row */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <SectionLabel icon={Server}>Helper nodes</SectionLabel>
          {total > 0 && (
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{
                background:
                  healthyCount === total
                    ? "rgba(34,197,94,0.1)"
                    : healthyCount === 0
                      ? "rgba(239,68,68,0.1)"
                      : "rgba(245,158,11,0.1)",
                border:
                  healthyCount === total
                    ? "1px solid rgba(34,197,94,0.3)"
                    : healthyCount === 0
                      ? "1px solid rgba(239,68,68,0.3)"
                      : "1px solid rgba(245,158,11,0.3)",
                color:
                  healthyCount === total
                    ? "var(--color-neon-green)"
                    : healthyCount === 0
                      ? "var(--color-neon-red)"
                      : "var(--color-neon-amber)",
              }}
            >
              {healthyCount}/{total} healthy
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Wifi icon — purely decorative activity indicator */}
          {nodes.some((n) => n.healthy) && (
            <Wifi
              className="h-3.5 w-3.5 opacity-30"
              style={{ color: "var(--color-neon-green)" }}
            />
          )}
          <button
            type="button"
            onClick={() => void fetchHelpers()}
            disabled={isLoading || !client}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-all duration-200 opacity-70 hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-30"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "var(--color-text-muted)",
            }}
            aria-label="Test all helpers"
          >
            {isLoading ? (
              <RefreshCw className="h-3 w-3 animate-spin" />
            ) : (
              <Activity className="h-3 w-3" />
            )}
            Test All
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <p
          className="mb-3 text-[11px]"
          style={{ color: "var(--color-neon-red)" }}
        >
          {error}
        </p>
      )}

      {/* Empty state */}
      {!isLoading && !error && nodes.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-10">
          <Server
            className="h-8 w-8 opacity-15"
            style={{ color: "var(--color-text-muted)" }}
          />
          <p
            className="text-[11px]"
            style={{ color: "var(--color-text-muted)" }}
          >
            No helper nodes configured
          </p>
        </div>
      )}

      {/* Node cards */}
      {nodes.length > 0 && (
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="visible"
          className="flex flex-col gap-2"
        >
          <AnimatePresence mode="popLayout">
            {nodes.map((node) => (
              <HelperCard key={node.name} node={node} />
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </motion.div>
  );
}

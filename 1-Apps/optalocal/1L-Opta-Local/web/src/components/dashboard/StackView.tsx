"use client";

/**
 * StackView — P3A
 *
 * Shows routing roles table, helper nodes with health badges,
 * and a Reload Config action. Gemini card aesthetic.
 */

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Network,
  Server,
  Cpu,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { cn } from "@opta/ui";
import type { LMXClient } from "@/lib/lmx-client";
import type { StackInfo } from "@/types/lmx";

// ---------------------------------------------------------------------------
// Animation variants
// ---------------------------------------------------------------------------

const tableRowVariants = {
  hidden: { opacity: 0, x: -6 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: {
      delay: i * 0.04,
      type: "spring" as const,
      stiffness: 260,
      damping: 28,
    },
  }),
};

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function StackSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-10 animate-pulse rounded-lg"
          style={{ background: "rgba(255,255,255,0.04)" }}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// InlineToast
// ---------------------------------------------------------------------------

function InlineToast({
  message,
  visible,
  isError = false,
}: {
  message: string;
  visible: boolean;
  isError?: boolean;
}) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.span
          initial={{ opacity: 0, scale: 0.95, y: -4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -4 }}
          transition={{ type: "spring", stiffness: 320, damping: 28 }}
          className="text-[11px] font-medium"
          style={{
            color: isError
              ? "var(--color-neon-red)"
              : "var(--color-neon-green)",
          }}
        >
          {message}
        </motion.span>
      )}
    </AnimatePresence>
  );
}

// ---------------------------------------------------------------------------
// LoadedBadge
// ---------------------------------------------------------------------------

function LoadedBadge({ loaded }: { loaded: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
      style={{
        background: loaded ? "rgba(34,197,94,0.1)" : "rgba(255,255,255,0.05)",
        border: loaded
          ? "1px solid rgba(34,197,94,0.25)"
          : "1px solid rgba(255,255,255,0.08)",
        color: loaded ? "var(--color-neon-green)" : "var(--color-text-muted)",
      }}
    >
      <span
        className={cn("h-1.5 w-1.5 rounded-full", loaded && "animate-pulse")}
        style={{
          background: loaded
            ? "var(--color-neon-green)"
            : "var(--color-text-muted)",
        }}
      />
      {loaded ? "Loaded" : "Unloaded"}
    </span>
  );
}

// ---------------------------------------------------------------------------
// HealthDot
// ---------------------------------------------------------------------------

function HealthDot({ healthy }: { healthy: boolean }) {
  return (
    <span
      className={cn(
        "inline-block h-2 w-2 rounded-full transition-all duration-500",
        healthy
          ? "shadow-[0_0_6px_var(--color-neon-green)]"
          : "shadow-[0_0_6px_var(--color-neon-red)]",
      )}
      style={{
        background: healthy
          ? "var(--color-neon-green)"
          : "var(--color-neon-red)",
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// SectionDivider
// ---------------------------------------------------------------------------

function SectionDivider({
  label,
}: {
  label: string;
  icon?: React.ElementType;
}) {
  return (
    <div className="my-4 flex items-center gap-3">
      <span
        className="text-[10px] uppercase tracking-[0.18em] shrink-0"
        style={{ color: "var(--color-text-muted)" }}
      >
        {label}
      </span>
      <div
        className="h-px flex-1"
        style={{
          background:
            "linear-gradient(90deg, rgba(139,92,246,0.2), transparent)",
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// StackView
// ---------------------------------------------------------------------------

interface StackViewProps {
  client: LMXClient | null;
}

export function StackView({ client }: StackViewProps) {
  const [stack, setStack] = useState<StackInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloading, setReloading] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [toastVisible, setToastVisible] = useState(false);
  const [toastError, setToastError] = useState(false);

  // ---- Fetch ----
  const fetchStack = useCallback(async () => {
    if (!client) return;
    setLoading(true);
    setError(null);
    try {
      const data = await client.getStack();
      setStack(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load stack");
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    void fetchStack();
  }, [fetchStack]);

  // ---- Reload config ----
  const handleReloadConfig = useCallback(async () => {
    if (!client || reloading) return;
    setReloading(true);
    try {
      await client.reloadConfig();
      await fetchStack();
      setToastMsg("Config reloaded");
      setToastError(false);
      setToastVisible(true);
      setTimeout(() => setToastVisible(false), 2800);
    } catch (err) {
      setToastMsg(err instanceof Error ? err.message : "Reload failed");
      setToastError(true);
      setToastVisible(true);
      setTimeout(() => setToastVisible(false), 3500);
    } finally {
      setReloading(false);
    }
  }, [client, reloading, fetchStack]);

  // ---- Derived ----
  const roles = stack ? Object.entries(stack.roles) : [];
  const helperNodes = stack ? Object.entries(stack.helper_nodes) : [];

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div
      className="group relative overflow-hidden rounded-2xl"
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
      {/* Shimmer rim on hover */}
      <div
        className="pointer-events-none absolute inset-0 z-10 rounded-2xl opacity-0 transition-opacity duration-700 group-hover:opacity-100"
        style={{
          background:
            "conic-gradient(from 180deg, rgba(6,182,212,0.18), rgba(139,92,246,0.22), rgba(59,130,246,0.18), rgba(168,85,247,0.2), rgba(6,182,212,0.18))",
          maskImage:
            "linear-gradient(black, black) content-box, linear-gradient(black, black)",
          maskComposite: "exclude",
          WebkitMaskComposite: "destination-out",
          padding: "1px",
        }}
      />

      <div className="relative z-20 p-5">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Network
              className="h-3.5 w-3.5 opacity-60"
              style={{ color: "var(--color-neon-purple)" }}
            />
            <span
              className="text-[10px] font-medium uppercase tracking-[0.18em]"
              style={{ color: "var(--color-text-muted)" }}
            >
              Stack
            </span>
          </div>

          <div className="flex items-center gap-2">
            <InlineToast
              message={toastMsg}
              visible={toastVisible}
              isError={toastError}
            />
            <button
              onClick={handleReloadConfig}
              disabled={!client || reloading}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-all duration-200",
                "disabled:cursor-not-allowed disabled:opacity-40",
              )}
              style={{
                background: "rgba(139,92,246,0.1)",
                border: "1px solid rgba(139,92,246,0.2)",
                color: "var(--color-neon-purple)",
              }}
              aria-label="Reload config"
            >
              <RefreshCw
                className={cn("h-3 w-3", reloading && "animate-spin")}
              />
              {reloading ? "Reloading…" : "Reload Config"}
            </button>

            <button
              onClick={fetchStack}
              disabled={!client || loading}
              className={cn(
                "flex items-center justify-center rounded-lg p-1.5 transition-all duration-200",
                "disabled:cursor-not-allowed disabled:opacity-40",
              )}
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
              aria-label="Refresh stack"
            >
              <RefreshCw
                className={cn("h-3 w-3", loading && "animate-spin")}
                style={{ color: "var(--color-text-muted)" }}
              />
            </button>
          </div>
        </div>

        {/* Divider */}
        <div
          className="mb-4 h-px"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(139,92,246,0.25), rgba(6,182,212,0.2), transparent)",
          }}
        />

        {/* Content */}
        {!client ? (
          <p
            className="py-6 text-center text-[12px]"
            style={{ color: "var(--color-text-muted)" }}
          >
            Not connected
          </p>
        ) : loading ? (
          <StackSkeleton />
        ) : error ? (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl px-4 py-3 text-center"
            style={{
              background: "rgba(239,68,68,0.07)",
              border: "1px solid rgba(239,68,68,0.2)",
            }}
          >
            <p
              className="text-[12px]"
              style={{ color: "var(--color-neon-red)" }}
            >
              {error}
            </p>
            <button
              onClick={fetchStack}
              className="mt-2 text-[11px] underline opacity-70 hover:opacity-100 transition-opacity"
              style={{ color: "var(--color-neon-red)" }}
            >
              Retry
            </button>
          </motion.div>
        ) : !stack ? (
          <p
            className="py-6 text-center text-[12px]"
            style={{ color: "var(--color-text-muted)" }}
          >
            No stack data
          </p>
        ) : (
          <div>
            {/* Default model */}
            {stack.default_model && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 flex items-center gap-3 rounded-xl px-4 py-3"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(88,28,135,0.15), rgba(59,130,246,0.08))",
                  border: "1px solid rgba(139,92,246,0.18)",
                }}
              >
                <Cpu
                  className="h-3.5 w-3.5 shrink-0 opacity-70"
                  style={{ color: "var(--color-neon-purple)" }}
                />
                <div className="min-w-0 flex-1">
                  <p
                    className="text-[10px] uppercase tracking-[0.14em]"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    Default model
                  </p>
                  <p
                    className="mt-0.5 truncate text-[12px] font-medium"
                    style={{ color: "var(--color-text-primary)" }}
                    title={stack.default_model}
                  >
                    {stack.default_model}
                  </p>
                </div>
              </motion.div>
            )}

            {/* Roles table */}
            {roles.length > 0 && (
              <>
                <SectionDivider label="Routing roles" />
                {/* Table header */}
                <div
                  className="mb-1 grid grid-cols-[1fr_1.6fr_auto] gap-3 px-3 pb-1"
                  style={{
                    borderBottom: "1px solid rgba(255,255,255,0.05)",
                  }}
                >
                  {["Role", "Model ID", "Status"].map((h) => (
                    <span
                      key={h}
                      className="text-[10px] uppercase tracking-[0.14em]"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      {h}
                    </span>
                  ))}
                </div>

                <div className="flex flex-col gap-1">
                  {roles.map(([role, info], i) => (
                    <motion.div
                      key={role}
                      custom={i}
                      variants={tableRowVariants}
                      initial="hidden"
                      animate="visible"
                      className="grid grid-cols-[1fr_1.6fr_auto] items-center gap-3 rounded-lg px-3 py-2.5 transition-colors duration-150 hover:bg-white/[0.02]"
                      style={{
                        background: "rgba(255,255,255,0.025)",
                        border: "1px solid rgba(255,255,255,0.04)",
                      }}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Server
                          className="h-3 w-3 shrink-0 opacity-50"
                          style={{ color: "var(--color-text-muted)" }}
                        />
                        <span
                          className="truncate text-[12px] font-medium"
                          style={{ color: "var(--color-text-primary)" }}
                        >
                          {role}
                        </span>
                      </div>
                      <span
                        className="truncate text-[11px] font-mono"
                        style={{ color: "var(--color-text-secondary)" }}
                        title={info.model_id}
                      >
                        {info.model_id}
                      </span>
                      <LoadedBadge loaded={info.loaded} />
                    </motion.div>
                  ))}
                </div>
              </>
            )}

            {/* Helper nodes */}
            {helperNodes.length > 0 && (
              <>
                <SectionDivider label="Helper nodes" />
                <div className="flex flex-col gap-2">
                  {helperNodes.map(([name, node], i) => (
                    <motion.div
                      key={name}
                      custom={roles.length + i}
                      variants={tableRowVariants}
                      initial="hidden"
                      animate="visible"
                      className="rounded-xl px-4 py-3"
                      style={{
                        background: node.circuit_open
                          ? "rgba(245,158,11,0.06)"
                          : node.healthy
                            ? "rgba(34,197,94,0.05)"
                            : "rgba(239,68,68,0.06)",
                        border: node.circuit_open
                          ? "1px solid rgba(245,158,11,0.2)"
                          : node.healthy
                            ? "1px solid rgba(34,197,94,0.15)"
                            : "1px solid rgba(239,68,68,0.2)",
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        {/* Left: name + url */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <HealthDot
                              healthy={node.healthy && !node.circuit_open}
                            />
                            <span
                              className="truncate text-[12px] font-medium"
                              style={{ color: "var(--color-text-primary)" }}
                            >
                              {name}
                            </span>
                          </div>
                          <p
                            className="mt-0.5 truncate text-[10px] font-mono"
                            style={{ color: "var(--color-text-muted)" }}
                          >
                            {node.url}
                          </p>
                        </div>

                        {/* Right: latency + circuit */}
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          {node.circuit_open ? (
                            <span
                              className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
                              style={{
                                background: "rgba(245,158,11,0.12)",
                                border: "1px solid rgba(245,158,11,0.3)",
                                color: "var(--color-neon-amber)",
                              }}
                            >
                              <AlertTriangle className="h-2.5 w-2.5" />
                              Circuit Open
                            </span>
                          ) : node.healthy ? (
                            <span
                              className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
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
                              className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                              style={{
                                background: "rgba(239,68,68,0.1)",
                                border: "1px solid rgba(239,68,68,0.25)",
                                color: "var(--color-neon-red)",
                              }}
                            >
                              Unhealthy
                            </span>
                          )}

                          {node.latency_ms != null && (
                            <span
                              className="text-[10px] tabular-nums"
                              style={{
                                color:
                                  node.latency_ms < 20
                                    ? "var(--color-neon-green)"
                                    : node.latency_ms > 100
                                      ? "var(--color-neon-amber)"
                                      : "var(--color-text-secondary)",
                              }}
                            >
                              {node.latency_ms}ms
                            </span>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </>
            )}

            {/* Empty roles */}
            {roles.length === 0 && helperNodes.length === 0 && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="py-8 text-center"
              >
                <Network
                  className="mx-auto mb-3 h-7 w-7 opacity-20"
                  style={{ color: "var(--color-text-muted)" }}
                />
                <p
                  className="text-[12px]"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  No routing configuration
                </p>
              </motion.div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

/**
 * PresetsPanel — P3A
 *
 * Displays LMX presets with expandable details and a Reload Presets action.
 * Uses the Gemini card aesthetic from page.tsx.
 */

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Layers,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Cpu,
} from "lucide-react";
import { cn } from "@opta/ui";
import type { LMXClient } from "@/lib/lmx-client";
import type { Preset } from "@/types/lmx";

// ---------------------------------------------------------------------------
// Animation variants
// ---------------------------------------------------------------------------

const listVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.04 },
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

const expandVariants = {
  collapsed: { height: 0, opacity: 0 },
  expanded: {
    height: "auto",
    opacity: 1,
    transition: { type: "spring" as const, stiffness: 300, damping: 30 },
  },
};

// ---------------------------------------------------------------------------
// Skeleton loader
// ---------------------------------------------------------------------------

function PresetSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-14 animate-pulse rounded-xl"
          style={{ background: "rgba(255,255,255,0.04)" }}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// InlineToast — fade-in/out green message, no toast library
// ---------------------------------------------------------------------------

function InlineToast({
  message,
  visible,
}: {
  message: string;
  visible: boolean;
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
          style={{ color: "var(--color-neon-green)" }}
        >
          {message}
        </motion.span>
      )}
    </AnimatePresence>
  );
}

// ---------------------------------------------------------------------------
// PresetRow — single collapsible preset entry
// ---------------------------------------------------------------------------

function PresetRow({ preset }: { preset: Preset }) {
  const [expanded, setExpanded] = useState(false);

  const hasDetails =
    preset.parameters !== undefined ||
    preset.system_prompt !== undefined ||
    preset.auto_load !== undefined;

  return (
    <motion.div variants={rowVariants} layout>
      {/* Header row */}
      <button
        className={cn(
          "group w-full rounded-xl px-4 py-3 text-left transition-colors duration-200",
          "flex items-start justify-between gap-3",
        )}
        style={{
          background: expanded
            ? "rgba(139,92,246,0.08)"
            : "rgba(255,255,255,0.025)",
          border: expanded
            ? "1px solid rgba(139,92,246,0.2)"
            : "1px solid rgba(255,255,255,0.05)",
          cursor: hasDetails ? "pointer" : "default",
        }}
        onClick={() => hasDetails && setExpanded((p) => !p)}
        aria-expanded={expanded}
        aria-label={`${preset.name} preset`}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Cpu
              className="h-3.5 w-3.5 shrink-0 opacity-60"
              style={{ color: "var(--color-neon-purple)" }}
            />
            <span
              className="truncate text-[13px] font-medium leading-none"
              style={{ color: "var(--color-text-primary)" }}
            >
              {preset.name}
            </span>
            {preset.routing_alias && (
              <span
                className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                style={{
                  background: "rgba(6,182,212,0.1)",
                  border: "1px solid rgba(6,182,212,0.25)",
                  color: "var(--opta-neon-cyan)",
                }}
              >
                {preset.routing_alias}
              </span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span
              className="truncate text-[10px]"
              style={{ color: "var(--color-text-muted)" }}
            >
              {preset.model}
            </span>
            {preset.description && (
              <>
                <span
                  className="opacity-30"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  ·
                </span>
                <span
                  className="truncate text-[10px] opacity-70"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  {preset.description}
                </span>
              </>
            )}
          </div>
        </div>

        {hasDetails && (
          <div className="mt-0.5 shrink-0 opacity-40 transition-opacity group-hover:opacity-70">
            {expanded ? (
              <ChevronDown
                className="h-3.5 w-3.5"
                style={{ color: "var(--color-text-muted)" }}
              />
            ) : (
              <ChevronRight
                className="h-3.5 w-3.5"
                style={{ color: "var(--color-text-muted)" }}
              />
            )}
          </div>
        )}
      </button>

      {/* Expanded detail */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="expanded"
            variants={expandVariants}
            initial="collapsed"
            animate="expanded"
            exit="collapsed"
            className="overflow-hidden"
          >
            <div
              className="mx-2 mb-2 rounded-b-xl px-4 py-3 space-y-3"
              style={{
                background: "rgba(139,92,246,0.04)",
                border: "1px solid rgba(139,92,246,0.12)",
                borderTop: "none",
              }}
            >
              {/* System prompt snippet */}
              {preset.system_prompt && (
                <div>
                  <p
                    className="mb-1 text-[10px] uppercase tracking-[0.14em]"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    System prompt
                  </p>
                  <p
                    className="line-clamp-3 text-[11px] leading-relaxed"
                    style={{ color: "var(--color-text-secondary)" }}
                  >
                    {preset.system_prompt}
                  </p>
                </div>
              )}

              {/* Parameters JSON */}
              {preset.parameters && (
                <div>
                  <p
                    className="mb-1 text-[10px] uppercase tracking-[0.14em]"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    Parameters
                  </p>
                  <pre
                    className="overflow-x-auto rounded-lg p-2 text-[10px] leading-relaxed"
                    style={{
                      background: "rgba(0,0,0,0.3)",
                      color: "var(--color-text-secondary)",
                      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                    }}
                  >
                    {JSON.stringify(preset.parameters, null, 2)}
                  </pre>
                </div>
              )}

              {/* Auto-load badge */}
              {preset.auto_load !== undefined && (
                <div className="flex items-center gap-2">
                  <span
                    className="text-[10px] uppercase tracking-[0.14em]"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    Auto-load
                  </span>
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                    style={{
                      background: preset.auto_load
                        ? "rgba(34,197,94,0.1)"
                        : "rgba(255,255,255,0.05)",
                      border: preset.auto_load
                        ? "1px solid rgba(34,197,94,0.3)"
                        : "1px solid rgba(255,255,255,0.08)",
                      color: preset.auto_load
                        ? "var(--color-neon-green)"
                        : "var(--color-text-muted)",
                    }}
                  >
                    {preset.auto_load ? "Enabled" : "Disabled"}
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// PresetsPanel
// ---------------------------------------------------------------------------

interface PresetsPanelProps {
  client: LMXClient | null;
}

export function PresetsPanel({ client }: PresetsPanelProps) {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloading, setReloading] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);

  // ---- Fetch presets ----
  const fetchPresets = useCallback(async () => {
    if (!client) return;
    setLoading(true);
    setError(null);
    try {
      const data = await client.getPresets();
      setPresets(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load presets");
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    void fetchPresets();
  }, [fetchPresets]);

  // ---- Reload action ----
  const handleReload = useCallback(async () => {
    if (!client || reloading) return;
    setReloading(true);
    setError(null);
    try {
      await client.reloadPresets();
      await fetchPresets();
      setToastVisible(true);
      setTimeout(() => setToastVisible(false), 2800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reload failed");
    } finally {
      setReloading(false);
    }
  }, [client, reloading, fetchPresets]);

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
            <Layers
              className="h-3.5 w-3.5 opacity-60"
              style={{ color: "var(--color-neon-purple)" }}
            />
            <span
              className="text-[10px] font-medium uppercase tracking-[0.18em]"
              style={{ color: "var(--color-text-muted)" }}
            >
              Presets
            </span>
            {presets.length > 0 && (
              <span
                className="rounded-full px-1.5 py-0.5 text-[10px] tabular-nums"
                style={{
                  background: "rgba(139,92,246,0.12)",
                  border: "1px solid rgba(139,92,246,0.2)",
                  color: "var(--color-neon-purple)",
                }}
              >
                {presets.length}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <InlineToast message="Presets reloaded" visible={toastVisible} />
            <button
              onClick={handleReload}
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
              aria-label="Reload presets"
            >
              <RefreshCw
                className={cn("h-3 w-3", reloading && "animate-spin")}
              />
              {reloading ? "Reloading…" : "Reload"}
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
          <PresetSkeleton />
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
              onClick={fetchPresets}
              className="mt-2 text-[11px] underline opacity-70 hover:opacity-100 transition-opacity"
              style={{ color: "var(--color-neon-red)" }}
            >
              Retry
            </button>
          </motion.div>
        ) : presets.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="py-8 text-center"
          >
            <Layers
              className="mx-auto mb-3 h-7 w-7 opacity-20"
              style={{ color: "var(--color-text-muted)" }}
            />
            <p
              className="text-[12px]"
              style={{ color: "var(--color-text-muted)" }}
            >
              No presets configured
            </p>
            <p
              className="mt-1 text-[11px] opacity-60"
              style={{ color: "var(--color-text-muted)" }}
            >
              Add presets to your LMX config to see them here
            </p>
          </motion.div>
        ) : (
          <motion.div
            variants={listVariants}
            initial="hidden"
            animate="visible"
            className="flex flex-col gap-2"
          >
            {presets.map((preset) => (
              <PresetRow key={preset.name} preset={preset} />
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}

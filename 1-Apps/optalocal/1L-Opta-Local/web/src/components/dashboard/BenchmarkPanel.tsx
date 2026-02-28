"use client";

/**
 * BenchmarkPanel — P4
 *
 * Rich benchmarking interface: run benchmarks, view historical results,
 * filter by model, autotune. Gemini card aesthetic.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  BarChart3,
  Zap,
  Clock,
  RefreshCw,
  ChevronDown,
  CheckCircle,
} from "lucide-react";
import { cn } from "@opta/ui";
import type { LMXClient } from "@/lib/lmx-client";
import type { BenchmarkRequest, BenchmarkResult } from "@/types/lmx";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface BenchmarkPanelProps {
  client: LMXClient | null;
  loadedModelIds: string[];
}

// ---------------------------------------------------------------------------
// Animation variants
// ---------------------------------------------------------------------------

const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 260, damping: 28 },
  },
};

const rowEnter = {
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

const expandVariants = {
  collapsed: { height: 0, opacity: 0 },
  expanded: {
    height: "auto",
    opacity: 1,
    transition: { type: "spring" as const, stiffness: 300, damping: 30 },
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function tpsColor(tps: number): string {
  if (tps >= 50) return "var(--color-neon-green)";
  if (tps >= 20) return "var(--color-neon-amber)";
  return "var(--color-neon-red)";
}

function formatTs(ts: string): string {
  try {
    const d = new Date(ts);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return ts;
  }
}

function shortModelId(id: string): string {
  // e.g. "mlx-community/Llama-3.2-8B-4bit" → "Llama-3.2-8B-4bit"
  const parts = id.split("/");
  return parts[parts.length - 1] ?? id;
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function ResultsSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-12 animate-pulse rounded-xl"
          style={{ background: "rgba(255,255,255,0.04)" }}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// TpsBar — small inline bar
// ---------------------------------------------------------------------------

function TpsBar({ tps }: { tps: number }) {
  const pct = Math.min((tps / 100) * 100, 100);
  return (
    <div
      className="h-1 w-full overflow-hidden rounded-full"
      style={{ background: "rgba(255,255,255,0.05)" }}
    >
      <motion.div
        className="h-full rounded-full"
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        style={{
          background:
            tps >= 50
              ? "linear-gradient(90deg, var(--color-neon-green), rgba(34,197,94,0.6))"
              : tps >= 20
                ? "linear-gradient(90deg, var(--color-neon-amber), rgba(245,158,11,0.6))"
                : "linear-gradient(90deg, var(--color-neon-red), rgba(239,68,68,0.6))",
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// ResultRow — expandable result with speculative stats
// ---------------------------------------------------------------------------

function ResultRow({
  result,
  index,
}: {
  result: BenchmarkResult;
  index: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasSpec =
    result.speculative_stats != null &&
    Object.keys(result.speculative_stats).length > 0;
  const hasExtended =
    hasSpec ||
    result.p50_ttft_ms != null ||
    result.p95_ttft_ms != null ||
    result.p50_tps != null ||
    result.p95_tps != null;

  return (
    <motion.div
      custom={index}
      variants={rowEnter}
      initial="hidden"
      animate="visible"
      layout
    >
      {/* Main row */}
      <button
        className={cn(
          "group w-full rounded-xl px-4 py-3 text-left transition-colors duration-200",
          "grid items-center gap-3",
          "grid-cols-[1.4fr_auto_auto_auto_auto]",
        )}
        style={{
          background: expanded
            ? "rgba(139,92,246,0.08)"
            : "rgba(255,255,255,0.025)",
          border: expanded
            ? "1px solid rgba(139,92,246,0.2)"
            : "1px solid rgba(255,255,255,0.05)",
          cursor: hasExtended ? "pointer" : "default",
        }}
        onClick={() => hasExtended && setExpanded((p) => !p)}
        aria-expanded={expanded}
      >
        {/* Model + time */}
        <div className="min-w-0">
          <p
            className="truncate text-[12px] font-medium leading-none"
            style={{ color: "var(--color-text-primary)" }}
            title={result.model_id}
          >
            {shortModelId(result.model_id)}
          </p>
          <p
            className="mt-0.5 text-[10px]"
            style={{ color: "var(--color-text-muted)" }}
          >
            {formatTs(result.timestamp)}
          </p>
        </div>

        {/* TPS */}
        <div className="w-20 text-right">
          <p
            className="text-[13px] font-semibold tabular-nums leading-none"
            style={{ color: tpsColor(result.tokens_per_second) }}
          >
            {result.tokens_per_second.toFixed(1)}
            <span
              className="ml-0.5 text-[10px] font-normal"
              style={{ color: "var(--color-text-muted)" }}
            >
              t/s
            </span>
          </p>
          <div className="mt-1">
            <TpsBar tps={result.tokens_per_second} />
          </div>
        </div>

        {/* TTFT */}
        <div className="hidden text-right sm:block">
          <p
            className="text-[11px] tabular-nums"
            style={{ color: "var(--color-text-secondary)" }}
          >
            {result.ttft_ms.toFixed(0)}ms
          </p>
          <p
            className="text-[10px]"
            style={{ color: "var(--color-text-muted)" }}
          >
            TTFT
          </p>
        </div>

        {/* Coherent */}
        <div>
          {result.coherent === true ? (
            <span
              className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{
                background: "rgba(34,197,94,0.1)",
                border: "1px solid rgba(34,197,94,0.25)",
                color: "var(--color-neon-green)",
              }}
            >
              <CheckCircle className="h-2.5 w-2.5" />
              OK
            </span>
          ) : result.coherent === false ? (
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{
                background: "rgba(239,68,68,0.1)",
                border: "1px solid rgba(239,68,68,0.25)",
                color: "var(--color-neon-red)",
              }}
            >
              Incoherent
            </span>
          ) : null}
        </div>

        {/* Expand indicator */}
        {hasExtended && (
          <div className="opacity-40 group-hover:opacity-70 transition-opacity">
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 transition-transform duration-300",
                expanded && "rotate-180",
              )}
              style={{ color: "var(--color-text-muted)" }}
            />
          </div>
        )}
      </button>

      {/* Expanded speculative stats */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="spec"
            variants={expandVariants}
            initial="collapsed"
            animate="expanded"
            exit="collapsed"
            className="overflow-hidden"
          >
            <div
              className="mx-2 mb-2 grid grid-cols-2 gap-2 rounded-b-xl px-4 py-3 sm:grid-cols-4"
              style={{
                background: "rgba(139,92,246,0.04)",
                border: "1px solid rgba(139,92,246,0.12)",
                borderTop: "none",
              }}
            >
              {result.p50_ttft_ms != null && (
                <MiniStat
                  label="TTFT p50"
                  value={`${result.p50_ttft_ms.toFixed(0)}ms`}
                />
              )}
              {result.p95_ttft_ms != null && (
                <MiniStat
                  label="TTFT p95"
                  value={`${result.p95_ttft_ms.toFixed(0)}ms`}
                />
              )}
              {result.p50_tps != null && (
                <MiniStat
                  label="TPS p50"
                  value={`${result.p50_tps.toFixed(1)}`}
                  accent={tpsColor(result.p50_tps)}
                />
              )}
              {result.p95_tps != null && (
                <MiniStat
                  label="TPS p95"
                  value={`${result.p95_tps.toFixed(1)}`}
                  accent={tpsColor(result.p95_tps)}
                />
              )}
              {result.speculative_stats?.accept_ratio != null && (
                <MiniStat
                  label="Spec accept"
                  value={`${(result.speculative_stats.accept_ratio * 100).toFixed(0)}%`}
                  accent="var(--opta-neon-cyan)"
                />
              )}
              {result.speculative_stats?.tokens_generated != null && (
                <MiniStat
                  label="Spec tokens"
                  value={`${result.speculative_stats.tokens_generated}`}
                />
              )}
              <MiniStat
                label="Total time"
                value={`${(result.total_time_ms / 1000).toFixed(2)}s`}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function MiniStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div>
      <p
        className="text-[10px] uppercase tracking-[0.12em]"
        style={{ color: "var(--color-text-muted)" }}
      >
        {label}
      </p>
      <p
        className="mt-0.5 text-[12px] font-medium tabular-nums"
        style={{ color: accent ?? "var(--color-text-secondary)" }}
      >
        {value}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AutotuneButton
// ---------------------------------------------------------------------------

function AutotuneButton({
  modelId,
  client,
}: {
  modelId: string;
  client: LMXClient;
}) {
  const [state, setState] = useState<"idle" | "running" | "done" | "error">(
    "idle",
  );

  const handleAutotune = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (state === "running") return;
      setState("running");
      try {
        await client.autotuneModel(modelId);
        setState("done");
        setTimeout(() => setState("idle"), 3000);
      } catch {
        setState("error");
        setTimeout(() => setState("idle"), 3000);
      }
    },
    [client, modelId, state],
  );

  return (
    <button
      onClick={handleAutotune}
      disabled={state === "running"}
      className={cn(
        "flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium transition-all duration-200",
        "disabled:cursor-not-allowed disabled:opacity-60",
      )}
      style={{
        background:
          state === "done"
            ? "rgba(34,197,94,0.1)"
            : state === "error"
              ? "rgba(239,68,68,0.1)"
              : "rgba(6,182,212,0.1)",
        border:
          state === "done"
            ? "1px solid rgba(34,197,94,0.25)"
            : state === "error"
              ? "1px solid rgba(239,68,68,0.25)"
              : "1px solid rgba(6,182,212,0.2)",
        color:
          state === "done"
            ? "var(--color-neon-green)"
            : state === "error"
              ? "var(--color-neon-red)"
              : "var(--opta-neon-cyan)",
      }}
      title={`Autotune ${shortModelId(modelId)}`}
    >
      {state === "running" ? (
        <>
          <RefreshCw className="h-2.5 w-2.5 animate-spin" />
          Tuning…
        </>
      ) : state === "done" ? (
        <>
          <CheckCircle className="h-2.5 w-2.5" />
          Done
        </>
      ) : state === "error" ? (
        "Error"
      ) : (
        <>
          <Zap className="h-2.5 w-2.5" />
          Autotune
        </>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// BenchmarkPanel
// ---------------------------------------------------------------------------

export function BenchmarkPanel({
  client,
  loadedModelIds,
}: BenchmarkPanelProps) {
  // ---- Run form state ----
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [prompt, setPrompt] = useState("");
  const [maxTokens, setMaxTokens] = useState(100);
  const [runs, setRuns] = useState(3);
  const [warmupRuns, setWarmupRuns] = useState(1);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<BenchmarkResult | null>(null);
  const [runError, setRunError] = useState<string | null>(null);

  // ---- Results state ----
  const [results, setResults] = useState<BenchmarkResult[]>([]);
  const [resultsLoading, setResultsLoading] = useState(true);
  const [resultsError, setResultsError] = useState<string | null>(null);
  const [filterModel, setFilterModel] = useState<string>("__all__");

  // Sync model selector to first loaded model
  useEffect(() => {
    if (!selectedModel && loadedModelIds.length > 0) {
      setSelectedModel(loadedModelIds[0] ?? "");
    }
  }, [loadedModelIds, selectedModel]);

  // ---- Fetch historical results ----
  const fetchResults = useCallback(async () => {
    if (!client) return;
    setResultsLoading(true);
    setResultsError(null);
    try {
      const data = await client.getBenchmarkResults();
      // Sort desc by timestamp
      const sorted = [...data].sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );
      setResults(sorted);
    } catch (err) {
      setResultsError(
        err instanceof Error ? err.message : "Failed to load results",
      );
    } finally {
      setResultsLoading(false);
    }
  }, [client]);

  useEffect(() => {
    void fetchResults();
  }, [fetchResults]);

  // ---- Run benchmark ----
  const handleRun = useCallback(async () => {
    if (!client || !selectedModel || running) return;
    setRunning(true);
    setRunResult(null);
    setRunError(null);

    const req: BenchmarkRequest = {
      model_id: selectedModel,
      prompt: prompt.trim() || undefined,
      max_tokens: maxTokens,
      runs,
      warmup_runs: warmupRuns,
    };

    try {
      const result = await client.runBenchmark(req);
      setRunResult(result);
      // Refresh history
      await fetchResults();
    } catch (err) {
      setRunError(err instanceof Error ? err.message : "Benchmark failed");
    } finally {
      setRunning(false);
    }
  }, [
    client,
    selectedModel,
    running,
    prompt,
    maxTokens,
    runs,
    warmupRuns,
    fetchResults,
  ]);

  // ---- Filtered results ----
  const filteredResults = useMemo(() => {
    if (filterModel === "__all__") return results;
    return results.filter((r) => r.model_id === filterModel);
  }, [results, filterModel]);

  // ---- Unique model IDs from results (for filter dropdown) ----
  const resultModelIds = useMemo(() => {
    return Array.from(new Set(results.map((r) => r.model_id)));
  }, [results]);

  // ---------------------------------------------------------------------------
  // Shared card wrapper styles (inlined so no GeminiCard import needed)
  // ---------------------------------------------------------------------------

  const cardStyle: React.CSSProperties = {
    background:
      "linear-gradient(145deg, rgba(15,10,30,0.82) 0%, rgba(10,8,22,0.78) 50%, rgba(12,10,28,0.82) 100%)",
    border: "1px solid rgba(139,92,246,0.12)",
    boxShadow:
      "0 1px 0 inset rgba(255,255,255,0.04), 0 20px 40px -20px rgba(0,0,0,0.6)",
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex flex-col gap-4">
      {/* ── RUN SECTION ── */}
      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        className="group relative overflow-hidden rounded-2xl p-5"
        style={cardStyle}
      >
        {/* Shimmer rim */}
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

        <div className="relative z-20">
          {/* Section header */}
          <div className="mb-4 flex items-center gap-2">
            <Play
              className="h-3.5 w-3.5 opacity-60"
              style={{ color: "var(--color-neon-purple)" }}
            />
            <span
              className="text-[10px] font-medium uppercase tracking-[0.18em]"
              style={{ color: "var(--color-text-muted)" }}
            >
              Run benchmark
            </span>
          </div>

          {/* Divider */}
          <div
            className="mb-4 h-px"
            style={{
              background:
                "linear-gradient(90deg, transparent, rgba(139,92,246,0.25), rgba(6,182,212,0.2), transparent)",
            }}
          />

          {/* Form grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Model selector */}
            <div className="lg:col-span-1">
              <label
                className="mb-1.5 block text-[10px] uppercase tracking-[0.14em]"
                style={{ color: "var(--color-text-muted)" }}
              >
                Model
              </label>
              <div className="flex gap-2">
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  disabled={running || loadedModelIds.length === 0}
                  className={cn(
                    "flex-1 min-w-0 truncate rounded-lg px-3 py-2 text-[12px] outline-none transition-all duration-200",
                    "focus:ring-1 disabled:cursor-not-allowed disabled:opacity-50",
                  )}
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "var(--color-text-primary)",
                    // focus ring handled below via CSS var
                  }}
                >
                  {loadedModelIds.length === 0 ? (
                    <option value="">No models loaded</option>
                  ) : (
                    loadedModelIds.map((id) => (
                      <option
                        key={id}
                        value={id}
                        style={{
                          background: "var(--opta-bg)",
                          color: "var(--color-text-primary)",
                        }}
                      >
                        {shortModelId(id)}
                      </option>
                    ))
                  )}
                </select>

                {/* Autotune button — shown when a model is selected */}
                {client && selectedModel && (
                  <AutotuneButton modelId={selectedModel} client={client} />
                )}
              </div>
            </div>

            {/* Max tokens */}
            <div>
              <label
                className="mb-1.5 block text-[10px] uppercase tracking-[0.14em]"
                style={{ color: "var(--color-text-muted)" }}
              >
                Max tokens
              </label>
              <input
                type="number"
                min={1}
                max={4096}
                value={maxTokens}
                onChange={(e) =>
                  setMaxTokens(Math.max(1, parseInt(e.target.value) || 100))
                }
                disabled={running}
                className="w-full rounded-lg px-3 py-2 text-[12px] outline-none transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "var(--color-text-primary)",
                }}
              />
            </div>

            {/* Runs + Warmup (side by side) */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  className="mb-1.5 block text-[10px] uppercase tracking-[0.14em]"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  Runs
                </label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={runs}
                  onChange={(e) =>
                    setRuns(
                      Math.min(10, Math.max(1, parseInt(e.target.value) || 3)),
                    )
                  }
                  disabled={running}
                  className="w-full rounded-lg px-3 py-2 text-[12px] outline-none disabled:cursor-not-allowed disabled:opacity-50"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "var(--color-text-primary)",
                  }}
                />
              </div>
              <div>
                <label
                  className="mb-1.5 block text-[10px] uppercase tracking-[0.14em]"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  Warmup
                </label>
                <input
                  type="number"
                  min={0}
                  max={5}
                  value={warmupRuns}
                  onChange={(e) =>
                    setWarmupRuns(
                      Math.min(5, Math.max(0, parseInt(e.target.value) || 1)),
                    )
                  }
                  disabled={running}
                  className="w-full rounded-lg px-3 py-2 text-[12px] outline-none disabled:cursor-not-allowed disabled:opacity-50"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "var(--color-text-primary)",
                  }}
                />
              </div>
            </div>
          </div>

          {/* Prompt textarea */}
          <div className="mt-4">
            <label
              className="mb-1.5 block text-[10px] uppercase tracking-[0.14em]"
              style={{ color: "var(--color-text-muted)" }}
            >
              Prompt (optional)
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Leave blank for default benchmark prompt"
              rows={2}
              disabled={running}
              className="w-full resize-none rounded-lg px-3 py-2 text-[12px] leading-relaxed outline-none transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "var(--color-text-primary)",
              }}
            />
          </div>

          {/* Run button + progress */}
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={handleRun}
              disabled={!client || !selectedModel || running}
              className={cn(
                "flex items-center gap-2 rounded-xl px-5 py-2.5 text-[13px] font-semibold transition-all duration-200",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
              style={{
                background: running
                  ? "rgba(139,92,246,0.25)"
                  : "linear-gradient(135deg, rgba(139,92,246,0.7), rgba(88,28,135,0.8))",
                border: "1px solid rgba(139,92,246,0.4)",
                boxShadow: running ? "none" : "0 0 20px rgba(139,92,246,0.25)",
                color: "var(--color-text-primary)",
              }}
            >
              {running ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Running…
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Run Benchmark
                </>
              )}
            </button>

            {/* Animated progress during run */}
            <AnimatePresence>
              {running && (
                <motion.div
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  className="flex items-center gap-2"
                >
                  <div
                    className="h-1 w-32 overflow-hidden rounded-full"
                    style={{ background: "rgba(255,255,255,0.06)" }}
                  >
                    <motion.div
                      className="h-full rounded-full"
                      style={{
                        background:
                          "linear-gradient(90deg, rgba(139,92,246,0.8), rgba(6,182,212,0.8))",
                      }}
                      animate={{ x: ["-100%", "100%"] }}
                      transition={{
                        duration: 1.4,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                    />
                  </div>
                  <span
                    className="text-[11px]"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    Benchmarking…
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Run error */}
          <AnimatePresence>
            {runError && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                className="mt-3 rounded-xl px-4 py-3"
                style={{
                  background: "rgba(239,68,68,0.08)",
                  border: "1px solid rgba(239,68,68,0.2)",
                }}
              >
                <p
                  className="text-[12px]"
                  style={{ color: "var(--color-neon-red)" }}
                >
                  {runError}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Inline result card */}
          <AnimatePresence>
            {runResult && !running && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.98 }}
                transition={{ type: "spring", stiffness: 280, damping: 26 }}
                className="mt-4 rounded-2xl p-4"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(34,197,94,0.08), rgba(6,182,212,0.06))",
                  border: "1px solid rgba(34,197,94,0.2)",
                }}
              >
                <div className="mb-3 flex items-center gap-2">
                  <CheckCircle
                    className="h-4 w-4"
                    style={{ color: "var(--color-neon-green)" }}
                  />
                  <span
                    className="text-[11px] font-semibold uppercase tracking-[0.14em]"
                    style={{ color: "var(--color-neon-green)" }}
                  >
                    Result
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-4 sm:grid-cols-5">
                  <ResultStat
                    icon={<Zap className="h-3 w-3" />}
                    label="TPS"
                    value={runResult.tokens_per_second.toFixed(1)}
                    accent={tpsColor(runResult.tokens_per_second)}
                  />
                  <ResultStat
                    icon={<Clock className="h-3 w-3" />}
                    label="TTFT"
                    value={`${runResult.ttft_ms.toFixed(0)}ms`}
                  />
                  {runResult.p50_ttft_ms != null && (
                    <ResultStat
                      label="p50 TTFT"
                      value={`${runResult.p50_ttft_ms.toFixed(0)}ms`}
                    />
                  )}
                  {runResult.p95_ttft_ms != null && (
                    <ResultStat
                      label="p95 TTFT"
                      value={`${runResult.p95_ttft_ms.toFixed(0)}ms`}
                    />
                  )}
                  {runResult.coherent != null && (
                    <ResultStat
                      label="Coherent"
                      value={runResult.coherent ? "Yes" : "No"}
                      accent={
                        runResult.coherent
                          ? "var(--color-neon-green)"
                          : "var(--color-neon-red)"
                      }
                    />
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* ── RESULTS SECTION ── */}
      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        transition={{ delay: 0.08 }}
        className="group relative overflow-hidden rounded-2xl p-5"
        style={cardStyle}
      >
        {/* Shimmer rim */}
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

        <div className="relative z-20">
          {/* Section header */}
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3
                className="h-3.5 w-3.5 opacity-60"
                style={{ color: "var(--color-neon-purple)" }}
              />
              <span
                className="text-[10px] font-medium uppercase tracking-[0.18em]"
                style={{ color: "var(--color-text-muted)" }}
              >
                History
              </span>
              {results.length > 0 && (
                <span
                  className="rounded-full px-1.5 py-0.5 text-[10px] tabular-nums"
                  style={{
                    background: "rgba(139,92,246,0.12)",
                    border: "1px solid rgba(139,92,246,0.2)",
                    color: "var(--color-neon-purple)",
                  }}
                >
                  {results.length}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Filter by model */}
              {resultModelIds.length > 1 && (
                <select
                  value={filterModel}
                  onChange={(e) => setFilterModel(e.target.value)}
                  className="rounded-lg px-2.5 py-1.5 text-[11px] outline-none transition-all duration-200"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "var(--color-text-secondary)",
                  }}
                >
                  <option
                    value="__all__"
                    style={{
                      background: "var(--opta-bg)",
                      color: "var(--color-text-primary)",
                    }}
                  >
                    All models
                  </option>
                  {resultModelIds.map((id) => (
                    <option
                      key={id}
                      value={id}
                      style={{
                        background: "var(--opta-bg)",
                        color: "var(--color-text-primary)",
                      }}
                    >
                      {shortModelId(id)}
                    </option>
                  ))}
                </select>
              )}

              {/* Refresh */}
              <button
                onClick={fetchResults}
                disabled={resultsLoading}
                className="flex items-center justify-center rounded-lg p-1.5 transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-40"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
                aria-label="Refresh results"
              >
                <RefreshCw
                  className={cn("h-3 w-3", resultsLoading && "animate-spin")}
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

          {/* Column labels */}
          {filteredResults.length > 0 && (
            <div
              className="mb-2 grid grid-cols-[1.4fr_auto_auto_auto_auto] items-center gap-3 px-4 pb-1"
              style={{
                borderBottom: "1px solid rgba(255,255,255,0.05)",
              }}
            >
              {["Model", "TPS", "TTFT", "Coherent", ""].map((h) => (
                <span
                  key={h}
                  className={cn(
                    "text-[10px] uppercase tracking-[0.14em]",
                    h === "TTFT" && "hidden text-right sm:block",
                    h === "" && "text-right",
                  )}
                  style={{ color: "var(--color-text-muted)" }}
                >
                  {h}
                </span>
              ))}
            </div>
          )}

          {/* Content */}
          {!client ? (
            <p
              className="py-6 text-center text-[12px]"
              style={{ color: "var(--color-text-muted)" }}
            >
              Not connected
            </p>
          ) : resultsLoading ? (
            <ResultsSkeleton />
          ) : resultsError ? (
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
                {resultsError}
              </p>
            </motion.div>
          ) : filteredResults.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="py-10 text-center"
            >
              <BarChart3
                className="mx-auto mb-3 h-8 w-8 opacity-15"
                style={{ color: "var(--color-text-muted)" }}
              />
              <p
                className="text-[13px] font-medium"
                style={{ color: "var(--color-text-muted)" }}
              >
                {results.length === 0
                  ? "No benchmarks run yet — run your first above"
                  : "No results for this model"}
              </p>
            </motion.div>
          ) : (
            <div className="flex flex-col gap-2">
              {filteredResults.map((result, i) => (
                <ResultRow
                  key={`${result.model_id}-${result.timestamp}`}
                  result={result}
                  index={i}
                />
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ResultStat — inline result metric
// ---------------------------------------------------------------------------

function ResultStat({
  label,
  value,
  accent,
  icon,
}: {
  label: string;
  value: string;
  accent?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-0.5 flex items-center gap-1">
        {icon && (
          <span
            className="opacity-60"
            style={{ color: accent ?? "var(--color-text-muted)" }}
          >
            {icon}
          </span>
        )}
        <span
          className="text-[10px] uppercase tracking-[0.12em]"
          style={{ color: "var(--color-text-muted)" }}
        >
          {label}
        </span>
      </div>
      <p
        className="text-[15px] font-semibold tabular-nums leading-none"
        style={{ color: accent ?? "var(--color-text-primary)" }}
      >
        {value}
      </p>
    </div>
  );
}

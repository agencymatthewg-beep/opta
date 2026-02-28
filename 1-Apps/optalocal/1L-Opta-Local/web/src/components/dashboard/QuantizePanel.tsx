"use client";

/**
 * QuantizePanel — P5
 *
 * Start HuggingFace model quantization jobs and monitor their progress.
 * Polls active jobs every 2s; auto-stops when job reaches terminal state.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Package,
  Play,
  CheckCircle,
  XCircle,
  RefreshCw,
  Loader,
} from "lucide-react";
import { cn } from "@opta/ui";
import type { LMXClient } from "@/lib/lmx-client";
import type { QuantizeRequest, QuantizeJob } from "@/types/lmx";

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

const listItem = {
  hidden: { opacity: 0, x: -8 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.25 } },
  exit: { opacity: 0, x: 8, transition: { duration: 0.2 } },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBytes(bytes: number): string {
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(2)} GB`;
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  return `${bytes} B`;
}

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
    <div className="mb-3 flex items-center gap-2">
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

function StatusBadge({ status }: { status: QuantizeJob["status"] }) {
  const map = {
    pending: {
      label: "Pending",
      color: "var(--color-neon-amber)",
      bg: "rgba(245,158,11,0.1)",
      border: "rgba(245,158,11,0.3)",
    },
    running: {
      label: "Running",
      color: "var(--opta-neon-cyan)",
      bg: "rgba(6,182,212,0.1)",
      border: "rgba(6,182,212,0.3)",
    },
    completed: {
      label: "Done",
      color: "var(--color-neon-green)",
      bg: "rgba(34,197,94,0.1)",
      border: "rgba(34,197,94,0.3)",
    },
    failed: {
      label: "Failed",
      color: "var(--color-neon-red)",
      bg: "rgba(239,68,68,0.1)",
      border: "rgba(239,68,68,0.3)",
    },
  } as const;

  const s = map[status];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider"
      style={{
        color: s.color,
        background: s.bg,
        border: `1px solid ${s.border}`,
      }}
    >
      {status === "running" && <Loader className="h-2.5 w-2.5 animate-spin" />}
      {status === "completed" && <CheckCircle className="h-2.5 w-2.5" />}
      {status === "failed" && <XCircle className="h-2.5 w-2.5" />}
      {s.label}
    </span>
  );
}

interface JobCardProps {
  job: QuantizeJob;
}

function JobCard({ job }: JobCardProps) {
  const isActive = job.status === "pending" || job.status === "running";
  const pct = job.percent ?? 0;

  return (
    <motion.div
      variants={listItem}
      initial="hidden"
      animate="visible"
      exit="exit"
      layout
      className="rounded-xl p-3"
      style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(139,92,246,0.1)",
      }}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <p
          className="truncate text-[12px] font-medium leading-snug"
          style={{ color: "var(--color-text-primary)" }}
          title={job.repo_id}
        >
          {job.repo_id}
        </p>
        <StatusBadge status={job.status} />
      </div>

      <p
        className="mb-2 text-[10px]"
        style={{ color: "var(--color-text-muted)" }}
      >
        Job&nbsp;
        <span
          className="font-mono"
          style={{ color: "var(--color-text-secondary)" }}
        >
          {job.job_id.slice(0, 8)}
        </span>
        {job.output_size_bytes != null && (
          <span> &middot; {formatBytes(job.output_size_bytes)}</span>
        )}
      </p>

      {isActive && (
        <div>
          <div className="mb-1 flex items-center justify-between">
            <span
              className="text-[10px]"
              style={{ color: "var(--color-text-muted)" }}
            >
              Progress
            </span>
            <span
              className="text-[10px] font-medium tabular-nums"
              style={{ color: "var(--color-text-secondary)" }}
            >
              {pct.toFixed(0)}%
            </span>
          </div>
          <div
            className="overflow-hidden rounded-full"
            style={{ height: 4, background: "rgba(255,255,255,0.06)" }}
          >
            <motion.div
              className="h-full rounded-full"
              style={{
                background:
                  "linear-gradient(90deg, var(--opta-neon-blue), var(--color-neon-purple), var(--opta-neon-cyan))",
              }}
              animate={{ width: `${Math.max(pct, 4)}%` }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
        </div>
      )}

      {job.status === "failed" && job.error && (
        <p
          className="mt-2 text-[10px] leading-relaxed"
          style={{ color: "var(--color-neon-red)" }}
        >
          {job.error}
        </p>
      )}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface QuantizePanelProps {
  client: LMXClient | null;
}

export function QuantizePanel({ client }: QuantizePanelProps) {
  // Form state
  const [repoId, setRepoId] = useState("");
  const [bits, setBits] = useState<4 | 8>(4);
  const [revision, setRevision] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Jobs state
  const [jobs, setJobs] = useState<QuantizeJob[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobsError, setJobsError] = useState<string | null>(null);

  // Polling refs — map of jobId → intervalId
  const pollRefs = useRef<Map<string, ReturnType<typeof setInterval>>>(
    new Map(),
  );

  // ---------------------------------------------------------------------------
  // Fetch all jobs
  // ---------------------------------------------------------------------------

  const fetchJobs = useCallback(async () => {
    if (!client) return;
    setJobsLoading(true);
    setJobsError(null);
    try {
      const list = await client.listQuantizeJobs();
      setJobs(list);
    } catch (err) {
      setJobsError(err instanceof Error ? err.message : "Failed to load jobs");
    } finally {
      setJobsLoading(false);
    }
  }, [client]);

  useEffect(() => {
    void fetchJobs();
  }, [fetchJobs]);

  // ---------------------------------------------------------------------------
  // Poll a single active job
  // ---------------------------------------------------------------------------

  const stopPolling = useCallback((jobId: string) => {
    const ref = pollRefs.current.get(jobId);
    if (ref != null) {
      clearInterval(ref);
      pollRefs.current.delete(jobId);
    }
  }, []);

  const startPolling = useCallback(
    (jobId: string) => {
      if (!client || pollRefs.current.has(jobId)) return;

      const id = setInterval(async () => {
        try {
          const updated = await client.getQuantizeJob(jobId);
          setJobs((prev) =>
            prev.map((j) => (j.job_id === jobId ? updated : j)),
          );
          if (updated.status === "completed" || updated.status === "failed") {
            stopPolling(jobId);
          }
        } catch {
          stopPolling(jobId);
        }
      }, 2000);

      pollRefs.current.set(jobId, id);
    },
    [client, stopPolling],
  );

  // Start polling for each active job on mount / jobs change
  useEffect(() => {
    for (const job of jobs) {
      if (job.status === "pending" || job.status === "running") {
        startPolling(job.job_id);
      } else {
        stopPolling(job.job_id);
      }
    }
  }, [jobs, startPolling, stopPolling]);

  // Cleanup all intervals on unmount
  useEffect(() => {
    const refs = pollRefs.current;
    return () => {
      for (const id of refs.values()) {
        clearInterval(id);
      }
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Submit quantization
  // ---------------------------------------------------------------------------

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!client || !repoId.trim()) return;

      setIsSubmitting(true);
      setSubmitError(null);

      const req: QuantizeRequest = {
        repo_id: repoId.trim(),
        bits,
        ...(revision.trim() ? { revision: revision.trim() } : {}),
      };

      try {
        const newJob = await client.startQuantize(req);
        setJobs((prev) => [newJob, ...prev]);
        setRepoId("");
        setRevision("");
        startPolling(newJob.job_id);
      } catch (err) {
        setSubmitError(
          err instanceof Error ? err.message : "Failed to start quantization",
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [client, repoId, bits, revision, startPolling],
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const activeJobs = jobs.filter(
    (j) => j.status === "pending" || j.status === "running",
  );
  const doneJobs = jobs.filter(
    (j) => j.status === "completed" || j.status === "failed",
  );

  return (
    <motion.div
      variants={floatUp}
      initial="hidden"
      animate="visible"
      className="flex flex-col gap-4"
    >
      {/* ── Start quantization ── */}
      <div
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
        <SectionLabel icon={Package}>Quantize model</SectionLabel>

        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="flex flex-col gap-3"
        >
          {/* Repo ID */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="q-repo-id"
              className="text-[10px] uppercase tracking-[0.14em]"
              style={{ color: "var(--color-text-muted)" }}
            >
              HuggingFace Repo ID
            </label>
            <input
              id="q-repo-id"
              type="text"
              value={repoId}
              onChange={(e) => setRepoId(e.target.value)}
              placeholder="mlx-community/Llama-3.2-3B-Instruct-4bit"
              autoComplete="off"
              spellCheck={false}
              className="w-full rounded-xl px-3 py-2 text-[12px] font-mono outline-none transition-colors duration-200"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(139,92,246,0.15)",
                color: "var(--color-text-primary)",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "rgba(139,92,246,0.4)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "rgba(139,92,246,0.15)";
              }}
            />
          </div>

          {/* Bits selector */}
          <div className="flex flex-col gap-1.5">
            <span
              className="text-[10px] uppercase tracking-[0.14em]"
              style={{ color: "var(--color-text-muted)" }}
            >
              Bits
            </span>
            <div className="flex gap-2">
              {([4, 8] as const).map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => setBits(b)}
                  className={cn(
                    "flex-1 rounded-xl py-2 text-[12px] font-medium transition-all duration-200",
                  )}
                  style={
                    bits === b
                      ? {
                          background:
                            "linear-gradient(135deg, rgba(88,28,135,0.5), rgba(6,182,212,0.2))",
                          border: "1px solid rgba(139,92,246,0.5)",
                          color: "var(--color-text-primary)",
                          boxShadow: "0 0 12px rgba(139,92,246,0.2)",
                        }
                      : {
                          background: "rgba(255,255,255,0.03)",
                          border: "1px solid rgba(255,255,255,0.08)",
                          color: "var(--color-text-muted)",
                        }
                  }
                >
                  {b}-bit
                </button>
              ))}
            </div>
          </div>

          {/* Revision (optional) */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="q-revision"
              className="text-[10px] uppercase tracking-[0.14em]"
              style={{ color: "var(--color-text-muted)" }}
            >
              Revision
              <span
                className="ml-2 normal-case"
                style={{ color: "var(--color-text-muted)", opacity: 0.5 }}
              >
                optional
              </span>
            </label>
            <input
              id="q-revision"
              type="text"
              value={revision}
              onChange={(e) => setRevision(e.target.value)}
              placeholder="main"
              autoComplete="off"
              spellCheck={false}
              className="w-full rounded-xl px-3 py-2 text-[12px] font-mono outline-none transition-colors duration-200"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(139,92,246,0.15)",
                color: "var(--color-text-primary)",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "rgba(139,92,246,0.4)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "rgba(139,92,246,0.15)";
              }}
            />
          </div>

          {/* Error */}
          <AnimatePresence>
            {submitError && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="text-[11px] leading-relaxed"
                style={{ color: "var(--color-neon-red)" }}
              >
                {submitError}
              </motion.p>
            )}
          </AnimatePresence>

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting || !repoId.trim() || !client}
            className={cn(
              "flex items-center justify-center gap-2 rounded-xl py-2.5 text-[12px] font-medium transition-all duration-200",
              (!repoId.trim() || !client) && "cursor-not-allowed opacity-40",
            )}
            style={{
              background: isSubmitting
                ? "rgba(255,255,255,0.05)"
                : "linear-gradient(135deg, rgba(88,28,135,0.55), rgba(59,130,246,0.35))",
              border: "1px solid rgba(139,92,246,0.35)",
              color: "var(--color-text-primary)",
            }}
          >
            {isSubmitting ? (
              <Loader className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            {isSubmitting ? "Starting…" : "Start Quantization"}
          </button>
        </form>
      </div>

      {/* ── Active jobs ── */}
      <div
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
        <div className="mb-3 flex items-center justify-between">
          <SectionLabel icon={Package}>Quantization jobs</SectionLabel>
          <button
            type="button"
            onClick={() => void fetchJobs()}
            disabled={jobsLoading || !client}
            className="rounded-lg p-1 opacity-50 transition-opacity hover:opacity-100 disabled:cursor-not-allowed"
            aria-label="Refresh jobs"
          >
            <RefreshCw
              className={cn("h-3.5 w-3.5", jobsLoading && "animate-spin")}
              style={{ color: "var(--color-text-muted)" }}
            />
          </button>
        </div>

        {jobsError && (
          <p
            className="mb-3 text-[11px]"
            style={{ color: "var(--color-neon-red)" }}
          >
            {jobsError}
          </p>
        )}

        {jobs.length === 0 && !jobsLoading && !jobsError && (
          <div className="flex flex-col items-center gap-2 py-8">
            <Package
              className="h-8 w-8 opacity-20"
              style={{ color: "var(--color-text-muted)" }}
            />
            <p
              className="text-[11px]"
              style={{ color: "var(--color-text-muted)" }}
            >
              No quantization jobs
            </p>
          </div>
        )}

        {jobs.length > 0 && (
          <div className="flex flex-col gap-2">
            {/* Active first */}
            <AnimatePresence mode="popLayout">
              {activeJobs.map((job) => (
                <JobCard key={job.job_id} job={job} />
              ))}
            </AnimatePresence>

            {/* Divider between active + done */}
            {activeJobs.length > 0 && doneJobs.length > 0 && (
              <div
                className="my-1 h-px"
                style={{
                  background:
                    "linear-gradient(90deg, transparent, rgba(139,92,246,0.2), transparent)",
                }}
              />
            )}

            <AnimatePresence mode="popLayout">
              {doneJobs.map((job) => (
                <JobCard key={job.job_id} job={job} />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.div>
  );
}

import { useCallback, useEffect, useRef, useState } from "react";
import { daemonClient } from "../lib/daemonClient";
import type { DaemonConnectionOptions } from "../types";

interface BackgroundJob {
  processId: string;
  sessionId?: string;
  command?: string;
  status?: string;
  startedAt?: string;
  exitCode?: number | null;
}

interface BackgroundJobOutput {
  processId: string;
  lines: string[];
}

interface BackgroundJobsPageProps {
  connection: DaemonConnectionOptions;
}

export function BackgroundJobsPage({ connection }: BackgroundJobsPageProps) {
  const [jobs, setJobs] = useState<BackgroundJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [output, setOutput] = useState<BackgroundJobOutput | null>(null);
  const [outputLoading, setOutputLoading] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const refreshTimerRef = useRef<number | null>(null);

  const showNotice = useCallback((msg: string) => {
    setActionNotice(msg);
    window.setTimeout(() => setActionNotice(null), 3000);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await daemonClient.listBackground(connection);
      setJobs(
        (response.processes ?? []) as BackgroundJob[],
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [connection]);

  const fetchOutput = useCallback(
    async (processId: string) => {
      setOutputLoading(true);
      try {
        const response = await daemonClient.backgroundOutput(connection, processId, {
          limit: 200,
        });
        const chunks = (response as unknown as { chunks?: Array<{ text?: string }> }).chunks ?? [];
        const lines = chunks.map((c) => c.text ?? "").filter(Boolean);
        setOutput({ processId, lines });
      } catch (err) {
        setOutput({
          processId,
          lines: [`Error fetching output: ${err instanceof Error ? err.message : String(err)}`],
        });
      } finally {
        setOutputLoading(false);
      }
    },
    [connection],
  );

  const killJob = useCallback(
    async (processId: string) => {
      try {
        await daemonClient.killBackground(connection, processId);
        showNotice(`Killed ${processId}`);
        await refresh();
        if (selectedJobId === processId) {
          setSelectedJobId(null);
          setOutput(null);
        }
      } catch (err) {
        showNotice(`Kill failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
    [connection, refresh, selectedJobId, showNotice],
  );

  const selectJob = useCallback(
    (processId: string) => {
      setSelectedJobId(processId);
      void fetchOutput(processId);
    },
    [fetchOutput],
  );

  useEffect(() => {
    void refresh();
    refreshTimerRef.current = window.setInterval(() => {
      void refresh();
    }, 5000);
    return () => {
      if (refreshTimerRef.current !== null) {
        window.clearInterval(refreshTimerRef.current);
      }
    };
  }, [refresh]);

  useEffect(() => {
    if (!selectedJobId) return;
    void fetchOutput(selectedJobId);
  }, [selectedJobId, fetchOutput]);

  const selectedJob = jobs.find((job) => job.processId === selectedJobId) ?? null;

  return (
    <div className="background-jobs-page">
      <header className="jobs-page-header">
        <div>
          <h2>Background Jobs</h2>
          <p>
            Daemon-managed background processes. {jobs.length} job
            {jobs.length !== 1 ? "s" : ""}.
          </p>
        </div>
        <button
          type="button"
          className="refresh-btn"
          onClick={() => void refresh()}
          disabled={loading}
          aria-label="Refresh background jobs"
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </header>

      {actionNotice ? (
        <div className="jobs-notice" role="status" aria-live="polite">
          {actionNotice}
        </div>
      ) : null}

      {error ? (
        <div className="jobs-error" role="alert">
          <strong>Failed to load jobs:</strong> {error}
          <button type="button" onClick={() => void refresh()}>
            Retry
          </button>
        </div>
      ) : null}

      <div className="jobs-layout">
        <div className="jobs-list" role="list" aria-label="Background jobs">
          {jobs.length === 0 && !loading ? (
            <p className="jobs-empty">No background jobs running.</p>
          ) : (
            jobs.map((job) => (
              <div
                key={job.processId}
                className={`job-row ${selectedJobId === job.processId ? "selected" : ""}`}
                role="listitem"
              >
                <button
                  type="button"
                  className="job-select"
                  onClick={() => selectJob(job.processId)}
                  aria-pressed={selectedJobId === job.processId}
                >
                  <span className="job-id">{job.processId}</span>
                  <span
                    className={`job-status status-${job.status ?? "unknown"}`}
                  >
                    {job.status ?? "unknown"}
                  </span>
                  {job.command ? (
                    <span className="job-command">{job.command}</span>
                  ) : null}
                </button>
                <button
                  type="button"
                  className="job-kill-btn"
                  onClick={() => void killJob(job.processId)}
                  aria-label={`Kill job ${job.processId}`}
                  title="Kill process"
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </div>

        <div className="job-output-panel">
          {selectedJob ? (
            <>
              <header className="output-header">
                <h3>{selectedJob.processId}</h3>
                {selectedJob.command ? (
                  <code className="output-command">{selectedJob.command}</code>
                ) : null}
                <button
                  type="button"
                  className="refresh-output-btn"
                  onClick={() => void fetchOutput(selectedJob.processId)}
                  disabled={outputLoading}
                >
                  {outputLoading ? "Loading…" : "Refresh Output"}
                </button>
              </header>
              <pre
                className="output-log"
                aria-label="Job output"
                aria-live="polite"
              >
                {output?.lines.join("\n") ?? ""}
              </pre>
            </>
          ) : (
            <div className="output-placeholder">
              <p>Select a job to view its output.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

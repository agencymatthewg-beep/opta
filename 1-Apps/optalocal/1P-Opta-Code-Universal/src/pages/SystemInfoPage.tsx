import { useSystemInfo } from "../hooks/useSystemInfo";
import type { DaemonConnectionOptions } from "../types";

interface SystemInfoPageProps {
  connection: DaemonConnectionOptions;
}

export function SystemInfoPage({ connection }: SystemInfoPageProps) {
  const { info, loading, updating, error, updateMessage, refresh, runDoctor, runUpdate } =
    useSystemInfo(connection);

  const statusColor = {
    pass: "text-emerald-400",
    warn: "text-amber-400",
    fail: "text-red-400",
    skip: "text-zinc-500",
  } as const;

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <div className="st-status-banner st-status-banner-error">{error}</div>
      )}
      {updateMessage && (
        <div className="st-status-banner st-status-banner-success">{updateMessage}</div>
      )}

      {/* Version section */}
      <div className="st-fieldset flex flex-col gap-3">
        <p className="st-label">Version</p>
        {loading ? (
          <p className="text-xs text-zinc-500">Checking…</p>
        ) : info ? (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-zinc-400">
            <dt>Current</dt>
            <dd className="text-gray-50 font-mono">{info.currentVersion}</dd>
            <dt>Latest</dt>
            <dd className={`font-mono ${info.latestVersion ? "text-gray-50" : "text-zinc-600"}`}>
              {info.latestVersion ?? "Unknown"}
            </dd>
            <dt>Status</dt>
            <dd>
              {info.upToDate === true && (
                <span className="text-emerald-400">Up to date</span>
              )}
              {info.upToDate === false && (
                <span className="text-amber-400">Update available</span>
              )}
              {info.upToDate === null && (
                <span className="text-zinc-500">Unknown</span>
              )}
            </dd>
          </dl>
        ) : (
          <p className="text-xs text-zinc-500">No version data. Run doctor below.</p>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading || updating}
            className="opta-studio-btn-secondary text-sm"
          >
            {loading ? "Checking…" : "Refresh"}
          </button>
          {info?.updateAvailable && (
            <button
              type="button"
              onClick={() => void runUpdate()}
              disabled={updating || loading}
              className="opta-studio-btn text-sm"
            >
              {updating ? "Updating…" : "Install update"}
            </button>
          )}
        </div>
      </div>

      {/* Doctor checks */}
      <div className="st-fieldset flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="st-label">Doctor checks</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void runDoctor(false)}
              disabled={loading || updating}
              className="opta-studio-btn-secondary text-xs"
            >
              Run doctor
            </button>
            <button
              type="button"
              onClick={() => void runDoctor(true)}
              disabled={loading || updating}
              className="opta-studio-btn text-xs"
            >
              Run doctor --fix
            </button>
          </div>
        </div>

        {info && (
          <div className="flex gap-4 text-xs text-zinc-500 mb-1">
            <span className="text-emerald-400">{info.doctorSummary.passed} passed</span>
            {info.doctorSummary.warnings > 0 && (
              <span className="text-amber-400">{info.doctorSummary.warnings} warnings</span>
            )}
            {info.doctorSummary.failures > 0 && (
              <span className="text-red-400">{info.doctorSummary.failures} failures</span>
            )}
          </div>
        )}

        <div className="flex flex-col gap-1">
          {info?.checks.length === 0 && !loading && (
            <p className="text-xs text-zinc-500">Run doctor to see check results.</p>
          )}
          {info?.checks.map((check) => (
            <div
              key={check.name}
              className="flex flex-col gap-0.5 p-2.5 rounded-lg bg-white/5 border border-[var(--opta-border)]"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-gray-50">{check.name}</span>
                <span className={`text-xs font-semibold uppercase ${statusColor[check.status]}`}>
                  {check.status}
                </span>
              </div>
              {check.message && (
                <p className="text-xs text-zinc-400">{check.message}</p>
              )}
              {check.fix && (
                <p className="text-xs text-zinc-500 font-mono mt-0.5">{check.fix}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

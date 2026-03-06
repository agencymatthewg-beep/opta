// TODO: UI design — Gemini will implement the visual design for this page.
// Backend is fully wired: search, export, delete, session detail.
import { useState } from "react";
import { useSessionsManager } from "../hooks/useSessionsManager";
import { daemonClient } from "../lib/daemonClient";
import type { DaemonConnectionOptions, SessionDetail } from "../types";

interface SessionMemoryPageProps {
  connection: DaemonConnectionOptions;
}

export function SessionMemoryPage({ connection }: SessionMemoryPageProps) {
  const { results, totalCount, searching, exporting, deleting, error, search, exportSession, deleteSession, clearResults } =
    useSessionsManager(connection);

  const [query, setQuery] = useState("");
  const [selectedSession, setSelectedSession] = useState<SessionDetail | null>(null);
  const [exportFormat, setExportFormat] = useState<"json" | "markdown" | "text">("json");
  const [exportedPath, setExportedPath] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleSearch = async () => {
    await search(query.trim(), 100);
    setSelectedSession(null);
  };

  const handleExport = async (sessionId: string) => {
    const result = await exportSession(sessionId, exportFormat);
    if (result) setExportedPath(result.path);
  };

  const handleDelete = async (sessionId: string) => {
    await deleteSession(sessionId);
    if (selectedSession?.sessionId === sessionId) setSelectedSession(null);
    setConfirmDeleteId(null);
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Search bar */}
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void handleSearch()}
          placeholder="Search sessions by title, workspace, or ID…"
          className="opta-studio-input flex-1"
        />
        <button
          type="button"
          onClick={() => void handleSearch()}
          disabled={searching}
          className="opta-studio-btn"
        >
          {searching ? "Searching…" : "Search"}
        </button>
        {results.length > 0 && (
          <button type="button" onClick={clearResults} className="opta-studio-btn-secondary">
            Clear
          </button>
        )}
      </div>

      {error && (
        <div className="st-status-banner st-status-banner-error">{error}</div>
      )}

      {exportedPath && (
        <div className="st-status-banner st-status-banner-success">
          Exported to: <code className="font-mono text-xs">{exportedPath}</code>
        </div>
      )}

      {/* Results header */}
      {results.length > 0 && (
        <div className="text-xs text-zinc-500">
          Showing {results.length} of {totalCount} sessions
        </div>
      )}

      {/* Session list + detail pane */}
      <div className="flex gap-4 flex-1 min-h-0 overflow-hidden">
        {/* List */}
        <div className="flex flex-col gap-1 flex-1 overflow-y-auto min-w-0">
          {results.length === 0 && !searching && query && (
            <div className="text-center text-zinc-500 text-sm py-8">No sessions found.</div>
          )}
          {results.map((session) => (
            <button
              key={session.sessionId}
              type="button"
              onClick={() => setSelectedSession(session)}
              className={`text-left p-3 rounded-lg border transition-colors ${
                selectedSession?.sessionId === session.sessionId
                  ? "border-[var(--opta-primary)] bg-[var(--opta-primary)]/10"
                  : "border-[var(--opta-border)] bg-white/5 hover:bg-white/10"
              }`}
            >
              <div className="font-medium text-sm text-gray-50 truncate">{session.title}</div>
              <div className="text-xs text-zinc-400 truncate">{session.workspace}</div>
              {session.updatedAt && (
                <div className="text-xs text-zinc-600 mt-0.5">{new Date(session.updatedAt).toLocaleString()}</div>
              )}
            </button>
          ))}
        </div>

        {/* Detail pane */}
        {selectedSession && (
          <div className="w-72 shrink-0 flex flex-col gap-3 p-4 rounded-xl border border-[var(--opta-border)] bg-white/5">
            <div>
              <div className="text-sm font-semibold text-gray-50">{selectedSession.title}</div>
              <div className="text-xs text-zinc-400 mt-0.5">{selectedSession.workspace}</div>
              <div className="font-mono text-xs text-zinc-600 mt-1 break-all">{selectedSession.sessionId}</div>
            </div>

            {/* Export controls */}
            <div className="flex flex-col gap-2">
              <label className="st-label">Export format</label>
              <select
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value as "json" | "markdown" | "text")}
                className="opta-studio-input text-sm"
              >
                <option value="json">JSON</option>
                <option value="markdown">Markdown</option>
                <option value="text">Plain text</option>
              </select>
              <button
                type="button"
                onClick={() => void handleExport(selectedSession.sessionId)}
                disabled={exporting}
                className="opta-studio-btn w-full"
              >
                {exporting ? "Exporting…" : "Export session"}
              </button>
            </div>

            {/* Delete */}
            {confirmDeleteId === selectedSession.sessionId ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void handleDelete(selectedSession.sessionId)}
                  disabled={deleting}
                  className="opta-studio-btn flex-1 text-red-400 border-red-500/30"
                >
                  {deleting ? "Deleting…" : "Confirm delete"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDeleteId(null)}
                  className="opta-studio-btn-secondary"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDeleteId(selectedSession.sessionId)}
                className="opta-studio-btn-secondary text-red-400 border-red-500/30 w-full"
              >
                Delete session
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  daemonClient,
  type SessionRetentionPruneResult,
  type SessionSnapshot,
} from "../lib/daemonClient";
import type { DaemonConnectionOptions } from "../types";

interface MemoryCenterPageProps {
  connection: DaemonConnectionOptions;
}

function formatSessionLabel(session: SessionSnapshot): string {
  const title = session.title?.trim();
  if (title) return title;
  return session.sessionId;
}

function formatSessionMeta(session: SessionSnapshot): string {
  const parts: string[] = [];
  if (session.workspace) parts.push(session.workspace);
  if (session.updatedAt) parts.push(new Date(session.updatedAt).toLocaleString());
  return parts.join(" • ");
}

function parseRetentionDays(value: string): number | null {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

export function MemoryCenterPage({ connection }: MemoryCenterPageProps) {
  const [pins, setPins] = useState<SessionSnapshot[]>([]);
  const [pinsLoading, setPinsLoading] = useState(false);
  const [pinsError, setPinsError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SessionSnapshot[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [retentionDays, setRetentionDays] = useState("30");
  const [preservePinned, setPreservePinned] = useState(true);
  const [retentionLoading, setRetentionLoading] = useState(false);
  const [retentionSaving, setRetentionSaving] = useState(false);

  const [pruneLoading, setPruneLoading] = useState(false);
  const [pruneResult, setPruneResult] = useState<SessionRetentionPruneResult | null>(null);

  const [notice, setNotice] = useState<string | null>(null);

  const pinnedIds = useMemo(
    () => new Set(pins.map((session) => session.sessionId)),
    [pins],
  );

  const loadPins = useCallback(async () => {
    setPinsLoading(true);
    setPinsError(null);
    try {
      const nextPins = await daemonClient.sessionsPins(connection);
      setPins(nextPins);
    } catch (error) {
      setPinsError(error instanceof Error ? error.message : String(error));
    } finally {
      setPinsLoading(false);
    }
  }, [connection]);

  const loadRetentionPolicy = useCallback(async () => {
    setRetentionLoading(true);
    try {
      const policy = await daemonClient.sessionsRetentionGet(connection);
      setRetentionDays(String(policy.days));
      setPreservePinned(policy.preservePinned);
    } catch {
      // Keep defaults if daemon policy retrieval fails.
    } finally {
      setRetentionLoading(false);
    }
  }, [connection]);

  useEffect(() => {
    void loadPins();
    void loadRetentionPolicy();
  }, [loadPins, loadRetentionPolicy]);

  const pinSession = useCallback(
    async (sessionId: string) => {
      setPinsError(null);
      try {
        await daemonClient.sessionsPin(connection, sessionId);
        setNotice(`Pinned ${sessionId}.`);
        await loadPins();
      } catch (error) {
        setPinsError(error instanceof Error ? error.message : String(error));
      }
    },
    [connection, loadPins],
  );

  const unpinSession = useCallback(
    async (sessionId: string) => {
      setPinsError(null);
      try {
        await daemonClient.sessionsUnpin(connection, sessionId);
        setNotice(`Unpinned ${sessionId}.`);
        await loadPins();
      } catch (error) {
        setPinsError(error instanceof Error ? error.message : String(error));
      }
    },
    [connection, loadPins],
  );

  const onSearch = useCallback(async () => {
    const query = searchQuery.trim();
    if (!query) {
      setSearchResults([]);
      setSearchError(null);
      return;
    }

    setSearching(true);
    setSearchError(null);
    try {
      const result = await daemonClient.sessionsSearch(connection, query);
      setSearchResults(result);
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : String(error));
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, [connection, searchQuery]);

  const saveRetentionPolicy = useCallback(async () => {
    const days = parseRetentionDays(retentionDays);
    if (days === null) {
      setNotice("Retention days must be a positive integer.");
      return;
    }

    setRetentionSaving(true);
    setNotice(null);
    try {
      const saved = await daemonClient.sessionsRetentionSet(connection, {
        days,
        preservePinned,
      });
      setRetentionDays(String(saved.days));
      setPreservePinned(saved.preservePinned);
      setPruneResult(null);
      setNotice(`Retention policy saved (${saved.days} days).`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setRetentionSaving(false);
    }
  }, [connection, preservePinned, retentionDays]);

  const runPrune = useCallback(
    async (dryRun: boolean) => {
      const days = parseRetentionDays(retentionDays);
      if (days === null) {
        setNotice("Retention days must be a positive integer.");
        return;
      }

      setPruneLoading(true);
      setNotice(null);
      try {
        const result = await daemonClient.sessionsRetentionPrune(connection, {
          days,
          preservePinned,
          dryRun,
        });
        setPruneResult(result);
        setNotice(
          dryRun
            ? `Dry run complete: ${result.pruned} sessions would be pruned.`
            : `Prune complete: ${result.pruned} sessions removed.`,
        );
        if (!dryRun) {
          await loadPins();
        }
      } catch (error) {
        setNotice(error instanceof Error ? error.message : String(error));
      } finally {
        setPruneLoading(false);
      }
    },
    [connection, loadPins, preservePinned, retentionDays],
  );

  return (
    <section className="memory-center-page">
      <header className="memory-center-header">
        <div>
          <h2>Memory Center</h2>
          <p>Pin high-value sessions, tune retention policy, and prune stale memory safely.</p>
        </div>
      </header>

      {notice ? (
        <p className="memory-center-notice" role="status">
          {notice}
        </p>
      ) : null}

      <div className="memory-center-grid">
        <article className="memory-center-card">
          <div className="memory-center-card-header">
            <h3>Pinned Sessions</h3>
            <button type="button" onClick={() => void loadPins()} disabled={pinsLoading}>
              {pinsLoading ? "Refreshing..." : "Refresh pins"}
            </button>
          </div>

          {pinsError ? (
            <p className="memory-center-error" role="alert">
              {pinsError}
            </p>
          ) : null}

          {pins.length === 0 ? (
            <p className="memory-center-empty">No pinned sessions.</p>
          ) : (
            <ul className="memory-center-list">
              {pins.map((session) => (
                <li key={session.sessionId}>
                  <div>
                    <strong>{formatSessionLabel(session)}</strong>
                    <span>{formatSessionMeta(session) || session.sessionId}</span>
                  </div>
                  <button
                    type="button"
                    aria-label={`Unpin ${session.sessionId}`}
                    onClick={() => void unpinSession(session.sessionId)}
                  >
                    Unpin
                  </button>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="memory-center-card">
          <div className="memory-center-card-header">
            <h3>Recall Search</h3>
          </div>

          <label className="memory-center-field" htmlFor="memory-search-query">
            Recall search query
          </label>
          <div className="memory-center-inline">
            <input
              id="memory-search-query"
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search local session history"
            />
            <button type="button" onClick={() => void onSearch()} disabled={searching}>
              {searching ? "Searching..." : "Search recall"}
            </button>
          </div>

          {searchError ? (
            <p className="memory-center-error" role="alert">
              {searchError}
            </p>
          ) : null}

          {searchQuery.trim().length > 0 && searchResults.length === 0 && !searching ? (
            <p className="memory-center-empty">No sessions matched your query.</p>
          ) : null}

          {searchResults.length > 0 ? (
            <ul className="memory-center-list">
              {searchResults.map((session) => {
                const pinned = pinnedIds.has(session.sessionId);
                return (
                  <li key={session.sessionId}>
                    <div>
                      <strong>{formatSessionLabel(session)}</strong>
                      <span>{formatSessionMeta(session) || session.sessionId}</span>
                    </div>
                    <button
                      type="button"
                      aria-label={`Pin ${session.sessionId}`}
                      disabled={pinned}
                      onClick={() => void pinSession(session.sessionId)}
                    >
                      {pinned ? "Pinned" : "Pin"}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </article>

        <article className="memory-center-card">
          <div className="memory-center-card-header">
            <h3>Retention Policy</h3>
            <span className="memory-center-subtle">
              {retentionLoading ? "Loading policy..." : "Daemon-backed policy"}
            </span>
          </div>

          <label className="memory-center-field" htmlFor="memory-retention-days">
            Retention days
          </label>
          <input
            id="memory-retention-days"
            type="number"
            min={1}
            value={retentionDays}
            onChange={(event) => setRetentionDays(event.target.value)}
          />

          <label className="memory-center-checkbox">
            <input
              type="checkbox"
              checked={preservePinned}
              onChange={(event) => setPreservePinned(event.target.checked)}
            />
            Preserve pinned sessions
          </label>

          <div className="memory-center-actions">
            <button
              type="button"
              onClick={() => void saveRetentionPolicy()}
              disabled={retentionSaving}
            >
              {retentionSaving ? "Saving..." : "Save retention policy"}
            </button>
          </div>
        </article>

        <article className="memory-center-card">
          <div className="memory-center-card-header">
            <h3>Retention Prune</h3>
            <span className="memory-center-subtle">Preview before apply</span>
          </div>

          <div className="memory-center-actions">
            <button
              type="button"
              onClick={() => void runPrune(true)}
              disabled={pruneLoading}
            >
              {pruneLoading ? "Running..." : "Preview prune"}
            </button>
            <button
              type="button"
              className="danger"
              onClick={() => void runPrune(false)}
              disabled={pruneLoading}
            >
              Apply prune
            </button>
          </div>

          {pruneResult ? (
            <div className="memory-center-prune-summary" role="status">
              <p>
                {pruneResult.dryRun ? "Dry run" : "Applied"}: {pruneResult.pruned} pruned,
                {" "}
                {pruneResult.kept} kept, {pruneResult.listed} listed.
              </p>
              {pruneResult.prunedSessions.length > 0 ? (
                <ul>
                  {pruneResult.prunedSessions.map((session) => (
                    <li key={session.sessionId}>{formatSessionLabel(session)}</li>
                  ))}
                </ul>
              ) : (
                <p className="memory-center-empty">No sessions selected for pruning.</p>
              )}
            </div>
          ) : null}
        </article>
      </div>
    </section>
  );
}

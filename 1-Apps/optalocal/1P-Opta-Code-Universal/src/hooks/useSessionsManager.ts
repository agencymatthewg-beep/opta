import { useCallback, useState } from "react";
import { daemonClient } from "../lib/daemonClient";
import type { DaemonConnectionOptions, SessionDetail, SessionExportResult } from "../types";

export interface UseSessionsManagerState {
  results: SessionDetail[];
  totalCount: number;
  searching: boolean;
  exporting: boolean;
  deleting: boolean;
  error: string | null;
  search: (query: string, limit?: number) => Promise<void>;
  exportSession: (sessionId: string, format?: "json" | "markdown" | "text", outputPath?: string) => Promise<SessionExportResult | null>;
  deleteSession: (sessionId: string) => Promise<void>;
  clearResults: () => void;
}

export function useSessionsManager(connection: DaemonConnectionOptions): UseSessionsManagerState {
  const [results, setResults] = useState<SessionDetail[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [searching, setSearching] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(
    async (query: string, limit = 50) => {
      setSearching(true);
      setError(null);
      try {
        const result = await daemonClient.sessionSearch(connection, query, limit);
        setResults(result.sessions);
        setTotalCount(result.total);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setResults([]);
      } finally {
        setSearching(false);
      }
    },
    [connection],
  );

  const exportSession = useCallback(
    async (
      sessionId: string,
      format: "json" | "markdown" | "text" = "json",
      outputPath?: string,
    ): Promise<SessionExportResult | null> => {
      setExporting(true);
      setError(null);
      try {
        return await daemonClient.sessionExport(connection, sessionId, format, outputPath);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        return null;
      } finally {
        setExporting(false);
      }
    },
    [connection],
  );

  const deleteSession = useCallback(
    async (sessionId: string) => {
      setDeleting(true);
      setError(null);
      try {
        await daemonClient.sessionDelete(connection, sessionId);
        setResults((prev) => prev.filter((s) => s.sessionId !== sessionId));
        setTotalCount((prev) => Math.max(0, prev - 1));
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setDeleting(false);
      }
    },
    [connection],
  );

  const clearResults = useCallback(() => {
    setResults([]);
    setTotalCount(0);
    setError(null);
  }, []);

  return { results, totalCount, searching, exporting, deleting, error, search, exportSession, deleteSession, clearResults };
}

import { useCallback, useEffect, useRef, useState } from "react";
import { daemonClient } from "../lib/daemonClient";
import type { DaemonConnectionOptions } from "../types";

export interface OperationDefinition {
  id: string;
  title: string;
  description: string;
  safety: "read" | "write" | "dangerous";
}

export interface OperationResult {
  ok: boolean;
  id: string;
  safety: string;
  result?: unknown;
  error?: { code: string; message: string; details?: unknown };
}

export interface UseOperationsState {
  operations: OperationDefinition[];
  loading: boolean;
  error: string | null;
  running: boolean;
  lastResult: OperationResult | null;
  runOperation: (
    id: string,
    input: Record<string, unknown>,
    confirmDangerous?: boolean,
  ) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useOperations(
  connection: DaemonConnectionOptions,
): UseOperationsState {
  const [operations, setOperations] = useState<OperationDefinition[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [lastResult, setLastResult] = useState<OperationResult | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    try {
      const response = await daemonClient.listOperations(connection);
      if (!controller.signal.aborted) {
        setOperations(response.operations as unknown as OperationDefinition[]);
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [connection]);

  useEffect(() => {
    void refresh();
    return () => {
      abortRef.current?.abort();
    };
  }, [refresh]);

  const runOperation = useCallback(
    async (
      id: string,
      input: Record<string, unknown>,
      confirmDangerous?: boolean,
    ) => {
      setRunning(true);
      setLastResult(null);
      try {
        const payload: Record<string, unknown> = { input };
        if (confirmDangerous) payload.confirmDangerous = true;
        const result = await daemonClient.runOperation(connection, id, payload);
        setLastResult(result as unknown as OperationResult);
      } catch (err) {
        setLastResult({
          ok: false,
          id,
          safety: "read",
          error: {
            code: "client_error",
            message: err instanceof Error ? err.message : String(err),
          },
        });
      } finally {
        setRunning(false);
      }
    },
    [connection],
  );

  return { operations, loading, error, running, lastResult, runOperation, refresh };
}

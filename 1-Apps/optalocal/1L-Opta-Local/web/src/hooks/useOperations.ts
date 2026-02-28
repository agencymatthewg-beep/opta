"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  OperationDefinition,
  OperationResponse,
  OptaDaemonClient,
} from "@/lib/opta-daemon-client";
import type { DaemonOperationId } from "@opta/daemon-client/types";

interface OperationExecutePayload extends Record<string, unknown> {
  input: Record<string, unknown>;
  confirmDangerous?: boolean;
}

export interface UseOperationsReturn {
  operations: OperationDefinition[];
  isLoading: boolean;
  loadError: string | null;
  isRunning: boolean;
  runError: string | null;
  lastResult: OperationResponse | null;
  refresh: () => Promise<void>;
  runOperation: (
    id: string,
    input: Record<string, unknown>,
    confirmDangerous?: boolean,
  ) => Promise<OperationResponse | null>;
}

export function useOperations(client: OptaDaemonClient | null): UseOperationsReturn {
  const [operations, setOperations] = useState<OperationDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<OperationResponse | null>(null);
  const refreshAbortRef = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    refreshAbortRef.current?.abort();
    const controller = new AbortController();
    refreshAbortRef.current = controller;

    if (!client) {
      setOperations([]);
      setLoadError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await client.listOperations();
      if (controller.signal.aborted) return;

      const ordered = [...response.operations].sort((a, b) =>
        a.id.localeCompare(b.id),
      );
      setOperations(ordered);
    } catch (error) {
      if (controller.signal.aborted) return;
      setLoadError(
        error instanceof Error ? error.message : "Failed to load operations",
      );
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
      }
    }
  }, [client]);

  useEffect(() => {
    void refresh();
    return () => {
      refreshAbortRef.current?.abort();
    };
  }, [refresh]);

  const runOperation = useCallback(
    async (
      id: string,
      input: Record<string, unknown>,
      confirmDangerous?: boolean,
    ): Promise<OperationResponse | null> => {
      if (!client) {
        const message = "Operations client unavailable.";
        setRunError(message);
        const result: OperationResponse = {
          ok: false,
          id: id as DaemonOperationId,
          safety: "read",
          error: { code: "CLIENT_UNAVAILABLE", message },
        };
        setLastResult(result);
        return result;
      }

      setIsRunning(true);
      setRunError(null);
      setLastResult(null);

      try {
        const payload: OperationExecutePayload = { input };
        if (confirmDangerous) payload.confirmDangerous = true;

        const response = await client.runOperation(id, payload);
        setLastResult(response);
        if (!response.ok) {
          setRunError(response.error.message);
        }
        return response;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Operation failed";
        setRunError(message);
        const result: OperationResponse = {
          ok: false,
          id: id as DaemonOperationId,
          safety: "read",
          error: { code: "CLIENT_ERROR", message },
        };
        setLastResult(result);
        return result;
      } finally {
        setIsRunning(false);
      }
    },
    [client],
  );

  return {
    operations,
    isLoading,
    loadError,
    isRunning,
    runError,
    lastResult,
    refresh,
    runOperation,
  };
}

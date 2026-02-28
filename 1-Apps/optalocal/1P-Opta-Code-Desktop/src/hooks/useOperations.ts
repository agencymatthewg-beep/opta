import { useCallback, useEffect, useRef, useState } from "react";
import { daemonClient } from "../lib/daemonClient";
import type { DaemonConnectionOptions } from "../types";

type OperationSafety = "read" | "write" | "dangerous";

interface JsonSchemaProperty {
  type?: string | string[];
  title?: string;
  description?: string;
  default?: unknown;
  enum?: unknown[];
}

export interface OperationInputSchema {
  type?: string;
  required?: string[];
  properties?: Record<string, JsonSchemaProperty>;
}

export interface OperationDefinition {
  id: string;
  title: string;
  description: string;
  safety: OperationSafety;
  inputSchema?: OperationInputSchema;
  outputSchema?: unknown;
}

export interface OperationResult {
  ok: boolean;
  id: string;
  safety: OperationSafety;
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
        setOperations(normalizeOperationsResponse(response));
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
      const operation = operations.find((candidate) => candidate.id === id);
      const fallbackSafety = operation?.safety ?? "read";
      setRunning(true);
      setLastResult(null);
      try {
        const payload: Record<string, unknown> = { input };
        if (confirmDangerous) payload.confirmDangerous = true;
        const result: unknown = await daemonClient.runOperation(
          connection,
          id,
          payload,
        );
        setLastResult(normalizeOperationResult(result, id, fallbackSafety));
      } catch (err) {
        setLastResult({
          ok: false,
          id,
          safety: fallbackSafety,
          error: {
            code: "client_error",
            message: err instanceof Error ? err.message : String(err),
          },
        });
      } finally {
        setRunning(false);
      }
    },
    [connection, operations],
  );

  return { operations, loading, error, running, lastResult, runOperation, refresh };
}

function normalizeOperationsResponse(response: unknown): OperationDefinition[] {
  if (!isRecord(response) || !Array.isArray(response.operations)) return [];
  return response.operations
    .map(normalizeOperationDefinition)
    .filter((operation): operation is OperationDefinition => operation !== null);
}

function normalizeOperationDefinition(
  operation: unknown,
): OperationDefinition | null {
  if (!isRecord(operation)) return null;
  const id =
    typeof operation.id === "string" && operation.id.trim().length > 0
      ? operation.id
      : "unknown.operation";
  const title =
    typeof operation.title === "string" && operation.title.trim().length > 0
      ? operation.title
      : id;
  const description =
    typeof operation.description === "string" &&
    operation.description.trim().length > 0
      ? operation.description
      : "No description provided.";

  return {
    id,
    title,
    description,
    safety: normalizeSafety(operation.safety),
    inputSchema: normalizeInputSchema(operation.inputSchema),
    outputSchema: operation.outputSchema,
  };
}

function normalizeSafety(safety: unknown): OperationSafety {
  if (safety === "read" || safety === "write" || safety === "dangerous") {
    return safety;
  }
  return "read";
}

function normalizeInputSchema(schema: unknown): OperationInputSchema | undefined {
  if (!isRecord(schema)) return undefined;

  const properties = isRecord(schema.properties)
    ? Object.entries(schema.properties).reduce<Record<string, JsonSchemaProperty>>(
        (accumulator, [key, value]) => {
          if (!isRecord(value)) return accumulator;
          accumulator[key] = {
            type: asStringOrStringArray(value.type),
            title: typeof value.title === "string" ? value.title : undefined,
            description:
              typeof value.description === "string"
                ? value.description
                : undefined,
            default: value.default,
            enum: Array.isArray(value.enum) ? value.enum : undefined,
          };
          return accumulator;
        },
        {},
      )
    : undefined;

  const required = Array.isArray(schema.required)
    ? schema.required.filter((entry): entry is string => typeof entry === "string")
    : undefined;

  if (!properties || Object.keys(properties).length === 0) return undefined;

  return {
    type: typeof schema.type === "string" ? schema.type : "object",
    required,
    properties,
  };
}

function normalizeOperationResult(
  response: unknown,
  id: string,
  safety: OperationSafety,
): OperationResult {
  if (!isRecord(response)) {
    return {
      ok: false,
      id,
      safety,
      error: normalizeOperationError(response),
    };
  }

  const normalizedId =
    typeof response.id === "string" && response.id.length > 0 ? response.id : id;
  const normalizedSafety = normalizeSafety(response.safety ?? safety);
  const hasOk = typeof response.ok === "boolean";
  const hasResult = hasOwn(response, "result");
  const hasError = hasOwn(response, "error");
  const ok = hasOk ? response.ok : !hasError;

  if (ok) {
    const result = hasResult ? response.result : response;
    return { ok: true, id: normalizedId, safety: normalizedSafety, result };
  }

  return {
    ok: false,
    id: normalizedId,
    safety: normalizedSafety,
    error: normalizeOperationError(response.error),
  };
}

function normalizeOperationError(error: unknown): {
  code: string;
  message: string;
  details?: unknown;
} {
  if (typeof error === "string") {
    return { code: "operation_error", message: error };
  }
  if (isRecord(error)) {
    const code = typeof error.code === "string" ? error.code : "operation_error";
    const message =
      typeof error.message === "string"
        ? error.message
        : "Operation failed without a structured error message.";
    return {
      code,
      message,
      details: hasOwn(error, "details") ? error.details : error,
    };
  }
  return {
    code: "operation_error",
    message: "Operation failed without a structured error payload.",
    details: error,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hasOwn(object: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function asStringOrStringArray(
  value: unknown,
): string | string[] | undefined {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return undefined;
  const filtered = value.filter((entry): entry is string => typeof entry === "string");
  return filtered.length > 0 ? filtered : undefined;
}

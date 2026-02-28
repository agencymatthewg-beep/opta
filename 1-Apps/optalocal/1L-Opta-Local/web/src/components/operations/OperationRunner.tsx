"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Play, ShieldAlert } from "lucide-react";
import { cn } from "@opta/ui";
import {
  OptaStatusPill,
  OptaSurface,
} from "@/components/shared/OptaPrimitives";
import type {
  OperationDefinition,
  OperationResponse,
} from "@/lib/opta-daemon-client";

interface OperationRunnerProps {
  operation: OperationDefinition;
  isRunning: boolean;
  runError: string | null;
  lastResult: OperationResponse | null;
  onRun: (
    id: string,
    input: Record<string, unknown>,
    confirmDangerous?: boolean,
  ) => Promise<OperationResponse | null>;
}

function statusFromSafety(safety?: OperationDefinition["safety"]) {
  if (safety === "dangerous") return "danger";
  if (safety === "write") return "warning";
  if (safety === "read") return "success";
  return "neutral";
}

export function OperationRunner({
  operation,
  isRunning,
  runError,
  lastResult,
  onRun,
}: OperationRunnerProps) {
  const [inputJson, setInputJson] = useState("{}");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [confirmDangerous, setConfirmDangerous] = useState(false);

  useEffect(() => {
    setInputJson("{}");
    setJsonError(null);
    setConfirmDangerous(false);
  }, [operation.id]);

  const safety = operation.safety ?? "read";
  const isDangerous = safety === "dangerous";
  const operationTitle =
    typeof operation.title === "string" ? operation.title : operation.id;
  const operationDescription =
    typeof operation.description === "string"
      ? operation.description
      : "No description available.";

  const resultText = useMemo(() => {
    if (!lastResult) return "";
    return JSON.stringify(lastResult, null, 2);
  }, [lastResult]);

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setJsonError(null);

      let parsed: unknown;
      try {
        parsed = JSON.parse(inputJson);
      } catch (error) {
        setJsonError(
          error instanceof Error
            ? `Invalid JSON: ${error.message}`
            : "Invalid JSON payload",
        );
        return;
      }

      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        setJsonError("Input must be a JSON object.");
        return;
      }

      await onRun(operation.id, parsed as Record<string, unknown>, confirmDangerous);
    },
    [confirmDangerous, inputJson, onRun, operation.id],
  );

  return (
    <OptaSurface hierarchy="raised" padding="md" className="rounded-2xl space-y-4">
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-semibold text-text-primary">{operationTitle}</h3>
          <p className="mt-1 text-sm text-text-secondary">
            {operationDescription}
          </p>
        </div>
        <OptaStatusPill
          label={safety}
          status={statusFromSafety(safety)}
          className="capitalize"
        />
      </div>

      <form className="space-y-3" onSubmit={(event) => void handleSubmit(event)}>
        <label className="block space-y-2 text-xs font-medium uppercase tracking-wider text-text-muted">
          <span>Input Payload (JSON object)</span>
          <textarea
            value={inputJson}
            onChange={(event) => {
              setInputJson(event.target.value);
              setJsonError(null);
            }}
            rows={7}
            spellCheck={false}
            className={cn(
              "w-full resize-y rounded-xl border border-opta-border bg-opta-surface/40 px-3 py-2",
              "font-mono text-xs text-text-primary outline-none transition-colors",
              "focus:border-primary/60 focus:ring-1 focus:ring-primary/40",
            )}
            aria-label={`JSON payload for ${operation.id}`}
          />
        </label>

        {jsonError ? (
          <div className="flex items-start gap-2 rounded-xl border border-neon-red/30 bg-neon-red/10 px-3 py-2 text-xs text-neon-red">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{jsonError}</span>
          </div>
        ) : null}

        {isDangerous ? (
          <label className="flex items-start gap-2 rounded-xl border border-neon-amber/25 bg-neon-amber/10 px-3 py-2 text-xs text-neon-amber">
            <input
              type="checkbox"
              checked={confirmDangerous}
              onChange={(event) => setConfirmDangerous(event.target.checked)}
              className="mt-0.5"
            />
            <span className="flex-1">
              Confirm dangerous execution (`confirmDangerous=true`).
            </span>
            <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
          </label>
        ) : null}

        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={isRunning || (isDangerous && !confirmDangerous)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
              "bg-primary/20 text-primary hover:bg-primary/30",
              "disabled:cursor-not-allowed disabled:opacity-60",
            )}
          >
            <Play className="h-3.5 w-3.5" />
            <span>{isRunning ? "Running…" : `Run ${operation.id}`}</span>
          </button>
          {runError ? (
            <span className="text-xs text-neon-red">{runError}</span>
          ) : null}
        </div>
      </form>

      {lastResult ? (
        <div className="space-y-2 rounded-xl border border-opta-border bg-opta-bg/40 p-3">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="font-medium uppercase tracking-wider text-text-muted">
              Last Result
            </span>
            <OptaStatusPill
              label={lastResult.ok ? "success" : "error"}
              status={lastResult.ok ? "success" : "danger"}
            />
          </div>
          <pre className="max-h-80 overflow-auto rounded-lg bg-opta-bg/80 p-3 text-xs text-text-secondary">
            {resultText}
          </pre>
        </div>
      ) : null}
    </OptaSurface>
  );
}

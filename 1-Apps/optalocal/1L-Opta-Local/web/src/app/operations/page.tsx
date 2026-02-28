"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, RefreshCw, TerminalSquare } from "lucide-react";
import { cn } from "@opta/ui";
import { OperationRunner } from "@/components/operations/OperationRunner";
import { useConnectionContextSafe } from "@/components/shared/ConnectionProvider";
import {
  OptaStatusPill,
  OptaSurface,
} from "@/components/shared/OptaPrimitives";
import { useOperations } from "@/hooks/useOperations";
import {
  OptaDaemonClient,
  type OperationDefinition,
} from "@/lib/opta-daemon-client";

type SafetyFilter = "all" | "read" | "write" | "dangerous";

function groupOperations(
  operations: OperationDefinition[],
): Map<string, OperationDefinition[]> {
  const groups = new Map<string, OperationDefinition[]>();
  for (const operation of operations) {
    const family = operation.id.includes(".")
      ? operation.id.split(".")[0]
      : operation.id;
    const key = family ?? operation.id;
    const existing = groups.get(key);
    if (existing) {
      existing.push(operation);
    } else {
      groups.set(key, [operation]);
    }
  }
  return groups;
}

function pillFromSafety(safety?: OperationDefinition["safety"]) {
  if (safety === "dangerous") return "danger";
  if (safety === "write") return "warning";
  if (safety === "read") return "success";
  return "neutral";
}

export default function OperationsPage() {
  const connection = useConnectionContextSafe();

  const envBaseUrl = process.env.NEXT_PUBLIC_OPTA_DAEMON_URL?.trim() ?? "";
  const envToken = process.env.NEXT_PUBLIC_OPTA_DAEMON_TOKEN?.trim() ?? "";
  const baseUrl = envBaseUrl || connection?.baseUrl || "";
  const token = envToken || connection?.adminKey || "";
  const usingFallbackToken = !envToken && Boolean(connection?.adminKey);

  const client = useMemo(() => {
    if (!baseUrl || !token) return null;
    return new OptaDaemonClient({ baseUrl, token });
  }, [baseUrl, token]);

  const {
    operations,
    isLoading,
    loadError,
    isRunning,
    runError,
    lastResult,
    refresh,
    runOperation,
  } = useOperations(client);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [safetyFilter, setSafetyFilter] = useState<SafetyFilter>("all");

  const filteredOperations = useMemo(() => {
    if (safetyFilter === "all") return operations;
    return operations.filter((operation) => operation.safety === safetyFilter);
  }, [operations, safetyFilter]);

  const groupedOperations = useMemo(
    () => groupOperations(filteredOperations),
    [filteredOperations],
  );

  useEffect(() => {
    if (!filteredOperations.length) {
      if (selectedId !== null) setSelectedId(null);
      return;
    }

    if (!selectedId) {
      setSelectedId(filteredOperations[0]?.id ?? null);
      return;
    }

    const stillVisible = filteredOperations.some(
      (operation) => operation.id === selectedId,
    );
    if (!stillVisible) {
      setSelectedId(filteredOperations[0]?.id ?? null);
    }
  }, [filteredOperations, selectedId]);

  const selectedOperation = useMemo(
    () =>
      filteredOperations.find((operation) => operation.id === selectedId) ??
      null,
    [filteredOperations, selectedId],
  );

  const hasClientConfig = Boolean(baseUrl && token);

  return (
    <main className="flex min-h-screen flex-col">
      <header className="glass border-b border-opta-border px-6 py-3 flex items-center gap-4 flex-shrink-0">
        <Link
          href="/"
          className={cn(
            "p-1.5 rounded-lg transition-colors",
            "text-text-secondary hover:text-text-primary hover:bg-primary/10",
          )}
          aria-label="Back to dashboard"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <TerminalSquare className="w-5 h-5 text-primary" />
        <h1 className="text-lg font-semibold text-text-primary">Operations</h1>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={!hasClientConfig || isLoading}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition-colors",
              "text-text-secondary hover:text-text-primary hover:bg-primary/10",
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
            <span>{isLoading ? "Loading…" : "Refresh"}</span>
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {!hasClientConfig ? (
          <OptaSurface
            hierarchy="raised"
            padding="md"
            className="rounded-2xl border border-neon-amber/25 bg-neon-amber/10 space-y-2"
          >
            <div className="flex items-center gap-2 text-neon-amber">
              <AlertCircle className="h-4 w-4" />
              <p className="text-sm font-medium">Daemon configuration required</p>
            </div>
            <p className="text-sm text-text-secondary">
              Set `NEXT_PUBLIC_OPTA_DAEMON_URL` and `NEXT_PUBLIC_OPTA_DAEMON_TOKEN`
              to enable `/v3/operations`.
            </p>
            {!envToken && connection?.adminKey ? (
              <p className="text-xs text-text-muted">
                Falling back to your connection admin key is unsupported on some
                daemon setups.
              </p>
            ) : null}
          </OptaSurface>
        ) : (
          <>
            {loadError ? (
              <OptaSurface
                hierarchy="raised"
                padding="md"
                className="rounded-2xl border border-neon-red/25 bg-neon-red/10"
              >
                <div className="flex items-start gap-2 text-neon-red">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Failed to load operations</p>
                    <p className="text-xs">{loadError}</p>
                  </div>
                </div>
              </OptaSurface>
            ) : null}

            {usingFallbackToken ? (
              <OptaSurface hierarchy="base" padding="sm" className="rounded-xl">
                <p className="text-xs text-text-muted">
                  Using connection admin key as daemon token fallback.
                </p>
              </OptaSurface>
            ) : null}

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[22rem_minmax(0,1fr)]">
              <OptaSurface hierarchy="raised" padding="md" className="rounded-2xl space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold text-text-primary">
                    Catalog
                  </h2>
                  <OptaStatusPill
                    label={`${filteredOperations.length} ops`}
                    status="info"
                  />
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {(["all", "read", "write", "dangerous"] as const).map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setSafetyFilter(level)}
                      className={cn(
                        "rounded-lg px-2 py-1 text-xs capitalize transition-colors",
                        safetyFilter === level
                          ? "bg-primary/20 text-primary"
                          : "bg-opta-surface/50 text-text-secondary hover:text-text-primary",
                      )}
                    >
                      {level}
                    </button>
                  ))}
                </div>

                <div className="max-h-[60vh] space-y-3 overflow-auto pr-1">
                  {[...groupedOperations.entries()].map(([family, ops]) => (
                    <section key={family} className="space-y-2">
                      <h3 className="text-[10px] uppercase tracking-wider text-text-muted">
                        {family}
                      </h3>
                      <div className="space-y-1">
                        {ops.map((operation) => (
                          <button
                            key={operation.id}
                            type="button"
                            onClick={() => setSelectedId(operation.id)}
                            className={cn(
                              "w-full rounded-xl border px-2.5 py-2 text-left transition-colors",
                              "border-opta-border bg-opta-surface/40 hover:bg-primary/10",
                              selectedId === operation.id &&
                                "border-primary/40 bg-primary/10",
                            )}
                            aria-pressed={selectedId === operation.id}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="truncate font-mono text-xs text-text-primary">
                                {operation.id}
                              </span>
                              <OptaStatusPill
                                label={operation.safety ?? "read"}
                                status={pillFromSafety(operation.safety)}
                                className="capitalize"
                              />
                            </div>
                            <p className="mt-1 line-clamp-2 text-xs text-text-muted">
                              {operation.description ?? "No description"}
                            </p>
                          </button>
                        ))}
                      </div>
                    </section>
                  ))}

                  {!isLoading && !filteredOperations.length ? (
                    <p className="text-sm text-text-muted">
                      No operations available.
                    </p>
                  ) : null}
                </div>
              </OptaSurface>

              {selectedOperation ? (
                <OperationRunner
                  operation={selectedOperation}
                  isRunning={isRunning}
                  runError={runError}
                  lastResult={lastResult}
                  onRun={runOperation}
                />
              ) : (
                <OptaSurface
                  hierarchy="raised"
                  padding="lg"
                  className="rounded-2xl flex items-center justify-center text-center"
                >
                  <p className="text-sm text-text-muted">
                    Select an operation to view details and execute it.
                  </p>
                </OptaSurface>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}

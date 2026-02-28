import { useEffect, useMemo, useState } from "react";
import { OperationRunner } from "../components/OperationRunner";
import { useOperations, type OperationDefinition } from "../hooks/useOperations";
import type { DaemonConnectionOptions } from "../types";

interface OperationsPageProps {
  connection: DaemonConnectionOptions;
}

type SafetyFilter = "all" | "read" | "write" | "dangerous";

function groupByFamily(
  operations: OperationDefinition[],
): Map<string, OperationDefinition[]> {
  const groups = new Map<string, OperationDefinition[]>();
  for (const op of operations) {
    const family = op.id.includes(".") ? op.id.split(".")[0] : op.id;
    const key = family ?? op.id;
    const existing = groups.get(key);
    if (existing) {
      existing.push(op);
    } else {
      groups.set(key, [op]);
    }
  }
  return groups;
}

export function OperationsPage({ connection }: OperationsPageProps) {
  const {
    operations,
    loading,
    error,
    running,
    lastResult,
    runOperation,
    refresh,
  } = useOperations(connection);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [safetyFilter, setSafetyFilter] = useState<SafetyFilter>("all");
  const [query, setQuery] = useState("");

  const safetyCounts = useMemo(() => {
    return operations.reduce(
      (accumulator, operation) => {
        accumulator.all += 1;
        accumulator[operation.safety] += 1;
        return accumulator;
      },
      { all: 0, read: 0, write: 0, dangerous: 0 },
    );
  }, [operations]);

  const filtered = useMemo(
    () => {
      const normalizedQuery = query.trim().toLowerCase();

      return operations.filter((operation) => {
        const passesSafety =
          safetyFilter === "all" || operation.safety === safetyFilter;
        if (!passesSafety) return false;
        if (!normalizedQuery) return true;

        const haystack = `${operation.id} ${operation.title} ${operation.description}`.toLowerCase();
        return haystack.includes(normalizedQuery);
      });
    },
    [operations, query, safetyFilter],
  );

  const grouped = useMemo(
    () =>
      [...groupByFamily(filtered).entries()]
        .map(([family, entries]) => [
          family,
          [...entries].sort((left, right) => left.id.localeCompare(right.id)),
        ] as const)
        .sort((left, right) => left[0].localeCompare(right[0])),
    [filtered],
  );

  const selectedOperation =
    operations.find((op) => op.id === selectedId) ?? null;

  const lastResultForSelected =
    lastResult?.id === selectedId ? lastResult : null;

  useEffect(() => {
    if (!selectedId) return;
    const stillVisible = filtered.some((operation) => operation.id === selectedId);
    if (!stillVisible) {
      setSelectedId(null);
    }
  }, [filtered, selectedId]);

  return (
    <div className="operations-page">
      <header className="operations-page-header">
        <div>
          <h2>Operations Console</h2>
          <p>
            Full CLI command-family access via daemon API.{" "}
            {operations.length} operations available.
          </p>
        </div>

        <div className="operations-filters">
          {(["all", "read", "write", "dangerous"] as const).map((level) => (
            <button
              key={level}
              type="button"
              className={`filter-btn ${safetyFilter === level ? "active" : ""}`}
              onClick={() => setSafetyFilter(level)}
            >
              {level} ({safetyCounts[level]})
            </button>
          ))}
          <label className="operation-input-label">
            Search
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="id, title, description"
              aria-label="Search operations"
            />
          </label>
          <button
            type="button"
            className="refresh-btn"
            onClick={() => void refresh()}
            disabled={loading}
            aria-label="Refresh operation catalog"
          >
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>
      </header>

      {error ? (
        <div className="operations-error" role="alert">
          <strong>Failed to load operations:</strong> {error}
          <button type="button" onClick={() => void refresh()}>
            Retry
          </button>
        </div>
      ) : null}

      <div className="operations-layout">
        <nav className="operations-catalog" aria-label="Operation catalog">
          {grouped.map(([family, ops]) => (
            <section key={family} className="operation-family">
              <h3 className="family-label">
                {family} ({ops.length})
              </h3>
              <ul className="family-list">
                {ops.map((op) => (
                  <li key={op.id}>
                    <button
                      type="button"
                      className={`op-entry ${selectedId === op.id ? "selected" : ""} safety-${op.safety}`}
                      onClick={() =>
                        setSelectedId(selectedId === op.id ? null : op.id)
                      }
                      aria-pressed={selectedId === op.id}
                      aria-label={`${op.title} — ${op.safety}`}
                    >
                      <span className="op-entry-id">{op.id}</span>
                      <span className={`op-safety-dot safety-${op.safety}`} />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}

          {!loading && operations.length === 0 && !error ? (
            <p className="operations-empty">
              No operations found. Ensure the daemon is running and connected.
            </p>
          ) : null}

          {!loading && operations.length > 0 && filtered.length === 0 ? (
            <p className="operations-empty">
              No operations match the current filter/query.
            </p>
          ) : null}
        </nav>

        <div className="operations-detail">
          {selectedOperation ? (
            <OperationRunner
              operation={selectedOperation}
              running={running}
              lastResult={lastResultForSelected}
              onRun={runOperation}
            />
          ) : (
            <div className="operations-placeholder">
              <p>Select an operation from the catalog to run it.</p>
              <p className="hint">
                Operations are grouped by command family. Safety classes:{" "}
                <span className="safety-read">read</span> ·{" "}
                <span className="safety-write">write</span> ·{" "}
                <span className="safety-dangerous">dangerous</span>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

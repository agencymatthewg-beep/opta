import { useCallback, useState } from "react";
import type { OperationDefinition, OperationResult } from "../hooks/useOperations";

interface OperationRunnerProps {
  operation: OperationDefinition;
  running: boolean;
  lastResult: OperationResult | null;
  onRun: (
    id: string,
    input: Record<string, unknown>,
    confirmDangerous?: boolean,
  ) => Promise<void>;
}

export function OperationRunner({
  operation,
  running,
  lastResult,
  onRun,
}: OperationRunnerProps) {
  const [inputJson, setInputJson] = useState("{}");
  const [parseError, setParseError] = useState<string | null>(null);
  const [dangerConfirmed, setDangerConfirmed] = useState(false);

  const handleSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      setParseError(null);
      let input: Record<string, unknown>;
      try {
        input = JSON.parse(inputJson) as Record<string, unknown>;
      } catch (err) {
        setParseError(
          `Invalid JSON: ${err instanceof Error ? err.message : String(err)}`,
        );
        return;
      }
      await onRun(operation.id, input, dangerConfirmed || undefined);
    },
    [inputJson, operation.id, onRun, dangerConfirmed],
  );

  const safetyColor =
    operation.safety === "dangerous"
      ? "var(--opta-danger, #ef4444)"
      : operation.safety === "write"
        ? "var(--opta-warn, #f59e0b)"
        : "var(--opta-success, #10b981)";

  return (
    <div className="operation-runner">
      <header className="operation-runner-header">
        <h3>{operation.title}</h3>
        <span
          className="operation-safety-badge"
          style={{ color: safetyColor }}
          aria-label={`Safety class: ${operation.safety}`}
        >
          {operation.safety}
        </span>
      </header>
      <p className="operation-description">{operation.description}</p>

      <form className="operation-form" onSubmit={(e) => void handleSubmit(e)}>
        <label className="operation-input-label">
          Input (JSON)
          <textarea
            className="operation-input"
            value={inputJson}
            onChange={(e) => {
              setInputJson(e.target.value);
              setParseError(null);
            }}
            rows={4}
            aria-label="Operation input JSON"
            spellCheck={false}
          />
        </label>

        {parseError ? (
          <p className="operation-parse-error" role="alert">
            {parseError}
          </p>
        ) : null}

        {operation.safety === "dangerous" ? (
          <label className="operation-danger-confirm">
            <input
              type="checkbox"
              checked={dangerConfirmed}
              onChange={(e) => setDangerConfirmed(e.target.checked)}
              aria-label="Confirm dangerous operation"
            />
            I understand this is a dangerous operation (confirmDangerous)
          </label>
        ) : null}

        <button
          type="submit"
          className="operation-run-button"
          disabled={running || (operation.safety === "dangerous" && !dangerConfirmed)}
          aria-busy={running}
        >
          {running ? "Running…" : `Run ${operation.id}`}
        </button>
      </form>

      {lastResult ? (
        <div
          className={`operation-result ${lastResult.ok ? "result-ok" : "result-error"}`}
          aria-label="Operation result"
        >
          <header className="result-header">
            <span>{lastResult.ok ? "✓ Success" : "✗ Error"}</span>
            <span className="result-safety">{lastResult.safety}</span>
          </header>
          <pre className="result-json">
            {JSON.stringify(
              lastResult.ok ? lastResult.result : lastResult.error,
              null,
              2,
            )}
          </pre>
        </div>
      ) : null}
    </div>
  );
}

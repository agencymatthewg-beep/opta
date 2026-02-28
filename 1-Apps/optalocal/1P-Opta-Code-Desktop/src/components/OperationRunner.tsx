import { useCallback, useEffect, useMemo, useState } from "react";
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
  const schemaFields = useMemo(
    () => deriveSchemaFields(operation),
    [operation],
  );
  const hasSchemaFields = schemaFields.length > 0;
  const [schemaValues, setSchemaValues] = useState<Record<string, string | boolean>>(
    {},
  );
  const [useRawJson, setUseRawJson] = useState(false);
  const [inputJson, setInputJson] = useState("{}");
  const [parseError, setParseError] = useState<string | null>(null);
  const [dangerConfirmed, setDangerConfirmed] = useState(false);

  useEffect(() => {
    const defaults = initializeSchemaValues(schemaFields);
    setSchemaValues(defaults);
    setUseRawJson(false);
    setParseError(null);
    setDangerConfirmed(false);
    setInputJson(
      hasSchemaFields ? JSON.stringify(defaultsToInput(schemaFields, defaults), null, 2) : "{}",
    );
  }, [hasSchemaFields, operation.id, schemaFields]);

  const handleSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      setParseError(null);
      let input: Record<string, unknown> = {};

      if (hasSchemaFields && !useRawJson) {
        const built = buildInputFromSchema(schemaFields, schemaValues);
        if (typeof built === "string") {
          setParseError(built);
          return;
        }
        input = built;
      } else {
        try {
          const parsed = JSON.parse(inputJson) as unknown;
          if (!isRecord(parsed)) {
            setParseError("Input JSON must be an object.");
            return;
          }
          input = parsed;
        } catch (err) {
          setParseError(
            `Invalid JSON: ${err instanceof Error ? err.message : String(err)}`,
          );
          return;
        }
      }
      await onRun(operation.id, input, dangerConfirmed || undefined);
    },
    [
      dangerConfirmed,
      hasSchemaFields,
      inputJson,
      onRun,
      operation.id,
      schemaFields,
      schemaValues,
      useRawJson,
    ],
  );

  const safetyClass =
    operation.safety === "dangerous"
      ? "safety-dangerous"
      : operation.safety === "write"
        ? "safety-write"
        : "safety-read";

  return (
    <div className="operation-runner">
      <header className="operation-runner-header">
        <h3>{operation.title}</h3>
        <span
          className={`operation-safety-badge ${safetyClass}`}
          aria-label={`Safety class: ${operation.safety}`}
        >
          {operation.safety}
        </span>
      </header>
      <p className="operation-description">{operation.description}</p>

      <form className="operation-form" onSubmit={(e) => void handleSubmit(e)}>
        {hasSchemaFields && !useRawJson ? (
          <fieldset className="operation-schema-inputs">
            <legend>Input fields</legend>
            {schemaFields.map((field) => (
              <label key={field.key} className="operation-input-label">
                {field.label}
                {field.type === "boolean" ? (
                  <input
                    type="checkbox"
                    checked={schemaValues[field.key] === true}
                    onChange={(e) => {
                      setSchemaValues((previous) => ({
                        ...previous,
                        [field.key]: e.target.checked,
                      }));
                      setParseError(null);
                    }}
                    aria-label={field.label}
                  />
                ) : field.enumOptions ? (
                  <select
                    value={String(schemaValues[field.key] ?? "")}
                    onChange={(e) => {
                      setSchemaValues((previous) => ({
                        ...previous,
                        [field.key]: e.target.value,
                      }));
                      setParseError(null);
                    }}
                    aria-label={field.label}
                  >
                    <option value="">Select…</option>
                    {field.enumOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={field.type === "number" || field.type === "integer" ? "number" : "text"}
                    step={field.type === "integer" ? "1" : "any"}
                    value={String(schemaValues[field.key] ?? "")}
                    onChange={(e) => {
                      setSchemaValues((previous) => ({
                        ...previous,
                        [field.key]: e.target.value,
                      }));
                      setParseError(null);
                    }}
                    aria-label={field.label}
                  />
                )}
              </label>
            ))}
          </fieldset>
        ) : null}

        {hasSchemaFields ? (
          <label className="operation-danger-confirm">
            <input
              type="checkbox"
              checked={useRawJson}
              onChange={(e) => {
                setUseRawJson(e.target.checked);
                setParseError(null);
              }}
              aria-label="Use raw JSON input"
            />
            Use raw JSON input
          </label>
        ) : null}

        {!hasSchemaFields || useRawJson ? (
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
        ) : null}

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

interface SchemaField {
  key: string;
  label: string;
  required: boolean;
  type: "string" | "number" | "integer" | "boolean";
  enumOptions?: string[];
}

function deriveSchemaFields(operation: OperationDefinition): SchemaField[] {
  const schema = operation.inputSchema;
  if (!schema || !schema.properties) return [];
  if (schema.type && schema.type !== "object") return [];

  const required = new Set(schema.required ?? []);

  return Object.entries(schema.properties).reduce<SchemaField[]>(
    (accumulator, [key, property]) => {
      const type = resolveFieldType(property.type);
      if (!type) return accumulator;

      const enumOptions = Array.isArray(property.enum)
        ? property.enum.filter(
            (entry): entry is string | number =>
              typeof entry === "string" || typeof entry === "number",
          )
        : undefined;

      accumulator.push({
        key,
        label:
          typeof property.title === "string" && property.title.trim().length > 0
            ? property.title
            : key,
        required: required.has(key),
        type,
        enumOptions: enumOptions?.map(String),
      });
      return accumulator;
    },
    [],
  );
}

function resolveFieldType(
  rawType: string | string[] | undefined,
): SchemaField["type"] | null {
  const primaryType = Array.isArray(rawType)
    ? rawType.find((entry) => entry !== "null")
    : rawType;

  if (
    primaryType === "string" ||
    primaryType === "number" ||
    primaryType === "integer" ||
    primaryType === "boolean"
  ) {
    return primaryType;
  }
  return null;
}

function initializeSchemaValues(
  fields: SchemaField[],
): Record<string, string | boolean> {
  return fields.reduce<Record<string, string | boolean>>((accumulator, field) => {
    accumulator[field.key] = field.type === "boolean" ? false : "";
    return accumulator;
  }, {});
}

function defaultsToInput(
  fields: SchemaField[],
  values: Record<string, string | boolean>,
): Record<string, unknown> {
  return fields.reduce<Record<string, unknown>>((accumulator, field) => {
    const value = values[field.key];
    if (field.type === "boolean") {
      accumulator[field.key] = value === true;
      return accumulator;
    }
    const text = String(value ?? "").trim();
    if (text.length > 0) {
      accumulator[field.key] = text;
    }
    return accumulator;
  }, {});
}

function buildInputFromSchema(
  fields: SchemaField[],
  values: Record<string, string | boolean>,
): Record<string, unknown> | string {
  const payload: Record<string, unknown> = {};

  for (const field of fields) {
    const rawValue = values[field.key];

    if (field.type === "boolean") {
      payload[field.key] = rawValue === true;
      continue;
    }

    const textValue = String(rawValue ?? "").trim();

    if (!textValue) {
      if (field.required) {
        return `Missing required field: ${field.label}`;
      }
      continue;
    }

    if (field.type === "integer" || field.type === "number") {
      const numericValue = Number(textValue);
      if (!Number.isFinite(numericValue)) {
        return `Invalid number for field: ${field.label}`;
      }
      if (field.type === "integer" && !Number.isInteger(numericValue)) {
        return `Invalid integer for field: ${field.label}`;
      }
      payload[field.key] = numericValue;
      continue;
    }

    payload[field.key] = textValue;
  }

  return payload;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

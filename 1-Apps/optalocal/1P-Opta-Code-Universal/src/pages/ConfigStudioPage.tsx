import { useCallback, useEffect, useMemo, useState } from "react";
import { daemonClient } from "../lib/daemonClient";
import type { DaemonConnectionOptions } from "../types";

interface ConfigStudioPageProps {
  connection: DaemonConnectionOptions;
}

type ActionState = "get" | "set" | "reset-key" | "reset-all" | null;
type NoticeTone = "success" | "error" | "info";

interface ConfigEntry {
  key: string;
  value: unknown;
  valueText: string;
}

interface OperationNotice {
  tone: NoticeTone;
  operationId: string;
  message: string;
  details?: unknown;
}

interface ConfigOperationError extends Error {
  details?: unknown;
}

const CONFIG_LIST_OPERATION = "config.list";
const CONFIG_GET_OPERATION = "config.get";
const CONFIG_SET_OPERATION = "config.set";
const CONFIG_RESET_OPERATION = "config.reset";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function compactValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === null ||
    value === undefined
  ) {
    return String(value);
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function formatEditorValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === undefined) return "";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function flattenConfigObject(value: unknown, prefix = ""): ConfigEntry[] {
  if (!isRecord(value)) {
    if (!prefix) return [];
    return [{ key: prefix, value, valueText: compactValue(value) }];
  }

  const entries: ConfigEntry[] = [];
  for (const key of Object.keys(value).sort((left, right) => left.localeCompare(right))) {
    const nextKey = prefix ? `${prefix}.${key}` : key;
    const nextValue = value[key];

    if (isRecord(nextValue)) {
      entries.push(...flattenConfigObject(nextValue, nextKey));
      continue;
    }

    entries.push({
      key: nextKey,
      value: nextValue,
      valueText: compactValue(nextValue),
    });
  }

  return entries;
}

function normalizeConfigEntries(result: unknown): ConfigEntry[] {
  if (Array.isArray(result)) {
    const entries = result
      .map((item): ConfigEntry | null => {
        if (!isRecord(item) || typeof item.key !== "string") return null;
        const key = item.key.trim();
        if (!key) return null;

        const value =
          "value" in item
            ? item.value
            : "current" in item
              ? item.current
              : "result" in item
                ? item.result
                : undefined;

        return {
          key,
          value,
          valueText: compactValue(value),
        };
      })
      .filter((entry): entry is ConfigEntry => entry !== null)
      .sort((left, right) => left.key.localeCompare(right.key));

    if (entries.length > 0) return entries;
  }

  if (isRecord(result)) {
    if ("config" in result) {
      return normalizeConfigEntries(result.config);
    }
    if ("entries" in result) {
      return normalizeConfigEntries(result.entries);
    }
    if ("items" in result) {
      return normalizeConfigEntries(result.items);
    }
    if ("values" in result) {
      return normalizeConfigEntries(result.values);
    }
    if ("data" in result) {
      return normalizeConfigEntries(result.data);
    }

    return flattenConfigObject(result);
  }

  return [];
}

function parseEditorValue(input: string): unknown {
  const trimmed = input.trim();
  if (!trimmed) return "";

  try {
    return JSON.parse(trimmed);
  } catch {
    return input;
  }
}

function readPath(source: unknown, keyPath: string): { found: boolean; value: unknown } {
  const segments = keyPath
    .split(".")
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (segments.length === 0) {
    return { found: false, value: undefined };
  }

  let cursor: unknown = source;
  for (const segment of segments) {
    if (!isRecord(cursor) || !(segment in cursor)) {
      return { found: false, value: undefined };
    }
    cursor = cursor[segment];
  }

  return { found: true, value: cursor };
}

function extractConfigValue(result: unknown, key: string): unknown {
  if (!isRecord(result)) return result;

  if ("value" in result) return result.value;
  if ("current" in result) return result.current;

  const directLookup = readPath(result, key);
  if (directLookup.found) return directLookup.value;

  if ("config" in result) return extractConfigValue(result.config, key);
  if ("result" in result) return extractConfigValue(result.result, key);

  return result;
}

function extractErrorDetails(error: unknown): unknown {
  if (isRecord(error) && "details" in error) {
    return error.details;
  }
  return undefined;
}

function prettyDetails(details: unknown): string {
  if (details === undefined) return "";
  if (typeof details === "string") return details;
  try {
    return JSON.stringify(details, null, 2);
  } catch {
    return String(details);
  }
}

export function ConfigStudioPage({ connection }: ConfigStudioPageProps) {
  const [entries, setEntries] = useState<ConfigEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [editorValue, setEditorValue] = useState("");
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [actionState, setActionState] = useState<ActionState>(null);
  const [notice, setNotice] = useState<OperationNotice | null>(null);

  const selectedEntry = useMemo(
    () => entries.find((entry) => entry.key === selectedKey) ?? null,
    [entries, selectedKey],
  );

  const filteredEntries = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (!normalizedQuery) return entries;

    return entries.filter((entry) => {
      const keyMatch = entry.key.toLowerCase().includes(normalizedQuery);
      const valueMatch = entry.valueText.toLowerCase().includes(normalizedQuery);
      return keyMatch || valueMatch;
    });
  }, [entries, searchQuery]);

  useEffect(() => {
    if (!selectedEntry) {
      setEditorValue("");
      return;
    }
    setEditorValue(formatEditorValue(selectedEntry.value));
  }, [selectedEntry?.key, selectedEntry?.value]);

  useEffect(() => {
    if (!selectedKey) {
      setSelectedKey(filteredEntries[0]?.key ?? null);
      return;
    }

    const stillVisible = filteredEntries.some((entry) => entry.key === selectedKey);
    if (!stillVisible) {
      setSelectedKey(filteredEntries[0]?.key ?? null);
    }
  }, [filteredEntries, selectedKey]);

  const runConfigOperation = useCallback(
    async (operationId: string, input: Record<string, unknown> = {}) => {
      const response = await daemonClient.runOperation(connection, operationId, {
        input,
      });

      if (response.ok) return response.result;

      const error = new Error(
        `[${response.error.code}] ${response.error.message}`,
      ) as ConfigOperationError;
      error.details = response.error.details;
      throw error;
    },
    [connection],
  );

  const updateEntryValue = useCallback((key: string, value: unknown) => {
    setEntries((current) => {
      const nextEntry: ConfigEntry = {
        key,
        value,
        valueText: compactValue(value),
      };
      const index = current.findIndex((entry) => entry.key === key);

      if (index === -1) {
        return [...current, nextEntry].sort((left, right) =>
          left.key.localeCompare(right.key),
        );
      }

      const next = [...current];
      next[index] = nextEntry;
      return next;
    });
  }, []);

  const loadConfig = useCallback(
    async (showSuccessNotice = false) => {
      setCatalogLoading(true);
      setCatalogError(null);

      try {
        const result = await runConfigOperation(CONFIG_LIST_OPERATION);
        const nextEntries = normalizeConfigEntries(result);
        setEntries(nextEntries);
        setSelectedKey((current) => {
          if (current && nextEntries.some((entry) => entry.key === current)) {
            return current;
          }
          return nextEntries[0]?.key ?? null;
        });

        if (showSuccessNotice) {
          setNotice({
            tone: "success",
            operationId: CONFIG_LIST_OPERATION,
            message: `Loaded ${nextEntries.length} config entries.`,
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setCatalogError(message);
        setNotice({
          tone: "error",
          operationId: CONFIG_LIST_OPERATION,
          message: "Failed to load config values.",
          details: extractErrorDetails(error),
        });
      } finally {
        setCatalogLoading(false);
      }
    },
    [runConfigOperation],
  );

  useEffect(() => {
    void loadConfig(false);
  }, [loadConfig]);

  const handleRefresh = useCallback(async () => {
    await loadConfig(true);
  }, [loadConfig]);

  const handleGetSelected = useCallback(async () => {
    if (!selectedKey) return;

    setActionState("get");
    try {
      const result = await runConfigOperation(CONFIG_GET_OPERATION, {
        key: selectedKey,
      });
      const value = extractConfigValue(result, selectedKey);
      updateEntryValue(selectedKey, value);
      setEditorValue(formatEditorValue(value));
      setNotice({
        tone: "success",
        operationId: CONFIG_GET_OPERATION,
        message: `Fetched ${selectedKey}.`,
        details: value,
      });
    } catch (error) {
      setNotice({
        tone: "error",
        operationId: CONFIG_GET_OPERATION,
        message: error instanceof Error ? error.message : String(error),
        details: extractErrorDetails(error),
      });
    } finally {
      setActionState(null);
    }
  }, [runConfigOperation, selectedKey, updateEntryValue]);

  const handleSetSelected = useCallback(async () => {
    if (!selectedKey) return;

    const parsedValue = parseEditorValue(editorValue);
    setActionState("set");

    try {
      const result = await runConfigOperation(CONFIG_SET_OPERATION, {
        key: selectedKey,
        value: parsedValue,
      });
      updateEntryValue(selectedKey, parsedValue);
      setNotice({
        tone: "success",
        operationId: CONFIG_SET_OPERATION,
        message: `Updated ${selectedKey}.`,
        details: result,
      });
      void loadConfig(false);
    } catch (error) {
      setNotice({
        tone: "error",
        operationId: CONFIG_SET_OPERATION,
        message: error instanceof Error ? error.message : String(error),
        details: extractErrorDetails(error),
      });
    } finally {
      setActionState(null);
    }
  }, [editorValue, loadConfig, runConfigOperation, selectedKey, updateEntryValue]);

  const handleResetSelected = useCallback(async () => {
    if (!selectedKey) return;
    const shouldReset = window.confirm(
      `Reset \"${selectedKey}\" to its default value?`,
    );
    if (!shouldReset) return;

    setActionState("reset-key");

    try {
      const result = await runConfigOperation(CONFIG_RESET_OPERATION, {
        key: selectedKey,
      });
      setNotice({
        tone: "success",
        operationId: CONFIG_RESET_OPERATION,
        message: `Reset ${selectedKey} to default.`,
        details: result,
      });
      await loadConfig(false);
    } catch (error) {
      setNotice({
        tone: "error",
        operationId: CONFIG_RESET_OPERATION,
        message: error instanceof Error ? error.message : String(error),
        details: extractErrorDetails(error),
      });
    } finally {
      setActionState(null);
    }
  }, [loadConfig, runConfigOperation, selectedKey]);

  const handleResetAll = useCallback(async () => {
    const shouldResetAll = window.confirm(
      "Reset all config values to defaults? This cannot be undone.",
    );
    if (!shouldResetAll) return;

    setActionState("reset-all");
    try {
      const result = await runConfigOperation(CONFIG_RESET_OPERATION, {});
      setNotice({
        tone: "success",
        operationId: CONFIG_RESET_OPERATION,
        message: "Reset all config values to defaults.",
        details: result,
      });
      await loadConfig(false);
    } catch (error) {
      setNotice({
        tone: "error",
        operationId: CONFIG_RESET_OPERATION,
        message: error instanceof Error ? error.message : String(error),
        details: extractErrorDetails(error),
      });
    } finally {
      setActionState(null);
    }
  }, [loadConfig, runConfigOperation]);

  const detailsText = notice ? prettyDetails(notice.details) : "";

  return (
    <div className="config-studio-page">
      <header className="config-studio-header">
        <div>
          <h2>Config Studio</h2>
          <p>
            Full daemon config management via {CONFIG_LIST_OPERATION},{" "}
            {CONFIG_GET_OPERATION}, {CONFIG_SET_OPERATION}, and {CONFIG_RESET_OPERATION}.
          </p>
        </div>

        <div className="config-studio-controls">
          <label className="operation-input-label">
            Search
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="key or value"
              aria-label="Search config keys"
            />
          </label>
          <button
            type="button"
            className="refresh-btn"
            onClick={() => void handleRefresh()}
            disabled={catalogLoading || actionState !== null}
            aria-label="Refresh config values"
          >
            {catalogLoading ? "Loading…" : "Refresh"}
          </button>
          <button
            type="button"
            className="action-btn delete"
            onClick={() => void handleResetAll()}
            disabled={catalogLoading || actionState !== null}
          >
            {actionState === "reset-all" ? "Resetting…" : "Reset all"}
          </button>
          <span className="config-studio-count">
            {filteredEntries.length}/{entries.length} keys
          </span>
        </div>
      </header>

      {catalogError ? (
        <div className="operations-error" role="alert">
          <strong>Config load failed:</strong> {catalogError}
          <button type="button" onClick={() => void handleRefresh()}>
            Retry
          </button>
        </div>
      ) : null}

      {notice ? (
        <div className={`config-op-notice config-op-notice-${notice.tone}`} role="status">
          <div className="config-op-notice-head">
            <strong>{notice.operationId}</strong>
            <span>{notice.message}</span>
          </div>
          {detailsText ? <pre>{detailsText}</pre> : null}
        </div>
      ) : null}

      <div className="config-studio-layout">
        <section className="config-key-catalog" aria-label="Config key catalog">
          {catalogLoading && entries.length === 0 ? (
            <p className="operations-empty">Loading config entries…</p>
          ) : null}

          {!catalogLoading && entries.length === 0 && !catalogError ? (
            <p className="operations-empty">
              No config entries available. Ensure daemon operations include config.list.
            </p>
          ) : null}

          {!catalogLoading && entries.length > 0 && filteredEntries.length === 0 ? (
            <p className="operations-empty">No config entries match the current search.</p>
          ) : null}

          <ul className="config-key-list">
            {filteredEntries.map((entry) => (
              <li key={entry.key}>
                <button
                  type="button"
                  className={`config-key-row ${entry.key === selectedKey ? "selected" : ""}`}
                  onClick={() => setSelectedKey(entry.key)}
                  aria-pressed={entry.key === selectedKey}
                >
                  <span className="config-key-name">{entry.key}</span>
                  <span className="config-key-value">{entry.valueText}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="config-editor-panel">
          {selectedEntry ? (
            <>
              <header className="config-editor-header">
                <h3>{selectedEntry.key}</h3>
                <p>Current value preview: {selectedEntry.valueText}</p>
              </header>

              <label className="config-editor-label">
                Edit value
                <textarea
                  value={editorValue}
                  onChange={(event) => setEditorValue(event.target.value)}
                  spellCheck={false}
                  rows={10}
                  aria-label="Config value editor"
                />
              </label>

              <p className="config-editor-hint">
                Input accepts JSON when valid; otherwise the raw text is submitted.
              </p>

              <div className="config-editor-actions">
                <button
                  type="button"
                  className="action-btn"
                  onClick={() => void handleGetSelected()}
                  disabled={catalogLoading || actionState !== null}
                >
                  {actionState === "get" ? "Fetching…" : "Get value"}
                </button>
                <button
                  type="button"
                  className="action-btn"
                  onClick={() => void handleSetSelected()}
                  disabled={catalogLoading || actionState !== null}
                >
                  {actionState === "set" ? "Saving…" : "Save value"}
                </button>
                <button
                  type="button"
                  className="action-btn delete"
                  onClick={() => void handleResetSelected()}
                  disabled={catalogLoading || actionState !== null}
                >
                  {actionState === "reset-key" ? "Resetting…" : "Reset key"}
                </button>
              </div>
            </>
          ) : (
            <div className="operations-placeholder">
              <p>Select a config key to inspect and edit its value.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

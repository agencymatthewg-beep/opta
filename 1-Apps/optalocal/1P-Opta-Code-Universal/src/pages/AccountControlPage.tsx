import { useCallback, useEffect, useMemo, useState } from "react";
import { daemonClient } from "../lib/daemonClient";
import type { DaemonConnectionOptions } from "../types";

interface AccountControlPageProps {
  connection: DaemonConnectionOptions;
}

type NoticeTone = "success" | "error" | "info";

interface OperationNotice {
  tone: NoticeTone;
  operationId: string;
  message: string;
  details?: unknown;
  action?: string;
}

interface AccountOperationError extends Error {
  code?: string;
  details?: unknown;
}

interface AccountKeySummary {
  id: string;
  label: string;
  summary: string;
  raw: unknown;
}

interface ExecuteOperationOptions {
  input?: Record<string, unknown>;
  successMessage: string;
  onSuccess?: (result: unknown) => void;
}

const OP_ACCOUNT_STATUS = "account.status";
const OP_ACCOUNT_SIGNUP = "account.signup";
const OP_ACCOUNT_LOGIN = "account.login";
const OP_ACCOUNT_LOGOUT = "account.logout";
const OP_ACCOUNT_KEYS_LIST = "account.keys.list";
const OP_ACCOUNT_KEYS_PUSH = "account.keys.push";
const OP_ACCOUNT_KEYS_DELETE = "account.keys.delete";

const OP_LOCAL_KEY_SHOW = "key.show";
const OP_LOCAL_KEY_CREATE = "key.create";
const OP_LOCAL_KEY_COPY = "key.copy";

const REQUIRED_OPERATION_IDS = [
  OP_ACCOUNT_STATUS,
  OP_ACCOUNT_SIGNUP,
  OP_ACCOUNT_LOGIN,
  OP_ACCOUNT_LOGOUT,
  OP_ACCOUNT_KEYS_LIST,
  OP_ACCOUNT_KEYS_PUSH,
  OP_ACCOUNT_KEYS_DELETE,
] as const;

const OPTIONAL_LOCAL_OPERATION_IDS = [
  OP_LOCAL_KEY_SHOW,
  OP_LOCAL_KEY_CREATE,
  OP_LOCAL_KEY_COPY,
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOwn(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function prettyValue(value: unknown): string {
  if (value === undefined) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function compactValue(value: unknown): string {
  if (
    typeof value === "string" ||
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

function parseInputObject(input: string, label: string): Record<string, unknown> {
  const trimmed = input.trim();
  if (!trimmed) return {};

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error(`${label} must be valid JSON.`);
  }

  if (!isRecord(parsed)) {
    throw new Error(`${label} must be a JSON object.`);
  }

  return parsed;
}

function toOperationError(error: unknown, operationId: string): AccountOperationError {
  if (error instanceof Error) {
    const cast = error as AccountOperationError;
    if (cast.code) return cast;
    return {
      ...cast,
      code: "operation_error",
      details: cast.details,
      message: cast.message,
      name: cast.name,
    };
  }

  if (isRecord(error)) {
    const code = typeof error.code === "string" ? error.code : "operation_error";
    const message =
      typeof error.message === "string"
        ? error.message
        : `Operation ${operationId} failed.`;
    const wrapped = new Error(message) as AccountOperationError;
    wrapped.code = code;
    wrapped.details = hasOwn(error, "details") ? error.details : error;
    return wrapped;
  }

  const wrapped = new Error(String(error)) as AccountOperationError;
  wrapped.code = "operation_error";
  wrapped.details = error;
  return wrapped;
}

function actionableHintForError(code: string, operationId: string): string {
  const normalizedCode = code.toLowerCase();

  if (
    normalizedCode.includes("unauth") ||
    normalizedCode.includes("forbidden") ||
    normalizedCode.includes("auth")
  ) {
    return "Authenticate with account.login (or account.signup), then retry.";
  }

  if (
    normalizedCode.includes("not_found") ||
    normalizedCode.includes("unknown_operation") ||
    normalizedCode.includes("unsupported")
  ) {
    return "Confirm this daemon version exposes the operation and refresh the operation catalog.";
  }

  if (
    normalizedCode.includes("invalid") ||
    normalizedCode.includes("schema") ||
    normalizedCode.includes("input")
  ) {
    return "Update the JSON input payload to match required fields and try again.";
  }

  return `Retry ${operationId} with corrected input or use Operations Console for raw diagnostics.`;
}

function extractOperationIds(response: unknown): Set<string> {
  if (!isRecord(response) || !Array.isArray(response.operations)) {
    return new Set<string>();
  }

  const ids = new Set<string>();
  for (const operation of response.operations) {
    if (!isRecord(operation)) continue;
    if (typeof operation.id !== "string") continue;
    const id = operation.id.trim();
    if (id) ids.add(id);
  }

  return ids;
}

function firstString(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }
  return null;
}

function normalizeKeyRecord(record: Record<string, unknown>, index: number): AccountKeySummary {
  const id =
    firstString(record, ["id", "keyId", "key_id", "name", "key", "fingerprint"]) ??
    `key-${index + 1}`;

  const label =
    firstString(record, ["name", "label", "title", "key", "id", "fingerprint"]) ??
    id;

  const summarySource =
    firstString(record, ["scope", "createdAt", "updatedAt", "type", "status", "project"]) ??
    compactValue(record);

  return {
    id,
    label,
    summary: summarySource,
    raw: record,
  };
}

function normalizeAccountKeys(result: unknown): AccountKeySummary[] {
  if (Array.isArray(result)) {
    return result
      .map((item, index): AccountKeySummary | null => {
        if (!isRecord(item)) return null;
        return normalizeKeyRecord(item, index);
      })
      .filter((item): item is AccountKeySummary => item !== null);
  }

  if (isRecord(result)) {
    if (Array.isArray(result.keys)) return normalizeAccountKeys(result.keys);
    if (Array.isArray(result.items)) return normalizeAccountKeys(result.items);
    if (Array.isArray(result.list)) return normalizeAccountKeys(result.list);
    if (Array.isArray(result.data)) return normalizeAccountKeys(result.data);

    const entries = Object.entries(result).map(([key, value]) => ({
      id: key,
      label: key,
      summary: compactValue(value),
      raw: value,
    }));
    return entries;
  }

  return [];
}

export function AccountControlPage({ connection }: AccountControlPageProps) {
  const [notice, setNotice] = useState<OperationNotice | null>(null);
  const [busyOperation, setBusyOperation] = useState<string | null>(null);

  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [availableOperationIds, setAvailableOperationIds] = useState<Set<string> | null>(null);

  const [signupInput, setSignupInput] = useState(
    '{\n  "identifier": "",\n  "password": "",\n  "name": ""\n}',
  );
  const [loginInput, setLoginInput] = useState(
    '{\n  "identifier": "",\n  "password": ""\n}',
  );
  const [pushKeyInput, setPushKeyInput] = useState(
    '{\n  "provider": "",\n  "key": "",\n  "label": "default"\n}',
  );
  const [deleteKeyInput, setDeleteKeyInput] = useState('{\n  "keyId": ""\n}');
  const [localShowInput, setLocalShowInput] = useState(
    '{\n  "reveal": true\n}',
  );
  const [localCreateInput, setLocalCreateInput] = useState(
    '{\n  "copy": true\n}',
  );

  const [statusResult, setStatusResult] = useState<unknown>(null);
  const [authResult, setAuthResult] = useState<unknown>(null);
  const [keysResult, setKeysResult] = useState<unknown>(null);
  const [localResult, setLocalResult] = useState<unknown>(null);
  const [accountKeys, setAccountKeys] = useState<AccountKeySummary[]>([]);

  useEffect(() => {
    let cancelled = false;

    const loadCatalog = async () => {
      setCatalogLoading(true);
      setCatalogError(null);

      try {
        const response = await daemonClient.listOperations(connection);
        if (cancelled) return;
        setAvailableOperationIds(extractOperationIds(response));
      } catch (error) {
        if (cancelled) return;
        setCatalogError(error instanceof Error ? error.message : String(error));
        setAvailableOperationIds(null);
      } finally {
        if (!cancelled) {
          setCatalogLoading(false);
        }
      }
    };

    void loadCatalog();

    return () => {
      cancelled = true;
    };
  }, [connection]);

  const isOperationUnavailable = useCallback(
    (operationId: string) =>
      availableOperationIds !== null && !availableOperationIds.has(operationId),
    [availableOperationIds],
  );

  const runAccountOperation = useCallback(
    async (operationId: string, input: Record<string, unknown> = {}) => {
      const response = await daemonClient.runOperation(connection, operationId, {
        input,
      });

      if (response.ok) {
        return response.result;
      }

      const operationError = new Error(
        `[${response.error.code}] ${response.error.message}`,
      ) as AccountOperationError;
      operationError.code = response.error.code;
      operationError.details = response.error.details;
      throw operationError;
    },
    [connection],
  );

  const executeOperation = useCallback(
    async (operationId: string, options: ExecuteOperationOptions) => {
      if (isOperationUnavailable(operationId)) {
        setNotice({
          tone: "error",
          operationId,
          message: "Operation is unavailable in the current daemon catalog.",
          action:
            "Upgrade daemon operations support or refresh the catalog after reconnecting.",
        });
        return undefined;
      }

      setBusyOperation(operationId);

      try {
        const result = await runAccountOperation(operationId, options.input ?? {});
        options.onSuccess?.(result);
        setNotice({
          tone: "success",
          operationId,
          message: options.successMessage,
          details: result,
        });
        return result;
      } catch (error) {
        const operationError = toOperationError(error, operationId);
        setNotice({
          tone: "error",
          operationId,
          message: operationError.message,
          details: operationError.details,
          action: actionableHintForError(
            operationError.code ?? "operation_error",
            operationId,
          ),
        });
        return undefined;
      } finally {
        setBusyOperation(null);
      }
    },
    [isOperationUnavailable, runAccountOperation],
  );

  const parseAndExecute = useCallback(
    async (
      operationId: string,
      label: string,
      rawInput: string,
      successMessage: string,
      onSuccess?: (result: unknown) => void,
    ) => {
      let input: Record<string, unknown>;
      try {
        input = parseInputObject(rawInput, label);
      } catch (error) {
        setNotice({
          tone: "error",
          operationId,
          message: error instanceof Error ? error.message : String(error),
          action: "Fix the JSON payload and retry.",
        });
        return;
      }

      await executeOperation(operationId, {
        input,
        successMessage,
        onSuccess,
      });
    },
    [executeOperation],
  );

  const handleStatus = useCallback(async () => {
    await executeOperation(OP_ACCOUNT_STATUS, {
      successMessage: "Loaded account status.",
      onSuccess: (result) => setStatusResult(result),
    });
  }, [executeOperation]);

  const handleSignup = useCallback(async () => {
    await parseAndExecute(
      OP_ACCOUNT_SIGNUP,
      "Signup input",
      signupInput,
      "Signup operation completed.",
      (result) => setAuthResult(result),
    );
  }, [parseAndExecute, signupInput]);

  const handleLogin = useCallback(async () => {
    await parseAndExecute(
      OP_ACCOUNT_LOGIN,
      "Login input",
      loginInput,
      "Login operation completed.",
      (result) => setAuthResult(result),
    );
  }, [loginInput, parseAndExecute]);

  const handleLogout = useCallback(async () => {
    await executeOperation(OP_ACCOUNT_LOGOUT, {
      successMessage: "Logout operation completed.",
      onSuccess: (result) => setAuthResult(result),
    });
  }, [executeOperation]);

  const handleListKeys = useCallback(async () => {
    await executeOperation(OP_ACCOUNT_KEYS_LIST, {
      successMessage: "Loaded account keys.",
      onSuccess: (result) => {
        setKeysResult(result);
        setAccountKeys(normalizeAccountKeys(result));
      },
    });
  }, [executeOperation]);

  const handlePushKey = useCallback(async () => {
    await parseAndExecute(
      OP_ACCOUNT_KEYS_PUSH,
      "Account key push input",
      pushKeyInput,
      "Account key push completed.",
      (result) => setKeysResult(result),
    );
  }, [parseAndExecute, pushKeyInput]);

  const handleDeleteKey = useCallback(async () => {
    await parseAndExecute(
      OP_ACCOUNT_KEYS_DELETE,
      "Account key delete input",
      deleteKeyInput,
      "Account key delete completed.",
      (result) => setKeysResult(result),
    );
  }, [deleteKeyInput, parseAndExecute]);

  const handleLocalShow = useCallback(async () => {
    await parseAndExecute(
      OP_LOCAL_KEY_SHOW,
      "Local key.show input",
      localShowInput,
      "Local key.show completed.",
      (result) => setLocalResult(result),
    );
  }, [localShowInput, parseAndExecute]);

  const handleLocalCreate = useCallback(async () => {
    await parseAndExecute(
      OP_LOCAL_KEY_CREATE,
      "Local key.create input",
      localCreateInput,
      "Local key.create completed.",
      (result) => setLocalResult(result),
    );
  }, [localCreateInput, parseAndExecute]);

  const handleLocalCopy = useCallback(async () => {
    await executeOperation(OP_LOCAL_KEY_COPY, {
      successMessage: "Local key.copy completed.",
      onSuccess: (result) => setLocalResult(result),
    });
  }, [executeOperation]);

  const requiredMissing = useMemo(() => {
    if (availableOperationIds === null) return [];
    return REQUIRED_OPERATION_IDS.filter((id) => !availableOperationIds.has(id));
  }, [availableOperationIds]);

  const availableLocalCount = useMemo(() => {
    if (availableOperationIds === null) return OPTIONAL_LOCAL_OPERATION_IDS.length;
    return OPTIONAL_LOCAL_OPERATION_IDS.filter((id) => availableOperationIds.has(id))
      .length;
  }, [availableOperationIds]);

  const noticeDetails = notice ? prettyValue(notice.details) : "";

  const isRunningAny = busyOperation !== null;

  return (
    <div className="account-control-page">
      <header className="account-control-header">
        <div>
          <h2>Account Controls</h2>
          <p>
            First-class account workflows via daemon operations: status, signup,
            login, logout, account key management, and optional local key
            shortcuts.
          </p>
        </div>

        <div className="account-control-meta">
          <span>
            Catalog: {catalogLoading ? "loading…" : availableOperationIds ? `${availableOperationIds.size} ops` : "unknown"}
          </span>
          <span>
            Local shortcuts: {availableLocalCount}/{OPTIONAL_LOCAL_OPERATION_IDS.length}
          </span>
        </div>
      </header>

      {catalogError ? (
        <div className="operations-error" role="alert">
          <strong>Operation catalog unavailable:</strong> {catalogError}
        </div>
      ) : null}

      {requiredMissing.length > 0 ? (
        <div className="operations-error" role="alert">
          <strong>Missing required account operations:</strong>{" "}
          {requiredMissing.join(", ")}
        </div>
      ) : null}

      {notice ? (
        <div
          className={`account-op-notice account-op-notice-${notice.tone}`}
          role={notice.tone === "error" ? "alert" : "status"}
        >
          <div className="account-op-notice-head">
            <strong>{notice.operationId}</strong>
            <span>{notice.message}</span>
          </div>
          {notice.action ? (
            <p className="account-op-notice-action">Next step: {notice.action}</p>
          ) : null}
          {noticeDetails ? <pre>{noticeDetails}</pre> : null}
        </div>
      ) : null}

      <div className="account-control-grid">
        <section className="account-panel">
          <header>
            <h3>Account Session</h3>
            <p>
              Operations: {OP_ACCOUNT_STATUS}, {OP_ACCOUNT_SIGNUP}, {OP_ACCOUNT_LOGIN}, {" "}
              {OP_ACCOUNT_LOGOUT}
            </p>
          </header>

          <div className="account-inline-actions">
            <button
              type="button"
              className="action-btn"
              onClick={() => void handleStatus()}
              disabled={isRunningAny || isOperationUnavailable(OP_ACCOUNT_STATUS)}
            >
              {busyOperation === OP_ACCOUNT_STATUS ? "Loading…" : "Refresh status"}
            </button>
            <button
              type="button"
              className="action-btn"
              onClick={() => void handleLogout()}
              disabled={isRunningAny || isOperationUnavailable(OP_ACCOUNT_LOGOUT)}
            >
              {busyOperation === OP_ACCOUNT_LOGOUT ? "Logging out…" : "Logout"}
            </button>
          </div>

          <label className="account-json-label">
            Signup input (JSON object)
            <textarea
              value={signupInput}
              onChange={(event) => setSignupInput(event.target.value)}
              spellCheck={false}
              rows={5}
              aria-label="Account signup JSON input"
            />
          </label>
          <button
            type="button"
            className="action-btn"
            onClick={() => void handleSignup()}
            disabled={isRunningAny || isOperationUnavailable(OP_ACCOUNT_SIGNUP)}
          >
            {busyOperation === OP_ACCOUNT_SIGNUP ? "Running signup…" : "Run signup"}
          </button>

          <label className="account-json-label">
            Login input (JSON object)
            <textarea
              value={loginInput}
              onChange={(event) => setLoginInput(event.target.value)}
              spellCheck={false}
              rows={5}
              aria-label="Account login JSON input"
            />
          </label>
          <button
            type="button"
            className="action-btn"
            onClick={() => void handleLogin()}
            disabled={isRunningAny || isOperationUnavailable(OP_ACCOUNT_LOGIN)}
          >
            {busyOperation === OP_ACCOUNT_LOGIN ? "Running login…" : "Run login"}
          </button>

          <div className="account-result-block">
            <h4>Latest status result</h4>
            {statusResult !== null ? (
              <pre>{prettyValue(statusResult)}</pre>
            ) : (
              <p className="account-empty">No status result yet.</p>
            )}
          </div>

          <div className="account-result-block">
            <h4>Latest auth action</h4>
            {authResult !== null ? (
              <pre>{prettyValue(authResult)}</pre>
            ) : (
              <p className="account-empty">No signup/login/logout action yet.</p>
            )}
          </div>
        </section>

        <section className="account-panel">
          <header>
            <h3>Account Keys</h3>
            <p>
              Operations: {OP_ACCOUNT_KEYS_LIST}, {OP_ACCOUNT_KEYS_PUSH}, {" "}
              {OP_ACCOUNT_KEYS_DELETE}
            </p>
          </header>

          <div className="account-inline-actions">
            <button
              type="button"
              className="action-btn"
              onClick={() => void handleListKeys()}
              disabled={isRunningAny || isOperationUnavailable(OP_ACCOUNT_KEYS_LIST)}
            >
              {busyOperation === OP_ACCOUNT_KEYS_LIST ? "Loading keys…" : "List keys"}
            </button>
          </div>

          {accountKeys.length > 0 ? (
            <ul className="account-keys-list" aria-label="Account keys list">
              {accountKeys.map((keyEntry) => (
                <li key={keyEntry.id} className="account-key-row">
                  <div>
                    <strong>{keyEntry.label}</strong>
                    <p>{keyEntry.summary}</p>
                  </div>
                  <button
                    type="button"
                    className="action-btn"
                    onClick={() =>
                      setDeleteKeyInput(
                        JSON.stringify({ keyId: keyEntry.id }, null, 2),
                      )
                    }
                  >
                    Use for delete {keyEntry.label}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="account-empty">
              No account keys loaded yet. Run <code>{OP_ACCOUNT_KEYS_LIST}</code>.
            </p>
          )}

          <label className="account-json-label">
            Key push input (JSON object)
            <textarea
              value={pushKeyInput}
              onChange={(event) => setPushKeyInput(event.target.value)}
              spellCheck={false}
              rows={5}
              aria-label="Account key push JSON input"
            />
          </label>
          <button
            type="button"
            className="action-btn"
            onClick={() => void handlePushKey()}
            disabled={isRunningAny || isOperationUnavailable(OP_ACCOUNT_KEYS_PUSH)}
          >
            {busyOperation === OP_ACCOUNT_KEYS_PUSH ? "Pushing key…" : "Push key"}
          </button>

          <label className="account-json-label">
            Key delete input (JSON object)
            <textarea
              value={deleteKeyInput}
              onChange={(event) => setDeleteKeyInput(event.target.value)}
              spellCheck={false}
              rows={4}
              aria-label="Account key delete JSON input"
            />
          </label>
          <button
            type="button"
            className="action-btn delete"
            onClick={() => void handleDeleteKey()}
            disabled={isRunningAny || isOperationUnavailable(OP_ACCOUNT_KEYS_DELETE)}
          >
            {busyOperation === OP_ACCOUNT_KEYS_DELETE ? "Deleting key…" : "Delete key"}
          </button>

          <div className="account-result-block">
            <h4>Latest keys operation</h4>
            {keysResult !== null ? (
              <pre>{prettyValue(keysResult)}</pre>
            ) : (
              <p className="account-empty">No account keys operation result yet.</p>
            )}
          </div>
        </section>

        <section className="account-panel">
          <header>
            <h3>Local Key Shortcuts (optional)</h3>
            <p>
              Operations: {OP_LOCAL_KEY_SHOW}, {OP_LOCAL_KEY_CREATE}, {" "}
              {OP_LOCAL_KEY_COPY}
            </p>
          </header>

          {availableOperationIds !== null && availableLocalCount === 0 ? (
            <p className="account-availability-hint">
              No local key shortcut operations are exposed by this daemon.
            </p>
          ) : null}

          <label className="account-json-label">
            Local key.show input (JSON object)
            <textarea
              value={localShowInput}
              onChange={(event) => setLocalShowInput(event.target.value)}
              spellCheck={false}
              rows={4}
              aria-label="Local key show JSON input"
            />
          </label>
          <button
            type="button"
            className="action-btn"
            onClick={() => void handleLocalShow()}
            disabled={isRunningAny || isOperationUnavailable(OP_LOCAL_KEY_SHOW)}
          >
            {busyOperation === OP_LOCAL_KEY_SHOW ? "Running key.show…" : "Run local key.show"}
          </button>

          <label className="account-json-label">
            Local key.create input (JSON object)
            <textarea
              value={localCreateInput}
              onChange={(event) => setLocalCreateInput(event.target.value)}
              spellCheck={false}
              rows={4}
              aria-label="Local key create JSON input"
            />
          </label>
          <button
            type="button"
            className="action-btn"
            onClick={() => void handleLocalCreate()}
            disabled={isRunningAny || isOperationUnavailable(OP_LOCAL_KEY_CREATE)}
          >
            {busyOperation === OP_LOCAL_KEY_CREATE ? "Running key.create…" : "Run local key.create"}
          </button>

          <button
            type="button"
            className="action-btn"
            onClick={() => void handleLocalCopy()}
            disabled={isRunningAny || isOperationUnavailable(OP_LOCAL_KEY_COPY)}
          >
            {busyOperation === OP_LOCAL_KEY_COPY ? "Running key.copy…" : "Run local key.copy"}
          </button>

          <div className="account-result-block">
            <h4>Latest local key shortcut result</h4>
            {localResult !== null ? (
              <pre>{prettyValue(localResult)}</pre>
            ) : (
              <p className="account-empty">No local shortcut result yet.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { daemonClient } from "../lib/daemonClient";
import { useDaemonSessions } from "./useDaemonSessions";

const STORAGE_KEY = "opta:daemon-connection";
const originalLocalStorage = globalThis.localStorage;

vi.mock("../lib/daemonClient", () => ({
  daemonClient: {
    connectWebSocket: vi.fn(() => ({ close: vi.fn(), send: vi.fn() })),
    health: vi.fn(),
    metrics: vi.fn(),
    createSession: vi.fn(),
    submitTurn: vi.fn(),
    resolvePermission: vi.fn(),
    cancel: vi.fn(),
  },
}));

function setStoredConnection(value: Record<string, unknown>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

function getStoredConnection(): Record<string, unknown> {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
}

function installMockLocalStorage() {
  const data = new Map<string, string>();
  const mockStorage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, String(value));
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
    clear: () => {
      data.clear();
    },
  };
  Object.defineProperty(globalThis, "localStorage", {
    value: mockStorage,
    configurable: true,
    writable: true,
  });
}

describe("useDaemonSessions secure connection persistence", () => {
  beforeEach(() => {
    installMockLocalStorage();
    setStoredConnection({
      host: "127.0.0.1",
      port: 9999,
      token: "",
    });
    delete (globalThis as { __TAURI__?: unknown }).__TAURI__;
    vi.mocked(daemonClient.health).mockResolvedValue({ status: "ok" } as never);
    vi.mocked(daemonClient.metrics).mockResolvedValue(null as never);
  });

  afterEach(() => {
    Object.defineProperty(globalThis, "localStorage", {
      value: originalLocalStorage,
      configurable: true,
      writable: true,
    });
    delete (globalThis as { __TAURI__?: unknown }).__TAURI__;
    vi.clearAllMocks();
  });

  it("loads host/port defaults from localStorage", async () => {
    setStoredConnection({
      host: "192.168.2.20",
      port: 9123,
      token: "legacy-token",
      protocol: "https",
    });

    const { result } = renderHook(() => useDaemonSessions());

    expect(result.current.connection.host).toBe("192.168.2.20");
    expect(result.current.connection.port).toBe(9123);
    expect(result.current.connection.protocol).toBe("https");
    expect(result.current.connection.token).toBe("legacy-token");

    await waitFor(() =>
      expect(daemonClient.health).toHaveBeenCalledTimes(1),
    );
  });

  it("loads token from secure store when Tauri bridge is available", async () => {
    setStoredConnection({
      host: "127.0.0.1",
      port: 9999,
      token: "legacy-token",
    });
    const invoke = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce("secure-token");
    (globalThis as { __TAURI__?: unknown }).__TAURI__ = {
      core: { invoke },
    };

    const { result } = renderHook(() => useDaemonSessions());

    await waitFor(() =>
      expect(result.current.connection.token).toBe("secure-token"),
    );
    expect(invoke).toHaveBeenCalledWith("set_connection_secret", {
      host: "127.0.0.1",
      port: 9999,
      token: "legacy-token",
    });
    expect(invoke).toHaveBeenCalledWith("get_connection_secret", {
      host: "127.0.0.1",
      port: 9999,
    });

    const stored = getStoredConnection();
    expect(stored.token).toBeUndefined();
  });

  it("keeps browser fallback behavior when Tauri bridge is unavailable", async () => {
    setStoredConnection({
      host: "127.0.0.1",
      port: 9999,
      token: "local-token",
    });

    const { result } = renderHook(() => useDaemonSessions());
    expect(result.current.connection.token).toBe("local-token");

    act(() => {
      result.current.setConnection({
        host: "127.0.0.1",
        port: 9999,
        token: "updated-token",
      });
    });

    const stored = getStoredConnection();
    expect(stored.token).toBe("updated-token");
  });

  it("does not clear secure token when switching endpoint with blank token", async () => {
    setStoredConnection({
      host: "127.0.0.1",
      port: 9999,
      token: "",
    });
    const invoke = vi.fn(async (command: string, args?: Record<string, unknown>) => {
      if (
        command === "get_connection_secret" &&
        args?.host === "10.0.0.8" &&
        args?.port === 7007
      ) {
        return "stored-token";
      }
      return "";
    });
    (globalThis as { __TAURI__?: unknown }).__TAURI__ = {
      core: { invoke },
    };

    const { result } = renderHook(() => useDaemonSessions());

    act(() => {
      result.current.setConnection({
        host: "10.0.0.8",
        port: 7007,
        token: "",
      });
    });

    await waitFor(() =>
      expect(result.current.connection.token).toBe("stored-token"),
    );
    expect(invoke).not.toHaveBeenCalledWith("delete_connection_secret", {
      host: "10.0.0.8",
      port: 7007,
    });
  });
});

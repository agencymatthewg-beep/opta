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
    sessionEvents: vi.fn(),
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
    vi.mocked(daemonClient.sessionEvents).mockResolvedValue({ events: [] } as never);
  });

  afterEach(() => {
    vi.useRealTimers();
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
    const invoke = vi.fn(async (command: string) => {
      if (command === "get_connection_secret") return "secure-token";
      return undefined;
    });
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

  it("adopts bootstrap daemon endpoint metadata when available", async () => {
    setStoredConnection({
      host: "127.0.0.1",
      port: 9999,
      token: "",
    });
    const invoke = vi.fn(async (command: string, args?: Record<string, unknown>) => {
      if (command === "bootstrap_daemon_connection") {
        return { host: "127.0.0.1", port: 10999 };
      }
      if (
        command === "get_connection_secret" &&
        args?.host === "127.0.0.1" &&
        args?.port === 10999
      ) {
        return "bootstrap-token";
      }
      return "";
    });
    (globalThis as { __TAURI__?: unknown }).__TAURI__ = {
      core: { invoke },
    };

    const { result } = renderHook(() => useDaemonSessions());

    await waitFor(() => expect(result.current.connection.port).toBe(10999));
    await waitFor(() => expect(result.current.connection.token).toBe("bootstrap-token"));
    expect(invoke).toHaveBeenCalledWith("bootstrap_daemon_connection", {
      startIfNeeded: true,
    });
    expect(invoke).toHaveBeenCalledWith("get_connection_secret", {
      host: "127.0.0.1",
      port: 10999,
    });
  });

  it("keeps browser fallback behavior when Tauri bridge is unavailable", async () => {
    setStoredConnection({
      host: "127.0.0.1",
      port: 9999,
      token: "local-token",
    });

    const { result } = renderHook(() => useDaemonSessions());
    await waitFor(() =>
      expect(daemonClient.health).toHaveBeenCalledTimes(1),
    );
    expect(result.current.connection.token).toBe("local-token");

    act(() => {
      result.current.setConnection({
        host: "127.0.0.1",
        port: 9999,
        token: "updated-token",
      });
    });

    await waitFor(() =>
      expect(result.current.connectionState).toBe("connected"),
    );

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

  it("does not reconnect existing sockets when a new tracked session is added", async () => {
    const connectCalls: string[] = [];
    vi.mocked(daemonClient.connectWebSocket).mockImplementation(
      (_connection, sessionId) => {
        connectCalls.push(sessionId);
        return { close: vi.fn(), send: vi.fn() } as never;
      },
    );

    const { result } = renderHook(() => useDaemonSessions());

    await act(async () => {
      await result.current.trackSession("sess-a");
    });
    await waitFor(() => expect(connectCalls).toEqual(["sess-a"]));

    await act(async () => {
      await result.current.trackSession("sess-b");
    });
    await act(async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    });

    expect(connectCalls.filter((id) => id === "sess-a")).toHaveLength(1);
    expect(connectCalls.filter((id) => id === "sess-b")).toHaveLength(1);
  });

  it("does not mark global connection disconnected on per-session websocket close", async () => {
    const onCloseBySession = new Map<string, (code: number) => void>();
    vi.mocked(daemonClient.connectWebSocket).mockImplementation(
      (_connection, sessionId, _afterSeq, handlers) => {
        onCloseBySession.set(sessionId, handlers.onClose ?? (() => undefined));
        return { close: vi.fn(), send: vi.fn() } as never;
      },
    );

    const { result } = renderHook(() => useDaemonSessions());

    await act(async () => {
      await result.current.trackSession("sess-stream");
    });

    await waitFor(() => expect(result.current.connectionState).toBe("connected"));
    expect(onCloseBySession.has("sess-stream")).toBe(true);

    act(() => {
      onCloseBySession.get("sess-stream")?.(1006);
    });

    await waitFor(() => expect(result.current.connectionState).toBe("connected"));
  });

  it("resumes websocket from max persisted seq after restart", async () => {
    const connectAfterSeq: number[] = [];
    vi.mocked(daemonClient.connectWebSocket).mockImplementation(
      (_connection, _sessionId, afterSeq) => {
        connectAfterSeq.push(afterSeq);
        return { close: vi.fn(), send: vi.fn() } as never;
      },
    );

    const invoke = vi.fn(async (command: string) => {
      if (command === "load_session_events") {
        return [
          JSON.stringify({ event: "turn.token", seq: 38, payload: { token: "A" } }),
          JSON.stringify({ event: "turn.done", seq: 40, payload: {} }),
        ];
      }
      if (command === "bootstrap_daemon_connection") {
        return { host: "127.0.0.1", port: 9999 };
      }
      return "";
    });
    (globalThis as { __TAURI__?: unknown }).__TAURI__ = {
      core: { invoke },
    };

    const { result } = renderHook(() => useDaemonSessions());

    await act(async () => {
      await result.current.trackSession("sess-resume");
    });

    await waitFor(() => expect(connectAfterSeq.length).toBeGreaterThan(0));
    expect(connectAfterSeq[0]).toBe(40);
  });

  it("fetches and merges gap events after persisted cursor", async () => {
    vi.mocked(daemonClient.sessionEvents).mockResolvedValue({
      events: [{ event: "turn.done", seq: 3, payload: {} }],
    } as never);
    const connectAfterSeq: number[] = [];
    vi.mocked(daemonClient.connectWebSocket).mockImplementation(
      (_connection, _sessionId, afterSeq) => {
        connectAfterSeq.push(afterSeq);
        return { close: vi.fn(), send: vi.fn() } as never;
      },
    );

    const invoke = vi.fn(async (command: string) => {
      if (command === "load_session_events") {
        return [JSON.stringify({ event: "turn.start", seq: 2, payload: {} })];
      }
      if (command === "bootstrap_daemon_connection") {
        return { host: "127.0.0.1", port: 9999 };
      }
      return "";
    });
    (globalThis as { __TAURI__?: unknown }).__TAURI__ = {
      core: { invoke },
    };

    const { result } = renderHook(() => useDaemonSessions());

    await act(async () => {
      await result.current.trackSession("sess-gap");
    });

    expect(daemonClient.sessionEvents).toHaveBeenCalledWith(
      expect.objectContaining({ host: "127.0.0.1", port: 9999 }),
      "sess-gap",
      2,
    );
    await waitFor(() => expect(connectAfterSeq[0]).toBe(3));
    await waitFor(() => {
      const timeline = result.current.timelineBySession["sess-gap"] ?? [];
      expect(timeline.some((item) => item.title === "Turn complete")).toBe(true);
    });
  });

  it("coalesces rapid token events into one assistant chunk", async () => {
    vi.useFakeTimers();
    const onEventBySession = new Map<string, (envelope: unknown) => void>();
    vi.mocked(daemonClient.connectWebSocket).mockImplementation(
      (_connection, sessionId, _afterSeq, handlers) => {
        onEventBySession.set(sessionId, handlers.onEvent as (envelope: unknown) => void);
        return { close: vi.fn(), send: vi.fn() } as never;
      },
    );

    const { result } = renderHook(() => useDaemonSessions());

    await act(async () => {
      await result.current.trackSession("sess-tokens");
    });

    const emit = onEventBySession.get("sess-tokens");
    expect(emit).toBeDefined();

    act(() => {
      emit?.({ event: "turn.token", seq: 1, payload: { token: "Hel" } });
      emit?.({ event: "turn.token", seq: 2, payload: { token: "lo" } });
      emit?.({ event: "turn.token", seq: 3, payload: { token: "!" } });
    });

    let items = result.current.timelineBySession["sess-tokens"] ?? [];
    expect(items.some((item) => item.kind === "assistant")).toBe(false);

    act(() => {
      vi.advanceTimersByTime(41);
    });
    await act(async () => {
      await Promise.resolve();
    });

    const assistantItems = (
      result.current.timelineBySession["sess-tokens"] ?? []
    ).filter((item) => item.kind === "assistant");
    expect(assistantItems).toHaveLength(1);
    expect(assistantItems[0]?.body).toBe("Hello!");
  });

  it("flushes buffered tokens before stop events", async () => {
    const onEventBySession = new Map<string, (envelope: unknown) => void>();
    vi.mocked(daemonClient.connectWebSocket).mockImplementation(
      (_connection, sessionId, _afterSeq, handlers) => {
        onEventBySession.set(sessionId, handlers.onEvent as (envelope: unknown) => void);
        return { close: vi.fn(), send: vi.fn() } as never;
      },
    );

    const { result } = renderHook(() => useDaemonSessions());

    await act(async () => {
      await result.current.trackSession("sess-stop");
    });

    const emit = onEventBySession.get("sess-stop");
    expect(emit).toBeDefined();

    act(() => {
      emit?.({ event: "turn.token", seq: 1, payload: { token: "Hi" } });
      emit?.({ event: "turn.done", seq: 2, payload: {} });
    });

    await waitFor(() => {
      const items = result.current.timelineBySession["sess-stop"] ?? [];
      const assistants = items.filter((item) => item.kind === "assistant");
      const systems = items.filter((item) => item.kind === "system");
      expect(assistants).toHaveLength(1);
      expect(assistants[0]?.body).toBe("Hi");
      expect(systems.some((item) => item.title === "Turn complete")).toBe(true);
    });
  });

  it("reconnects when server closes websocket cleanly", async () => {
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0);
    const onCloseBySession = new Map<string, (code: number) => void>();
    const connectCalls: string[] = [];

    vi.mocked(daemonClient.connectWebSocket).mockImplementation(
      (_connection, sessionId, _afterSeq, handlers) => {
        connectCalls.push(sessionId);
        onCloseBySession.set(sessionId, handlers.onClose ?? (() => undefined));
        return { close: vi.fn(), send: vi.fn() } as never;
      },
    );

    const { result } = renderHook(() => useDaemonSessions());
    await act(async () => {
      await result.current.trackSession("sess-reconnect");
    });
    await waitFor(() =>
      expect(connectCalls.filter((id) => id === "sess-reconnect")).toHaveLength(1),
    );

    act(() => {
      onCloseBySession.get("sess-reconnect")?.(1000);
    });

    await waitFor(
      () =>
        expect(connectCalls.filter((id) => id === "sess-reconnect")).toHaveLength(2),
      { timeout: 2_500 },
    );
    randomSpy.mockRestore();
  });

  it("keeps global connection live on non-transport submit errors", async () => {
    vi.mocked(daemonClient.submitTurn).mockRejectedValue(
      new Error("Validation failed"),
    );

    const { result } = renderHook(() => useDaemonSessions());
    await act(async () => {
      await result.current.trackSession("sess-submit");
    });
    await waitFor(() => expect(result.current.connectionState).toBe("connected"));

    await expect(
      result.current.submitMessage("hello world", "chat"),
    ).rejects.toThrow("Validation failed");
    expect(result.current.connectionState).toBe("connected");
  });

  it("marks connection disconnected on transport submit errors", async () => {
    vi.mocked(daemonClient.submitTurn).mockRejectedValue(
      new Error("ECONNREFUSED 127.0.0.1:9999"),
    );

    const { result } = renderHook(() => useDaemonSessions());
    await act(async () => {
      await result.current.trackSession("sess-transport-error");
    });
    await waitFor(() => expect(result.current.connectionState).toBe("connected"));

    await expect(
      result.current.submitMessage("hello world", "chat"),
    ).rejects.toThrow("ECONNREFUSED");
    await waitFor(() => expect(result.current.connectionState).toBe("disconnected"));
  });
});

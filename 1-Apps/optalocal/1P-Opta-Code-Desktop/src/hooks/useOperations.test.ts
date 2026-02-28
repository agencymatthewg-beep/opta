import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { daemonClient } from "../lib/daemonClient";
import { useOperations } from "./useOperations";

vi.mock("../lib/daemonClient", () => ({
  daemonClient: {
    listOperations: vi.fn(),
    runOperation: vi.fn(),
  },
}));

const connection = { host: "127.0.0.1", port: 9999, token: "test" };

const mockOperations = [
  { id: "doctor", title: "Doctor", description: "Diagnostics.", safety: "read" as const },
  { id: "benchmark", title: "Benchmark Suite", description: "Benchmark.", safety: "dangerous" as const },
];

describe("useOperations", () => {
  beforeEach(() => {
    vi.mocked(daemonClient.listOperations).mockResolvedValue({
      operations: mockOperations as never,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("loads the operation catalog on mount", async () => {
    const { result } = renderHook(() => useOperations(connection));

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.operations).toHaveLength(2);
    expect(result.current.operations[0].id).toBe("doctor");
    expect(result.current.error).toBeNull();
  });

  it("surfaces an error when the catalog fetch fails", async () => {
    vi.mocked(daemonClient.listOperations).mockRejectedValueOnce(
      new Error("daemon not running"),
    );

    const { result } = renderHook(() => useOperations(connection));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe("daemon not running");
    expect(result.current.operations).toHaveLength(0);
  });

  it("runs an operation and sets lastResult on success", async () => {
    const successResult = {
      ok: true,
      id: "doctor",
      safety: "read",
      result: { checks: [] },
    };
    vi.mocked(daemonClient.runOperation).mockResolvedValueOnce(
      successResult as never,
    );

    const { result } = renderHook(() => useOperations(connection));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await result.current.runOperation("doctor", {});
    await waitFor(() => expect(result.current.running).toBe(false));

    expect(result.current.lastResult).toMatchObject({ ok: true, id: "doctor" });
    expect(daemonClient.runOperation).toHaveBeenCalledWith(
      connection,
      "doctor",
      { input: {} },
    );
  });

  it("sets confirmDangerous in payload when provided", async () => {
    vi.mocked(daemonClient.runOperation).mockResolvedValueOnce({
      ok: false,
      id: "benchmark",
      safety: "dangerous",
      error: { code: "execution_failed", message: "failed" },
    } as never);

    const { result } = renderHook(() => useOperations(connection));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await result.current.runOperation("benchmark", {}, true);
    await waitFor(() => expect(result.current.running).toBe(false));

    expect(daemonClient.runOperation).toHaveBeenCalledWith(
      connection,
      "benchmark",
      { input: {}, confirmDangerous: true },
    );
  });

  it("captures client errors into lastResult", async () => {
    vi.mocked(daemonClient.runOperation).mockRejectedValueOnce(
      new Error("network error"),
    );

    const { result } = renderHook(() => useOperations(connection));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await result.current.runOperation("doctor", {});
    await waitFor(() => expect(result.current.running).toBe(false));

    expect(result.current.lastResult).toMatchObject({
      ok: false,
      error: { code: "client_error", message: "network error" },
    });
  });
});

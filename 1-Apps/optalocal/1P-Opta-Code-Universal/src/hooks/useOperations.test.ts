import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  DaemonListOperationsResponse,
  DaemonRunOperationResponse,
} from "@opta/daemon-client/types";
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
] satisfies DaemonListOperationsResponse["operations"];

describe("useOperations", () => {
  beforeEach(() => {
    vi.mocked(daemonClient.listOperations).mockResolvedValue({
      operations: mockOperations,
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

  it("normalizes operations with missing metadata safely", async () => {
    vi.mocked(daemonClient.listOperations).mockResolvedValueOnce({
      operations: [
        {
          id: "mystery.task",
        },
      ],
    } as unknown as DaemonListOperationsResponse);

    const { result } = renderHook(() => useOperations(connection));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.operations).toEqual([
      {
        id: "mystery.task",
        title: "mystery.task",
        description: "No description provided.",
        safety: "read",
      },
    ]);
  });

  it("runs an operation and sets lastResult on success", async () => {
    const successResult = {
      ok: true,
      id: "doctor",
      safety: "read",
      result: { checks: [] },
    } as const satisfies DaemonRunOperationResponse;
    vi.mocked(daemonClient.runOperation).mockResolvedValueOnce(successResult);

    const { result } = renderHook(() => useOperations(connection));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.runOperation("doctor", {});
    });
    await waitFor(() => expect(result.current.running).toBe(false));

    expect(result.current.lastResult).toMatchObject({ ok: true, id: "doctor" });
    expect(daemonClient.runOperation).toHaveBeenCalledWith(
      connection,
      "doctor",
      { input: {} },
    );
  });

  it("sets confirmDangerous in payload when provided", async () => {
    const failResult = {
      ok: false,
      id: "benchmark",
      safety: "dangerous",
      error: { code: "execution_failed", message: "failed" },
    } as const satisfies DaemonRunOperationResponse;
    vi.mocked(daemonClient.runOperation).mockResolvedValueOnce(failResult);

    const { result } = renderHook(() => useOperations(connection));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.runOperation("benchmark", {}, true);
    });
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

    await act(async () => {
      await result.current.runOperation("doctor", {});
    });
    await waitFor(() => expect(result.current.running).toBe(false));

    expect(result.current.lastResult).toMatchObject({
      ok: false,
      error: { code: "client_error", message: "network error" },
    });
  });

  it("normalizes responses that do not include an ok flag", async () => {
    vi.mocked(daemonClient.runOperation).mockResolvedValueOnce({
      output: "value",
    } as unknown as DaemonRunOperationResponse);

    const { result } = renderHook(() => useOperations(connection));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.runOperation("doctor", {});
    });
    await waitFor(() => expect(result.current.running).toBe(false));

    expect(result.current.lastResult).toMatchObject({
      ok: true,
      id: "doctor",
      safety: "read",
      result: { output: "value" },
    });
  });

  it("normalizes string operation errors into structured error details", async () => {
    vi.mocked(daemonClient.runOperation).mockResolvedValueOnce({
      ok: false,
      error: "boom",
    } as unknown as DaemonRunOperationResponse);

    const { result } = renderHook(() => useOperations(connection));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.runOperation("doctor", {});
    });
    await waitFor(() => expect(result.current.running).toBe(false));

    expect(result.current.lastResult).toMatchObject({
      ok: false,
      id: "doctor",
      safety: "read",
      error: { code: "operation_error", message: "boom" },
    });
  });
});

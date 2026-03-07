import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useBrowserLiveHost } from "./useBrowserLiveHost";

const fetchBrowserLiveHostStatus = vi.fn();
const runOperation = vi.fn();

vi.mock("../lib/browserLiveHostClient", () => ({
  fetchBrowserLiveHostStatus: (...args: unknown[]) =>
    fetchBrowserLiveHostStatus(...args),
}));

vi.mock("../lib/daemonClient", () => ({
  daemonClient: {
    runOperation: (...args: unknown[]) => runOperation(...args),
  },
}));

const connection = {
  host: "127.0.0.1",
  port: 9999,
  token: "daemon-token",
  protocol: "http" as const,
};

describe("useBrowserLiveHost", () => {
  beforeEach(() => {
    runOperation.mockReset();
    fetchBrowserLiveHostStatus.mockReset();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  it("does not local-scan when a daemon connection exists but browser.host is unavailable", async () => {
    runOperation.mockResolvedValue({ ok: false, error: { code: "unavailable" } });
    fetchBrowserLiveHostStatus.mockResolvedValue({
      running: true,
      host: "127.0.0.1",
      safePorts: [46000],
      scannedCandidateCount: 1,
      requiredPortCount: 2,
      maxSessionSlots: 1,
      includePeekabooScreen: false,
      screenActionsEnabled: false,
      openSessionCount: 0,
      slots: [],
    });

    const { result, unmount } = renderHook(() => useBrowserLiveHost(connection));

    await waitFor(() => {
      expect(runOperation).toHaveBeenCalledTimes(1);
    });

    expect(fetchBrowserLiveHostStatus).not.toHaveBeenCalled();
    expect(result.current.status).toBeNull();
    expect(result.current.isActive).toBe(false);
    unmount();
  });

  it("falls back to local live-host probing only when no daemon connection is available", async () => {
    fetchBrowserLiveHostStatus.mockResolvedValue({
      running: true,
      host: "127.0.0.1",
      safePorts: [46000],
      scannedCandidateCount: 1,
      requiredPortCount: 2,
      maxSessionSlots: 1,
      includePeekabooScreen: false,
      screenActionsEnabled: false,
      openSessionCount: 1,
      slots: [{ slotIndex: 0, port: 46001, sessionId: "sess-1" }],
    });

    const { result, unmount } = renderHook(() => useBrowserLiveHost());

    await waitFor(() => {
      expect(fetchBrowserLiveHostStatus).toHaveBeenCalledTimes(1);
    });

    expect(runOperation).not.toHaveBeenCalled();
    expect(result.current.isActive).toBe(true);
    expect(result.current.getSlotForSession("sess-1")?.port).toBe(46001);
    unmount();
  });
});

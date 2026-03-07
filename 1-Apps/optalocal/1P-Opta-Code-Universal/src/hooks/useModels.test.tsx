import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useModels } from "./useModels";
import { daemonClient } from "../lib/daemonClient";

vi.mock("../lib/daemonClient", () => ({
  daemonClient: {
    lmxStatus: vi.fn(),
    lmxDiscovery: vi.fn(),
    lmxModels: vi.fn(),
    lmxMemory: vi.fn(),
    lmxAvailable: vi.fn(),
    extractLmxEndpointCandidates: vi.fn(),
    configGet: vi.fn(),
    configSet: vi.fn(),
    lmxLoad: vi.fn(),
    lmxConfirmLoad: vi.fn(),
    lmxDownloadProgress: vi.fn(),
    lmxDownloads: vi.fn(),
    lmxUnload: vi.fn(),
    lmxDelete: vi.fn(),
    lmxDownload: vi.fn(),
    runOperation: vi.fn(),
  },
}));

const connection = {
  host: "127.0.0.1",
  port: 9999,
  token: "daemon-token",
  protocol: "http" as const,
};

describe("useModels", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(daemonClient.lmxStatus).mockResolvedValue({
      status: "ok",
      version: "1.0.0",
      models: [],
    });
    vi.mocked(daemonClient.lmxDiscovery).mockResolvedValue({
      service: "opta-lmx",
      endpoints: { preferred_base_url: "http://10.0.0.5:1234" },
      target: {
        host: "10.0.0.5",
        port: 1234,
        fallbackHosts: ["10.0.0.6"],
        autoDiscover: true,
      },
    });
    vi.mocked(daemonClient.lmxModels).mockResolvedValue({ models: [] });
    vi.mocked(daemonClient.lmxMemory).mockResolvedValue({
      total_unified_memory_gb: 64,
      used_gb: 8,
      available_gb: 56,
      models: {},
    });
    vi.mocked(daemonClient.lmxAvailable).mockResolvedValue([]);
    vi.mocked(daemonClient.extractLmxEndpointCandidates).mockReturnValue([]);
    vi.mocked(daemonClient.configGet).mockResolvedValue(null);
  });

  it("derives lmxTarget from daemon discovery without reading connection config keys", async () => {
    const { result } = renderHook(() => useModels(connection));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.lmxTarget).toEqual({
      host: "10.0.0.5",
      port: 1234,
      fallbackHosts: ["10.0.0.6"],
      autoDiscover: true,
    });
    expect(daemonClient.configGet).not.toHaveBeenCalled();
  });
});

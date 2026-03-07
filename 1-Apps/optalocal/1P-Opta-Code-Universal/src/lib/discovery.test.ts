import { beforeEach, describe, expect, it, vi } from "vitest";
import { discoverLmxCandidates } from "./discovery";

const discoveryList = vi.fn();
const discoverLmxViaMdnsHints = vi.fn();

vi.mock("./daemonClient", () => ({
  daemonClient: {
    discoveryList: (...args: unknown[]) => discoveryList(...args),
  },
}));

vi.mock("./lanScanner", async () => {
  const actual = await vi.importActual<typeof import("./lanScanner")>("./lanScanner");
  return {
    ...actual,
    discoverLmxViaMdnsHints: (...args: unknown[]) =>
      discoverLmxViaMdnsHints(...args),
  };
});

const connection = {
  host: "127.0.0.1",
  port: 9999,
  token: "daemon-token",
  protocol: "http" as const,
};

describe("discoverLmxCandidates", () => {
  beforeEach(() => {
    discoveryList.mockReset();
    discoverLmxViaMdnsHints.mockReset();
  });

  it("prefers daemon-backed discovery before direct mDNS probing", async () => {
    discoveryList.mockResolvedValue([
      {
        host: "10.0.0.12",
        port: 1234,
        name: "LMX (preferred_base_url)",
        source: "mdns",
        reachable: true,
      },
    ]);

    const results = await discoverLmxCandidates(connection);

    expect(results).toEqual([
      expect.objectContaining({
        host: "10.0.0.12",
        port: 1234,
        via: "daemon",
      }),
    ]);
    expect(discoverLmxViaMdnsHints).not.toHaveBeenCalled();
  });

  it("falls back to direct mDNS probing when daemon-backed discovery is empty", async () => {
    discoveryList.mockResolvedValue([]);
    discoverLmxViaMdnsHints.mockResolvedValue([
      {
        host: "lmx-host.local",
        port: 1234,
        latencyMs: 42,
        via: "mdns-hint",
      },
    ]);

    const results = await discoverLmxCandidates(connection);

    expect(discoverLmxViaMdnsHints).toHaveBeenCalledTimes(1);
    expect(results).toEqual([
      expect.objectContaining({
        host: "lmx-host.local",
        port: 1234,
        via: "mdns-hint",
      }),
    ]);
  });
});

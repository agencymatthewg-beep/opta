import { render, screen } from "@testing-library/react";
import { vi, it, expect, beforeEach } from "vitest";
import { WidgetLmxStatus } from "./WidgetLmxStatus";
import * as useModelsModule from "../../hooks/useModels";

beforeEach(() => {
  vi.spyOn(useModelsModule, "useModels").mockReturnValue({
    lmxReachable: true,
    loadedModels: [{ id: "kimi-k2-3bit", name: "Kimi K2.5", loaded: true } as any],
    lmxStatus: { state: "connected", latencyMs: 22 } as any,
    lmxDiscovery: null,
    lmxEndpointCandidates: [],
    lmxTarget: null,
    availableModels: [],
    memory: null,
    loading: false,
    error: null,
  } as any);
});

it("shows connected state", () => {
  render(<WidgetLmxStatus connection={{ host: "192.168.188.11", port: 1234 } as any} />);
  expect(screen.getByText("CONNECTED")).toBeInTheDocument();
  expect(screen.getByText("Kimi K2.5")).toBeInTheDocument();
  expect(screen.getByText(/22.*ms/)).toBeInTheDocument();
});

it("shows disconnected state", () => {
  vi.spyOn(useModelsModule, "useModels").mockReturnValue({
    lmxReachable: false, loadedModels: [], lmxStatus: null, lmxDiscovery: null,
    lmxEndpointCandidates: [], lmxTarget: null, availableModels: [], memory: null,
    loading: false, error: "unreachable",
  } as any);
  render(<WidgetLmxStatus connection={{ host: "192.168.188.11", port: 1234 } as any} />);
  expect(screen.getByText("OFFLINE")).toBeInTheDocument();
});

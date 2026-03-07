import { render } from "@testing-library/react";
import { it, expect, vi } from "vitest";
import { WidgetContent } from "./WidgetPane";
import type { WidgetId } from "../../types";

// Mock hooks that make network calls
vi.mock("../../hooks/useModels", () => ({
  useModels: () => ({
    lmxReachable: false, loadedModels: [], lmxStatus: null,
    lmxDiscovery: null, lmxEndpointCandidates: [], lmxTarget: null,
    availableModels: [], memory: null, loading: false, error: null,
    loadModel: vi.fn(), confirmLoad: vi.fn(), downloadProgress: vi.fn(),
    listDownloads: vi.fn(), unloadModel: vi.fn(), deleteModel: vi.fn(),
    downloadModel: vi.fn(), runModelHistory: vi.fn(), runModelHealth: vi.fn(),
    runModelScan: vi.fn(), saveLmxTarget: vi.fn(), refreshLmx: vi.fn(),
  }),
}));

// WidgetCommandBar reads localStorage on mount
vi.stubGlobal("localStorage", { getItem: () => null, setItem: vi.fn() });

const V2_WIDGET_IDS: WidgetId[] = [
  "lmx-status",
  "context-bar",
  "active-tool",
  "session-memory",
  "model-switcher",
  "latency-sparkline",
  "daemon-ring",
  "command-bar",
  "working-dir",
  "browser-session",
];

it.each(V2_WIDGET_IDS)("widget '%s' renders without throwing", (widgetId) => {
  expect(() =>
    render(
      <WidgetContent
        widgetId={widgetId}
        timelineItems={[]}
        rawEvents={[]}
        connection={null}
        sessionId={null}
        connectionHealth={null}
        projectCwd={null}
      />
    )
  ).not.toThrow();
});

import type { ComponentProps } from "react";
import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const preloadSettingsModalLazyTab = vi.hoisted(() => vi.fn());

const daemonClientMock = vi.hoisted(() => ({
  configGet: vi.fn(),
  configSet: vi.fn(),
  lmxDiscovery: vi.fn(),
  extractLmxEndpointCandidates: vi.fn(),
  runOperation: vi.fn(),
  health: vi.fn(),
  lmxStatus: vi.fn(),
}));

vi.mock("../lib/connectionProbe", () => ({
  probeDaemonConnection: vi.fn(),
}));

vi.mock("../lib/daemonClient", () => ({
  daemonClient: daemonClientMock,
}));

vi.mock("./settings/ConnectionAddressBook", () => ({
  ConnectionAddressBook: () => (
    <div data-testid="settings-tab-connection-address-book" />
  ),
}));

vi.mock("./settings/SettingsTabModelProvider", () => ({
  SettingsTabModelProvider: () => (
    <div data-testid="settings-tab-model-provider" />
  ),
}));

vi.mock("./settings/SettingsTabPermissions", () => ({
  SettingsTabPermissions: () => <div data-testid="settings-tab-permissions" />,
}));

vi.mock("./settings/SettingsTabSafety", () => ({
  SettingsTabSafety: () => <div data-testid="settings-tab-safety" />,
}));

vi.mock("./settings/SettingsTabBrowser", () => ({
  SettingsTabBrowser: () => <div data-testid="settings-tab-browser" />,
}));

vi.mock("./settings/SettingsTabResearch", () => ({
  SettingsTabResearch: () => <div data-testid="settings-tab-research" />,
}));

vi.mock("./settings/SettingsTabToolsAgents", () => ({
  SettingsTabToolsAgents: () => (
    <div data-testid="settings-tab-tools-agents" />
  ),
}));

vi.mock("./settings/SettingsTabLearning", () => ({
  SettingsTabLearning: () => <div data-testid="settings-tab-learning" />,
}));

vi.mock("./settings/SettingsTabPolicy", () => ({
  SettingsTabPolicy: () => <div data-testid="settings-tab-policy" />,
}));

vi.mock("./settings/SettingsTabMcp", () => ({
  SettingsTabMcp: () => <div data-testid="settings-tab-mcp" />,
}));

vi.mock("./settings/SettingsTabFleet", () => ({
  SettingsTabFleet: () => <div data-testid="settings-tab-fleet" />,
}));

vi.mock("./settings/SettingsTabSecrets", () => ({
  SettingsTabSecrets: () => <div data-testid="settings-tab-secrets" />,
}));

vi.mock("./settingsModalLazyPages", async () => {
  const React = await import("react");

  const resolvedLazy = (label: string) =>
    React.lazy(async () => ({
      default: () => <div>{label}</div>,
    }));

  const pendingLazy = React.lazy(
    () =>
      new Promise<never>(() => {
        // Keep pending to assert suspense fallback deterministically.
      }),
  );

  const rejectedLazy = React.lazy(async () => {
    throw new Error("mock session-memory chunk failure");
  });

  return {
    LazyAccountControlPage: resolvedLazy("Account Control Loaded"),
    LazyAppCatalogPage: pendingLazy,
    LazyBackgroundJobsPage: resolvedLazy("Background Jobs Loaded"),
    LazyCliOperationsPage: resolvedLazy("CLI Operations Loaded"),
    LazyConfigStudioPage: resolvedLazy("Config Studio Loaded"),
    LazyDaemonControlPage: resolvedLazy("Daemon Control Loaded"),
    LazyDaemonLogsPage: resolvedLazy("Daemon Logs Loaded"),
    LazyEnvProfilesPage: resolvedLazy("Environment Profiles Loaded"),
    LazyMcpManagementPage: resolvedLazy("MCP Management Loaded"),
    LazyModelAliasesPage: resolvedLazy("Model Aliases Loaded"),
    LazySessionMemoryPage: rejectedLazy,
    LazySystemInfoPage: resolvedLazy("System Info Loaded"),
    LazySystemOperationsPage: resolvedLazy("System Operations Loaded"),
    preloadSettingsModalLazyTab,
  };
});

import { SettingsModal } from "./SettingsModal";

type SettingsModalProps = ComponentProps<typeof SettingsModal>;

const baseProps: SettingsModalProps = {
  isOpen: true,
  onClose: vi.fn(),
  connection: {
    host: "127.0.0.1",
    port: 9999,
    token: "test-token",
  },
  onSaveConnection: vi.fn(),
  embedded: true,
  isDeepLayer: true,
  activeTab: "daemon-runtime",
};

async function renderSettingsModal(
  overrides: Partial<SettingsModalProps> = {},
) {
  const props: SettingsModalProps = {
    ...baseProps,
    ...overrides,
  };
  const rendered = render(<SettingsModal {...props} />);
  await act(async () => {
    await Promise.resolve();
  });
  return rendered;
}

describe("SettingsModal", () => {
  beforeEach(() => {
    preloadSettingsModalLazyTab.mockReset();

    daemonClientMock.configGet.mockReset();
    daemonClientMock.configGet.mockImplementation(
      () =>
        new Promise(() => {
          // Keep remote settings fetch pending in tests to avoid extra async churn.
        }),
    );
    daemonClientMock.configSet.mockReset();
    daemonClientMock.configSet.mockResolvedValue(undefined);
    daemonClientMock.lmxDiscovery.mockReset();
    daemonClientMock.lmxDiscovery.mockImplementation(
      () =>
        new Promise(() => {
          // Keep remote discovery pending in tests to avoid extra async churn.
        }),
    );
    daemonClientMock.extractLmxEndpointCandidates.mockReset();
    daemonClientMock.extractLmxEndpointCandidates.mockReturnValue([]);
    daemonClientMock.runOperation.mockReset();
    daemonClientMock.runOperation.mockResolvedValue({ ok: true });
    daemonClientMock.health.mockReset();
    daemonClientMock.health.mockResolvedValue({ status: "ok" });
    daemonClientMock.lmxStatus.mockReset();
    daemonClientMock.lmxStatus.mockResolvedValue({ models: [] });
  });

  it.each([false, true])(
    "keeps header/chrome structure consistent in deep layer (fullscreen=%s)",
    async (isFullscreen) => {
      const { container } = await renderSettingsModal({
        isFullscreen,
        activeTab: "daemon-runtime",
      });

      expect(screen.getByText("Keyboard Layout")).toBeInTheDocument();
      // "OPTA SETTINGS" static label was removed in the logo redesign; logo
      // now renders the active tab name dynamically (e.g. "DAEMON").
      expect(screen.getByLabelText("DAEMON")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /close settings/i }),
      ).toBeInTheDocument();

      expect(
        container.querySelectorAll(".opta-studio-top-chrome-left"),
      ).toHaveLength(1);
      expect(
        container.querySelectorAll(".opta-studio-top-chrome-center"),
      ).toHaveLength(1);
      expect(
        container.querySelectorAll(".opta-studio-top-chrome-right"),
      ).toHaveLength(1);
      expect(container.querySelectorAll(".opta-studio-panel-title")).toHaveLength(1);
      expect(
        container.querySelectorAll(".opta-studio-category-wheel-shell"),
      ).toHaveLength(1);
      expect(
        container.querySelectorAll(".opta-studio-category-copy"),
      ).toHaveLength(1);
      expect(screen.getAllByText("Daemon Runtime")).toHaveLength(1);

      if (isFullscreen) {
        expect(
          container.querySelector(".opta-studio-shell--fullscreen"),
        ).toBeInTheDocument();
      } else {
        expect(
          container.querySelector(".opta-studio-shell--fullscreen"),
        ).not.toBeInTheDocument();
      }
    },
  );

  it("shows lazy chunk fallback while Apps Catalog is pending", async () => {
    await renderSettingsModal({ activeTab: "apps-catalog" });

    const fallback = await screen.findByRole("status");
    expect(fallback).toHaveTextContent("Loading Apps Catalog");
    expect(fallback).toHaveTextContent(
      "This section is loaded on demand to reduce initial Settings Studio bundle cost.",
    );
  });

  it("shows lazy chunk error boundary when Session Memory chunk rejects", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const expectedChunkError = "mock session-memory chunk failure";

    const handleExpectedWindowError = (event: ErrorEvent) => {
      if (event.message.includes(expectedChunkError)) {
        event.preventDefault();
      }
    };
    const handleExpectedUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reasonText =
        event.reason instanceof Error
          ? event.reason.message
          : String(event.reason);
      if (reasonText.includes(expectedChunkError)) {
        event.preventDefault();
      }
    };

    window.addEventListener("error", handleExpectedWindowError);
    window.addEventListener(
      "unhandledrejection",
      handleExpectedUnhandledRejection,
    );

    try {
      await renderSettingsModal({ activeTab: "session-memory" });
      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent("Session Memory failed to load");
      expect(alert).toHaveTextContent(expectedChunkError);
    } finally {
      window.removeEventListener("error", handleExpectedWindowError);
      window.removeEventListener(
        "unhandledrejection",
        handleExpectedUnhandledRejection,
      );
      consoleErrorSpy.mockRestore();
    }
  });
});

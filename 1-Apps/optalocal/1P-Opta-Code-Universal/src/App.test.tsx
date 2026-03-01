import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { useDaemonSessions } from "./hooks/useDaemonSessions";

vi.mock("./lib/runtime", () => ({
  getTauriInvoke: () => null,
  isNativeDesktop: () => false,
}));

vi.mock("./lib/sessionExporter", () => ({
  downloadAsFile: vi.fn(),
  exportToMarkdown: vi.fn().mockReturnValue("# session"),
}));

vi.mock("./hooks/useDaemonSessions", () => ({
  useDaemonSessions: vi.fn(),
}));

vi.mock("./hooks/useBrowserLiveHost", () => ({
  useBrowserLiveHost: () => ({
    getSlotForSession: () => undefined,
  }),
}));

vi.mock("./components/Composer", () => ({
  Composer: () => <div>ComposerMock</div>,
}));

vi.mock("./components/WorkspaceRail", () => ({
  WorkspaceRail: () => <div>WorkspaceRailMock</div>,
}));

vi.mock("./components/TimelineCards", () => ({
  TimelineCards: () => <div>TimelineCardsMock</div>,
}));

vi.mock("./components/DaemonPanel", () => ({
  DaemonPanel: () => <div>DaemonPanelMock</div>,
}));

vi.mock("./components/LiveBrowserView", () => ({
  LiveBrowserView: () => <div>LiveBrowserViewMock</div>,
}));

vi.mock("./components/SettingsModal", () => ({
  SettingsModal: () => null,
}));

vi.mock("./components/SetupWizard", () => ({
  SetupWizard: () => <div>SetupWizardMock</div>,
}));

vi.mock("./components/OptaRing", () => ({
  OptaRing: () => <div>OptaRingMock</div>,
}));

vi.mock("./pages/ModelsPage", () => ({
  ModelsPage: () => <div>ModelsPageMock</div>,
}));

vi.mock("./pages/OperationsPage", () => ({
  OperationsPage: () => <div>OperationsPageMock</div>,
}));

vi.mock("./pages/ConfigStudioPage", () => ({
  ConfigStudioPage: () => <div>ConfigStudioPageMock</div>,
}));

vi.mock("./pages/AccountControlPage", () => ({
  AccountControlPage: () => <div>AccountControlPageMock</div>,
}));

vi.mock("./pages/BackgroundJobsPage", () => ({
  BackgroundJobsPage: () => <div>BackgroundJobsPageMock</div>,
}));

vi.mock("./pages/DaemonLogsPage", () => ({
  DaemonLogsPage: () => <div>DaemonLogsPageMock</div>,
}));

describe("App account controls wiring", () => {
  beforeEach(() => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: vi.fn().mockReturnValue(null),
        setItem: vi.fn(),
        removeItem: vi.fn(),
      },
    });

    vi.mocked(useDaemonSessions).mockReturnValue({
      activeSessionId: null,
      cancelActiveTurn: vi.fn().mockResolvedValue(undefined),
      connection: { host: "127.0.0.1", port: 9999, token: "token" },
      connectionError: null,
      connectionState: "connected",
      isStreaming: false,
      pendingPermissions: [],
      streamingBySession: {},
      pendingPermissionsBySession: {},
      refreshNow: vi.fn().mockResolvedValue(undefined),
      resolvePermission: vi.fn().mockResolvedValue(undefined),
      runtime: null,
      sessions: [],
      setActiveSessionId: vi.fn(),
      setConnection: vi.fn(),
      submitMessage: vi.fn().mockResolvedValue(undefined),
      timelineBySession: {},
      trackSession: vi.fn().mockResolvedValue(undefined),
      createSession: vi.fn().mockResolvedValue("sess_1"),
      removeSession: vi.fn(),
      initialCheckDone: true,
    } as never);
  });

  it("renders Account tab and switches to AccountControlPage", async () => {
    render(<App />);

    const accountTab = await screen.findByRole("button", { name: "Account" });
    fireEvent.click(accountTab);

    expect(screen.getByText("AccountControlPageMock")).toBeInTheDocument();
  });

  it("opens account controls via command palette command", async () => {
    render(<App />);

    const paletteTrigger = await screen.findByRole("button", {
      name: "Palette (Cmd/Ctrl+K)",
    });
    fireEvent.click(paletteTrigger);

    const paletteDialog = await screen.findByRole("dialog", {
      name: "Command palette",
    });

    fireEvent.change(
      within(paletteDialog).getByPlaceholderText("Type to search commands..."),
      {
        target: { value: "account controls" },
      },
    );

    const commandButton = await within(paletteDialog).findByRole("button", {
      name: /Open account controls/i,
    });
    fireEvent.click(commandButton);

    await waitFor(() => {
      expect(screen.getByText("AccountControlPageMock")).toBeInTheDocument();
    });
  });
});

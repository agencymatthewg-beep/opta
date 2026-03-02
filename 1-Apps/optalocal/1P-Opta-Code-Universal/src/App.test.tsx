import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

vi.mock("./pages/EnvProfilesPage", () => ({
  EnvProfilesPage: () => <div>EnvProfilesPageMock</div>,
}));

vi.mock("./pages/McpManagementPage", () => ({
  McpManagementPage: () => <div>McpManagementPageMock</div>,
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
  const makeDaemonState = (
    overrides: Partial<ReturnType<typeof useDaemonSessions>>,
  ) =>
    ({
      activeSessionId: null,
      cancelActiveTurn: vi.fn().mockResolvedValue(undefined),
      connection: { host: "127.0.0.1", port: 9999, token: "token" },
      connectionError: null,
      connectionState: "connected",
      isStreaming: false,
      pendingPermissions: [],
      streamingBySession: {},
      pendingPermissionsBySession: {},
      repairConnection: vi.fn().mockResolvedValue(undefined),
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
      runtimePollDelayMs: 4_000,
      ...overrides,
    }) as never;

  beforeEach(() => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: vi.fn().mockReturnValue(null),
        setItem: vi.fn(),
        removeItem: vi.fn(),
      },
    });

    vi.mocked(useDaemonSessions).mockReturnValue(makeDaemonState({}));
  });

  afterEach(() => {
    vi.useRealTimers();
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

  it("renders Env and MCP tabs and switches pages", async () => {
    render(<App />);

    const envTab = await screen.findByRole("button", { name: "Env" });
    fireEvent.click(envTab);
    expect(screen.getByText("EnvProfilesPageMock")).toBeInTheDocument();

    const mcpTab = screen.getByRole("button", { name: "MCP" });
    fireEvent.click(mcpTab);
    expect(screen.getByText("McpManagementPageMock")).toBeInTheDocument();
  });

  it("shows reconnect overlay after losing connection from a previously connected state", async () => {
    const stateRef = {
      current: makeDaemonState({ connectionState: "connected" }),
    };
    vi.mocked(useDaemonSessions).mockImplementation(
      () => stateRef.current as never,
    );

    const view = render(<App />);
    await waitFor(() => expect(screen.getByText("Live")).toBeInTheDocument());

    stateRef.current = makeDaemonState({
      connectionState: "disconnected",
      connectionError: "daemon unreachable",
    });
    view.rerender(<App />);
    await act(async () => {});
    expect(screen.getByText("Daemon connection lost")).toBeInTheDocument();
  });

  it("shows auto-repair action instead of command-only daemon instructions", async () => {
    const repairConnection = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useDaemonSessions).mockReturnValue(
      makeDaemonState({
        connectionState: "disconnected",
        connectionError: "daemon unreachable",
        repairConnection,
      }),
    );

    render(<App />);

    expect(
      await screen.findByText(/Daemon offline\. Run auto-repair/i),
    ).toBeInTheDocument();
    const repairButton = screen.getByRole("button", {
      name: /Repair daemon connection/i,
    });
    expect(repairButton).toBeInTheDocument();
    expect(screen.queryByText(/opta daemon start/i)).not.toBeInTheDocument();

    fireEvent.click(repairButton);
    expect(repairConnection).toHaveBeenCalledTimes(1);
  });

  it("renders reconnect diagnostics endpoint and offline duration", async () => {
    vi.useFakeTimers();
    const stateRef = {
      current: makeDaemonState({ connectionState: "connected" }),
    };
    vi.mocked(useDaemonSessions).mockImplementation(
      () => stateRef.current as never,
    );

    const view = render(<App />);
    await act(async () => {});
    stateRef.current = makeDaemonState({
      connectionState: "disconnected",
      connectionError: "daemon unreachable",
    });
    view.rerender(<App />);
    await act(async () => {});
    expect(screen.getByText("Daemon connection lost")).toBeInTheDocument();
    expect(screen.getByText(/Endpoint:/i)).toBeInTheDocument();
    expect(screen.getByText("http://127.0.0.1:9999")).toBeInTheDocument();
    expect(
      screen.getByText(/health checks retry every \d+s/i),
    ).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2_000);
    });

    expect(screen.getByText(/Offline for [12]s\./i)).toBeInTheDocument();
    vi.useRealTimers();
  });

  it("copies reconnect diagnostics to clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    const stateRef = {
      current: makeDaemonState({ connectionState: "connected" }),
    };
    vi.mocked(useDaemonSessions).mockImplementation(
      () => stateRef.current as never,
    );

    const view = render(<App />);
    await waitFor(() => expect(screen.getByText("Live")).toBeInTheDocument());
    stateRef.current = makeDaemonState({
      connectionState: "disconnected",
      connectionError: "daemon unreachable",
    });
    view.rerender(<App />);

    expect(await screen.findByText("Daemon connection lost")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /copy diagnostics/i }));

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText.mock.calls[0]?.[0]).toContain(
      "endpoint=http://127.0.0.1:9999",
    );
  });
});

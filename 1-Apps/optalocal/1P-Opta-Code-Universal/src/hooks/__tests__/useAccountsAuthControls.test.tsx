import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi, afterEach } from "vitest";
import type { DaemonConnectionOptions } from "../../types";
import { useAccountsAuthControls } from "../useAccountsAuthControls";

vi.mock("../../lib/runtime/index", () => ({
  runAccountBrowserLogin: vi.fn(),
  fetchAccountStatus: vi.fn(),
}));

vi.mock("../../lib/runtime/deepLinks", () => ({
  useAuthDeepLinkListener: vi.fn(),
}));

const mockedRuntime = await vi.importMock<
  typeof import("../../lib/runtime/index")
>("../../lib/runtime/index");
const mockedDeepLinks = await vi.importMock<
  typeof import("../../lib/runtime/deepLinks")
>("../../lib/runtime/deepLinks");

const connection: DaemonConnectionOptions = {
  host: "127.0.0.1",
  port: 11434,
  scheme: "http",
};

describe("useAccountsAuthControls", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("invokes runAccountBrowserLogin and surfaces success notice", async () => {
    const notices: string[] = [];
    vi.mocked(mockedRuntime.runAccountBrowserLogin).mockResolvedValue({
      authResult: {},
      statusResult: {},
    });

    const { result } = renderHook(() =>
      useAccountsAuthControls({
        connection,
        onNotice: (msg) => notices.push(msg),
      }),
    );

    await act(async () => {
      await result.current.handleAccountsLogin();
    });

    expect(mockedRuntime.runAccountBrowserLogin).toHaveBeenCalledWith(
      connection,
    );
    expect(notices.some((msg) => msg.includes("Complete login"))).toBe(true);
  });

  it("reports failure notice when login throws", async () => {
    const notices: string[] = [];
    vi.mocked(mockedRuntime.runAccountBrowserLogin).mockRejectedValue(
      new Error("Network down"),
    );

    const { result } = renderHook(() =>
      useAccountsAuthControls({
        connection,
        onNotice: (msg) => notices.push(msg),
      }),
    );

    await act(async () => {
      await result.current.handleAccountsLogin();
    });

    expect(
      notices.some((msg) => msg.includes("Accounts login failed")),
    ).toBe(true);
  });

  it("hooks into deep-link listener to refresh status", async () => {
    const notices: string[] = [];
    vi.mocked(mockedRuntime.fetchAccountStatus).mockResolvedValue({});

    renderHook(() =>
      useAccountsAuthControls({
        connection,
        onNotice: (msg) => notices.push(msg),
      }),
    );

    expect(mockedDeepLinks.useAuthDeepLinkListener).toHaveBeenCalledTimes(1);
    const listenerArgs =
      vi.mocked(mockedDeepLinks.useAuthDeepLinkListener).mock.calls[0]?.[0];
    expect(listenerArgs).toBeDefined();
    await listenerArgs?.onAuthCallback?.("opta-code://auth/callback");
    listenerArgs?.notify?.("Auth callback detected");

    expect(mockedRuntime.fetchAccountStatus).toHaveBeenCalledWith(connection);
    expect(
      notices.some((msg) => msg.includes("linked successfully")),
    ).toBe(true);
    expect(
      notices.some((msg) => msg.includes("Auth callback detected")),
    ).toBe(true);
  });
});

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SetupWizard } from "./SetupWizard";

const invokeNative = vi.fn();
const runtimeState = { native: false };
const lmxDiscovery = vi.fn();
const configSet = vi.fn();
const runOperation = vi.fn();

vi.mock("../lib/runtime", () => ({
  invokeNative: (...args: unknown[]) => invokeNative(...args),
  isNativeDesktop: () => runtimeState.native,
}));

vi.mock("../lib/daemonClient", () => ({
  daemonClient: {
    lmxDiscovery: (...args: unknown[]) => lmxDiscovery(...args),
    configSet: (...args: unknown[]) => configSet(...args),
    runOperation: (...args: unknown[]) => runOperation(...args),
  },
}));

vi.mock("../hooks/usePlatform.js", () => ({
  usePlatform: () => "macos",
}));

describe("SetupWizard", () => {
  beforeEach(() => {
    runtimeState.native = false;
    invokeNative.mockReset();
    invokeNative.mockRejectedValue(new Error("not available"));
    lmxDiscovery.mockReset();
    lmxDiscovery.mockRejectedValue(new Error("discovery unavailable"));
    configSet.mockReset();
    configSet.mockResolvedValue(undefined);
    runOperation.mockReset();
    runOperation.mockResolvedValue({ ok: true, result: { ok: true } });
  });

  it("walks through steps and completes launch", async () => {
    const onComplete = vi.fn();

    render(<SetupWizard onComplete={onComplete} />);

    expect(screen.getByText(/your local ai/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /get started/i }));
    expect(screen.getByText(/choose a provider/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: /anthropic/i }));
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    expect(screen.getByText(/preferences/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /review setup/i }));
    expect(screen.getByText(/you're all set/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /launch opta/i }));
    await waitFor(
      () => {
        expect(onComplete).toHaveBeenCalledTimes(1);
      },
      { timeout: 2000 },
    );
  });

  it("blocks completion when native onboard.apply fails and allows retry", async () => {
    runtimeState.native = true;
    invokeNative.mockImplementation((command: string, args?: Record<string, unknown>) => {
      if (command === "get_config_dir") return Promise.resolve("/tmp/opta");
      if (command === "bootstrap_daemon_connection") {
        return Promise.resolve({ host: "127.0.0.1", port: 10999 });
      }
      if (command === "get_connection_secret") {
        return Promise.resolve("daemon-token");
      }
      return Promise.resolve(undefined);
    });
    runOperation
      .mockResolvedValueOnce({
        ok: false,
        error: { code: "onboard_failed", message: "write failed" },
      })
      .mockResolvedValue({
        ok: true,
        result: { ok: true },
      });

    const onComplete = vi.fn();
    render(<SetupWizard onComplete={onComplete} />);

    fireEvent.click(screen.getByRole("button", { name: /get started/i }));
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    fireEvent.click(screen.getByRole("button", { name: /review setup/i }));

    const launchButton = screen.getByRole("button", { name: /launch opta/i });
    fireEvent.click(launchButton);

    expect(await screen.findByRole("alert")).toHaveTextContent(/write failed/i);
    expect(onComplete).not.toHaveBeenCalled();

    await waitFor(() => expect(launchButton).not.toBeDisabled());
    fireEvent.click(launchButton);
    await waitFor(() => {
      expect(runOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          host: "127.0.0.1",
          port: 10999,
          token: "daemon-token",
        }),
        "onboard.apply",
        expect.any(Object),
      );
    });
    await waitFor(
      () => {
        expect(onComplete).toHaveBeenCalledTimes(1);
      },
      { timeout: 2000 },
    );
  });

  it("prefills connection from native mDNS discovery command", async () => {
    runtimeState.native = true;
    invokeNative.mockImplementation((command: string, args?: Record<string, unknown>) => {
      if (command === "get_config_dir") return Promise.resolve("/tmp/opta");
      if (command === "bootstrap_daemon_connection") {
        return Promise.resolve({ host: "127.0.0.1", port: 10999 });
      }
      if (command === "get_connection_secret") {
        return Promise.resolve("daemon-token");
      }
      if (command === "discover_lmx_mdns") {
        return Promise.resolve([
          {
            host: "10.10.10.40",
            port: 1234,
            hostname: "zeta.local",
            serviceInstance: "zeta._opta-lmx._tcp.local",
          },
          {
            host: "10.10.10.11",
            port: 1234,
            hostname: "alpha.local",
            serviceInstance: "alpha._opta-lmx._tcp.local",
          },
        ]);
      }
      if (command === "probe_lmx_server") {
        return Promise.resolve({ reachable: true });
      }
      return Promise.reject(new Error(`unexpected command: ${command}`));
    });

    render(<SetupWizard onComplete={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /get started/i }));

    await waitFor(() => {
      expect(screen.getByDisplayValue("10.10.10.11:1234")).toBeInTheDocument();
    });
    expect(lmxDiscovery).not.toHaveBeenCalled();
  });

  it("prefills from native mDNS even when bootstrap metadata is unavailable", async () => {
    runtimeState.native = true;
    invokeNative.mockImplementation((command: string) => {
      if (command === "get_config_dir") return Promise.resolve("/tmp/opta");
      if (command === "bootstrap_daemon_connection") {
        return Promise.resolve({ host: "", port: 0 });
      }
      if (command === "discover_lmx_mdns") {
        return Promise.resolve([
          {
            host: "10.10.10.44",
            port: 1234,
            hostname: "fallback.local",
            serviceInstance: "fallback._opta-lmx._tcp.local",
          },
        ]);
      }
      if (command === "probe_lmx_server") {
        return Promise.resolve({ reachable: true });
      }
      return Promise.reject(new Error(`unexpected command: ${command}`));
    });

    render(<SetupWizard onComplete={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /get started/i }));

    await waitFor(() => {
      expect(screen.getByDisplayValue("10.10.10.44:1234")).toBeInTheDocument();
    });
    expect(lmxDiscovery).not.toHaveBeenCalled();
    expect(configSet).not.toHaveBeenCalled();
  });

  it("falls back to daemon lmx discovery when native mDNS is empty", async () => {
    runtimeState.native = true;
    invokeNative.mockImplementation((command: string, args?: Record<string, unknown>) => {
      if (command === "get_config_dir") return Promise.resolve("/tmp/opta");
      if (command === "bootstrap_daemon_connection") {
        return Promise.resolve({ host: "127.0.0.1", port: 10999 });
      }
      if (command === "get_connection_secret") {
        return Promise.resolve("daemon-token");
      }
      if (command === "discover_lmx_mdns") {
        return Promise.resolve([]);
      }
      if (command === "probe_lmx_server") {
        return Promise.resolve({ reachable: true });
      }
      return Promise.reject(new Error(`unexpected command: ${command}`));
    });
    lmxDiscovery.mockResolvedValue({
      endpoints: {
        preferred_base_url: "http://10.10.10.22:1234/v1",
      },
    });

    render(<SetupWizard onComplete={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /get started/i }));

    await waitFor(() => {
      expect(screen.getByDisplayValue("10.10.10.22:1234")).toBeInTheDocument();
    });
    expect(lmxDiscovery).toHaveBeenCalled();
  });

  it("falls back to daemon lmx discovery when native mDNS candidate is unreachable", async () => {
    runtimeState.native = true;
    invokeNative.mockImplementation((command: string, args?: Record<string, unknown>) => {
      if (command === "get_config_dir") return Promise.resolve("/tmp/opta");
      if (command === "bootstrap_daemon_connection") {
        return Promise.resolve({ host: "127.0.0.1", port: 10999 });
      }
      if (command === "get_connection_secret") {
        return Promise.resolve("daemon-token");
      }
      if (command === "discover_lmx_mdns") {
        return Promise.resolve([
          {
            host: "10.10.10.40",
            port: 1234,
            hostname: "unreachable.local",
            serviceInstance: "unreachable._opta-lmx._tcp.local",
          },
        ]);
      }
      if (command === "probe_lmx_server") {
        if (args?.host === "10.10.10.40") {
          return Promise.resolve({ reachable: false });
        }
        if (args?.host === "10.10.10.22") {
          return Promise.resolve({ reachable: true });
        }
        return Promise.resolve({ reachable: false });
      }
      return Promise.reject(new Error(`unexpected command: ${command}`));
    });
    lmxDiscovery.mockResolvedValue({
      endpoints: {
        preferred_base_url: "http://10.10.10.22:1234/v1",
      },
    });

    render(<SetupWizard onComplete={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /get started/i }));

    await waitFor(() => {
      expect(screen.getByDisplayValue("10.10.10.22:1234")).toBeInTheDocument();
    });
    expect(lmxDiscovery).toHaveBeenCalled();
  });

  it("auto-applies discovered host and port to daemon config on success", async () => {
    runtimeState.native = true;
    invokeNative.mockImplementation((command: string) => {
      if (command === "get_config_dir") return Promise.resolve("/tmp/opta");
      if (command === "bootstrap_daemon_connection") {
        return Promise.resolve({ host: "127.0.0.1", port: 10999 });
      }
      if (command === "get_connection_secret") {
        return Promise.resolve("daemon-token");
      }
      if (command === "discover_lmx_mdns") {
        return Promise.resolve([
          {
            host: "10.10.10.20",
            port: 1234,
            hostname: "studio.local",
            serviceInstance: "studio._opta-lmx._tcp.local",
          },
        ]);
      }
      if (command === "probe_lmx_server") {
        return Promise.resolve({ reachable: true });
      }
      return Promise.reject(new Error(`unexpected command: ${command}`));
    });

    render(<SetupWizard onComplete={vi.fn()} />);

    await waitFor(() => {
      expect(configSet).toHaveBeenCalledWith(
        expect.objectContaining({
          host: "127.0.0.1",
          port: 10999,
          token: "daemon-token",
        }),
        "connection.host",
        "10.10.10.20",
      );
    });
    expect(configSet).toHaveBeenCalledWith(
      expect.any(Object),
      "connection.port",
      1234,
    );
    expect(configSet).toHaveBeenCalledWith(
      expect.any(Object),
      "connection.autoDiscover",
      true,
    );
  });
});

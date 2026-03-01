import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConfigStudioPage } from "./ConfigStudioPage";
import { daemonClient } from "../lib/daemonClient";

vi.mock("../lib/daemonClient", () => ({
  daemonClient: {
    runOperation: vi.fn(),
  },
}));

const connection = { host: "127.0.0.1", port: 8080, token: "token" };

function opSuccess(id: string, result: unknown) {
  return {
    ok: true as const,
    id: id as never,
    safety: "read" as const,
    result,
  };
}

describe("ConfigStudioPage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  it("loads config entries and filters by search query", async () => {
    vi.mocked(daemonClient.runOperation).mockResolvedValueOnce(
      opSuccess("config.list", {
        connection: { host: "127.0.0.1", port: 9000 },
        model: { default: "qwen2.5" },
      }),
    );

    render(<ConfigStudioPage connection={connection} />);

    expect(
      await screen.findByRole("button", { name: /connection\.host/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /connection\.port/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /model\.default/i }),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Search config keys"), {
      target: { value: "model.default" },
    });

    expect(
      screen.getByRole("button", { name: /model\.default/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /connection\.host/i }),
    ).not.toBeInTheDocument();
  });

  it("saves edited value via config.set", async () => {
    vi.mocked(daemonClient.runOperation)
      .mockResolvedValueOnce(
        opSuccess("config.list", {
          connection: { host: "127.0.0.1" },
        }),
      )
      .mockResolvedValueOnce(opSuccess("config.set", { updated: true }))
      .mockResolvedValueOnce(
        opSuccess("config.list", {
          connection: { host: "127.0.0.1" },
        }),
      );

    render(<ConfigStudioPage connection={connection} />);

    expect(
      await screen.findByRole("button", { name: /connection\.host/i }),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Config value editor"), {
      target: { value: '"192.168.1.10"' },
    });

    fireEvent.click(screen.getByRole("button", { name: "Save value" }));

    await waitFor(() => {
      expect(daemonClient.runOperation).toHaveBeenCalledWith(
        connection,
        "config.set",
        {
          input: {
            key: "connection.host",
            value: "192.168.1.10",
          },
        },
      );
    });

    expect(await screen.findByText("Updated connection.host.")).toBeInTheDocument();
  });

  it("fetches latest key value via config.get", async () => {
    vi.mocked(daemonClient.runOperation)
      .mockResolvedValueOnce(
        opSuccess("config.list", {
          connection: { host: "127.0.0.1" },
        }),
      )
      .mockResolvedValueOnce(opSuccess("config.get", { value: 42 }));

    render(<ConfigStudioPage connection={connection} />);

    expect(
      await screen.findByRole("button", { name: /connection\.host/i }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Get value" }));

    await waitFor(() => {
      expect(daemonClient.runOperation).toHaveBeenCalledWith(
        connection,
        "config.get",
        {
          input: {
            key: "connection.host",
          },
        },
      );
    });

    await waitFor(() => {
      expect(screen.getByLabelText("Config value editor")).toHaveValue("42");
    });
  });
});

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AccountControlPage } from "./AccountControlPage";
import { daemonClient } from "../lib/daemonClient";

vi.mock("../lib/daemonClient", () => ({
  daemonClient: {
    listOperations: vi.fn(),
    runOperation: vi.fn(),
  },
}));

const connection = { host: "127.0.0.1", port: 8080, token: "token" };

const requiredOperations = [
  "account.status",
  "account.signup",
  "account.login",
  "account.logout",
  "account.keys.list",
  "account.keys.push",
  "account.keys.delete",
];

function opSuccess(id: string, result: unknown) {
  return {
    ok: true as const,
    id: id as never,
    safety: "read" as const,
    result,
  };
}

describe("AccountControlPage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();

    vi.mocked(daemonClient.listOperations).mockResolvedValue({
      operations: [
        ...requiredOperations,
        "key.show",
        "key.create",
        "key.copy",
      ].map((id) => ({ id })),
    } as never);
  });

  it("runs account.status and renders a success notice", async () => {
    vi.mocked(daemonClient.runOperation).mockResolvedValueOnce(
      opSuccess("account.status", {
        authenticated: true,
        user: { email: "ops@optalocal.com" },
      }) as never,
    );

    render(<AccountControlPage connection={connection} />);

    fireEvent.click(screen.getByRole("button", { name: "Refresh status" }));

    await waitFor(() => {
      expect(daemonClient.runOperation).toHaveBeenCalledWith(
        connection,
        "account.status",
        { input: {} },
      );
    });

    expect(await screen.findByText("Loaded account status.")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("ops@optalocal.com");
  });

  it("shows actionable error notice when operation fails", async () => {
    vi.mocked(daemonClient.runOperation).mockResolvedValueOnce({
      ok: false,
      id: "account.status",
      safety: "read",
      error: {
        code: "unauthorized",
        message: "Authentication required",
        details: { reason: "token missing" },
      },
    } as never);

    render(<AccountControlPage connection={connection} />);

    fireEvent.click(screen.getByRole("button", { name: "Refresh status" }));

    expect(
      await screen.findByText("[unauthorized] Authentication required"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Authenticate with account\.login/i),
    ).toBeInTheDocument();
  });

  it("lists account keys and supports seeding delete input from a listed key", async () => {
    vi.mocked(daemonClient.runOperation).mockResolvedValueOnce(
      opSuccess("account.keys.list", {
        keys: [
          {
            id: "key_123",
            name: "Primary key",
            scope: "workspace",
          },
        ],
      }) as never,
    );

    render(<AccountControlPage connection={connection} />);

    fireEvent.click(screen.getByRole("button", { name: "List keys" }));

    await waitFor(() => {
      expect(daemonClient.runOperation).toHaveBeenCalledWith(
        connection,
        "account.keys.list",
        { input: {} },
      );
    });

    expect(await screen.findByText("Primary key")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Use for delete Primary key" }),
    );

    expect(screen.getByLabelText("Account key delete JSON input")).toHaveValue(
      '{\n  "keyId": "key_123"\n}',
    );
  });

  it("disables optional local key shortcuts when daemon catalog does not expose them", async () => {
    vi.mocked(daemonClient.listOperations).mockResolvedValueOnce({
      operations: requiredOperations.map((id) => ({ id })),
    } as never);

    render(<AccountControlPage connection={connection} />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Run local key.show" }),
      ).toBeDisabled();
    });

    expect(
      screen.getByRole("button", { name: "Run local key.create" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Run local key.copy" }),
    ).toBeDisabled();
  });
});

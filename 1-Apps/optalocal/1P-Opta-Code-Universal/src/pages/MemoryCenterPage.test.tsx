import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryCenterPage } from "./MemoryCenterPage";
import { daemonClient } from "../lib/daemonClient";

vi.mock("../lib/daemonClient", () => ({
  daemonClient: {
    sessionsPins: vi.fn(),
    sessionsUnpin: vi.fn(),
    sessionsPin: vi.fn(),
    sessionsSearch: vi.fn(),
    sessionsRetentionGet: vi.fn(),
    sessionsRetentionSet: vi.fn(),
    sessionsRetentionPrune: vi.fn(),
  },
}));

const connection = { host: "127.0.0.1", port: 10999, token: "daemon-token" };

describe("MemoryCenterPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(daemonClient.sessionsPins).mockResolvedValue([]);
    vi.mocked(daemonClient.sessionsRetentionGet).mockResolvedValue({
      days: 30,
      preservePinned: true,
    });
    vi.mocked(daemonClient.sessionsRetentionSet).mockResolvedValue({
      days: 30,
      preservePinned: true,
    });
    vi.mocked(daemonClient.sessionsRetentionPrune).mockResolvedValue({
      dryRun: true,
      listed: 0,
      kept: 0,
      pruned: 0,
      keptSessions: [],
      prunedSessions: [],
    });
    vi.mocked(daemonClient.sessionsSearch).mockResolvedValue([]);
    vi.mocked(daemonClient.sessionsPin).mockResolvedValue(undefined);
    vi.mocked(daemonClient.sessionsUnpin).mockResolvedValue(undefined);
  });

  it("loads pinned sessions and retention policy", async () => {
    vi.mocked(daemonClient.sessionsPins).mockResolvedValueOnce([
      {
        sessionId: "sess_1",
        title: "Memory anchor",
        workspace: "Opta",
        updatedAt: "2026-03-03T06:00:00.000Z",
      },
    ]);
    vi.mocked(daemonClient.sessionsRetentionGet).mockResolvedValueOnce({
      days: 45,
      preservePinned: false,
    });

    render(<MemoryCenterPage connection={connection} />);

    expect(await screen.findByText("Memory anchor")).toBeInTheDocument();
    expect(screen.getByLabelText("Retention days")).toHaveValue(45);
    expect(screen.getByLabelText("Preserve pinned sessions")).not.toBeChecked();
  });

  it("unpinns a session and refreshes the pin list", async () => {
    vi.mocked(daemonClient.sessionsPins)
      .mockResolvedValueOnce([
        {
          sessionId: "sess_unpin",
          title: "Unpin me",
        },
      ])
      .mockResolvedValueOnce([]);

    render(<MemoryCenterPage connection={connection} />);

    const unpin = await screen.findByRole("button", { name: "Unpin sess_unpin" });
    fireEvent.click(unpin);

    await waitFor(() => {
      expect(daemonClient.sessionsUnpin).toHaveBeenCalledWith(connection, "sess_unpin");
    });
    expect(await screen.findByText(/Unpinned sess_unpin\./i)).toBeInTheDocument();
  });

  it("searches recall and pins a returned session", async () => {
    vi.mocked(daemonClient.sessionsSearch).mockResolvedValueOnce([
      {
        sessionId: "sess_search_1",
        title: "Recovered context",
      },
    ]);
    vi.mocked(daemonClient.sessionsPins)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          sessionId: "sess_search_1",
          title: "Recovered context",
        },
      ]);

    render(<MemoryCenterPage connection={connection} />);

    fireEvent.change(screen.getByLabelText("Recall search query"), {
      target: { value: "recovered" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Search recall" }));

    expect(await screen.findByText("Recovered context")).toBeInTheDocument();
    await waitFor(() => {
      expect(daemonClient.sessionsSearch).toHaveBeenCalledWith(
        connection,
        "recovered",
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Pin sess_search_1" }));

    await waitFor(() => {
      expect(daemonClient.sessionsPin).toHaveBeenCalledWith(
        connection,
        "sess_search_1",
      );
    });
    expect(await screen.findByText(/Pinned sess_search_1\./i)).toBeInTheDocument();
  });

  it("saves retention policy and supports preview/apply prune", async () => {
    vi.mocked(daemonClient.sessionsRetentionSet).mockResolvedValueOnce({
      days: 14,
      preservePinned: false,
    });
    vi.mocked(daemonClient.sessionsRetentionPrune)
      .mockResolvedValueOnce({
        dryRun: true,
        listed: 3,
        kept: 2,
        pruned: 1,
        keptSessions: [],
        prunedSessions: [{ sessionId: "sess_old", title: "Old session" }],
      })
      .mockResolvedValueOnce({
        dryRun: false,
        listed: 3,
        kept: 2,
        pruned: 1,
        keptSessions: [],
        prunedSessions: [{ sessionId: "sess_old", title: "Old session" }],
      });

    render(<MemoryCenterPage connection={connection} />);

    fireEvent.change(screen.getByLabelText("Retention days"), {
      target: { value: "14" },
    });
    fireEvent.click(screen.getByLabelText("Preserve pinned sessions"));
    fireEvent.click(screen.getByRole("button", { name: "Save retention policy" }));

    await waitFor(() => {
      expect(daemonClient.sessionsRetentionSet).toHaveBeenCalledWith(connection, {
        days: 14,
        preservePinned: false,
      });
    });

    fireEvent.click(screen.getByRole("button", { name: "Preview prune" }));

    await waitFor(() => {
      expect(daemonClient.sessionsRetentionPrune).toHaveBeenCalledWith(connection, {
        days: 14,
        preservePinned: false,
        dryRun: true,
      });
    });
    expect(await screen.findByText(/Dry run: 1 pruned, 2 kept, 3 listed\./i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Apply prune" }));

    await waitFor(() => {
      expect(daemonClient.sessionsRetentionPrune).toHaveBeenCalledWith(connection, {
        days: 14,
        preservePinned: false,
        dryRun: false,
      });
    });
    expect(await screen.findByText(/Applied: 1 pruned, 2 kept, 3 listed\./i)).toBeInTheDocument();
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { daemonClient } from "./daemonClient";
import type { DaemonConnectionOptions } from "../types";

const connection: DaemonConnectionOptions = {
  host: "127.0.0.1",
  port: 10999,
  token: "daemon-token",
};

function opSuccess(result: unknown) {
  return {
    ok: true as const,
    id: "sessions.search" as never,
    safety: "read" as const,
    result,
  };
}

function opFailure(message: string) {
  return {
    ok: false as const,
    id: "sessions.search" as never,
    safety: "write" as const,
    error: {
      code: "invalid_input",
      message,
    },
  };
}

describe("daemonClient session memory wrappers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("runs sessions.search and normalizes session snapshots", async () => {
    const runOperation = vi
      .spyOn(daemonClient, "runOperation")
      .mockResolvedValueOnce(
        opSuccess([
          {
            id: "sess_1",
            title: "Pinned context",
            workspace: "Opta",
            updated_at: "2026-03-03T06:00:00.000Z",
          },
        ]) as never,
      );

    const result = await daemonClient.sessionsSearch(connection, "pinned context");

    expect(runOperation).toHaveBeenCalledWith(connection, "sessions.search", {
      input: { query: "pinned context" },
    });
    expect(result).toEqual([
      {
        sessionId: "sess_1",
        title: "Pinned context",
        workspace: "Opta",
        updatedAt: "2026-03-03T06:00:00.000Z",
      },
    ]);
  });

  it("runs sessions.pins and reads nested pin list payloads", async () => {
    vi.spyOn(daemonClient, "runOperation").mockResolvedValueOnce(
      opSuccess({
        pins: [
          {
            sessionId: "sess_pin_1",
            title: "Memory anchor",
          },
        ],
      }) as never,
    );

    const result = await daemonClient.sessionsPins(connection);

    expect(result).toEqual([
      {
        sessionId: "sess_pin_1",
        title: "Memory anchor",
        workspace: undefined,
        updatedAt: undefined,
      },
    ]);
  });

  it("runs sessions.pin with id payload", async () => {
    const runOperation = vi
      .spyOn(daemonClient, "runOperation")
      .mockResolvedValueOnce(opSuccess({ pinned: true }) as never);

    await daemonClient.sessionsPin(connection, "sess_42");

    expect(runOperation).toHaveBeenCalledWith(connection, "sessions.pin", {
      input: { id: "sess_42" },
    });
  });

  it("runs sessions.unpin using the primary payload", async () => {
    const runOperation = vi
      .spyOn(daemonClient, "runOperation")
      .mockResolvedValueOnce(opSuccess({ unpinned: true }) as never);

    await daemonClient.sessionsUnpin(connection, "sess_99");

    expect(runOperation).toHaveBeenCalledWith(connection, "sessions.unpin", {
      input: { id: "sess_99" },
    });
  });

  it("normalizes sessions.retention.get policy fields", async () => {
    vi.spyOn(daemonClient, "runOperation").mockResolvedValueOnce(
      opSuccess({
        policy: {
          retentionDays: 45,
          preservePinned: false,
        },
      }) as never,
    );

    const policy = await daemonClient.sessionsRetentionGet(connection);

    expect(policy).toEqual({
      days: 45,
      preservePinned: false,
    });
  });

  it("sets policy and normalizes prune result", async () => {
    const runOperation = vi
      .spyOn(daemonClient, "runOperation")
      .mockResolvedValueOnce(opSuccess({ retentionDays: 21, preservePinned: true }) as never)
      .mockResolvedValueOnce(
        opSuccess({ retentionDays: 21, preservePinned: true }) as never,
      )
      .mockResolvedValueOnce(
        opSuccess({
          dryRun: true,
          scanned: 3,
          candidateCount: 1,
          candidateIds: ["sess_old"],
          keptCount: 2,
          prunedCount: 0,
          prunedIds: [],
        }) as never,
      );

    const policy = await daemonClient.sessionsRetentionSet(connection, {
      days: 21,
      preservePinned: true,
    });
    const preview = await daemonClient.sessionsRetentionPrune(connection, {
      days: 21,
      preservePinned: true,
      dryRun: true,
    });

    expect(runOperation).toHaveBeenNthCalledWith(
      1,
      connection,
      "sessions.retention.set",
      {
        input: { days: 21, preservePinned: true },
      },
    );
    expect(runOperation).toHaveBeenNthCalledWith(
      2,
      connection,
      "sessions.retention.set",
      {
        input: { days: 21, preservePinned: true },
      },
    );
    expect(runOperation).toHaveBeenNthCalledWith(
      3,
      connection,
      "sessions.retention.prune",
      {
        input: { dryRun: true },
      },
    );

    expect(policy).toEqual({ days: 21, preservePinned: true });
    expect(preview).toEqual({
      dryRun: true,
      listed: 3,
      kept: 2,
      pruned: 1,
      keptSessions: [],
      prunedSessions: [
        {
          sessionId: "sess_old",
          title: undefined,
          workspace: undefined,
          updatedAt: undefined,
        },
      ],
    });
  });
});

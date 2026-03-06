import type { DeviceCommandRecord } from './types.ts';

export interface SSEHoldOptions {
  /** Commands that are already queued and should be flushed immediately. */
  initialCommands: DeviceCommandRecord[];
  /**
   * Polls for new commands on this interval (milliseconds).
   * Must be >= 1000.
   */
  pollIntervalMs: number;
  /**
   * Total duration to hold the connection before sending an 'end' event and
   * closing (milliseconds).  Should be kept under Vercel's 30 s streaming
   * limit — 25 000 ms is the recommended ceiling.
   */
  holdDurationMs: number;
  /**
   * How often to emit an SSE keepalive comment so that proxies / browsers do
   * not time out the idle connection (milliseconds).
   */
  keepaliveIntervalMs: number;
  /**
   * Called on each poll tick with the ISO timestamp of the latest command
   * seen so far.  Must return any commands created strictly after that
   * timestamp.  The implementation is responsible for marking them as
   * delivered if required.
   */
  fetchNewCommands: (since: string) => Promise<DeviceCommandRecord[]>;
}

/**
 * Creates a ReadableStream that implements true SSE push semantics for device
 * commands.
 *
 * Protocol emitted:
 *   event: connected\ndata: {"ok":true}\n\n
 *   event: command\ndata: <DeviceCommandRecord JSON>\n\n   (zero or more)
 *   : keepalive\n\n                                         (every keepaliveIntervalMs)
 *   event: end\ndata: {"reason":"timeout","ok":true}\n\n   (after holdDurationMs)
 *
 * This function uses Node.js setTimeout (not setInterval) chained via
 * Promise for compatibility with Next.js Node runtime.  It does NOT require
 * Edge Runtime — the route that calls it must not declare
 * `export const runtime = 'edge'`.
 */
export function createCommandSSEStream(options: SSEHoldOptions): ReadableStream<Uint8Array> {
  const { initialCommands, pollIntervalMs, holdDurationMs, keepaliveIntervalMs, fetchNewCommands } =
    options;

  const encoder = new TextEncoder();

  function encode(text: string): Uint8Array {
    return encoder.encode(text);
  }

  function commandEvent(command: DeviceCommandRecord): Uint8Array {
    return encode(`event: command\ndata: ${JSON.stringify(command)}\n\n`);
  }

  return new ReadableStream<Uint8Array>({
    start(controller) {
      // Tracks whether the stream has been closed (to guard against double-close).
      let closed = false;

      function safeClose(): void {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          // Already closed — safe to ignore.
        }
      }

      function safeEnqueue(chunk: Uint8Array): void {
        if (closed) return;
        try {
          controller.enqueue(chunk);
        } catch {
          // Controller closed externally — mark as done.
          closed = true;
        }
      }

      // -----------------------------------------------------------------------
      // 1. Send the connected handshake.
      // -----------------------------------------------------------------------
      safeEnqueue(encode('event: connected\ndata: {"ok":true}\n\n'));

      // -----------------------------------------------------------------------
      // 2. Flush all initially-pending commands.
      // -----------------------------------------------------------------------
      let lastSeenAt: string =
        initialCommands.length > 0
          ? // Use the latest createdAt from the initial batch as our cursor.
            initialCommands.reduce(
              (latest, cmd) => (cmd.createdAt > latest ? cmd.createdAt : latest),
              initialCommands[0]?.createdAt ?? new Date(0).toISOString(),
            )
          : // No initial commands — use current time so we only pick up new ones.
            new Date().toISOString();

      for (const command of initialCommands) {
        safeEnqueue(commandEvent(command));
      }

      // -----------------------------------------------------------------------
      // 3. Schedule the hold-timeout that sends 'end' and closes the stream.
      // -----------------------------------------------------------------------
      const holdTimer = setTimeout(() => {
        safeEnqueue(
          encode('event: end\ndata: {"reason":"timeout","ok":true}\n\n'),
        );
        safeClose();
      }, holdDurationMs);

      // -----------------------------------------------------------------------
      // 4. Schedule keepalive comments at regular intervals.
      //    We use a recursive setTimeout chain so that we can stop cleanly
      //    when the hold-timeout fires.
      // -----------------------------------------------------------------------
      let keepaliveTimer: ReturnType<typeof setTimeout> | null = null;

      function scheduleKeepalive(): void {
        if (closed) return;
        keepaliveTimer = setTimeout(() => {
          safeEnqueue(encode(': keepalive\n\n'));
          scheduleKeepalive();
        }, keepaliveIntervalMs);
      }

      scheduleKeepalive();

      // -----------------------------------------------------------------------
      // 5. Poll for new commands at pollIntervalMs using a recursive chain.
      // -----------------------------------------------------------------------
      let pollTimer: ReturnType<typeof setTimeout> | null = null;

      async function poll(): Promise<void> {
        if (closed) return;

        try {
          const newCommands = await fetchNewCommands(lastSeenAt);

          if (newCommands.length > 0) {
            // Advance the cursor to the latest createdAt in this batch.
            lastSeenAt = newCommands.reduce(
              (latest, cmd) => (cmd.createdAt > latest ? cmd.createdAt : latest),
              lastSeenAt,
            );

            for (const command of newCommands) {
              safeEnqueue(commandEvent(command));
            }
          }
        } catch {
          // DB poll failure — not fatal; we simply skip this tick and retry.
        }

        if (!closed) {
          pollTimer = setTimeout(() => {
            void poll();
          }, pollIntervalMs);
        }
      }

      // Kick off the first poll.
      pollTimer = setTimeout(() => {
        void poll();
      }, pollIntervalMs);

      // -----------------------------------------------------------------------
      // 6. Cancel hook — clean up timers if the client disconnects early.
      // -----------------------------------------------------------------------
      return {
        cancel() {
          closed = true;
          clearTimeout(holdTimer);
          if (keepaliveTimer != null) clearTimeout(keepaliveTimer);
          if (pollTimer != null) clearTimeout(pollTimer);
        },
      };
    },
  });
}

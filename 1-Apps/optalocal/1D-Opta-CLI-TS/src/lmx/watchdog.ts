/**
 * watchdog.ts — LMX continuous health monitor.
 *
 * Pings the LMX health endpoint on a fixed interval during active agent sessions.
 * After `failureThreshold` consecutive failures, fires `onUnhealthy` exactly once
 * per unhealthy event. Resets when health recovers so subsequent failures re-fire.
 */

import type { LmxClient } from './client.js';

export class LmxWatchdog {
  private timer: NodeJS.Timeout | undefined;
  private consecutiveFailures = 0;
  private notified = false;
  private readonly failureThreshold = 2;

  constructor(
    private readonly client: LmxClient,
    private readonly onUnhealthy: () => void,
  ) {}

  /** Start the watchdog. No-op if already running. */
  start(intervalMs = 15_000): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.tick(), intervalMs);
    // Don't prevent process exit while watchdog is active.
    this.timer.unref();
  }

  /** Stop the watchdog and cancel any pending tick. */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  private async tick(): Promise<void> {
    try {
      const result = await this.client.health({ timeoutMs: 4_000, maxRetries: 0 });
      if (result.status === 'ok') {
        this.consecutiveFailures = 0;
        this.notified = false;
      } else {
        this.handleFailure();
      }
    } catch {
      this.handleFailure();
    }
  }

  private handleFailure(): void {
    this.consecutiveFailures++;
    if (this.consecutiveFailures >= this.failureThreshold && !this.notified) {
      this.notified = true;
      this.onUnhealthy();
    }
  }
}

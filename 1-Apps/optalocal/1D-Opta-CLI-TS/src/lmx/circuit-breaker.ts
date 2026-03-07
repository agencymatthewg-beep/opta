/**
 * circuit-breaker.ts
 *
 * Per-endpoint circuit breaker for LMX connection probes.
 *
 * States:
 *   closed   — normal operation; failures accumulate toward threshold
 *   open     — threshold exceeded; probes fast-fail until recovery window elapses
 *   half-open — one probe allowed through to test recovery; further probes blocked
 *
 * When the half-open probe succeeds, the circuit closes. When it fails, the
 * circuit stays open and the recovery timer resets.
 */

export type CircuitState = 'closed' | 'open' | 'half-open';

const FAILURE_THRESHOLD = 3;
const RECOVERY_BACKOFF_MS = 10_000;

interface BreakerEntry {
  state: CircuitState;
  failures: number;
  openedAt: number;
  /** True once the half-open slot has been claimed by an in-flight probe. */
  halfOpenClaimed: boolean;
}

const breakers = new Map<string, BreakerEntry>();

function key(host: string, port: number): string {
  return `${host.toLowerCase()}:${port}`;
}

function getEntry(k: string): BreakerEntry {
  const existing = breakers.get(k);
  if (existing) return existing;
  const entry: BreakerEntry = { state: 'closed', failures: 0, openedAt: 0, halfOpenClaimed: false };
  breakers.set(k, entry);
  return entry;
}

/**
 * Returns true if a probe attempt should be allowed for this endpoint.
 * Call this before each `probeLmxConnection`. Claiming the half-open slot is
 * atomic — only the first caller returns true; concurrent callers return false.
 */
export function canAttempt(host: string, port: number): boolean {
  const entry = getEntry(key(host, port));
  if (entry.state === 'closed') return true;
  if (entry.state === 'open') {
    if (Date.now() - entry.openedAt >= RECOVERY_BACKOFF_MS) {
      entry.state = 'half-open';
      entry.halfOpenClaimed = true;
      return true;
    }
    return false;
  }
  // half-open: allow only if the slot hasn't been claimed yet
  if (!entry.halfOpenClaimed) {
    entry.halfOpenClaimed = true;
    return true;
  }
  return false;
}

/** Call after a successful probe. Closes the circuit. */
export function recordSuccess(host: string, port: number): void {
  const entry = getEntry(key(host, port));
  entry.state = 'closed';
  entry.failures = 0;
  entry.openedAt = 0;
  entry.halfOpenClaimed = false;
}

/** Call after a failed probe. Opens the circuit after `FAILURE_THRESHOLD` consecutive failures. */
export function recordFailure(host: string, port: number): void {
  const entry = getEntry(key(host, port));
  if (entry.state === 'half-open') {
    // Half-open probe failed → back to open, reset timer
    entry.state = 'open';
    entry.openedAt = Date.now();
    entry.halfOpenClaimed = false;
    return;
  }
  if (entry.state === 'open') return;
  entry.failures += 1;
  if (entry.failures >= FAILURE_THRESHOLD) {
    entry.state = 'open';
    entry.openedAt = Date.now();
    entry.halfOpenClaimed = false;
  }
}

/** Returns current circuit state for diagnostics. */
export function getCircuitState(host: string, port: number): CircuitState {
  return getEntry(key(host, port)).state;
}

/** Test helper — reset all circuit breakers. */
export function resetBreakers(): void {
  breakers.clear();
}

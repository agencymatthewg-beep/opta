import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  canAttempt,
  recordFailure,
  recordSuccess,
  getCircuitState,
  resetBreakers,
} from '../../src/lmx/circuit-breaker.js';

const HOST = '192.168.188.11';
const PORT = 1234;

afterEach(() => {
  resetBreakers();
  vi.useRealTimers();
});

describe('circuit breaker', () => {
  it('allows attempts when closed', () => {
    expect(canAttempt(HOST, PORT)).toBe(true);
    expect(getCircuitState(HOST, PORT)).toBe('closed');
  });

  it('stays closed below failure threshold', () => {
    recordFailure(HOST, PORT);
    recordFailure(HOST, PORT);
    expect(getCircuitState(HOST, PORT)).toBe('closed');
    expect(canAttempt(HOST, PORT)).toBe(true);
  });

  it('opens after threshold consecutive failures', () => {
    recordFailure(HOST, PORT);
    recordFailure(HOST, PORT);
    recordFailure(HOST, PORT);
    expect(getCircuitState(HOST, PORT)).toBe('open');
  });

  it('fast-fails when open', () => {
    recordFailure(HOST, PORT);
    recordFailure(HOST, PORT);
    recordFailure(HOST, PORT);
    expect(canAttempt(HOST, PORT)).toBe(false);
  });

  it('resets failure count on success', () => {
    recordFailure(HOST, PORT);
    recordFailure(HOST, PORT);
    recordSuccess(HOST, PORT);
    expect(getCircuitState(HOST, PORT)).toBe('closed');
    // Failures should be reset — 2 more failures should NOT open the circuit
    recordFailure(HOST, PORT);
    recordFailure(HOST, PORT);
    expect(getCircuitState(HOST, PORT)).toBe('closed');
  });

  it('transitions to half-open after recovery window', () => {
    vi.useFakeTimers();
    recordFailure(HOST, PORT);
    recordFailure(HOST, PORT);
    recordFailure(HOST, PORT);
    expect(getCircuitState(HOST, PORT)).toBe('open');

    vi.advanceTimersByTime(10_001);
    expect(canAttempt(HOST, PORT)).toBe(true);
    expect(getCircuitState(HOST, PORT)).toBe('half-open');
  });

  it('blocks concurrent probes when half-open (only one slot)', () => {
    vi.useFakeTimers();
    recordFailure(HOST, PORT);
    recordFailure(HOST, PORT);
    recordFailure(HOST, PORT);
    vi.advanceTimersByTime(10_001);

    expect(canAttempt(HOST, PORT)).toBe(true);  // claims the slot
    expect(canAttempt(HOST, PORT)).toBe(false); // slot taken
  });

  it('closes on successful half-open probe', () => {
    vi.useFakeTimers();
    recordFailure(HOST, PORT);
    recordFailure(HOST, PORT);
    recordFailure(HOST, PORT);
    vi.advanceTimersByTime(10_001);

    canAttempt(HOST, PORT); // enter half-open
    recordSuccess(HOST, PORT);
    expect(getCircuitState(HOST, PORT)).toBe('closed');
    expect(canAttempt(HOST, PORT)).toBe(true);
  });

  it('re-opens and resets timer on failed half-open probe', () => {
    vi.useFakeTimers();
    recordFailure(HOST, PORT);
    recordFailure(HOST, PORT);
    recordFailure(HOST, PORT);
    vi.advanceTimersByTime(10_001);

    canAttempt(HOST, PORT); // enter half-open
    recordFailure(HOST, PORT);
    expect(getCircuitState(HOST, PORT)).toBe('open');
    // Still blocked immediately after re-open
    expect(canAttempt(HOST, PORT)).toBe(false);
  });

  it('tracks separate circuits per host', () => {
    recordFailure(HOST, PORT);
    recordFailure(HOST, PORT);
    recordFailure(HOST, PORT);
    expect(getCircuitState(HOST, PORT)).toBe('open');
    expect(getCircuitState('localhost', PORT)).toBe('closed');
  });

  it('tracks separate circuits per port', () => {
    recordFailure(HOST, 1234);
    recordFailure(HOST, 1234);
    recordFailure(HOST, 1234);
    expect(getCircuitState(HOST, 1234)).toBe('open');
    expect(getCircuitState(HOST, 5678)).toBe('closed');
  });
});

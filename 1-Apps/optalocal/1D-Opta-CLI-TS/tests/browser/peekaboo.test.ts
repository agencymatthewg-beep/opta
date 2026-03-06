import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const execaMock = vi.fn();

vi.mock('execa', () => ({
  execa: (...args: unknown[]) => execaMock(...args),
}));

describe('peekaboo telemetry-safe error context', () => {
  beforeEach(() => {
    vi.resetModules();
    execaMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('includes sanitized stdout/stderr and context in action failures', async () => {
    execaMock.mockRejectedValueOnce(Object.assign(new Error('command failed'), {
      stdout: 'token=plain-secret\nok',
      stderr: 'Authorization: Bearer opta_sk_prod_secret',
      exitCode: 2,
      signal: 'SIGTERM',
      timedOut: false,
    }));

    const { peekabooTypeText } = await import('../../src/browser/peekaboo.js');
    const error = await peekabooTypeText('opta_sk_user_input_secret').catch((err) => err as Error);

    expect(error.name).toBe('PeekabooActionError');
    expect(error.message).toContain('"action":"type"');
    expect(error.message).toContain('"context":{"chars":25}');
    expect(error.message).toContain('"stdout":"token=[REDACTED]');
    expect(error.message).toContain('"stderr":"Authorization:');
    expect(error.message).toContain('[REDACTED]');
    expect(error.message).not.toContain('plain-secret');
    expect(error.message).not.toContain('opta_sk_prod_secret');
    expect(error.message).not.toContain('opta_sk_user_input_secret');
  });
});

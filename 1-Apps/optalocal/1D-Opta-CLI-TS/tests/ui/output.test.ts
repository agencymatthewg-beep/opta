import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('output module', () => {
  const originalEnv = { ...process.env };
  const originalStdout = process.stdout.isTTY;

  afterEach(() => {
    // Restore env
    process.env = { ...originalEnv };
    Object.defineProperty(process.stdout, 'isTTY', { value: originalStdout, writable: true });
    vi.resetModules();
  });

  it('isCI is true when CI=true', async () => {
    process.env['CI'] = 'true';
    delete process.env['FORCE_COLOR'];
    const mod = await import('../../src/ui/output.js');
    expect(mod.isCI).toBe(true);
  });

  it('isCI is true when not a TTY', async () => {
    delete process.env['CI'];
    delete process.env['FORCE_COLOR'];
    Object.defineProperty(process.stdout, 'isTTY', { value: undefined, writable: true });
    const mod = await import('../../src/ui/output.js');
    expect(mod.isCI).toBe(true);
  });

  it('FORCE_COLOR overrides non-TTY detection', async () => {
    delete process.env['CI'];
    process.env['FORCE_COLOR'] = '1';
    Object.defineProperty(process.stdout, 'isTTY', { value: undefined, writable: true });
    const mod = await import('../../src/ui/output.js');
    expect(mod.forceColor).toBe(true);
    expect(mod.isCI).toBe(false);
  });

  it('FORCE_COLOR overrides CI=true', async () => {
    process.env['CI'] = 'true';
    process.env['FORCE_COLOR'] = '1';
    const mod = await import('../../src/ui/output.js');
    expect(mod.forceColor).toBe(true);
    expect(mod.isCI).toBe(false);
  });

  it('forceColor is false when FORCE_COLOR not set', async () => {
    delete process.env['FORCE_COLOR'];
    const mod = await import('../../src/ui/output.js');
    expect(mod.forceColor).toBe(false);
  });

  it('exports helper functions', async () => {
    const mod = await import('../../src/ui/output.js');
    expect(typeof mod.success).toBe('function');
    expect(typeof mod.warn).toBe('function');
    expect(typeof mod.info).toBe('function');
    expect(typeof mod.error).toBe('function');
    expect(typeof mod.dim).toBe('function');
    expect(typeof mod.heading).toBe('function');
  });
});

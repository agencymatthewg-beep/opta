import { describe, it, expect } from 'vitest';
import { createPlaywrightMcpServerConfig } from '../../src/browser/mcp-bootstrap.js';

describe('createPlaywrightMcpServerConfig', () => {
  it('returns secure isolated defaults', () => {
    const config = createPlaywrightMcpServerConfig();

    expect(config.transport).toBe('stdio');
    expect(config.command).toBe('npx');
    expect(config.args).toEqual(['-y', '@playwright/mcp@latest', '--isolated']);
    expect(config.env).toEqual({});
  });

  it('adds normalized allowed-hosts when provided', () => {
    const config = createPlaywrightMcpServerConfig({
      allowedHosts: [' example.com ', 'api.example.com', 'example.com'],
    });

    expect(config.args).toContain('--allowed-hosts');
    expect(config.args).toContain('example.com,api.example.com');
  });

  it('supports attach mode by omitting isolated flag', () => {
    const config = createPlaywrightMcpServerConfig({ mode: 'attach' });
    expect(config.args).not.toContain('--isolated');
  });

  it('passes through command, package, and env overrides', () => {
    const config = createPlaywrightMcpServerConfig({
      command: 'pnpm',
      packageName: '@playwright/mcp@1.0.0',
      env: { DEBUG: 'pw:mcp' },
    });

    expect(config.command).toBe('pnpm');
    expect(config.args.slice(0, 2)).toEqual(['-y', '@playwright/mcp@1.0.0']);
    expect(config.env).toEqual({ DEBUG: 'pw:mcp' });
  });

  it('passes --start-url when startUrl is provided', () => {
    const config = createPlaywrightMcpServerConfig({ startUrl: 'https://example.com' });
    const idx = config.args.indexOf('--start-url');
    expect(idx).toBeGreaterThan(-1);
    expect(config.args[idx + 1]).toBe('https://example.com');
  });

  it('trims startUrl whitespace before passing to args', () => {
    const config = createPlaywrightMcpServerConfig({ startUrl: '  https://example.com  ' });
    const idx = config.args.indexOf('--start-url');
    expect(idx).toBeGreaterThan(-1);
    expect(config.args[idx + 1]).toBe('https://example.com');
  });

  it('omits --start-url for empty or whitespace-only startUrl', () => {
    expect(createPlaywrightMcpServerConfig({ startUrl: '' }).args).not.toContain('--start-url');
    expect(createPlaywrightMcpServerConfig({ startUrl: '   ' }).args).not.toContain('--start-url');
  });
});

describe('V3 browser.action event type', () => {
  it('browser.action is registered in V3EventSchema', async () => {
    const { V3EventSchema } = await import('../../src/protocol/v3/types.js');
    expect(V3EventSchema.options).toContain('browser.action');
  });
});

describe('browser.homePage config field', () => {
  it('accepts a homePage string in browser config', async () => {
    const { OptaConfigSchema } = await import('../../src/core/config.js');
    const result = OptaConfigSchema.safeParse({
      browser: { enabled: true, homePage: 'https://example.com' },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.browser?.homePage).toBe('https://example.com');
    }
  });

  it('homePage defaults to undefined when omitted', async () => {
    const { OptaConfigSchema } = await import('../../src/core/config.js');
    const result = OptaConfigSchema.safeParse({ browser: { enabled: true } });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.browser?.homePage).toBeUndefined();
    }
  });
});

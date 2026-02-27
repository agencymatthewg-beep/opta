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
});

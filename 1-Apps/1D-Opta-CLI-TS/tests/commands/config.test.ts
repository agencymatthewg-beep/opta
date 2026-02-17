import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the config module to avoid filesystem access
vi.mock('../../src/core/config.js', () => ({
  loadConfig: vi.fn().mockResolvedValue({
    connection: { host: '192.168.188.11', port: 1234, protocol: 'http' },
    model: { default: 'test-model', contextLimit: 32768 },
    defaultMode: 'safe',
    permissions: { read_file: 'allow', edit_file: 'ask' },
    safety: { maxToolCalls: 30, compactAt: 0.7, circuitBreaker: {} },
    git: { autoCommit: true, checkpoints: true },
    mcp: { servers: {} },
    search: { searxngUrl: 'http://192.168.188.10:8888' },
    background: { maxConcurrent: 5, defaultTimeout: 300000, maxBufferSize: 1048576, killOnSessionEnd: true },
    hooks: [],
    lsp: { enabled: true, servers: {}, timeout: 10000 },
    subAgent: { enabled: true, maxDepth: 2, maxConcurrent: 1, defaultBudget: {}, inheritMode: true },
    tui: { default: false },
  }),
  getConfigStore: vi.fn(),
  OptaConfigSchema: { parse: vi.fn() },
}));

let output: string[] = [];
beforeEach(() => {
  output = [];
  vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
    output.push(args.map(String).join(' '));
  });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('config command', () => {
  it('lists config as formatted text by default', async () => {
    const { config } = await import('../../src/commands/config.js');
    await config('list', undefined, undefined, {});
    const text = output.join('\n');
    // Should contain key-value pairs (flattened)
    expect(text).toContain('connection.host');
    expect(text).toContain('192.168.188.11');
  });

  it('outputs JSON when --json flag is set', async () => {
    const { config } = await import('../../src/commands/config.js');
    await config('list', undefined, undefined, { json: true });
    const text = output.join('\n');
    // Should be valid JSON
    const parsed = JSON.parse(text);
    expect(parsed).toHaveProperty('connection');
    expect(parsed.connection.host).toBe('192.168.188.11');
    expect(parsed.connection.port).toBe(1234);
  });

  it('JSON output contains no ANSI escape codes', async () => {
    const { config } = await import('../../src/commands/config.js');
    await config('list', undefined, undefined, { json: true });
    const text = output.join('\n');
    // eslint-disable-next-line no-control-regex
    expect(text).not.toMatch(/\x1b\[/);
  });

  it('lists config when no action provided', async () => {
    const { config } = await import('../../src/commands/config.js');
    await config(undefined, undefined, undefined, {});
    const text = output.join('\n');
    expect(text).toContain('connection.host');
  });

  it('JSON output is pretty-printed', async () => {
    const { config } = await import('../../src/commands/config.js');
    await config('list', undefined, undefined, { json: true });
    const text = output.join('\n');
    // Pretty-printed JSON should contain newlines and indentation
    expect(text).toContain('\n');
    expect(text).toMatch(/^\{/);
    expect(text).toMatch(/\}$/);
  });
});

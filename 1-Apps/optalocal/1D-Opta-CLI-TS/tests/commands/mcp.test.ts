import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/core/config.js', () => ({
  loadConfig: vi.fn().mockResolvedValue({
    mcp: {
      servers: {
        github: {
          transport: 'stdio',
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-github'],
          env: { GITHUB_TOKEN: 'test' },
        },
      },
    },
  }),
  saveConfig: vi.fn(),
  getConfigStore: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue({
      github: {
        transport: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-github'],
        env: { GITHUB_TOKEN: 'test' },
      },
    }),
    set: vi.fn(),
    delete: vi.fn(),
  }),
}));

vi.mock('../../src/mcp/client.js', () => ({
  connectMcpServer: vi.fn().mockResolvedValue({
    name: 'test-server',
    tools: [{ name: 'tool1', description: 'Test tool', inputSchema: {} }],
    close: vi.fn(),
  }),
}));

vi.mock('../../src/platform/paths.js', () => ({
  getConfigDir: vi.fn().mockReturnValue('/tmp/opta-mcp-test-config'),
  getDaemonDir: vi.fn().mockReturnValue('/tmp/opta-mcp-test-daemon'),
  getSessionsDir: vi.fn().mockReturnValue('/tmp/opta-mcp-test-sessions'),
  getThemesDir: vi.fn().mockReturnValue('/tmp/opta-mcp-test-themes'),
}));

import { mcpList, mcpAdd, mcpAddPlaywright, mcpRemove, mcpTest } from '../../src/commands/mcp.js';

describe('opta mcp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('list shows configured servers', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    await mcpList({});
    expect(log).toHaveBeenCalled();
    const output = log.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(output).toContain('github');
    log.mockRestore();
  });

  it('list with --json outputs JSON', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    await mcpList({ json: true });
    const output = log.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(() => JSON.parse(output)).not.toThrow();
    log.mockRestore();
  });

  it('add saves a new stdio server to config', async () => {
    const { saveConfig } = await import('../../src/core/config.js');
    await mcpAdd('myserver', 'npx -y @mcp/my-server', {});
    expect(saveConfig).toHaveBeenCalled();
  });

  it('add-playwright helper saves isolated defaults', async () => {
    const { saveConfig } = await import('../../src/core/config.js');
    await mcpAddPlaywright();

    expect(saveConfig).toHaveBeenCalledWith({
      mcp: {
        servers: {
          playwright: expect.objectContaining({
            transport: 'stdio',
            command: 'npx',
            args: expect.arrayContaining(['-y', '@playwright/mcp@latest', '--isolated']),
          }),
        },
      },
    });
  });

  it('add-playwright helper supports attach mode', async () => {
    const { saveConfig } = await import('../../src/core/config.js');
    await mcpAddPlaywright({ mode: 'attach' });

    expect(saveConfig).toHaveBeenCalledWith({
      mcp: {
        servers: {
          playwright: expect.objectContaining({
            transport: 'stdio',
            command: 'npx',
            args: expect.arrayContaining(['-y', '@playwright/mcp@latest']),
          }),
        },
      },
    });
  });

  it('remove deletes a server from config', async () => {
    const { getConfigStore } = await import('../../src/core/config.js');
    await mcpRemove('github');
    expect(getConfigStore).toHaveBeenCalled();
  });

  it('test connects and disconnects from a server', async () => {
    const { connectMcpServer } = await import('../../src/mcp/client.js');
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    await mcpTest('github');
    expect(connectMcpServer).toHaveBeenCalled();
    log.mockRestore();
  });
});

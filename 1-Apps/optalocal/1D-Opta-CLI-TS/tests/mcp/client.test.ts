import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the MCP SDK modules
vi.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: vi.fn().mockImplementation(() => ({
    connect: vi.fn(),
    listTools: vi.fn().mockResolvedValue({
      tools: [
        {
          name: 'get_issue',
          description: 'Get a GitHub issue',
          inputSchema: {
            type: 'object',
            properties: { owner: { type: 'string' }, repo: { type: 'string' } },
            required: ['owner', 'repo'],
          },
        },
      ],
    }),
    callTool: vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'Issue #1: Fix bug' }],
    }),
    close: vi.fn(),
  })),
}));

vi.mock('@modelcontextprotocol/sdk/client/stdio.js', () => ({
  StdioClientTransport: vi.fn(),
}));

vi.mock('@modelcontextprotocol/sdk/client/streamableHttp.js', () => ({
  StreamableHTTPClientTransport: vi.fn(),
}));

import { connectMcpServer } from '../../src/mcp/client.js';

describe('MCP client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('connects to a stdio server and lists tools', async () => {
    const conn = await connectMcpServer('github', {
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-github'],
      env: {},
    });
    expect(conn.name).toBe('github');
    expect(conn.tools.length).toBe(1);
    expect(conn.tools[0]!.name).toBe('get_issue');
  });

  it('connects to an HTTP server', async () => {
    const conn = await connectMcpServer('postgres', {
      transport: 'http',
      url: 'http://localhost:3100/mcp',
    });
    expect(conn.name).toBe('postgres');
    expect(conn.tools.length).toBe(1);
  });

  it('calls a tool and returns text result', async () => {
    const conn = await connectMcpServer('github', {
      transport: 'stdio',
      command: 'npx',
      args: [],
      env: {},
    });
    const result = await conn.call('get_issue', { owner: 'test', repo: 'test' });
    expect(result).toBe('Issue #1: Fix bug');
  });

  it('closes the connection', async () => {
    const conn = await connectMcpServer('github', {
      transport: 'stdio',
      command: 'npx',
      args: [],
      env: {},
    });
    await conn.close();
    // Should not throw
  });

  it('returns error string when tool call fails', async () => {
    const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
    vi.mocked(Client).mockImplementationOnce(
      () =>
        ({
          connect: vi.fn(),
          listTools: vi.fn().mockResolvedValue({ tools: [] }),
          callTool: vi.fn().mockRejectedValue(new Error('Server crashed')),
          close: vi.fn(),
        }) as any
    );

    const conn = await connectMcpServer('broken', {
      transport: 'stdio',
      command: 'echo',
      args: [],
      env: {},
    });
    const result = await conn.call('anything', {});
    expect(result).toContain('Error');
  });
});

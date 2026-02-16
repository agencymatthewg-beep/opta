import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the MCP client
vi.mock('../../src/mcp/client.js', () => ({
  connectMcpServer: vi.fn().mockResolvedValue({
    name: 'github',
    tools: [
      {
        name: 'get_issue',
        description: 'Get a GitHub issue',
        inputSchema: {
          type: 'object',
          properties: { owner: { type: 'string' } },
          required: ['owner'],
        },
      },
    ],
    call: vi.fn().mockResolvedValue('Issue #1'),
    close: vi.fn(),
  }),
}));

import { buildToolRegistry } from '../../src/mcp/registry.js';
import { TOOL_SCHEMAS } from '../../src/core/tools.js';

describe('Tool registry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('includes all built-in tools when no MCP servers configured', async () => {
    const registry = await buildToolRegistry({
      mcp: { servers: {} },
    } as any);
    expect(registry.schemas.length).toBe(TOOL_SCHEMAS.length);
  });

  it('merges MCP tools with built-in tools', async () => {
    const registry = await buildToolRegistry({
      mcp: {
        servers: {
          github: {
            transport: 'stdio' as const,
            command: 'npx',
            args: [],
            env: {},
          },
        },
      },
    } as any);
    expect(registry.schemas.length).toBe(TOOL_SCHEMAS.length + 1);
  });

  it('namespaces MCP tools as mcp__<server>__<tool>', async () => {
    const registry = await buildToolRegistry({
      mcp: {
        servers: {
          github: {
            transport: 'stdio' as const,
            command: 'npx',
            args: [],
            env: {},
          },
        },
      },
    } as any);
    const names = registry.schemas.map((s: any) => s.function.name);
    expect(names).toContain('mcp__github__get_issue');
  });

  it('routes built-in tool calls to executeTool', async () => {
    const registry = await buildToolRegistry({
      mcp: { servers: {} },
    } as any);
    const result = await registry.execute('read_file', JSON.stringify({ path: 'package.json' }));
    expect(result).toContain('"name"');
  });

  it('routes MCP tool calls to the MCP server', async () => {
    const registry = await buildToolRegistry({
      mcp: {
        servers: {
          github: {
            transport: 'stdio' as const,
            command: 'npx',
            args: [],
            env: {},
          },
        },
      },
    } as any);
    const result = await registry.execute(
      'mcp__github__get_issue',
      JSON.stringify({ owner: 'test' })
    );
    expect(result).toBe('Issue #1');
  });

  it('closes all MCP connections on shutdown', async () => {
    const registry = await buildToolRegistry({
      mcp: {
        servers: {
          github: {
            transport: 'stdio' as const,
            command: 'npx',
            args: [],
            env: {},
          },
        },
      },
    } as any);
    await registry.close();
    // Should not throw
  });

  it('handles MCP server connection failure gracefully', async () => {
    const { connectMcpServer } = await import('../../src/mcp/client.js');
    vi.mocked(connectMcpServer).mockRejectedValueOnce(new Error('Connection refused'));

    const registry = await buildToolRegistry({
      mcp: {
        servers: {
          broken: {
            transport: 'http' as const,
            url: 'http://localhost:9999/mcp',
          },
        },
      },
    } as any);
    // Should still have built-in tools only
    expect(registry.schemas.length).toBe(TOOL_SCHEMAS.length);
  });
});

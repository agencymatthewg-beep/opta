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
import { TOOL_SCHEMAS, SUB_AGENT_TOOL_SCHEMAS } from '../../src/core/tools.js';

const TOTAL_BUILTIN = TOOL_SCHEMAS.length + SUB_AGENT_TOOL_SCHEMAS.length;

describe('Tool registry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('includes all built-in tools when no MCP servers configured', async () => {
    const registry = await buildToolRegistry({
      mcp: { servers: {} },
    } as any);
    expect(registry.schemas.length).toBe(TOTAL_BUILTIN);
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
    expect(registry.schemas.length).toBe(TOTAL_BUILTIN + 1);
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
    // Should still have built-in tools + sub-agent tools only
    expect(registry.schemas.length).toBe(TOTAL_BUILTIN);
  });
});

// --- Task 9: Sub-Agent Registry Integration ---

describe('Tool Registry with Sub-Agent Tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('includes spawn_agent in normal mode when subAgent is enabled', async () => {
    const registry = await buildToolRegistry({
      mcp: { servers: {} },
      subAgent: { enabled: true },
    } as any);
    const names = registry.schemas.map((s: any) => s.function.name);
    expect(names).toContain('spawn_agent');
    expect(names).toContain('delegate_task');
  });

  it('excludes spawn_agent in plan mode', async () => {
    const registry = await buildToolRegistry({
      mcp: { servers: {} },
      subAgent: { enabled: true },
    } as any, 'plan');
    const names = registry.schemas.map((s: any) => s.function.name);
    expect(names).not.toContain('spawn_agent');
    expect(names).not.toContain('delegate_task');
  });

  it('excludes sub-agent tools when disabled in config', async () => {
    const registry = await buildToolRegistry({
      mcp: { servers: {} },
      subAgent: { enabled: false },
    } as any);
    const names = registry.schemas.map((s: any) => s.function.name);
    expect(names).not.toContain('spawn_agent');
    expect(names).not.toContain('delegate_task');
  });

  it('excludes sub-agent tools from schema count when disabled', async () => {
    const registry = await buildToolRegistry({
      mcp: { servers: {} },
      subAgent: { enabled: false },
    } as any);
    expect(registry.schemas.length).toBe(TOOL_SCHEMAS.length);
  });
});

// --- LSP Registry Integration ---

describe('LSP tool routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('includes LSP tool schemas when LSP is enabled', async () => {
    const registry = await buildToolRegistry({
      mcp: { servers: {} },
      lsp: { enabled: true, servers: {}, timeout: 10000 },
    } as any);
    const names = registry.schemas.map((s: any) => s.function.name);
    expect(names).toContain('lsp_definition');
    expect(names).toContain('lsp_references');
    expect(names).toContain('lsp_hover');
    expect(names).toContain('lsp_symbols');
    expect(names).toContain('lsp_document_symbols');
    expect(names).toContain('lsp_rename');
  });

  it('excludes LSP tool schemas when LSP is disabled', async () => {
    const registry = await buildToolRegistry({
      mcp: { servers: {} },
      lsp: { enabled: false, servers: {}, timeout: 10000 },
    } as any);
    const names = registry.schemas.map((s: any) => s.function.name);
    expect(names).not.toContain('lsp_definition');
    expect(names).not.toContain('lsp_references');
  });

  it('routes lsp_* calls through LspManager instead of Unknown tool', async () => {
    const registry = await buildToolRegistry({
      mcp: { servers: {} },
      lsp: { enabled: true, servers: {}, timeout: 10000 },
    } as any);
    const result = await registry.execute('lsp_definition', JSON.stringify({
      path: 'src/app.ts', line: 1, character: 0,
    }));
    // Should return a fallback (no real server) instead of "Unknown tool"
    expect(result).not.toContain('Unknown tool');
  });
});

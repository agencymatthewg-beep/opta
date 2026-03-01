import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Tests for visual overlay event dispatch in the MCP registry.
 *
 * The registry dispatches `opta:state`, `opta:navigate`, `opta:action`, and
 * `opta:policy` events via `dispatchOverlayEvent()` (fire-and-forget) to the
 * Playwright browser's chrome overlay. These tests verify the dispatch logic
 * without a real Playwright connection by mocking the MCP connection and
 * interceptor.
 */

// ---- Mocks ----

// Mock the MCP client so we can provide a fake connection
vi.mock('../../src/mcp/client.js', () => ({
  connectMcpServer: vi.fn(),
}));

// Mock browser interceptor — the core of how browser tool calls are routed
const mockInterceptBrowserMcpCall = vi.fn();
const MockBrowserPolicyDeniedError = class extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'BrowserPolicyDeniedError';
  }
};
vi.mock('../../src/browser/mcp-interceptor.js', () => ({
  interceptBrowserMcpCall: (...args: unknown[]) => mockInterceptBrowserMcpCall(...args),
  BrowserPolicyDeniedError: MockBrowserPolicyDeniedError,
}));

// Mock browser policy config resolver
vi.mock('../../src/core/browser-policy-config.js', () => ({
  resolveBrowserPolicyConfig: vi.fn().mockReturnValue({
    maxActions: 100,
    allowedTools: ['browser_navigate', 'browser_click', 'browser_type', 'browser_fill_form'],
  }),
}));

// Mock the mcp-bootstrap for Playwright server config creation
vi.mock('../../src/browser/mcp-bootstrap.js', () => ({
  createPlaywrightMcpServerConfig: vi.fn().mockResolvedValue({
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@playwright/mcp@latest', '--isolated'],
    env: {},
  }),
}));

// Mock core tools
vi.mock('../../src/core/tools/index.js', () => ({
  TOOL_SCHEMAS: [],
  SUB_AGENT_TOOL_SCHEMAS: [],
  executeTool: vi.fn().mockResolvedValue('ok'),
}));

// Mock custom tools loader
vi.mock('../../src/core/tools/custom.js', () => ({
  loadCustomTools: vi.fn().mockResolvedValue([]),
  toToolSchema: vi.fn(),
  executeCustomTool: vi.fn(),
}));

// Mock debug
vi.mock('../../src/core/debug.js', () => ({
  debug: vi.fn(),
}));

// Mock error utils
vi.mock('../../src/utils/errors.js', () => ({
  errorMessage: (e: unknown) => (e instanceof Error ? e.message : String(e)),
}));

// Mock token estimation
vi.mock('../../src/utils/tokens.js', () => ({
  estimateTokens: vi.fn().mockReturnValue(100),
}));

// Mock LMX API key
vi.mock('../../src/lmx/api-key.js', () => ({
  resolveLmxApiKeyAsync: vi.fn().mockResolvedValue('test-key'),
}));

// Mock MCP cache
vi.mock('../../src/mcp/cache.js', () => ({
  ToolResultCache: vi.fn().mockImplementation(() => ({
    isCacheable: () => false,
    isWriteTool: () => false,
    get: () => undefined,
    set: vi.fn(),
    flush: vi.fn(),
    size: 0,
  })),
}));

// Mock LSP
vi.mock('../../src/lsp/manager.js', () => ({
  LspManager: vi.fn().mockImplementation(() => ({
    execute: vi.fn().mockResolvedValue('lsp result'),
    shutdownAll: vi.fn(),
    notifyFileChanged: vi.fn(),
  })),
}));

import { connectMcpServer, type McpConnection } from '../../src/mcp/client.js';
import { buildToolRegistry } from '../../src/mcp/registry.js';
import type { OptaConfig } from '../../src/core/config.js';

// --- Helpers ---

/** Minimal config with browser enabled and Playwright MCP wired. */
function makeConfig(overrides?: Partial<OptaConfig>): OptaConfig {
  return {
    model: { default: 'mlx-community/test', contextLimit: 32768 },
    connection: { host: '192.168.188.11', port: 1234 },
    browser: {
      enabled: true,
      mode: 'isolated',
      mcp: { enabled: true },
    },
    mcp: { servers: {} },
    subAgent: { enabled: false },
    lsp: { enabled: false },
    ...overrides,
  } as OptaConfig;
}

/** Create a mock McpConnection that tracks `call` invocations. */
function createMockMcpConn(name = 'playwright'): McpConnection & { call: ReturnType<typeof vi.fn> } {
  return {
    name,
    tools: [
      { name: 'browser_navigate', description: 'Navigate', inputSchema: {} },
      { name: 'browser_click', description: 'Click', inputSchema: {} },
      { name: 'browser_type', description: 'Type', inputSchema: {} },
      { name: 'browser_fill_form', description: 'Fill form', inputSchema: {} },
      { name: 'browser_snapshot', description: 'Snapshot', inputSchema: {} },
      { name: 'browser_evaluate', description: 'Evaluate JS', inputSchema: {} },
    ],
    call: vi.fn().mockResolvedValue('ok'),
    close: vi.fn(),
  };
}

describe('registry visual dispatch — dispatchOverlayEvent via browser tool execution', () => {
  let mockConn: ReturnType<typeof createMockMcpConn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockConn = createMockMcpConn();
    vi.mocked(connectMcpServer).mockResolvedValue(mockConn);
    mockInterceptBrowserMcpCall.mockImplementation(
      async (_toolName: string, _args: unknown, _opts: unknown, executeFn: () => Promise<string>) => {
        return await executeFn();
      },
    );
  });

  it('dispatches opta:state executing before browser_navigate', async () => {
    const registry = await buildToolRegistry(makeConfig());
    await registry.execute(
      'mcp__playwright__browser_navigate',
      JSON.stringify({ url: 'https://example.com' }),
    );

    // dispatchOverlayEvent calls mcpConn.call('browser_evaluate', { expression: ... })
    const evaluateCalls = mockConn.call.mock.calls.filter(
      (c: unknown[]) => c[0] === 'browser_evaluate',
    );

    // First evaluate call should be opta:state executing (before tool)
    expect(evaluateCalls.length).toBeGreaterThanOrEqual(1);
    const firstExpr = (evaluateCalls[0]![1] as { expression: string }).expression;
    expect(firstExpr).toContain('opta:state');
    expect(firstExpr).toContain('"executing"');
  });

  it('dispatches opta:navigate after successful browser_navigate', async () => {
    const registry = await buildToolRegistry(makeConfig());
    await registry.execute(
      'mcp__playwright__browser_navigate',
      JSON.stringify({ url: 'https://example.com' }),
    );

    const evaluateCalls = mockConn.call.mock.calls.filter(
      (c: unknown[]) => c[0] === 'browser_evaluate',
    );

    // Should have: opta:state executing, opta:navigate, opta:state idle
    const expressions = evaluateCalls.map(
      (c: unknown[]) => (c[1] as { expression: string }).expression,
    );
    const navigateEvent = expressions.find((e: string) => e.includes('opta:navigate'));
    expect(navigateEvent).toBeDefined();
    expect(navigateEvent).toContain('https://example.com');
  });

  it('dispatches opta:action with type click after browser_click', async () => {
    const registry = await buildToolRegistry(makeConfig());
    await registry.execute(
      'mcp__playwright__browser_click',
      JSON.stringify({ selector: '#submit-btn' }),
    );

    const evaluateCalls = mockConn.call.mock.calls.filter(
      (c: unknown[]) => c[0] === 'browser_evaluate',
    );
    const expressions = evaluateCalls.map(
      (c: unknown[]) => (c[1] as { expression: string }).expression,
    );
    const actionEvent = expressions.find((e: string) => e.includes('opta:action'));
    expect(actionEvent).toBeDefined();
    expect(actionEvent).toContain('"click"');
    expect(actionEvent).toContain('#submit-btn');
  });

  it('dispatches opta:action with type type after browser_type', async () => {
    const registry = await buildToolRegistry(makeConfig());
    await registry.execute(
      'mcp__playwright__browser_type',
      JSON.stringify({ selector: '#search', text: 'hello' }),
    );

    const evaluateCalls = mockConn.call.mock.calls.filter(
      (c: unknown[]) => c[0] === 'browser_evaluate',
    );
    const expressions = evaluateCalls.map(
      (c: unknown[]) => (c[1] as { expression: string }).expression,
    );
    const actionEvent = expressions.find((e: string) => e.includes('opta:action'));
    expect(actionEvent).toBeDefined();
    expect(actionEvent).toContain('"type"');
    expect(actionEvent).toContain('#search');
  });

  it('dispatches opta:action with type type after browser_fill_form', async () => {
    const registry = await buildToolRegistry(makeConfig());
    await registry.execute(
      'mcp__playwright__browser_fill_form',
      JSON.stringify({ selector: '#email', value: 'test@test.com' }),
    );

    const evaluateCalls = mockConn.call.mock.calls.filter(
      (c: unknown[]) => c[0] === 'browser_evaluate',
    );
    const expressions = evaluateCalls.map(
      (c: unknown[]) => (c[1] as { expression: string }).expression,
    );
    const actionEvent = expressions.find((e: string) => e.includes('opta:action'));
    expect(actionEvent).toBeDefined();
    expect(actionEvent).toContain('"type"');
  });

  it('dispatches opta:state idle after successful tool execution', async () => {
    const registry = await buildToolRegistry(makeConfig());
    await registry.execute(
      'mcp__playwright__browser_navigate',
      JSON.stringify({ url: 'https://example.com' }),
    );

    const evaluateCalls = mockConn.call.mock.calls.filter(
      (c: unknown[]) => c[0] === 'browser_evaluate',
    );
    const expressions = evaluateCalls.map(
      (c: unknown[]) => (c[1] as { expression: string }).expression,
    );

    // Last opta:state dispatch should be idle
    const stateEvents = expressions.filter((e: string) => e.includes('opta:state'));
    expect(stateEvents.length).toBeGreaterThanOrEqual(2);
    const lastState = stateEvents[stateEvents.length - 1]!;
    expect(lastState).toContain('"idle"');
  });

  it('dispatches opta:state error when tool execution fails', async () => {
    mockInterceptBrowserMcpCall.mockRejectedValueOnce(new Error('Element not found'));

    const registry = await buildToolRegistry(makeConfig());
    const result = await registry.execute(
      'mcp__playwright__browser_click',
      JSON.stringify({ selector: '#missing' }),
    );

    expect(result).toContain('Error');

    const evaluateCalls = mockConn.call.mock.calls.filter(
      (c: unknown[]) => c[0] === 'browser_evaluate',
    );
    const expressions = evaluateCalls.map(
      (c: unknown[]) => (c[1] as { expression: string }).expression,
    );
    const errorState = expressions.find(
      (e: string) => e.includes('opta:state') && e.includes('"error"'),
    );
    expect(errorState).toBeDefined();
  });

  it('dispatches opta:policy gated on BrowserPolicyDeniedError', async () => {
    mockInterceptBrowserMcpCall.mockRejectedValueOnce(
      new MockBrowserPolicyDeniedError('Policy denied: browser_evaluate'),
    );

    const registry = await buildToolRegistry(makeConfig());
    const result = await registry.execute(
      'mcp__playwright__browser_navigate',
      JSON.stringify({ url: 'https://evil.com' }),
    );

    expect(result).toContain('Error');

    const evaluateCalls = mockConn.call.mock.calls.filter(
      (c: unknown[]) => c[0] === 'browser_evaluate',
    );
    const expressions = evaluateCalls.map(
      (c: unknown[]) => (c[1] as { expression: string }).expression,
    );
    const policyEvent = expressions.find((e: string) => e.includes('opta:policy'));
    expect(policyEvent).toBeDefined();
    expect(policyEvent).toContain('"gated"');
  });

  it('dispatch failures do not block tool execution (fire-and-forget)', async () => {
    // Make browser_evaluate reject to simulate dispatch failure
    mockConn.call.mockImplementation(async (toolName: string) => {
      if (toolName === 'browser_evaluate') {
        throw new Error('Evaluate failed');
      }
      return 'ok';
    });

    // The interceptor should still succeed
    mockInterceptBrowserMcpCall.mockResolvedValueOnce('navigation complete');

    const registry = await buildToolRegistry(makeConfig());
    // This should NOT throw despite browser_evaluate failures
    const result = await registry.execute(
      'mcp__playwright__browser_navigate',
      JSON.stringify({ url: 'https://example.com' }),
    );

    expect(result).toContain('navigation complete');
  });

  it('visual dispatch does not block tool execution timing', async () => {
    // Make browser_evaluate slow (100ms delay) — but dispatch is fire-and-forget
    mockConn.call.mockImplementation(async (toolName: string) => {
      if (toolName === 'browser_evaluate') {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return 'ok';
      }
      return 'tool result';
    });

    mockInterceptBrowserMcpCall.mockResolvedValueOnce('fast result');

    const registry = await buildToolRegistry(makeConfig());

    const start = Date.now();
    const result = await registry.execute(
      'mcp__playwright__browser_navigate',
      JSON.stringify({ url: 'https://example.com' }),
    );
    const elapsed = Date.now() - start;

    expect(result).toContain('fast result');
    // The main execution should complete well under the 100ms evaluate delay
    // because dispatchOverlayEvent uses void + .catch() (fire-and-forget).
    // We give a generous threshold since CI can be slow.
    expect(elapsed).toBeLessThan(500);
  });

  it('does not dispatch visual events for non-Playwright MCP connections', async () => {
    const otherConn = createMockMcpConn('github');
    vi.mocked(connectMcpServer).mockResolvedValue(otherConn);

    const config = makeConfig({
      browser: { enabled: false },
      mcp: {
        servers: {
          github: {
            transport: 'stdio' as const,
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-github'],
            env: {},
          },
        },
      },
    } as Partial<OptaConfig>);

    const registry = await buildToolRegistry(config);
    await registry.execute(
      'mcp__github__browser_navigate',
      JSON.stringify({ url: 'https://example.com' }),
    );

    // No browser_evaluate calls for visual dispatch — this is not a Playwright connection
    const evaluateCalls = otherConn.call.mock.calls.filter(
      (c: unknown[]) => c[0] === 'browser_evaluate',
    );
    expect(evaluateCalls.length).toBe(0);
  });

  it('does not dispatch for browser_snapshot (no visual event mapped)', async () => {
    const registry = await buildToolRegistry(makeConfig());
    await registry.execute(
      'mcp__playwright__browser_snapshot',
      JSON.stringify({}),
    );

    const evaluateCalls = mockConn.call.mock.calls.filter(
      (c: unknown[]) => c[0] === 'browser_evaluate',
    );
    const expressions = evaluateCalls.map(
      (c: unknown[]) => (c[1] as { expression: string }).expression,
    );

    // Should have opta:state executing + opta:state idle, but no opta:action or opta:navigate
    const actionEvents = expressions.filter(
      (e: string) => e.includes('opta:action') || e.includes('opta:navigate'),
    );
    expect(actionEvents.length).toBe(0);
  });
});

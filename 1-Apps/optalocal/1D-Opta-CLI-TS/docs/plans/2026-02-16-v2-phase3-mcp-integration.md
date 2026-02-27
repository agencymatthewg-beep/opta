# V2 Phase 3: MCP Integration — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Connect Opta CLI to external MCP servers (GitHub, databases, docs, etc.) and expose their tools alongside the 9 built-in tools in the agent loop.

**Architecture:** Two new modules (`src/mcp/client.ts` for transport, `src/mcp/registry.ts` for tool merging) wrap the `@modelcontextprotocol/sdk` package. The config schema gains an `mcp.servers` section. The agent loop swaps hardcoded `TOOL_SCHEMAS` for a dynamic registry that merges built-in + MCP tools. The `opta mcp` command gets real subcommands.

**Tech Stack:** `@modelcontextprotocol/sdk` (MCP TS SDK), Zod (config validation), OpenAI function-call format (tool schemas), execa (stdio transport child processes)

---

### Task 1: Add MCP SDK dependency + config schema

**Files:**
- Modify: `package.json` (add `@modelcontextprotocol/sdk` dependency)
- Modify: `src/core/config.ts` (add `mcp.servers` to Zod schema)
- Modify: `tests/core/config.test.ts` (add MCP config validation tests)

**Step 1: Write the failing tests**

Add tests to `tests/core/config.test.ts`:

```typescript
describe('MCP config schema', () => {
  it('defaults to empty servers object', async () => {
    const config = await loadConfig();
    expect(config.mcp.servers).toEqual({});
  });

  it('accepts stdio server config', async () => {
    const config = await loadConfig({
      mcp: {
        servers: {
          github: {
            transport: 'stdio',
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-github'],
            env: { GITHUB_TOKEN: 'test-token' },
          },
        },
      },
    });
    expect(config.mcp.servers['github']?.transport).toBe('stdio');
    expect(config.mcp.servers['github']?.command).toBe('npx');
  });

  it('accepts http server config', async () => {
    const config = await loadConfig({
      mcp: {
        servers: {
          postgres: {
            transport: 'http',
            url: 'http://localhost:3100/mcp',
          },
        },
      },
    });
    expect(config.mcp.servers['postgres']?.transport).toBe('http');
    expect(config.mcp.servers['postgres']?.url).toBe('http://localhost:3100/mcp');
  });

  it('rejects invalid transport type', async () => {
    await expect(
      loadConfig({
        mcp: { servers: { bad: { transport: 'grpc' } } },
      })
    ).rejects.toThrow();
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- tests/core/config.test.ts`
Expected: FAIL — `config.mcp` is undefined (schema doesn't have `mcp` yet)

**Step 3: Install MCP SDK dependency**

```bash
pnpm add @modelcontextprotocol/sdk
```

**Step 4: Add MCP config to Zod schema**

In `src/core/config.ts`, add the MCP server config schemas:

```typescript
const McpStdioServerSchema = z.object({
  transport: z.literal('stdio'),
  command: z.string(),
  args: z.array(z.string()).default([]),
  env: z.record(z.string(), z.string()).default({}),
});

const McpHttpServerSchema = z.object({
  transport: z.literal('http'),
  url: z.string().url(),
});

const McpServerConfigSchema = z.discriminatedUnion('transport', [
  McpStdioServerSchema,
  McpHttpServerSchema,
]);

// Add to OptaConfigSchema:
mcp: z.object({
  servers: z.record(z.string(), McpServerConfigSchema).default({}),
}).default({}),
```

**Step 5: Run tests to verify they pass**

Run: `npm test -- tests/core/config.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml src/core/config.ts tests/core/config.test.ts
git commit -m "feat(mcp): add MCP SDK dependency and config schema

Add @modelcontextprotocol/sdk package. Extend Zod config schema with
mcp.servers supporting stdio and http transport discriminated union."
```

---

### Task 2: Create MCP client wrapper

**Files:**
- Create: `src/mcp/client.ts`
- Create: `tests/mcp/client.test.ts`

**Step 1: Write the failing tests**

Create `tests/mcp/client.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the MCP SDK
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

import { connectMcpServer, type McpConnection } from '../../src/mcp/client.js';

describe('MCP client', () => {
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
    vi.mocked(Client).mockImplementationOnce(() => ({
      connect: vi.fn(),
      listTools: vi.fn().mockResolvedValue({ tools: [] }),
      callTool: vi.fn().mockRejectedValue(new Error('Server crashed')),
      close: vi.fn(),
    }) as any);

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
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- tests/mcp/client.test.ts`
Expected: FAIL — `src/mcp/client.ts` doesn't exist

**Step 3: Implement the MCP client**

Create `src/mcp/client.ts`:

```typescript
import { debug } from '../core/debug.js';

export interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface McpConnection {
  name: string;
  tools: McpTool[];
  call(toolName: string, args: Record<string, unknown>): Promise<string>;
  close(): Promise<void>;
}

interface StdioConfig {
  transport: 'stdio';
  command: string;
  args: string[];
  env: Record<string, string>;
}

interface HttpConfig {
  transport: 'http';
  url: string;
}

type McpServerConfig = StdioConfig | HttpConfig;

export async function connectMcpServer(
  name: string,
  config: McpServerConfig
): Promise<McpConnection> {
  const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
  const client = new Client({ name: `opta-${name}`, version: '1.0.0' });

  // Create transport based on config
  if (config.transport === 'stdio') {
    const { StdioClientTransport } = await import(
      '@modelcontextprotocol/sdk/client/stdio.js'
    );
    const transport = new StdioClientTransport({
      command: config.command,
      args: config.args,
      env: { ...process.env, ...config.env } as Record<string, string>,
    });
    await client.connect(transport);
  } else {
    const { StreamableHTTPClientTransport } = await import(
      '@modelcontextprotocol/sdk/client/streamableHttp.js'
    );
    const transport = new StreamableHTTPClientTransport(new URL(config.url));
    await client.connect(transport);
  }

  // Fetch available tools
  const { tools: rawTools } = await client.listTools();
  const tools: McpTool[] = rawTools.map((t) => ({
    name: t.name,
    description: t.description ?? '',
    inputSchema: t.inputSchema as Record<string, unknown>,
  }));

  debug(`MCP server "${name}" connected with ${tools.length} tools`);

  return {
    name,
    tools,
    async call(toolName, args) {
      try {
        const result = await client.callTool({ name: toolName, arguments: args });
        // Extract text from content array
        const texts = (result.content as Array<{ type: string; text?: string }>)
          .filter((c) => c.type === 'text' && c.text)
          .map((c) => c.text!);
        return texts.join('\n') || '(empty response)';
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return `Error: MCP tool "${toolName}" failed: ${msg}`;
      }
    },
    async close() {
      await client.close();
      debug(`MCP server "${name}" disconnected`);
    },
  };
}
```

**Step 4: Run tests to verify they pass**

Run: `npm test -- tests/mcp/client.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/mcp/client.ts tests/mcp/client.test.ts
git commit -m "feat(mcp): add MCP client wrapper with stdio and HTTP transport

Wraps @modelcontextprotocol/sdk Client with connectMcpServer() that
handles both stdio and HTTP transports, tool listing, and tool calling
with error handling."
```

---

### Task 3: Create tool registry

**Files:**
- Create: `src/mcp/registry.ts`
- Create: `tests/mcp/registry.test.ts`

**Step 1: Write the failing tests**

Create `tests/mcp/registry.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';

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
            transport: 'stdio',
            command: 'npx',
            args: [],
            env: {},
          },
        },
      },
    } as any);
    expect(registry.schemas.length).toBe(TOOL_SCHEMAS.length + 1);
    const names = registry.schemas.map((s) => s.function.name);
    expect(names).toContain('get_issue');
  });

  it('namespaces MCP tools to avoid collisions', async () => {
    const registry = await buildToolRegistry({
      mcp: {
        servers: {
          github: {
            transport: 'stdio',
            command: 'npx',
            args: [],
            env: {},
          },
        },
      },
    } as any);
    const names = registry.schemas.map((s) => s.function.name);
    expect(names).toContain('mcp__github__get_issue');
  });

  it('routes built-in tool calls to executeTool', async () => {
    const registry = await buildToolRegistry({
      mcp: { servers: {} },
    } as any);
    // read_file should work through the registry
    const result = await registry.execute('read_file', JSON.stringify({ path: 'package.json' }));
    expect(result).toContain('"name"');
  });

  it('routes MCP tool calls to the MCP server', async () => {
    const registry = await buildToolRegistry({
      mcp: {
        servers: {
          github: {
            transport: 'stdio',
            command: 'npx',
            args: [],
            env: {},
          },
        },
      },
    } as any);
    const result = await registry.execute('mcp__github__get_issue', JSON.stringify({ owner: 'test' }));
    expect(result).toBe('Issue #1');
  });

  it('closes all MCP connections on shutdown', async () => {
    const registry = await buildToolRegistry({
      mcp: {
        servers: {
          github: {
            transport: 'stdio',
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
            transport: 'http',
            url: 'http://localhost:9999/mcp',
          },
        },
      },
    } as any);
    // Should still have built-in tools
    expect(registry.schemas.length).toBe(TOOL_SCHEMAS.length);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- tests/mcp/registry.test.ts`
Expected: FAIL — `src/mcp/registry.ts` doesn't exist

**Step 3: Implement the tool registry**

Create `src/mcp/registry.ts`:

```typescript
import { TOOL_SCHEMAS, executeTool } from '../core/tools.js';
import { connectMcpServer, type McpConnection } from './client.js';
import { debug } from '../core/debug.js';
import type { OptaConfig } from '../core/config.js';

interface ToolSchema {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

interface ToolRegistry {
  schemas: ToolSchema[];
  execute: (name: string, argsJson: string) => Promise<string>;
  close: () => Promise<void>;
}

export async function buildToolRegistry(config: OptaConfig): Promise<ToolRegistry> {
  const connections: McpConnection[] = [];
  const mcpSchemas: ToolSchema[] = [];
  const mcpRoutes = new Map<string, McpConnection>();

  // Connect to each configured MCP server
  const serverEntries = Object.entries(config.mcp?.servers ?? {});

  for (const [name, serverConfig] of serverEntries) {
    try {
      const conn = await connectMcpServer(name, serverConfig);
      connections.push(conn);

      // Namespace MCP tools: mcp__<server>__<tool>
      for (const tool of conn.tools) {
        const namespacedName = `mcp__${name}__${tool.name}`;
        mcpSchemas.push({
          type: 'function',
          function: {
            name: namespacedName,
            description: `[${name}] ${tool.description}`,
            parameters: tool.inputSchema,
          },
        });
        mcpRoutes.set(namespacedName, conn);
      }

      debug(`MCP "${name}": ${conn.tools.length} tools registered`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      debug(`MCP "${name}" failed to connect: ${msg}`);
      console.warn(`  MCP server "${name}" unavailable: ${msg}`);
    }
  }

  // Warn if total tool count is high
  const totalTools = TOOL_SCHEMAS.length + mcpSchemas.length;
  if (totalTools > 20) {
    console.warn(
      `  ${totalTools} tools configured — local models may struggle. Consider reducing MCP servers.`
    );
  }

  const allSchemas = [...(TOOL_SCHEMAS as ToolSchema[]), ...mcpSchemas];

  return {
    schemas: allSchemas,
    async execute(name: string, argsJson: string): Promise<string> {
      // Check if it's an MCP tool
      const mcpConn = mcpRoutes.get(name);
      if (mcpConn) {
        let args: Record<string, unknown>;
        try {
          args = JSON.parse(argsJson);
        } catch {
          return `Error: Invalid JSON arguments`;
        }
        return mcpConn.call(name.split('__').slice(2).join('__'), args);
      }

      // Fall through to built-in tools
      return executeTool(name, argsJson);
    },
    async close() {
      for (const conn of connections) {
        try {
          await conn.close();
        } catch {
          // Best-effort cleanup
        }
      }
    },
  };
}
```

**Step 4: Run tests to verify they pass**

Run: `npm test -- tests/mcp/registry.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/mcp/registry.ts tests/mcp/registry.test.ts
git commit -m "feat(mcp): add tool registry merging built-in and MCP tools

buildToolRegistry() connects to configured MCP servers, namespaces their
tools as mcp__<server>__<tool>, merges with built-in TOOL_SCHEMAS, and
routes calls to the correct handler. Gracefully degrades on connection
failure."
```

---

### Task 4: Hook registry into agent loop

**Files:**
- Modify: `src/core/agent.ts` (use `buildToolRegistry()` instead of hardcoded `TOOL_SCHEMAS`)
- Modify: `tests/core/agent.test.ts` (add test for MCP tool routing)

**Step 1: Write the failing test**

Add to `tests/core/agent.test.ts`:

```typescript
it('uses tool registry when MCP servers are configured', async () => {
  // Verify agent.ts imports buildToolRegistry
  const agentSource = readFileSync(resolve(__dirname, '../../src/core/agent.ts'), 'utf-8');
  expect(agentSource).toContain('buildToolRegistry');
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/core/agent.test.ts`
Expected: FAIL — agent.ts doesn't contain `buildToolRegistry`

**Step 3: Modify agent loop to use registry**

In `src/core/agent.ts`, modify the `agentLoop()` function:

1. Import `buildToolRegistry` at point of use (lazy)
2. Replace `TOOL_SCHEMAS` constant with registry's `schemas`
3. Replace `executeTool(call.name, call.args)` with `registry.execute(call.name, call.args)`
4. Call `registry.close()` before returning

Key changes to `agentLoop()`:

```typescript
// Before the while loop:
const { buildToolRegistry } = await import('../mcp/registry.js');
const registry = await buildToolRegistry(config);

// In the API call, replace TOOL_SCHEMAS:
tools: registry.schemas as Parameters<typeof client.chat.completions.create>[0]['tools'],

// In tool execution, replace executeTool:
const result = await registry.execute(call.name, call.args);

// Before returning, close MCP connections:
await registry.close();
```

Also update the `resolvePermission` call — MCP tools should default to 'ask' permission:

```typescript
// MCP tools default to 'ask' permission
const permission = resolvePermission(call.name, config);
```

**Step 4: Run tests to verify they pass**

Run: `npm test -- tests/core/agent.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/agent.ts tests/core/agent.test.ts
git commit -m "feat(mcp): hook tool registry into agent loop

Agent loop now uses buildToolRegistry() for dynamic tool list that
includes both built-in and MCP tools. MCP connections are closed when
the loop completes."
```

---

### Task 5: Rewrite MCP command from stub

**Files:**
- Rewrite: `src/commands/mcp.ts` (full implementation)
- Modify: `src/index.ts` (add subcommands to mcp command)
- Create: `tests/commands/mcp.test.ts`

**Step 1: Write the failing tests**

Create `tests/commands/mcp.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock config
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
    get: vi.fn().mockReturnValue({}),
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

import { mcpList, mcpAdd, mcpRemove, mcpTest } from '../../src/commands/mcp.js';

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

  it('add saves a new stdio server to config', async () => {
    const { saveConfig } = await import('../../src/core/config.js');
    await mcpAdd('myserver', 'npx -y @mcp/my-server', {});
    expect(saveConfig).toHaveBeenCalled();
  });

  it('remove deletes a server from config', async () => {
    const store = (await import('../../src/core/config.js')).getConfigStore;
    await mcpRemove('github');
    expect(store).toHaveBeenCalled();
  });

  it('test connects and disconnects from a server', async () => {
    const { connectMcpServer } = await import('../../src/mcp/client.js');
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    await mcpTest('github');
    expect(connectMcpServer).toHaveBeenCalled();
    log.mockRestore();
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- tests/commands/mcp.test.ts`
Expected: FAIL — `mcpList`, `mcpAdd`, etc. don't exist

**Step 3: Implement the MCP command**

Rewrite `src/commands/mcp.ts`:

```typescript
import chalk from 'chalk';
import { loadConfig, saveConfig, getConfigStore } from '../core/config.js';
import { connectMcpServer } from '../mcp/client.js';

interface McpListOptions {
  json?: boolean;
}

export async function mcpList(opts: McpListOptions): Promise<void> {
  const config = await loadConfig();
  const servers = config.mcp.servers;
  const entries = Object.entries(servers);

  if (entries.length === 0) {
    console.log(chalk.dim('No MCP servers configured.'));
    console.log(chalk.dim('\nAdd one with: opta mcp add <name> <command>'));
    return;
  }

  if (opts.json) {
    console.log(JSON.stringify(servers, null, 2));
    return;
  }

  console.log(chalk.bold(`\n${entries.length} MCP server(s):\n`));
  for (const [name, cfg] of entries) {
    const transport = cfg.transport === 'stdio'
      ? `${cfg.command} ${cfg.args.join(' ')}`.trim()
      : cfg.url;
    console.log(`  ${chalk.cyan(name)}  ${chalk.dim(cfg.transport)}  ${transport}`);
  }
  console.log();
}

export async function mcpAdd(
  name: string,
  command: string,
  opts: { env?: string }
): Promise<void> {
  const parts = command.split(/\s+/);
  const cmd = parts[0]!;
  const args = parts.slice(1);

  const env: Record<string, string> = {};
  if (opts.env) {
    for (const pair of opts.env.split(',')) {
      const [k, v] = pair.split('=');
      if (k && v) env[k] = v;
    }
  }

  await saveConfig({
    mcp: {
      servers: {
        [name]: { transport: 'stdio', command: cmd, args, env },
      },
    },
  });

  console.log(chalk.green('✓') + ` Added MCP server: ${name}`);
}

export async function mcpRemove(name: string): Promise<void> {
  const store = await getConfigStore();
  const servers = (store.get('mcp.servers') as Record<string, unknown>) ?? {};

  if (!(name in servers)) {
    console.log(chalk.yellow(`MCP server "${name}" not found in config.`));
    return;
  }

  delete servers[name];
  store.set('mcp.servers', servers);
  console.log(chalk.green('✓') + ` Removed MCP server: ${name}`);
}

export async function mcpTest(name: string): Promise<void> {
  const config = await loadConfig();
  const serverConfig = config.mcp.servers[name];

  if (!serverConfig) {
    console.log(chalk.red('✗') + ` MCP server "${name}" not found in config.`);
    return;
  }

  console.log(chalk.dim(`Connecting to ${name}...`));
  try {
    const conn = await connectMcpServer(name, serverConfig);
    console.log(chalk.green('✓') + ` Connected to ${name}`);
    console.log(chalk.dim(`  ${conn.tools.length} tools available:`));
    for (const tool of conn.tools) {
      console.log(`    ${chalk.cyan(tool.name)} — ${tool.description}`);
    }
    await conn.close();
    console.log(chalk.green('✓') + ' Connection closed cleanly');
  } catch (err) {
    console.log(chalk.red('✗') + ` Failed: ${err instanceof Error ? err.message : err}`);
  }
}
```

**Step 4: Update `src/index.ts` to register MCP subcommands**

Replace the current MCP command registration with:

```typescript
const mcpCmd = program
  .command('mcp')
  .description('Manage MCP (Model Context Protocol) servers');

mcpCmd
  .command('list')
  .description('Show configured MCP servers')
  .option('--json', 'machine-readable output')
  .action(async (opts) => {
    const { mcpList } = await import('./commands/mcp.js');
    await mcpList(opts);
  });

mcpCmd
  .command('add <name> <command>')
  .description('Add a stdio MCP server')
  .option('--env <pairs>', 'environment variables (KEY=VAL,KEY2=VAL2)')
  .action(async (name: string, command: string, opts) => {
    const { mcpAdd } = await import('./commands/mcp.js');
    await mcpAdd(name, command, opts);
  });

mcpCmd
  .command('remove <name>')
  .description('Remove an MCP server')
  .action(async (name: string) => {
    const { mcpRemove } = await import('./commands/mcp.js');
    await mcpRemove(name);
  });

mcpCmd
  .command('test <name>')
  .description('Test connection to an MCP server')
  .action(async (name: string) => {
    const { mcpTest } = await import('./commands/mcp.js');
    await mcpTest(name);
  });
```

**Step 5: Run tests to verify they pass**

Run: `npm test -- tests/commands/mcp.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add src/commands/mcp.ts src/index.ts tests/commands/mcp.test.ts
git commit -m "feat(mcp): rewrite mcp command with list/add/remove/test subcommands

Replace V2 stub with full implementation. List shows configured servers,
add saves stdio server to config, remove deletes it, test connects and
shows available tools."
```

---

### Task 6: Update CLI tests for MCP subcommands

**Files:**
- Modify: `tests/cli.test.ts` (add MCP subcommand tests)

**Step 1: Add CLI integration tests**

Add to `tests/cli.test.ts`:

```typescript
describe('opta mcp', () => {
  it('mcp list runs without error', async () => {
    const result = await execa('node', ['dist/index.js', 'mcp', 'list'], { reject: false });
    expect(result.exitCode).toBe(0);
  });

  it('mcp shows help with subcommands', async () => {
    const result = await execa('node', ['dist/index.js', 'mcp', '--help'], { reject: false });
    expect(result.stdout).toContain('list');
    expect(result.stdout).toContain('add');
    expect(result.stdout).toContain('remove');
    expect(result.stdout).toContain('test');
  });
});
```

**Step 2: Run tests to verify they pass**

Run: `npm run build && npm test -- tests/cli.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add tests/cli.test.ts
git commit -m "test(mcp): add CLI integration tests for mcp subcommands"
```

---

### Task 7: Final validation and version bump

**Files:**
- Modify: `package.json` (bump version to `0.2.0-alpha.3`)

**Step 1: Run full test suite**

```bash
npm run typecheck
npm test
```

Expected: All tests pass, no type errors.

**Step 2: Build and verify CLI**

```bash
npm run build
node dist/index.js --version
node dist/index.js mcp --help
node dist/index.js mcp list
```

**Step 3: Bump version**

In `package.json`, change `"version": "0.2.0-alpha.2"` to `"version": "0.2.0-alpha.3"`.

**Step 4: Commit**

```bash
git add package.json
git commit -m "chore: bump version to 0.2.0-alpha.3 (Phase 3 complete)

V2 Phase 3 adds MCP integration:
- @modelcontextprotocol/sdk client wrapper (stdio + HTTP)
- Tool registry merging built-in + MCP tools
- opta mcp list/add/remove/test subcommands
- Graceful degradation on MCP server failure
- Tool count warning for local LLMs"
```

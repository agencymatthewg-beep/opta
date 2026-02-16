import { TOOL_SCHEMAS, SUB_AGENT_TOOL_SCHEMAS, executeTool } from '../core/tools.js';
import { connectMcpServer, type McpConnection } from './client.js';
import { debug } from '../core/debug.js';
import type { OptaConfig } from '../core/config.js';
import { LspManager } from '../lsp/manager.js';
import { resolve } from 'node:path';

interface ToolSchema {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ToolRegistry {
  schemas: ToolSchema[];
  execute: (name: string, argsJson: string) => Promise<string>;
  close: () => Promise<void>;
}

export async function buildToolRegistry(
  config: OptaConfig,
  mode: string = 'normal'
): Promise<ToolRegistry> {
  const connections: McpConnection[] = [];
  const mcpSchemas: ToolSchema[] = [];
  const mcpRoutes = new Map<string, McpConnection>();

  const serverEntries = Object.entries(config.mcp?.servers ?? {});

  for (const [name, serverConfig] of serverEntries) {
    try {
      const conn = await connectMcpServer(name, serverConfig);
      connections.push(conn);

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

  // Conditionally include sub-agent tools
  const subAgentEnabled = config.subAgent?.enabled ?? true;
  const subAgentSchemas = subAgentEnabled
    ? (SUB_AGENT_TOOL_SCHEMAS as ToolSchema[])
    : [];

  // Conditionally include LSP tools
  const lspEnabled = config.lsp?.enabled ?? true;
  const LSP_TOOL_NAMES = new Set([
    'lsp_definition', 'lsp_references', 'lsp_hover',
    'lsp_symbols', 'lsp_document_symbols', 'lsp_rename',
  ]);

  // Initialize LspManager if LSP is enabled
  let lspManager: LspManager | null = null;
  if (lspEnabled) {
    lspManager = new LspManager({
      cwd: process.cwd(),
      config: {
        enabled: true,
        servers: config.lsp?.servers ?? {},
        timeout: config.lsp?.timeout ?? 10000,
      },
    });
  }

  // Filter out LSP tools from base schemas if disabled
  const baseSchemas = lspEnabled
    ? (TOOL_SCHEMAS as ToolSchema[])
    : (TOOL_SCHEMAS as ToolSchema[]).filter(s => !LSP_TOOL_NAMES.has(s.function.name));

  const totalTools = baseSchemas.length + mcpSchemas.length + subAgentSchemas.length;
  if (totalTools > 20) {
    console.warn(
      `  ${totalTools} tools configured — local models may struggle. Consider reducing MCP servers.`
    );
  }

  const allSchemas = [...baseSchemas, ...subAgentSchemas, ...mcpSchemas];

  const WRITE_TOOL_NAMES = new Set([
    'edit_file', 'write_file', 'multi_edit', 'delete_file',
    'run_command', 'save_memory', 'bg_start', 'bg_kill',
    'spawn_agent', 'delegate_task', 'lsp_rename',
  ]);

  const filteredSchemas = mode === 'plan'
    ? allSchemas.filter(s => !WRITE_TOOL_NAMES.has(s.function.name))
    : allSchemas;

  // Build a self-reference for sub-agent tool execution
  const registryRef: { current: ToolRegistry | null } = { current: null };

  const registry: ToolRegistry = {
    schemas: filteredSchemas,
    async execute(name: string, argsJson: string): Promise<string> {
      const mcpConn = mcpRoutes.get(name);
      if (mcpConn) {
        let args: Record<string, unknown>;
        try {
          args = JSON.parse(argsJson);
        } catch {
          return 'Error: Invalid JSON arguments';
        }
        // Strip namespace: mcp__server__toolname -> toolname
        const originalName = name.split('__').slice(2).join('__');
        return mcpConn.call(originalName, args);
      }

      // Route sub-agent tools
      if (name === 'spawn_agent' || name === 'delegate_task') {
        return execSubAgentTool(name, argsJson, config, registryRef.current!);
      }

      // Route LSP tools through LspManager
      if (lspManager && LSP_TOOL_NAMES.has(name)) {
        let args: Record<string, unknown>;
        try {
          args = JSON.parse(argsJson);
        } catch {
          return 'Error: Invalid JSON arguments';
        }
        return lspManager.execute(name, args);
      }

      // Execute standard tools, then notify LSP of file changes
      const result = await executeTool(name, argsJson);

      // Notify LSP of file changes after write operations
      if (lspManager && (name === 'edit_file' || name === 'write_file' || name === 'multi_edit')) {
        try {
          const args = JSON.parse(argsJson);
          if (args.path) {
            await lspManager.notifyFileChanged(resolve(process.cwd(), String(args.path)));
          }
        } catch {
          // Best effort - don't fail the tool execution
        }
      }

      return result;
    },
    async close() {
      // Shutdown LSP servers
      if (lspManager) {
        await lspManager.shutdownAll();
      }

      for (const conn of connections) {
        try {
          await conn.close();
        } catch {
          // Best-effort cleanup
        }
      }
    },
  };

  registryRef.current = registry;
  return registry;
}

// --- Sub-Agent Tool Execution ---

async function execSubAgentTool(
  name: string,
  argsJson: string,
  config: OptaConfig,
  registry: ToolRegistry
): Promise<string> {
  let args: Record<string, unknown>;
  try {
    args = JSON.parse(argsJson);
  } catch {
    return 'Error: Invalid JSON arguments for sub-agent tool';
  }

  // Lazy-load sub-agent modules
  const { spawnSubAgent, formatSubAgentResult } = await import('../core/subagent.js');
  const { nanoid } = await import('nanoid');

  // Create an OpenAI client for the sub-agent (shares config)
  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({
    baseURL: `http://${config.connection.host}:${config.connection.port}/v1`,
    apiKey: 'opta-lmx',
  });

  if (name === 'spawn_agent') {
    const task = String(args['task'] ?? '');
    if (!task) return 'Error: task is required for spawn_agent';

    const result = await spawnSubAgent(
      {
        id: nanoid(8),
        description: task,
        scope: args['scope'] ? String(args['scope']) : undefined,
        budget: args['max_tool_calls']
          ? { maxToolCalls: Number(args['max_tool_calls']) }
          : undefined,
        mode: args['mode'] ? String(args['mode']) : undefined,
      },
      config,
      client,
      registry,
    );

    return formatSubAgentResult(result);
  }

  if (name === 'delegate_task') {
    const { executeDelegation } = await import('../core/orchestrator.js');

    const plan = String(args['plan'] ?? '');
    if (!plan) return 'Error: plan is required for delegate_task';

    const subtasks = (args['subtasks'] as Array<{ task: string; scope?: string; depends_on?: number }>) ?? [];
    if (!Array.isArray(subtasks) || subtasks.length === 0) {
      return 'Error: subtasks array is required for delegate_task';
    }

    try {
      return await executeDelegation(
        { plan, subtasks },
        config,
        client,
        registry,
        (task, cfg, cli, reg) => spawnSubAgent(task, cfg, cli, reg),
      );
    } catch (err) {
      return `Error: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  return `Error: Unknown sub-agent tool "${name}"`;
}

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

export interface ToolRegistry {
  schemas: ToolSchema[];
  execute: (name: string, argsJson: string) => Promise<string>;
  close: () => Promise<void>;
}

export async function buildToolRegistry(config: OptaConfig): Promise<ToolRegistry> {
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

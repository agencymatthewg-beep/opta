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

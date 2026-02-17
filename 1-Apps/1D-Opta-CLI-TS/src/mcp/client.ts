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

/** Check if an error is likely a connection/transport failure. */
function isConnectionError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes('connection') ||
    msg.includes('transport') ||
    msg.includes('closed') ||
    msg.includes('disconnected') ||
    msg.includes('econnrefused') ||
    msg.includes('econnreset') ||
    msg.includes('epipe') ||
    msg.includes('ended')
  );
}

/** Extract content from MCP tool result, supporting text, image, and resource types. */
function extractContent(result: { content?: unknown; isError?: boolean }): string {
  const contentArray = result.content as Array<{
    type: string;
    text?: string;
    data?: string;
    mimeType?: string;
    resource?: { uri?: string; text?: string };
  }> | undefined;

  if (!contentArray || !Array.isArray(contentArray)) {
    return '(empty response)';
  }

  const prefix = result.isError ? '[Error] ' : '';

  const parts = contentArray
    .map(c => {
      if (c.type === 'text' && c.text) return c.text;
      if (c.type === 'image') {
        return `[Image: ${c.mimeType ?? 'unknown'}, ${(c.data?.length ?? 0)} bytes base64]`;
      }
      if (c.type === 'resource') {
        const uri = c.resource?.uri ?? 'unknown';
        const text = c.resource?.text;
        return text ? `[Resource: ${uri}]\n${text}` : `[Resource: ${uri}]`;
      }
      return '';
    })
    .filter(Boolean);

  return prefix + (parts.join('\n') || '(empty response)');
}

export async function connectMcpServer(
  name: string,
  config: McpServerConfig
): Promise<McpConnection> {
  const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
  let client = new Client({ name: `opta-${name}`, version: '1.0.0' });

  async function connect(c: typeof client): Promise<void> {
    if (config.transport === 'stdio') {
      const { StdioClientTransport } = await import(
        '@modelcontextprotocol/sdk/client/stdio.js'
      );
      const transport = new StdioClientTransport({
        command: config.command,
        args: config.args,
        env: { ...process.env, ...config.env } as Record<string, string>,
      });
      await c.connect(transport);
    } else {
      const { StreamableHTTPClientTransport } = await import(
        '@modelcontextprotocol/sdk/client/streamableHttp.js'
      );
      const transport = new StreamableHTTPClientTransport(new URL(config.url));
      await c.connect(transport);
    }
  }

  await connect(client);

  const { tools: rawTools } = await client.listTools();
  const tools: McpTool[] = rawTools.map((t) => ({
    name: t.name,
    description: t.description ?? '',
    inputSchema: t.inputSchema as Record<string, unknown>,
  }));

  debug(`MCP server "${name}" connected with ${tools.length} tools`);

  /** Attempt to reconnect by creating a fresh client. */
  async function reconnect(): Promise<void> {
    debug(`MCP "${name}" reconnecting...`);
    try {
      await client.close();
    } catch {
      // Best-effort close of old client
    }
    const { Client: NewClient } = await import('@modelcontextprotocol/sdk/client/index.js');
    client = new NewClient({ name: `opta-${name}`, version: '1.0.0' });
    await connect(client);
    debug(`MCP "${name}" reconnected`);
  }

  return {
    name,
    tools,
    async call(toolName, args) {
      // Try the call; on connection error, reconnect once and retry
      try {
        const result = await client.callTool({ name: toolName, arguments: args }) as { content?: unknown; isError?: boolean };
        return extractContent(result);
      } catch (err) {
        if (isConnectionError(err)) {
          try {
            await reconnect();
            const result = await client.callTool({ name: toolName, arguments: args }) as { content?: unknown; isError?: boolean };
            return extractContent(result);
          } catch (retryErr) {
            const msg = retryErr instanceof Error ? retryErr.message : String(retryErr);
            return `Error: MCP tool "${toolName}" failed after reconnect: ${msg}`;
          }
        }
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

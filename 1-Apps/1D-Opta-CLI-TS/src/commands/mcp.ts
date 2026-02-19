import chalk from 'chalk';
import { loadConfig, saveConfig, getConfigStore } from '../core/config.js';
import { connectMcpServer } from '../mcp/client.js';
import { errorMessage } from '../utils/errors.js';

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
    const transport =
      cfg.transport === 'stdio'
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

  console.log(chalk.green('\u2713') + ` Added MCP server: ${name}`);
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
  console.log(chalk.green('\u2713') + ` Removed MCP server: ${name}`);
}

export async function mcpTest(name: string): Promise<void> {
  const config = await loadConfig();
  const serverConfig = config.mcp.servers[name];

  if (!serverConfig) {
    console.log(chalk.red('\u2717') + ` MCP server "${name}" not found in config.`);
    return;
  }

  console.log(chalk.dim(`Connecting to ${name}...`));
  try {
    const conn = await connectMcpServer(name, serverConfig);
    console.log(chalk.green('\u2713') + ` Connected to ${name}`);
    console.log(chalk.dim(`  ${conn.tools.length} tools available:`));
    for (const tool of conn.tools) {
      console.log(`    ${chalk.cyan(tool.name)} — ${tool.description}`);
    }
    await conn.close();
    console.log(chalk.green('\u2713') + ' Connection closed cleanly');
  } catch (err) {
    console.log(chalk.red('\u2717') + ` Failed: ${errorMessage(err)}`);
  }
}

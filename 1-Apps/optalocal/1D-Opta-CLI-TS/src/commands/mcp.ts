import chalk from 'chalk';
import { loadConfig, saveConfig, getConfigStore } from '../core/config.js';
import { connectMcpServer } from '../mcp/client.js';
import { errorMessage } from '../utils/errors.js';
import { createPlaywrightMcpServerConfig } from '../browser/mcp-bootstrap.js';
import type { BrowserMode } from '../browser/types.js';

interface McpListOptions {
  json?: boolean;
}

interface McpAddPlaywrightOptions {
  name?: string;
  mode?: BrowserMode;
  command?: string;
  packageName?: string;
  allowedHosts?: string[];
  blockedOrigins?: string[];
  env?: string;
}

interface McpHealthOptions {
  json?: boolean;
  watch?: number;
  probeStdio?: boolean;
  timeoutMs?: number;
}

const PLAYWRIGHT_MCP_SERVER_KEY = 'playwright';

function parseEnvPairs(raw?: string): Record<string, string> {
  const env: Record<string, string> = {};
  if (!raw) return env;

  for (const pair of raw.split(',')) {
    const idx = pair.indexOf('=');
    if (idx <= 0) continue;

    const key = pair.slice(0, idx).trim();
    const value = pair.slice(idx + 1).trim();
    if (!key || !value) continue;

    env[key] = value;
  }

  return env;
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
      cfg.transport === 'stdio' ? `${cfg.command} ${cfg.args.join(' ')}`.trim() : cfg.url;
    console.log(`  ${chalk.cyan(name)}  ${chalk.dim(cfg.transport)}  ${transport}`);
  }
  console.log();
}

export async function mcpAdd(name: string, command: string, opts: { env?: string }): Promise<void> {
  const parts = command.split(/\s+/);
  const cmd = parts[0]!;
  const args = parts.slice(1);

  const env = parseEnvPairs(opts.env);

  await saveConfig({
    mcp: {
      servers: {
        [name]: { transport: 'stdio', command: cmd, args, env },
      },
    },
  });

  console.log(chalk.green('\u2713') + ` Added MCP server: ${name}`);
}

export async function mcpAddPlaywright(opts: McpAddPlaywrightOptions = {}): Promise<void> {
  const name = opts.name?.trim() || PLAYWRIGHT_MCP_SERVER_KEY;
  const env = parseEnvPairs(opts.env);
  const serverConfig = await createPlaywrightMcpServerConfig({
    command: opts.command,
    packageName: opts.packageName,
    mode: opts.mode,
    allowedHosts: opts.allowedHosts,
    blockedOrigins: opts.blockedOrigins,
    env,
  });

  await saveConfig({
    mcp: {
      servers: {
        [name]: serverConfig,
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

  Reflect.deleteProperty(servers, name);
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

type McpHealthStatus = 'healthy' | 'down' | 'skipped';

interface McpHealthServerResult {
  name: string;
  transport: string;
  status: McpHealthStatus;
  tools: number;
  latencyMs?: number;
  error?: string;
}

interface McpHealthSnapshot {
  generatedAt: string;
  summary: {
    total: number;
    healthy: number;
    down: number;
    skipped: number;
  };
  servers: McpHealthServerResult[];
}

async function probeServer(
  name: string,
  serverConfig: {
    transport: string;
    command?: string;
    url?: string;
    args?: string[];
    env?: Record<string, string>;
  },
  timeoutMs: number
): Promise<McpHealthServerResult> {
  const startedAt = Date.now();
  const connectPromise = connectMcpServer(
    name,
    serverConfig as Parameters<typeof connectMcpServer>[1]
  );
  let timedOut = false;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        timedOut = true;
        reject(new Error(`timeout after ${timeoutMs}ms`));
      }, timeoutMs);
    });
    const conn = await Promise.race([connectPromise, timeoutPromise]);
    const latencyMs = Date.now() - startedAt;
    const tools = conn.tools.length;
    await conn.close();
    return {
      name,
      transport: serverConfig.transport,
      status: 'healthy',
      tools,
      latencyMs,
    };
  } catch (err) {
    if (timedOut) {
      // Best effort: if connection resolves after timeout, close it.
      void connectPromise
        .then(async (conn) => {
          await conn.close();
        })
        .catch(() => {});
    }
    return {
      name,
      transport: serverConfig.transport,
      status: 'down',
      tools: 0,
      error: errorMessage(err),
    };
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

async function buildHealthSnapshot(
  opts: Pick<McpHealthOptions, 'probeStdio' | 'timeoutMs'>
): Promise<McpHealthSnapshot> {
  const config = await loadConfig();
  const servers = config.mcp?.servers ?? {};
  const entries = Object.entries(servers);

  const timeoutMs = Math.max(500, opts.timeoutMs ?? 5000);
  const probeStdio = opts.probeStdio === true;

  const probes = entries.map(async ([name, serverConfig]) => {
    if (serverConfig.transport === 'stdio' && !probeStdio) {
      return {
        name,
        transport: serverConfig.transport,
        status: 'skipped' as const,
        tools: 0,
        error: 'stdio probe disabled (use --probe-stdio)',
      };
    }
    return probeServer(name, serverConfig, timeoutMs);
  });

  const serversResult = await Promise.all(probes);

  const summary = {
    total: serversResult.length,
    healthy: serversResult.filter((r) => r.status === 'healthy').length,
    down: serversResult.filter((r) => r.status === 'down').length,
    skipped: serversResult.filter((r) => r.status === 'skipped').length,
  };

  return {
    generatedAt: new Date().toISOString(),
    summary,
    servers: serversResult,
  };
}

function formatServerLine(server: McpHealthServerResult): string {
  const statusColor =
    server.status === 'healthy' ? chalk.green('healthy') :
    server.status === 'down' ? chalk.red('down') :
    chalk.yellow('skipped');

  const latency = server.latencyMs !== undefined ? `${server.latencyMs}ms` : '-';
  const tools = `${server.tools} tool${server.tools === 1 ? '' : 's'}`;
  const error = server.error ? ` — ${server.error}` : '';
  return `  ${chalk.cyan(server.name)}  ${chalk.dim(server.transport)}  ${statusColor}  ${latency}  ${tools}${error}`;
}

function printHealthSnapshot(snapshot: McpHealthSnapshot): void {
  console.log(chalk.bold(`\nMCP health @ ${snapshot.generatedAt}\n`));
  if (snapshot.summary.total === 0) {
    console.log(chalk.dim('No MCP servers configured.\n'));
    return;
  }

  for (const server of snapshot.servers) {
    console.log(formatServerLine(server));
  }
  console.log(
    `\nSummary: ${chalk.green(`${snapshot.summary.healthy} healthy`)}, ` +
      `${chalk.red(`${snapshot.summary.down} down`)}, ` +
      `${chalk.yellow(`${snapshot.summary.skipped} skipped`)} ` +
      `(total ${snapshot.summary.total})\n`
  );
}

export async function mcpHealth(opts: McpHealthOptions = {}): Promise<void> {
  const intervalSec = Number(opts.watch ?? 0);
  const watchMode = Number.isFinite(intervalSec) && intervalSec > 0;

  if (!watchMode) {
    const snapshot = await buildHealthSnapshot(opts);
    if (opts.json) {
      console.log(JSON.stringify(snapshot, null, 2));
      return;
    }
    printHealthSnapshot(snapshot);
    return;
  }

  if (opts.json) {
    console.log(
      chalk.yellow('warning: --json with --watch prints newline-delimited JSON snapshots.')
    );
  }

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const snapshot = await buildHealthSnapshot(opts);
    if (opts.json) {
      console.log(JSON.stringify(snapshot));
    } else {
      console.clear();
      printHealthSnapshot(snapshot);
      console.log(chalk.dim(`Watching every ${intervalSec}s (Ctrl+C to stop)\n`));
    }
    await new Promise((resolve) => setTimeout(resolve, Math.round(intervalSec * 1000)));
  }
}

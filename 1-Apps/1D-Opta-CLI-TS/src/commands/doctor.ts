import chalk from 'chalk';
import { readdir, stat, access } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { loadConfig } from '../core/config.js';
import { VERSION } from '../core/version.js';
import { debug } from '../core/debug.js';
import { errorMessage } from '../utils/errors.js';

// --- Types ---

export interface DoctorOptions {
  format?: string;
}

export interface CheckResult {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
  detail?: string;
}

// --- Individual Checks ---

export async function checkNode(): Promise<CheckResult> {
  const version = process.version;
  const major = parseInt(version.slice(1).split('.')[0] ?? '0', 10);

  if (major >= 20) {
    return {
      name: 'Node.js',
      status: 'pass',
      message: `Node.js ${version} (>= 20.0.0 required)`,
    };
  }

  return {
    name: 'Node.js',
    status: 'fail',
    message: `Node.js ${version} is below minimum (>= 20.0.0 required)`,
    detail: 'Upgrade Node.js to 20+ for ESM support and native fetch',
  };
}

export async function checkLmxConnection(
  host: string,
  port: number,
  adminKey?: string
): Promise<CheckResult> {
  const url = `http://${host}:${port}/admin/health`;
  const start = Date.now();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    const latency = Date.now() - start;

    if (!response.ok) {
      return {
        name: 'LMX Connection',
        status: 'fail',
        message: `LMX returned HTTP ${response.status} at ${host}:${port}`,
        detail: 'Check Opta LMX server logs for errors',
      };
    }

    // Try to get model count
    let modelCount = 0;
    try {
      const modelsUrl = `http://${host}:${port}/admin/models`;
      const headers: Record<string, string> = {};
      if (adminKey) headers['X-Admin-Key'] = adminKey;

      const modelsController = new AbortController();
      const modelsTimeout = setTimeout(() => modelsController.abort(), 5000);

      const modelsRes = await fetch(modelsUrl, {
        signal: modelsController.signal,
        headers,
      });
      clearTimeout(modelsTimeout);

      if (modelsRes.ok) {
        const data = (await modelsRes.json()) as { loaded?: unknown[]; count?: number };
        modelCount = data.loaded?.length ?? data.count ?? 0;
      }
    } catch {
      // Models endpoint failed — not critical, just skip count
      debug('doctor: failed to fetch model count from /admin/models');
    }

    const modelSuffix = modelCount > 0 ? `, ${modelCount} model${modelCount !== 1 ? 's' : ''} loaded` : '';

    return {
      name: 'LMX Connection',
      status: 'pass',
      message: `LMX connected at ${host}:${port} (${latency}ms${modelSuffix})`,
    };
  } catch (err) {
    const reason = err instanceof Error && err.name === 'AbortError'
      ? 'timed out after 5s'
      : err instanceof Error
        ? err.message
        : 'unknown error';

    return {
      name: 'LMX Connection',
      status: 'fail',
      message: `LMX unreachable at ${host}:${port} (${reason})`,
      detail: `Run 'opta connect' or check that LMX is running at ${host}:${port}`,
    };
  }
}

export async function checkActiveModel(
  configModel: string,
  host: string,
  port: number,
  adminKey?: string
): Promise<CheckResult> {
  if (!configModel) {
    return {
      name: 'Active Model',
      status: 'warn',
      message: 'No default model configured',
      detail: "Run 'opta models use <model>' to set a default",
    };
  }

  // Verify the model is loaded on LMX
  try {
    const url = `http://${host}:${port}/admin/models`;
    const headers: Record<string, string> = {};
    if (adminKey) headers['X-Admin-Key'] = adminKey;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(url, { signal: controller.signal, headers });
    clearTimeout(timeout);

    if (res.ok) {
      const data = (await res.json()) as { loaded?: Array<{ id?: string }> };
      const loadedIds = (data.loaded ?? []).map((m) => m.id ?? '');
      const modelCount = loadedIds.length;

      if (loadedIds.some((id) => id === configModel || id.includes(configModel))) {
        return {
          name: 'Active Model',
          status: 'pass',
          message: `Model: ${configModel} (${modelCount} model${modelCount !== 1 ? 's' : ''} loaded)`,
        };
      }

      return {
        name: 'Active Model',
        status: 'warn',
        message: `Model "${configModel}" not found in loaded models`,
        detail: `Loaded models: ${loadedIds.join(', ') || 'none'}. Run 'opta models' to see available models.`,
      };
    }
  } catch {
    // LMX unreachable — can't verify, just report what we have
    debug('doctor: could not verify model against LMX');
  }

  return {
    name: 'Active Model',
    status: 'pass',
    message: `Model: ${configModel} (LMX offline, cannot verify)`,
  };
}

export async function checkConfig(): Promise<CheckResult> {
  try {
    const config = await loadConfig();

    // Check for common misconfigurations
    const issues: string[] = [];

    if (!config.connection.host) {
      issues.push('connection.host is empty');
    }
    if (config.connection.port === 0) {
      issues.push('connection.port is 0');
    }

    if (issues.length > 0) {
      return {
        name: 'Config',
        status: 'warn',
        message: `Config has issues: ${issues.join(', ')}`,
        detail: "Run 'opta config list' to review current settings",
      };
    }

    return {
      name: 'Config',
      status: 'pass',
      message: 'Config valid',
    };
  } catch (err) {
    const msg = errorMessage(err);
    return {
      name: 'Config',
      status: 'fail',
      message: `Config validation failed: ${msg}`,
      detail: "Run 'opta config reset' to restore defaults",
    };
  }
}

export async function checkOpis(cwd: string): Promise<CheckResult> {
  const appMdPath = join(cwd, 'APP.md');

  try {
    await access(appMdPath);
  } catch {
    return {
      name: 'OPIS',
      status: 'warn',
      message: 'OPIS not initialized (no APP.md found)',
      detail: "Run 'opta init' to scaffold project intelligence docs",
    };
  }

  // Count available OPIS docs
  const opisFiles = [
    'ARCHITECTURE.md', 'GUARDRAILS.md', 'DECISIONS.md',
    'ECOSYSTEM.md', 'KNOWLEDGE.md', 'WORKFLOWS.md',
    'ROADMAP.md', 'INDEX.md',
  ];

  let docCount = 1; // APP.md counts
  const docsDir = join(cwd, 'docs');

  for (const file of opisFiles) {
    try {
      await access(join(docsDir, file));
      docCount++;
    } catch {
      // File doesn't exist
    }
  }

  return {
    name: 'OPIS',
    status: 'pass',
    message: `OPIS initialized (${docCount} doc${docCount !== 1 ? 's' : ''})`,
  };
}

export async function checkMcpServers(
  servers: Record<string, { transport: string; command?: string; url?: string; args?: string[]; env?: Record<string, string> }>
): Promise<CheckResult> {
  const names = Object.keys(servers);

  if (names.length === 0) {
    return {
      name: 'MCP',
      status: 'pass',
      message: 'No MCP servers configured',
    };
  }

  let connected = 0;
  let totalTools = 0;
  const failed: string[] = [];

  for (const name of names) {
    const serverConfig = servers[name]!;

    try {
      const { connectMcpServer } = await import('../mcp/client.js');

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const conn = await Promise.race([
        connectMcpServer(name, serverConfig as Parameters<typeof connectMcpServer>[1]),
        new Promise<never>((_, reject) => {
          controller.signal.addEventListener('abort', () =>
            reject(new Error('timeout'))
          );
        }),
      ]);

      clearTimeout(timeout);
      totalTools += conn.tools.length;
      connected++;
      await conn.close();
    } catch {
      failed.push(name);
    }
  }

  if (failed.length === 0) {
    return {
      name: 'MCP',
      status: 'pass',
      message: `MCP: ${connected}/${names.length} servers connected (${totalTools} tool${totalTools !== 1 ? 's' : ''})`,
    };
  }

  if (connected > 0) {
    return {
      name: 'MCP',
      status: 'warn',
      message: `MCP: ${connected}/${names.length} servers connected (${failed.join(', ')} failed)`,
      detail: `Failed servers: ${failed.join(', ')}. Check server commands and availability.`,
    };
  }

  return {
    name: 'MCP',
    status: 'fail',
    message: `MCP: 0/${names.length} servers connected`,
    detail: `All MCP servers failed: ${failed.join(', ')}`,
  };
}

export async function checkGit(cwd: string): Promise<CheckResult> {
  try {
    await access(join(cwd, '.git'));
  } catch {
    return {
      name: 'Git',
      status: 'warn',
      message: 'Not a git repository',
      detail: "Run 'git init' to initialize version control",
    };
  }

  // Check for uncommitted changes
  try {
    const { execaCommand } = await import('execa');
    const result = await execaCommand('git status --porcelain', {
      cwd,
      timeout: 5000,
    });

    const lines = result.stdout.split('\n').filter((l) => l.trim().length > 0);
    const changeCount = lines.length;

    // Check for checkpoints directory
    let hasCheckpoints = false;
    try {
      await access(join(cwd, '.opta', 'checkpoints'));
      hasCheckpoints = true;
    } catch {
      // No checkpoints dir
    }

    const checkpointNote = hasCheckpoints ? ', checkpoints enabled' : '';

    if (changeCount === 0) {
      return {
        name: 'Git',
        status: 'pass',
        message: `Git repository (clean${checkpointNote})`,
      };
    }

    if (changeCount > 20) {
      return {
        name: 'Git',
        status: 'warn',
        message: `Git repository (${changeCount} uncommitted changes${checkpointNote})`,
        detail: 'Consider committing or stashing changes',
      };
    }

    return {
      name: 'Git',
      status: 'pass',
      message: `Git repository (${changeCount} change${changeCount !== 1 ? 's' : ''}${checkpointNote})`,
    };
  } catch {
    return {
      name: 'Git',
      status: 'pass',
      message: 'Git repository (could not check status)',
    };
  }
}

export async function checkDiskUsage(): Promise<CheckResult> {
  const sessionsDir = join(homedir(), '.config', 'opta', 'sessions');

  let sessionCount = 0;
  let totalBytes = 0;

  try {
    const files = await readdir(sessionsDir);
    const jsonFiles = files.filter((f) => f.endsWith('.json'));
    sessionCount = jsonFiles.length;

    for (const file of jsonFiles) {
      try {
        const s = await stat(join(sessionsDir, file));
        totalBytes += s.size;
      } catch {
        // Skip unreadable files
      }
    }
  } catch {
    // Sessions dir doesn't exist — that's fine
    return {
      name: 'Sessions',
      status: 'pass',
      message: 'Sessions: 0 (0 B)',
    };
  }

  const sizeStr = formatBytes(totalBytes);

  if (totalBytes > 100 * 1024 * 1024) {
    return {
      name: 'Sessions',
      status: 'warn',
      message: `Sessions: ${sessionCount} (${sizeStr})`,
      detail: "Session storage exceeds 100 MB. Run 'opta sessions' to review and delete old sessions.",
    };
  }

  return {
    name: 'Sessions',
    status: 'pass',
    message: `Sessions: ${sessionCount} (${sizeStr})`,
  };
}

// --- Formatting Helpers ---

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function statusIcon(status: 'pass' | 'warn' | 'fail'): string {
  switch (status) {
    case 'pass': return chalk.green('\u2713');
    case 'warn': return chalk.yellow('\u26A0');
    case 'fail': return chalk.red('\u2717');
  }
}

// --- Main Command ---

export async function runDoctor(options: DoctorOptions): Promise<void> {
  const isJson = options.format === 'json';
  const config = await loadConfig();

  const { host, port, adminKey } = config.connection;
  const cwd = process.cwd();

  // Run all checks
  const results: CheckResult[] = [];

  // 1. Node.js version
  results.push(await checkNode());

  // 2. LMX connection
  results.push(await checkLmxConnection(host, port, adminKey));

  // 3. Active model
  results.push(await checkActiveModel(config.model.default, host, port, adminKey));

  // 4. Config validation
  results.push(await checkConfig());

  // 5. OPIS status
  results.push(await checkOpis(cwd));

  // 6. MCP servers
  results.push(await checkMcpServers(config.mcp.servers as Parameters<typeof checkMcpServers>[0]));

  // 7. Git status
  results.push(await checkGit(cwd));

  // 8. Disk usage
  results.push(await checkDiskUsage());

  // Output
  if (isJson) {
    const passed = results.filter((r) => r.status === 'pass').length;
    const warnings = results.filter((r) => r.status === 'warn').length;
    const failures = results.filter((r) => r.status === 'fail').length;

    console.log(JSON.stringify({
      version: VERSION,
      checks: results,
      summary: { passed, warnings, failures },
    }, null, 2));
    return;
  }

  // Text output
  console.log('');
  console.log(chalk.bold('Opta Doctor'));
  console.log(chalk.dim('\u2500'.repeat(30)));
  console.log('');

  for (const result of results) {
    const icon = statusIcon(result.status);
    console.log(`  ${icon} ${result.message}`);
    if (result.detail && result.status !== 'pass') {
      console.log(`    ${chalk.dim(result.detail)}`);
    }
  }

  const passed = results.filter((r) => r.status === 'pass').length;
  const warnings = results.filter((r) => r.status === 'warn').length;
  const failures = results.filter((r) => r.status === 'fail').length;

  console.log('');

  const parts: string[] = [];
  parts.push(`${passed} check${passed !== 1 ? 's' : ''} passed`);
  if (warnings > 0) parts.push(`${warnings} warning${warnings !== 1 ? 's' : ''}`);
  if (failures > 0) parts.push(`${failures} error${failures !== 1 ? 's' : ''}`);

  const summaryColor = failures > 0 ? chalk.red : warnings > 0 ? chalk.yellow : chalk.green;
  console.log('  ' + summaryColor(parts.join(', ')));
  console.log('');
}

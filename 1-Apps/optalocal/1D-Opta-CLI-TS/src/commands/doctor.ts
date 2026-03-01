import chalk from 'chalk';
import { readdir, stat, access, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { loadConfig } from '../core/config.js';
import { getConfigDir, getSessionsDir, getDaemonDir } from '../platform/paths.js';
import { VERSION } from '../core/version.js';
import { debug } from '../core/debug.js';
import { errorMessage } from '../utils/errors.js';
import { diskHeadroomMbToBytes, readDiskHeadroom } from '../utils/disk.js';
import { colorizeOptaWord } from '../ui/brand.js';

// --- Types ---

export interface DoctorOptions {
  format?: string;
  fix?: boolean;
}

export interface CheckResult {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
  detail?: string;
  fix?: () => Promise<string>;
}

interface LmxDoctorSnapshot {
  reachable: boolean;
  host: string;
  source: 'primary' | 'fallback';
  latencyMs: number;
  loadedModelIds: string[];
  error?: string;
}

const FAST_DOCTOR_REQUEST_OPTS = { timeoutMs: 2_500, maxRetries: 0 } as const;

function buildFailoverHint(fallbackHosts: string[]): string {
  const normalized = fallbackHosts.map((value) => value.trim()).filter((value) => value.length > 0);
  return normalized.length > 0
    ? `Configured fallback hosts: ${normalized.join(', ')}.`
    : "Configure failover hosts: 'opta config set connection.fallbackHosts hostA,hostB'.";
}

export async function checkLmxDiscovery(): Promise<CheckResult> {
  try {
    const { discoverLmxHosts } = await import('../lmx/mdns-discovery.js');
    const discovered = await discoverLmxHosts(2000);
    if (discovered.length === 0) {
      return {
        name: 'LMX Discovery',
        status: 'warn',
        message: 'No LMX servers found on LAN',
        detail: "Ensure Opta-LMX is running and reachable on port 1234. Run 'opta onboard' to configure manually.",
      };
    }
    const hostList = discovered.map((d) => `${d.host}:${d.port} (${d.latencyMs}ms)`).join(', ');
    return {
      name: 'LMX Discovery',
      status: 'pass',
      message: `LAN discovery: ${discovered.length} LMX server${discovered.length !== 1 ? 's' : ''} found — ${hostList}`,
    };
  } catch (err) {
    return {
      name: 'LMX Discovery',
      status: 'warn',
      message: `LMX discovery unavailable (${errorMessage(err)})`,
    };
  }
}

async function collectLmxDoctorSnapshot(
  host: string,
  port: number,
  adminKey?: string,
  fallbackHosts: string[] = []
): Promise<LmxDoctorSnapshot> {
  const start = Date.now();
  try {
    const [{ resolveLmxEndpoint }, { LmxClient }] = await Promise.all([
      import('../lmx/endpoints.js'),
      import('../lmx/client.js'),
    ]);
    const resolved = await resolveLmxEndpoint(
      {
        host,
        port,
        adminKey,
        fallbackHosts,
      },
      {
        timeoutMs: 1_500,
      }
    );
    const lmx = new LmxClient({
      host: resolved.host,
      port,
      adminKey,
      fallbackHosts: [],
      timeoutMs: 2_500,
      maxRetries: 0,
    });
    await lmx.health(FAST_DOCTOR_REQUEST_OPTS);
    const models = await lmx.models(FAST_DOCTOR_REQUEST_OPTS).catch(() => ({ models: [] }));
    return {
      reachable: true,
      host: resolved.host,
      source: resolved.source,
      latencyMs: Date.now() - start,
      loadedModelIds: models.models.map((model) => model.model_id),
    };
  } catch (err) {
    return {
      reachable: false,
      host,
      source: 'primary',
      latencyMs: Date.now() - start,
      loadedModelIds: [],
      error: errorMessage(err),
    };
  }
}

function lmxConnectionResultFromSnapshot(
  snapshot: LmxDoctorSnapshot,
  host: string,
  port: number,
  fallbackHosts: string[] = []
): CheckResult {
  if (snapshot.reachable) {
    const modelCount = snapshot.loadedModelIds.length;
    const modelSuffix =
      modelCount > 0 ? `, ${modelCount} model${modelCount !== 1 ? 's' : ''} loaded` : '';
    const failoverSuffix =
      snapshot.source === 'fallback' ? chalk.dim(` via fallback ${snapshot.host}`) : '';
    return {
      name: 'LMX Connection',
      status: 'pass',
      message: `LMX connected at ${snapshot.host}:${port} (${snapshot.latencyMs}ms${modelSuffix})${failoverSuffix}`,
    };
  }

  const reason = snapshot.error && snapshot.error.length > 0 ? snapshot.error : 'unknown error';
  const failoverHint = buildFailoverHint(fallbackHosts);
  return {
    name: 'LMX Connection',
    status: 'fail',
    message: `LMX unreachable at ${host}:${port} (${reason})`,
    detail: [
      `Check that LMX is running at ${host}:${port}.`,
      "For authenticated inference set 'connection.apiKey' (or OPTA_API_KEY).",
      failoverHint,
      "Run 'opta status' or 'opta config set connection.host <host>' to reconfigure.",
    ].join(' '),
    fix: async () => 'Ensure LMX server is running on Mono512 (192.168.188.11:1234). Cannot auto-start remote server.',
  };
}

function activeModelResultFromSnapshot(
  configModel: string,
  snapshot: LmxDoctorSnapshot
): CheckResult {
  if (!configModel) {
    return {
      name: 'Active Model',
      status: 'warn',
      message: 'No default model configured',
      detail: "Run 'opta models use <model>' to set a default",
    };
  }

  if (!snapshot.reachable) {
    return {
      name: 'Active Model',
      status: 'pass',
      message: `Model: ${configModel} (LMX offline, cannot verify)`,
    };
  }

  const loadedIds = snapshot.loadedModelIds;
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

// --- Individual Checks ---

export function checkNode(): CheckResult {
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
  adminKey?: string,
  fallbackHosts: string[] = []
): Promise<CheckResult> {
  const snapshot = await collectLmxDoctorSnapshot(host, port, adminKey, fallbackHosts);
  return lmxConnectionResultFromSnapshot(snapshot, host, port, fallbackHosts);
}

export async function checkActiveModel(
  configModel: string,
  host: string,
  port: number,
  adminKey?: string,
  fallbackHosts: string[] = []
): Promise<CheckResult> {
  const snapshot = await collectLmxDoctorSnapshot(host, port, adminKey, fallbackHosts);
  if (!snapshot.reachable) {
    debug('doctor: could not verify model against LMX');
  }
  return activeModelResultFromSnapshot(configModel, snapshot);
}

export async function checkConfig(
  preloadedConfig?: Awaited<ReturnType<typeof loadConfig>>
): Promise<CheckResult> {
  try {
    const config = preloadedConfig ?? (await loadConfig());

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
    'ARCHITECTURE.md',
    'GUARDRAILS.md',
    'DECISIONS.md',
    'ECOSYSTEM.md',
    'KNOWLEDGE.md',
    'WORKFLOWS.md',
    'ROADMAP.md',
    'INDEX.md',
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
  servers: Record<
    string,
    {
      transport: string;
      command?: string;
      url?: string;
      args?: string[];
      env?: Record<string, string>;
    }
  >
): Promise<CheckResult> {
  const names = Object.keys(servers);

  if (names.length === 0) {
    return {
      name: 'MCP',
      status: 'pass',
      message: 'No MCP servers configured',
    };
  }

  const probeStdioServers = process.env['OPTA_DOCTOR_PROBE_STDIO_MCP'] === '1';
  const probeTargets = names.filter((name) => {
    const server = servers[name]!;
    if (server.transport === 'http') return true;
    if (server.transport === 'stdio') return probeStdioServers;
    return false;
  });
  const skippedStdio = names.filter((name) => servers[name]!.transport === 'stdio' && !probeStdioServers);

  const { connectMcpServer } = await import('../mcp/client.js');
  const settled = await Promise.all(
    probeTargets.map(async (name) => {
      const serverConfig = servers[name]!;
      const connectPromise = connectMcpServer(
        name,
        serverConfig as Parameters<typeof connectMcpServer>[1]
      );
      let timedOut = false;
      let timeoutId: ReturnType<typeof setTimeout> | undefined;

      try {
        const timeout = new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => {
            timedOut = true;
            reject(new Error('timeout'));
          }, 5000);
        });
        const conn = await Promise.race([connectPromise, timeout]);
        const toolCount = conn.tools.length;
        await conn.close();
        return { name, ok: true as const, toolCount };
      } catch {
        if (timedOut) {
          // Best-effort late cleanup if the connect promise resolves after timeout.
          void connectPromise
            .then(async (conn) => {
              await conn.close();
            })
            .catch(() => {});
        }
        return { name, ok: false as const, toolCount: 0 };
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
      }
    })
  );

  const connected = settled.filter((entry) => entry.ok).length;
  const totalTools = settled.reduce((sum, entry) => sum + entry.toolCount, 0);
  const failed = settled.filter((entry) => !entry.ok).map((entry) => entry.name);

  if (failed.length === 0 && skippedStdio.length === 0) {
    return {
      name: 'MCP',
      status: 'pass',
      message: `MCP: ${connected}/${probeTargets.length} servers connected (${totalTools} tool${totalTools !== 1 ? 's' : ''})`,
    };
  }

  if (failed.length === 0 && skippedStdio.length > 0) {
    return {
      name: 'MCP',
      status: 'warn',
      message: `MCP: ${connected}/${probeTargets.length} probed (${skippedStdio.length} stdio server${skippedStdio.length !== 1 ? 's' : ''} skipped)`,
      detail:
        "Deep stdio MCP probing is skipped in doctor mode to avoid hanging transports. Set OPTA_DOCTOR_PROBE_STDIO_MCP=1 or run 'opta mcp test <name>'.",
    };
  }

  if (connected > 0 || skippedStdio.length > 0) {
    return {
      name: 'MCP',
      status: 'warn',
      message: `MCP: ${connected}/${probeTargets.length} probed (${failed.length} failed, ${skippedStdio.length} skipped)`,
      detail: [
        failed.length > 0 ? `Failed servers: ${failed.join(', ')}.` : '',
        skippedStdio.length > 0
          ? "Skipped stdio servers require manual probe: run 'opta mcp test <name>' or set OPTA_DOCTOR_PROBE_STDIO_MCP=1."
          : '',
      ]
        .filter(Boolean)
        .join(' '),
    };
  }

  return {
    name: 'MCP',
    status: 'fail',
    message: `MCP: 0/${probeTargets.length} probed servers connected`,
    detail: `All probed MCP servers failed: ${failed.join(', ')}`,
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

export async function checkAccount(): Promise<CheckResult> {
  // Step 1: check whether Supabase is configured at all
  const { resolveSupabaseAuthConfig } = await import('../accounts/supabase.js');
  const config = resolveSupabaseAuthConfig();

  if (!config) {
    return {
      name: 'Account',
      status: 'warn',
      message: 'OPTA_SUPABASE_URL not configured (account features disabled)',
      detail:
        'Set OPTA_SUPABASE_URL and OPTA_SUPABASE_ANON_KEY environment variables to enable account features.',
    };
  }

  // Step 2: load persisted account state
  const { loadAccountState } = await import('../accounts/storage.js');
  const state = await loadAccountState();

  if (!state) {
    return {
      name: 'Account',
      status: 'pass',
      message: 'Not logged in (run opta account login)',
    };
  }

  // Step 3: check session / token validity
  if (!state.session) {
    return {
      name: 'Account',
      status: 'warn',
      message: 'Account state found but no active session',
      detail: "The saved token is missing or expired. Run 'opta account login' to re-authenticate.",
    };
  }

  const expiresAt = state.session.expires_at;
  const identifier = state.user?.email ?? state.user?.phone ?? 'unknown user';

  if (expiresAt !== undefined) {
    const nowSecs = Date.now() / 1000;
    const diffSecs = expiresAt - nowSecs;

    if (diffSecs <= 0) {
      return {
        name: 'Account',
        status: 'warn',
        message: `Token expired (run opta account login)`,
        detail: `Last authenticated as ${identifier} on project ${state.project}.`,
      };
    }

    const hours = Math.floor(diffSecs / 3600);
    const mins = Math.ceil((diffSecs % 3600) / 60);
    const expiresSuffix = hours > 0 ? `expires in ${hours}h` : `expires in ${mins}m`;

    return {
      name: 'Account',
      status: 'pass',
      message: `Logged in as ${identifier} (${expiresSuffix})`,
    };
  }

  // No expires_at — treat as valid but indeterminate expiry
  return {
    name: 'Account',
    status: 'pass',
    message: `Logged in as ${identifier}`,
  };
}

export async function checkDiskUsage(): Promise<CheckResult> {
  const sessionsDir = getSessionsDir();

  let sessionCount = 0;
  let totalBytes = 0;

  try {
    const files = await readdir(sessionsDir);
    const jsonFiles = files.filter((f) => f.endsWith('.json'));
    sessionCount = jsonFiles.length;

    const stats = await Promise.all(
      jsonFiles.map(async (file) => {
        try {
          const s = await stat(join(sessionsDir, file));
          return s.size;
        } catch {
          return 0;
        }
      })
    );
    totalBytes = stats.reduce((sum, size) => sum + size, 0);
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
      detail:
        "Session storage exceeds 100 MB. Run 'opta sessions' to review and delete old sessions.",
    };
  }

  return {
    name: 'Sessions',
    status: 'pass',
    message: `Sessions: ${sessionCount} (${sizeStr})`,
  };
}

export async function checkDiskHeadroom(
  minFreeBytes = diskHeadroomMbToBytes()
): Promise<CheckResult> {
  try {
    const disk = await readDiskHeadroom(getConfigDir());
    const available = formatBytes(disk.availableBytes);
    const required = formatBytes(minFreeBytes);

    if (disk.availableBytes < minFreeBytes) {
      return {
        name: 'Disk Headroom',
        status: 'fail',
        message: `Disk headroom below required minimum (${available} available, ${required} required)`,
        detail: 'Free disk space on the filesystem backing ~/.config/opta and rerun opta doctor.',
        fix: async () => 'Disk space is low — free space manually. Cannot auto-fix.',
      };
    }

    return {
      name: 'Disk Headroom',
      status: 'pass',
      message: `Disk headroom: ${available} available`,
    };
  } catch (err) {
    return {
      name: 'Disk Headroom',
      status: 'warn',
      message: `Disk headroom check unavailable (${errorMessage(err)})`,
    };
  }
}

export async function checkDaemon(): Promise<CheckResult> {
  const { isDaemonRunning, readDaemonState } = await import('../daemon/lifecycle.js');
  const state = await readDaemonState();
  const running = await isDaemonRunning(state);

  if (running) {
    return {
      name: 'Daemon',
      status: 'pass',
      message: `Daemon running (pid=${state!.pid}, port=${state!.port})`,
    };
  }

  return {
    name: 'Daemon',
    status: 'warn',
    message: 'Daemon not running',
    detail: "Run 'opta daemon start' to start the background daemon.",
    fix: async () => {
      const { ensureDaemonRunning } = await import('../daemon/lifecycle.js');
      const daemonState = await ensureDaemonRunning();
      return `Daemon started (pid=${daemonState.pid}, port=${daemonState.port})`;
    },
  };
}

export async function checkConfigDirs(): Promise<CheckResult> {
  const configDir = getConfigDir();
  const requiredDirs = [
    configDir,
    getSessionsDir(),
    getDaemonDir(),
  ];

  const missing: string[] = [];
  for (const dir of requiredDirs) {
    try {
      await access(dir);
    } catch {
      missing.push(dir);
    }
  }

  if (missing.length === 0) {
    return {
      name: 'Config Dirs',
      status: 'pass',
      message: 'Config directories exist',
    };
  }

  return {
    name: 'Config Dirs',
    status: 'warn',
    message: `Missing config directories (${missing.length})`,
    detail: missing.join(', '),
    fix: async () => {
      for (const dir of missing) {
        await mkdir(dir, { recursive: true });
      }
      return `Created ${missing.length} missing director${missing.length !== 1 ? 'ies' : 'y'}`;
    },
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
    case 'pass':
      return chalk.green('\u2713');
    case 'warn':
      return chalk.yellow('\u26A0');
    case 'fail':
      return chalk.red('\u2717');
  }
}

// --- Main Command ---

export async function runDoctor(options: DoctorOptions): Promise<void> {
  const isJson = options.format === 'json';
  const config = await loadConfig();

  const { host, port, adminKey } = config.connection;
  const cwd = process.cwd();

  const nodeResult = checkNode();
  const [
    lmxSnapshot,
    configResult,
    opisResult,
    mcpResult,
    gitResult,
    diskResult,
    diskHeadroomResult,
    accountResult,
    daemonResult,
    configDirsResult,
    lmxDiscoveryResult,
  ] = await Promise.all([
    collectLmxDoctorSnapshot(host, port, adminKey, config.connection.fallbackHosts),
    checkConfig(config),
    checkOpis(cwd),
    checkMcpServers(config.mcp.servers as Parameters<typeof checkMcpServers>[0]),
    checkGit(cwd),
    checkDiskUsage(),
    checkDiskHeadroom(diskHeadroomMbToBytes(config.safety?.diskHeadroomMb)),
    checkAccount(),
    checkDaemon(),
    checkConfigDirs(),
    checkLmxDiscovery(),
  ]);

  const results: CheckResult[] = [
    nodeResult,
    lmxConnectionResultFromSnapshot(lmxSnapshot, host, port, config.connection.fallbackHosts),
    lmxDiscoveryResult,
    activeModelResultFromSnapshot(config.model.default, lmxSnapshot),
    configResult,
    configDirsResult,
    opisResult,
    mcpResult,
    gitResult,
    daemonResult,
    diskResult,
    diskHeadroomResult,
    accountResult,
  ];

  // Output
  if (isJson) {
    const passed = results.filter((r) => r.status === 'pass').length;
    const warnings = results.filter((r) => r.status === 'warn').length;
    const failures = results.filter((r) => r.status === 'fail').length;

    console.log(
      JSON.stringify(
        {
          version: VERSION,
          checks: results.map(({ fix: _fix, ...rest }) => rest),
          summary: { passed, warnings, failures },
        },
        null,
        2
      )
    );
    return;
  }

  // Text output
  console.log('');
  console.log(chalk.bold(colorizeOptaWord('Opta Doctor')));
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

  // --fix: attempt to auto-fix failed/warned checks
  if (options.fix) {
    const fixable = results.filter((r) => r.status !== 'pass' && r.fix);
    if (fixable.length === 0) {
      console.log(chalk.dim('  No auto-fixable issues found.'));
      console.log('');
      return;
    }

    console.log(chalk.bold('  Applying fixes...'));
    console.log('');

    for (const result of fixable) {
      try {
        const fixMessage = await result.fix!();
        console.log(`  ${chalk.green('\u2713')} ${result.name}: ${fixMessage}`);
      } catch (err) {
        console.log(`  ${chalk.red('\u2717')} ${result.name}: fix failed — ${errorMessage(err)}`);
      }
    }

    console.log('');
  }
}

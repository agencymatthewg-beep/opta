import { VERSION } from '../../core/version.js';
import { loadConfig } from '../../core/config.js';
import { diskHeadroomMbToBytes } from '../../utils/disk.js';
import { errorMessage } from '../../utils/errors.js';
import {
  checkAccount,
  checkActiveModel,
  checkConfig,
  checkDiskHeadroom,
  checkDiskUsage,
  checkGit,
  checkLmxConnection,
  checkMcpServers,
  checkNode,
  checkOpis,
  type CheckResult,
} from '../../commands/doctor.js';
import { accountLogout, accountStatus } from '../../commands/account.js';
import { completions } from '../../commands/completions.js';
import { config as configCommand } from '../../commands/config.js';
import { getConfigStore } from '../../core/config.js';
import {
  daemonInstall,
  daemonLogs,
  daemonStart,
  daemonStatusCommand,
  daemonStop,
  daemonUninstall,
} from '../../commands/daemon.js';
import { diff } from '../../commands/diff.js';
import { envCommand } from '../../commands/env.js';
import { benchmark } from '../../commands/benchmark.js';
import { embed } from '../../commands/embed.js';
import { mcpAdd, mcpAddPlaywright, mcpList, mcpRemove, mcpTest } from '../../commands/mcp.js';
import { keyCopy, keyCreate, keyShow } from '../../commands/key.js';
import { rerank } from '../../commands/rerank.js';
import { sessions } from '../../commands/sessions.js';
import { fetchLatestVersion } from '../../commands/version.js';
import {
  deleteAnthropicKey,
  deleteLmxKey,
  keychainStatus,
  storeAnthropicKey,
  storeLmxKey,
} from '../../keychain/api-keys.js';
import {
  OPERATION_IDS,
  OPERATION_TAXONOMY_BY_ID,
  OperationInputSchemaById,
  type OperationDescriptor,
  type OperationId,
  type OperationInputById,
} from '../../protocol/v3/operations.js';

export interface OperationRegistryEntry<
  TId extends OperationId = OperationId,
> extends OperationDescriptor {
  inputSchema: (typeof OperationInputSchemaById)[TId];
  execute: (input: OperationInputById[TId]) => Promise<unknown>;
}

let captureQueue: Promise<void> = Promise.resolve();

function toConsoleLine(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

async function captureCommandOutput(
  run: () => Promise<void>
): Promise<{ stdout: string; stderr: string }> {
  const previous = captureQueue;
  let release: (() => void) | undefined;
  captureQueue = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;

  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;

  console.log = (...args: unknown[]) => {
    stdoutLines.push(args.map(toConsoleLine).join(' '));
  };
  console.warn = (...args: unknown[]) => {
    stderrLines.push(args.map(toConsoleLine).join(' '));
  };
  console.error = (...args: unknown[]) => {
    stderrLines.push(args.map(toConsoleLine).join(' '));
  };

  try {
    await run();
  } finally {
    console.log = originalLog;
    console.warn = originalWarn;
    console.error = originalError;
    release?.();
  }

  return {
    stdout: stdoutLines.join('\n').trim(),
    stderr: stderrLines.join('\n').trim(),
  };
}

async function runCommandForJson<T>(
  operationId: OperationId,
  run: () => Promise<void>
): Promise<T> {
  const output = await captureCommandOutput(run);
  if (!output.stdout) {
    throw new Error(`Operation "${operationId}" returned no JSON output.`);
  }
  try {
    return JSON.parse(output.stdout) as T;
  } catch (err) {
    const reason = errorMessage(err);
    throw new Error(`Operation "${operationId}" returned invalid JSON output (${reason}).`);
  }
}

async function runCommandForText(
  run: () => Promise<void>
): Promise<{ stdout: string; stderr: string }> {
  return captureCommandOutput(run);
}

async function runDoctorOperation(): Promise<{
  version: string;
  checks: CheckResult[];
  summary: {
    passed: number;
    warnings: number;
    failures: number;
  };
}> {
  const config = await loadConfig();
  const { host, port, adminKey, fallbackHosts } = config.connection;
  const cwd = process.cwd();

  const nodeCheck = checkNode();
  const asyncChecks = await Promise.all([
    checkLmxConnection(host, port, adminKey, fallbackHosts),
    checkActiveModel(config.model.default, host, port, adminKey, fallbackHosts),
    checkConfig(config),
    checkOpis(cwd),
    checkMcpServers(config.mcp.servers as Parameters<typeof checkMcpServers>[0]),
    checkGit(cwd),
    checkDiskUsage(),
    checkDiskHeadroom(diskHeadroomMbToBytes(config.safety?.diskHeadroomMb)),
    checkAccount(),
  ]);
  const checks = [nodeCheck, ...asyncChecks];

  return {
    version: VERSION,
    checks,
    summary: {
      passed: checks.filter((check) => check.status === 'pass').length,
      warnings: checks.filter((check) => check.status === 'warn').length,
      failures: checks.filter((check) => check.status === 'fail').length,
    },
  };
}

async function runVersionCheckOperation(): Promise<{
  current: string;
  latest: string | null;
  upToDate: boolean | null;
  updateAvailable: boolean | null;
}> {
  const latest = await fetchLatestVersion();
  if (!latest) {
    return {
      current: VERSION,
      latest: null,
      upToDate: null,
      updateAvailable: null,
    };
  }
  const upToDate = VERSION === latest;
  return {
    current: VERSION,
    latest,
    upToDate,
    updateAvailable: !upToDate,
  };
}

function toConfigValueString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value === undefined) return '';
  if (value === null) return 'null';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function defineOperation<TId extends OperationId>(
  id: TId,
  execute: (input: OperationInputById[TId]) => Promise<unknown>
): OperationRegistryEntry<TId> {
  const taxonomy = OPERATION_TAXONOMY_BY_ID[id];
  return {
    ...taxonomy,
    inputSchema: OperationInputSchemaById[id],
    execute,
  };
}

export const operationRegistry = {
  doctor: defineOperation('doctor', async () => runDoctorOperation()),
  'env.list': defineOperation('env.list', async () =>
    runCommandForJson('env.list', async () => {
      await envCommand('list', undefined, { json: true });
    })
  ),
  'env.show': defineOperation('env.show', async (input) =>
    runCommandForJson('env.show', async () => {
      await envCommand('show', input.name, { json: true });
    })
  ),
  'env.save': defineOperation('env.save', async (input) =>
    runCommandForJson('env.save', async () => {
      await envCommand('save', input.name, {
        json: true,
        host: input.host,
        port: input.port === undefined ? undefined : String(input.port),
        adminKey: input.adminKey,
        model: input.model,
        provider: input.provider,
        mode: input.mode,
      });
    })
  ),
  'env.use': defineOperation('env.use', async (input) =>
    runCommandForJson('env.use', async () => {
      await envCommand('use', input.name, { json: true });
    })
  ),
  'env.delete': defineOperation('env.delete', async (input) =>
    runCommandForJson('env.delete', async () => {
      await envCommand('delete', input.name, { json: true });
    })
  ),
  'config.get': defineOperation('config.get', async (input) => {
    const output = await runCommandForText(async () => {
      await configCommand('get', input.key);
    });
    return {
      key: input.key,
      value: output.stdout.trim(),
    };
  }),
  'config.set': defineOperation('config.set', async (input) =>
    runCommandForText(async () => {
      await configCommand('set', input.key, toConfigValueString(input.value));
    })
  ),
  'config.list': defineOperation('config.list', async () =>
    runCommandForJson('config.list', async () => {
      await configCommand('list', undefined, undefined, { json: true });
    })
  ),
  'config.reset': defineOperation('config.reset', async (input) => {
    const key = input.key?.trim();
    if (!key) {
      return runCommandForText(async () => {
        await configCommand('reset');
      });
    }

    const store = await getConfigStore();
    store.delete(key);
    return {
      ok: true,
      scope: 'key',
      key,
      message: `${key} reset to default`,
    };
  }),
  'account.status': defineOperation('account.status', async () =>
    runCommandForJson('account.status', async () => {
      await accountStatus({ json: true });
    })
  ),
  'account.logout': defineOperation('account.logout', async () =>
    runCommandForJson('account.logout', async () => {
      await accountLogout({ json: true });
    })
  ),
  'key.create': defineOperation('key.create', async (input) =>
    runCommandForJson('key.create', async () => {
      await keyCreate({
        value: input.value,
        remote: input.remote,
        copy: input.copy,
        json: true,
      });
    })
  ),
  'key.show': defineOperation('key.show', async (input) =>
    runCommandForJson('key.show', async () => {
      await keyShow({
        reveal: input.reveal,
        copy: input.copy,
        json: true,
      });
    })
  ),
  'key.copy': defineOperation('key.copy', async () =>
    runCommandForJson('key.copy', async () => {
      await keyCopy({ json: true });
    })
  ),
  'version.check': defineOperation('version.check', async () => runVersionCheckOperation()),
  'completions.generate': defineOperation('completions.generate', async (input) =>
    runCommandForText(async () => {
      completions(input.shell, { install: input.install });
    })
  ),
  'daemon.start': defineOperation('daemon.start', async (input) =>
    runCommandForJson('daemon.start', async () => {
      await daemonStart({
        host: input.host,
        port: input.port === undefined ? undefined : String(input.port),
        json: true,
      });
    })
  ),
  'daemon.stop': defineOperation('daemon.stop', async () =>
    runCommandForText(async () => {
      await daemonStop({});
    })
  ),
  'daemon.status': defineOperation('daemon.status', async () =>
    runCommandForJson('daemon.status', async () => {
      await daemonStatusCommand({ json: true });
    })
  ),
  'daemon.logs': defineOperation('daemon.logs', async () =>
    runCommandForJson('daemon.logs', async () => {
      await daemonLogs({ json: true });
    })
  ),
  'daemon.install': defineOperation('daemon.install', async () =>
    runCommandForText(async () => {
      await daemonInstall({});
    })
  ),
  'daemon.uninstall': defineOperation('daemon.uninstall', async () =>
    runCommandForText(async () => {
      await daemonUninstall({});
    })
  ),
  'sessions.list': defineOperation('sessions.list', async (input) =>
    runCommandForJson('sessions.list', async () => {
      await sessions('list', undefined, {
        json: true,
        model: input.model,
        since: input.since,
        tag: input.tag,
        limit: input.limit === undefined ? undefined : String(input.limit),
      });
    })
  ),
  'sessions.search': defineOperation('sessions.search', async (input) =>
    runCommandForJson('sessions.search', async () => {
      await sessions('search', input.query, { json: true });
    })
  ),
  'sessions.export': defineOperation('sessions.export', async (input) =>
    runCommandForJson('sessions.export', async () => {
      await sessions('export', input.id, { json: true });
    })
  ),
  'sessions.delete': defineOperation('sessions.delete', async (input) =>
    runCommandForText(async () => {
      await sessions('delete', input.id, { json: true });
    })
  ),
  diff: defineOperation('diff', async (input) =>
    runCommandForText(async () => {
      await diff({ session: input.session });
    })
  ),
  'mcp.list': defineOperation('mcp.list', async () =>
    runCommandForJson('mcp.list', async () => {
      await mcpList({ json: true });
    })
  ),
  'mcp.add': defineOperation('mcp.add', async (input) =>
    runCommandForText(async () => {
      await mcpAdd(input.name, input.command, { env: input.env });
    })
  ),
  'mcp.add-playwright': defineOperation('mcp.add-playwright', async (input) =>
    runCommandForText(async () => {
      await mcpAddPlaywright({
        name: input.name,
        mode: input.mode,
        command: input.command,
        packageName: input.packageName,
        allowedHosts: input.allowedHosts,
        blockedOrigins: input.blockedOrigins,
        env: input.env,
      });
    })
  ),
  'mcp.remove': defineOperation('mcp.remove', async (input) =>
    runCommandForText(async () => {
      await mcpRemove(input.name);
    })
  ),
  'mcp.test': defineOperation('mcp.test', async (input) =>
    runCommandForText(async () => {
      await mcpTest(input.name);
    })
  ),
  embed: defineOperation('embed', async (input) =>
    runCommandForJson('embed', async () => {
      await embed(input.text, {
        model: input.model,
        json: true,
      });
    })
  ),
  rerank: defineOperation('rerank', async (input) =>
    runCommandForJson('rerank', async () => {
      await rerank(input.query, {
        documents: input.documents.join('|'),
        model: input.model,
        topK: input.topK === undefined ? undefined : String(input.topK),
        json: true,
      });
    })
  ),
  benchmark: defineOperation('benchmark', async (input) =>
    runCommandForJson('benchmark', async () => {
      await benchmark({
        output: input.output,
        query: input.query,
        words: input.words,
        maxResults: input.maxResults,
        providerOrder: input.providerOrder,
        host: input.host,
        port: input.port,
        force: input.force,
        json: true,
      });
    })
  ),
  'keychain.status': defineOperation('keychain.status', async () => keychainStatus()),
  'keychain.set-anthropic': defineOperation('keychain.set-anthropic', async (input) => {
    const stored = await storeAnthropicKey(input.apiKey);
    const status = await keychainStatus();
    return { stored, status };
  }),
  'keychain.set-lmx': defineOperation('keychain.set-lmx', async (input) => {
    const stored = await storeLmxKey(input.apiKey);
    const status = await keychainStatus();
    return { stored, status };
  }),
  'keychain.delete-anthropic': defineOperation('keychain.delete-anthropic', async () => {
    await deleteAnthropicKey();
    return { deleted: true, status: await keychainStatus() };
  }),
  'keychain.delete-lmx': defineOperation('keychain.delete-lmx', async () => {
    await deleteLmxKey();
    return { deleted: true, status: await keychainStatus() };
  }),
} satisfies { [K in OperationId]: OperationRegistryEntry<K> };

export function getRegisteredOperation(id: OperationId): OperationRegistryEntry {
  return operationRegistry[id] as OperationRegistryEntry;
}

export function listRegisteredOperations(): OperationDescriptor[] {
  return OPERATION_IDS.map((id) => {
    const operation = operationRegistry[id];
    return {
      id: operation.id,
      title: operation.title,
      description: operation.description,
      safety: operation.safety,
    };
  });
}

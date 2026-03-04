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
import {
  accountKeysDelete,
  accountKeysList,
  accountKeysPush,
  accountLogin,
  accountLogout,
  accountSignup,
  accountStatus,
} from '../../commands/account.js';
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
import { init } from '../../commands/init.js';
import { benchmark } from '../../commands/benchmark.js';
import { runCeoBenchmark } from '../../benchmark/ceo/runner.js';
import { appsInstall, appsList, appsUninstall } from '../../commands/apps.js';
import { embed } from '../../commands/embed.js';
import { mcpAdd, mcpAddPlaywright, mcpList, mcpRemove, mcpTest } from '../../commands/mcp.js';
import { models } from '../../commands/models/index.js';
import {
  FAST_DISCOVERY_REQUEST_OPTS,
  type LibraryModelEntry,
  type LocalModelSnapshot,
} from '../../commands/models/types.js';
import {
  fetchHuggingFaceModels,
  getModelOptions,
  mergeCatalogEntries,
  rankCatalogEntries,
  sortCatalogEntries,
} from '../../commands/models/inventory.js';
import { keyCopy, keyCreate, keyShow } from '../../commands/key.js';
import { applyOnboardingProfile } from '../../commands/onboard.js';
import { rerank } from '../../commands/rerank.js';
import { serve } from '../../commands/serve.js';
import { sessions } from '../../commands/sessions.js';
import { updateCommand } from '../../commands/update.js';
import { fetchLatestVersion } from '../../commands/version.js';
import { LmxClient } from '../../lmx/client.js';
import {
  deleteAnthropicKey,
  deleteGeminiKey,
  deleteLmxKey,
  deleteOpenaiKey,
  deleteOpencodeZenKey,
  keychainStatus,
  storeAnthropicKey,
  storeGeminiKey,
  storeLmxKey,
  storeOpenaiKey,
  storeOpencodeZenKey,
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
  const { host, port, adminKey, fallbackHosts, adminKeysByHost } = config.connection;
  const cwd = process.cwd();

  const nodeCheck = checkNode();
  const asyncChecks = await Promise.all([
    checkLmxConnection(host, port, adminKey, fallbackHosts, adminKeysByHost),
    checkActiveModel(
      config.model.default,
      host,
      port,
      adminKey,
      fallbackHosts,
      adminKeysByHost
    ),
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

function clampBrowseLimit(limit: number | undefined): number {
  if (typeof limit !== 'number' || Number.isNaN(limit)) return 120;
  return Math.max(1, Math.min(500, Math.trunc(limit)));
}

function makeModelsClient(config: Awaited<ReturnType<typeof loadConfig>>): LmxClient {
  return new LmxClient({
    host: config.connection.host,
    fallbackHosts: config.connection.fallbackHosts,
    port: config.connection.port,
    adminKey: config.connection.adminKey,
    adminKeysByHost: config.connection.adminKeysByHost,
  });
}

async function buildLibraryBrowseEntries(
  client: LmxClient,
  query: string | undefined,
  limit: number
): Promise<LibraryModelEntry[]> {
  const [loadedRes, available, hfEntries] = await Promise.all([
    client.models(FAST_DISCOVERY_REQUEST_OPTS).catch(() => ({ models: [] })),
    client.available(FAST_DISCOVERY_REQUEST_OPTS).catch(() => []),
    fetchHuggingFaceModels(query, Math.min(Math.max(limit * 2, 120), 250)).catch(() => []),
  ]);

  const snapshot: LocalModelSnapshot = {
    loadedIds: new Set(loadedRes.models.map((model) => model.model_id)),
    availableById: new Map(available.map((model) => [model.repo_id, model] as const)),
    historyById: new Map(),
  };
  const catalog = mergeCatalogEntries(snapshot, hfEntries);
  const ranked = query?.trim() ? rankCatalogEntries(catalog, query) : sortCatalogEntries(catalog);
  return ranked.slice(0, limit);
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

async function withOptionalOptaPassword<T>(
  password: string | undefined,
  run: () => Promise<T>
): Promise<T> {
  if (password === undefined) return run();

  const previous = process.env['OPTA_PASSWORD'];
  process.env['OPTA_PASSWORD'] = password;
  try {
    return await run();
  } finally {
    if (previous === undefined) {
      delete process.env['OPTA_PASSWORD'];
    } else {
      process.env['OPTA_PASSWORD'] = previous;
    }
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
      const serializedAdminKeysByHost =
        input.adminKeysByHost === undefined
          ? undefined
          : typeof input.adminKeysByHost === 'string'
            ? input.adminKeysByHost
            : JSON.stringify(input.adminKeysByHost);
      await envCommand('save', input.name, {
        json: true,
        host: input.host,
        port: input.port === undefined ? undefined : String(input.port),
        adminKey: input.adminKey,
        adminKeysByHost: serializedAdminKeysByHost,
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
  'account.signup': defineOperation('account.signup', async (input) =>
    withOptionalOptaPassword(input.password, async () =>
      runCommandForJson('account.signup', async () => {
        await accountSignup({
          identifier: input.identifier,
          name: input.name,
          json: true,
        });
      })
    )
  ),
  'account.login': defineOperation('account.login', async (input) =>
    withOptionalOptaPassword(input.password, async () =>
      runCommandForJson('account.login', async () => {
        await accountLogin({
          identifier: input.identifier,
          oauth: input.oauth,
          oauthOptaBrowser: input.oauthOptaBrowser,
          oauthCookieJar: input.oauthCookieJar,
          oauthHeadless: input.oauthHeadless,
          timeout: input.timeout === undefined ? undefined : String(input.timeout),
          accountsUrl: input.accountsUrl,
          json: true,
        });
      })
    )
  ),
  'account.keys.list': defineOperation('account.keys.list', async (input) =>
    runCommandForJson('account.keys.list', async () => {
      await accountKeysList({
        provider: input.provider,
        json: true,
      });
    })
  ),
  'account.keys.push': defineOperation('account.keys.push', async (input) =>
    runCommandForJson('account.keys.push', async () => {
      await accountKeysPush(input.provider, input.key, {
        label: input.label,
        json: true,
      });
    })
  ),
  'account.keys.delete': defineOperation('account.keys.delete', async (input) =>
    runCommandForJson('account.keys.delete', async () => {
      await accountKeysDelete(input.keyId, {
        provider: input.provider,
        json: true,
      });
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
  'onboard.apply': defineOperation('onboard.apply', async (input) =>
    applyOnboardingProfile({
      provider: input.provider as string | undefined,
      lmxHost: input.lmxHost,
      lmxPort: input.lmxPort === undefined ? undefined : Number(input.lmxPort),
      lmxAdminKey: input.lmxAdminKey,
      anthropicApiKey: input.anthropicApiKey,
      geminiApiKey: input.geminiApiKey,
      openaiApiKey: input.openaiApiKey,
      opencodeZenApiKey: input.opencodeZenApiKey,
      providerKeyStorage: input.providerKeyStorage,
      autonomyLevel: input.autonomyLevel,
      tuiDefault: input.tuiDefault,
    })
  ),
  'serve.status': defineOperation('serve.status', async () =>
    runCommandForJson('serve.status', async () => {
      await serve(undefined, { json: true });
    })
  ),
  'serve.start': defineOperation('serve.start', async () =>
    runCommandForText(async () => {
      await serve('start', { json: true });
    })
  ),
  'serve.stop': defineOperation('serve.stop', async () =>
    runCommandForText(async () => {
      await serve('stop', { json: true });
    })
  ),
  'serve.restart': defineOperation('serve.restart', async () =>
    runCommandForText(async () => {
      await serve('restart', { json: true });
    })
  ),
  'serve.logs': defineOperation('serve.logs', async () =>
    runCommandForText(async () => {
      await serve('logs');
    })
  ),
  'init.run': defineOperation('init.run', async (input) =>
    runCommandForText(async () => {
      await init({
        yes: input.yes ?? true,
        force: input.force,
      });
    })
  ),
  'update.run': defineOperation('update.run', async (input) =>
    runCommandForJson('update.run', async () => {
      await updateCommand({
        components: input.components,
        target: input.target,
        remoteHost: input.remoteHost,
        remoteUser: input.remoteUser,
        identityFile: input.identityFile,
        localRoot: input.localRoot,
        remoteRoot: input.remoteRoot,
        dryRun: input.dryRun,
        build: input.build,
        pull: input.pull,
        json: true,
      });
    })
  ),
  'apps.list': defineOperation('apps.list', async () =>
    runCommandForJson('apps.list', async () => {
      await appsList({ json: true });
    })
  ),
  'apps.install': defineOperation('apps.install', async (input) =>
    runCommandForText(async () => {
      await appsInstall(input.appIds);
    })
  ),
  'apps.uninstall': defineOperation('apps.uninstall', async (input) =>
    runCommandForText(async () => {
      await appsUninstall(input.appIds);
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
  'ceo.benchmark': defineOperation('ceo.benchmark', async (input) =>
    runCommandForJson('ceo.benchmark', async () => {
      await runCeoBenchmark({
        filter: input.filter,
        model: input.model,
        json: true,
      });
    })
  ),
  'models.history': defineOperation('models.history', async () =>
    runCommandForJson('models.history', async () => {
      await models('history', undefined, undefined, { json: true });
    })
  ),
  'models.aliases.list': defineOperation('models.aliases.list', async () =>
    runCommandForJson('models.aliases.list', async () => {
      await models('aliases', undefined, undefined, { json: true });
    })
  ),
  'models.aliases.set': defineOperation('models.aliases.set', async (input) =>
    runCommandForText(async () => {
      await models('alias', input.alias, input.model, { json: true });
    })
  ),
  'models.aliases.delete': defineOperation('models.aliases.delete', async (input) =>
    runCommandForText(async () => {
      await models('unalias', input.alias, undefined, { json: true });
    })
  ),
  'models.dashboard': defineOperation('models.dashboard', async () =>
    runCommandForJson('models.dashboard', async () => {
      await models('dashboard', undefined, undefined, { json: true });
    })
  ),
  'models.predictor': defineOperation('models.predictor', async () =>
    runCommandForJson('models.predictor', async () => {
      await models('predictor', undefined, undefined, { json: true });
    })
  ),
  'models.helpers': defineOperation('models.helpers', async () =>
    runCommandForJson('models.helpers', async () => {
      await models('helpers', undefined, undefined, { json: true });
    })
  ),
  'models.quantize': defineOperation('models.quantize', async (input) =>
    runCommandForJson('models.quantize', async () => {
      await models('quantize', input.args, undefined, { json: true });
    })
  ),
  'models.agents': defineOperation('models.agents', async (input) =>
    runCommandForJson('models.agents', async () => {
      await models('agents', input.args, undefined, { json: true });
    })
  ),
  'models.skills': defineOperation('models.skills', async (input) =>
    runCommandForJson('models.skills', async () => {
      await models('skills', input.args, undefined, { json: true });
    })
  ),
  'models.rag': defineOperation('models.rag', async (input) =>
    runCommandForJson('models.rag', async () => {
      await models('rag', input.args, undefined, { json: true });
    })
  ),
  'models.health': defineOperation('models.health', async (input) =>
    runCommandForJson('models.health', async () => {
      await models('health', input.args, undefined, { json: true });
    })
  ),
  'models.scan': defineOperation('models.scan', async (input) =>
    runCommandForJson('models.scan', async () => {
      await models('scan', undefined, undefined, {
        json: true,
        full: input.full,
      });
    })
  ),
  'models.browse.local': defineOperation('models.browse.local', async (input) => {
    const config = await loadConfig();
    const client = makeModelsClient(config);
    const options = await getModelOptions(client);
    const query = input.query?.trim().toLowerCase();
    const limit = clampBrowseLimit(input.limit);
    const filter = (id: string): boolean => (!query ? true : id.toLowerCase().includes(query));
    const loaded = options.loaded.filter((entry) => filter(entry.id)).slice(0, limit);
    const onDisk = options.onDisk.filter((entry) => filter(entry.id)).slice(0, limit);

    return {
      query: input.query ?? null,
      limit,
      defaultModel: config.model.default,
      counts: {
        loaded: options.loaded.length,
        onDisk: options.onDisk.length,
      },
      loaded,
      onDisk,
    };
  }),
  'models.browse.library': defineOperation('models.browse.library', async (input) => {
    const config = await loadConfig();
    const client = makeModelsClient(config);
    const limit = clampBrowseLimit(input.limit);
    const entries = await buildLibraryBrowseEntries(client, input.query, limit);

    return {
      query: input.query ?? null,
      limit,
      defaultModel: config.model.default,
      counts: {
        total: entries.length,
        loaded: entries.filter((entry) => entry.loaded).length,
        downloaded: entries.filter((entry) => entry.downloaded).length,
      },
      entries,
    };
  }),
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
  'keychain.set-gemini': defineOperation('keychain.set-gemini', async (input) => {
    const stored = await storeGeminiKey(input.apiKey);
    const status = await keychainStatus();
    return { stored, status };
  }),
  'keychain.set-openai': defineOperation('keychain.set-openai', async (input) => {
    const stored = await storeOpenaiKey(input.apiKey);
    const status = await keychainStatus();
    return { stored, status };
  }),
  'keychain.set-opencode-zen': defineOperation('keychain.set-opencode-zen', async (input) => {
    const stored = await storeOpencodeZenKey(input.apiKey);
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
  'keychain.delete-gemini': defineOperation('keychain.delete-gemini', async () => {
    await deleteGeminiKey();
    return { deleted: true, status: await keychainStatus() };
  }),
  'keychain.delete-openai': defineOperation('keychain.delete-openai', async () => {
    await deleteOpenaiKey();
    return { deleted: true, status: await keychainStatus() };
  }),
  'keychain.delete-opencode-zen': defineOperation('keychain.delete-opencode-zen', async () => {
    await deleteOpencodeZenKey();
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

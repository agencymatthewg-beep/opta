import { TOOL_SCHEMAS, SUB_AGENT_TOOL_SCHEMAS, executeTool } from '../core/tools/index.js';
import { connectMcpServer, type McpConnection } from './client.js';
import { ToolResultCache } from './cache.js';
import { debug } from '../core/debug.js';
import { errorMessage } from '../utils/errors.js';
import { estimateTokens } from '../utils/tokens.js';
import type { OptaConfig } from '../core/config.js';
import type { SubAgentContext } from '../core/subagent.js';
import { LspManager } from '../lsp/manager.js';
import { resolve } from 'node:path';
import { loadCustomTools, toToolSchema, executeCustomTool, type CustomToolDef } from '../core/tools/custom.js';
import { createPlaywrightMcpServerConfig } from '../browser/mcp-bootstrap.js';
import { resolveLmxApiKey } from '../lmx/api-key.js';

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
  execute: (
    name: string,
    argsJson: string,
    parentCtx?: SubAgentContext,
    signal?: AbortSignal
  ) => Promise<string>;
  close: () => Promise<void>;
}

interface SubAgentCallbacks {
  onSubAgentSpawn?: (id: string, label: string, dependsOn?: number) => void;
  onSubAgentProgress?: (event: import('../core/subagent-events.js').SubAgentProgressEvent) => void;
  onSubAgentDone?: (agentId: string, result: string) => void;
}

interface BuildToolRegistryOptions {
  executeLocalTool?: (name: string, argsJson: string, signal?: AbortSignal) => Promise<string>;
  onSubAgentSpawn?: (id: string, label: string, dependsOn?: number) => void;
  onSubAgentProgress?: (event: import('../core/subagent-events.js').SubAgentProgressEvent) => void;
  onSubAgentDone?: (agentId: string, result: string) => void;
}

const PLAYWRIGHT_MCP_SERVER_KEY = 'playwright';

function normalizeStringList(values: string[] | undefined): string[] {
  if (!values || values.length === 0) return [];
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const value of values) {
    const candidate = value.trim();
    if (!candidate || seen.has(candidate)) continue;
    seen.add(candidate);
    normalized.push(candidate);
  }
  return normalized;
}

function resolvePlaywrightAllowedHosts(browser: OptaConfig['browser']): string[] {
  const policyHosts = normalizeStringList(browser.policy?.allowedHosts);
  const hasPolicyOverride = policyHosts.some((host) => host !== '*');
  const sourceHosts = hasPolicyOverride
    ? policyHosts
    : normalizeStringList(browser.globalAllowedHosts);

  // Preserve previous behavior: wildcard means unrestricted, so omit the flag.
  if (sourceHosts.includes('*')) return [];
  return sourceHosts;
}

function resolvePlaywrightBlockedOrigins(browser: OptaConfig['browser']): string[] {
  const policyBlocked = normalizeStringList(browser.policy?.blockedOrigins);
  if (policyBlocked.length > 0) return policyBlocked;
  return normalizeStringList(browser.blockedOrigins);
}

export async function buildToolRegistry(
  config: OptaConfig,
  mode: string = 'normal',
  options?: BuildToolRegistryOptions,
): Promise<ToolRegistry> {
  const connections: McpConnection[] = [];
  const mcpSchemas: ToolSchema[] = [];
  const mcpRoutes = new Map<string, McpConnection>();

  const mergedServers = { ...(config.mcp?.servers ?? {}) };
  const browser = config.browser;
  const browserMcp = browser?.mcp;

  if (
    browser?.enabled &&
    browserMcp?.enabled &&
    !(PLAYWRIGHT_MCP_SERVER_KEY in mergedServers)
  ) {
    const browserMode = browser.attach?.enabled ? 'attach' : browser.mode;
    const allowedHosts = resolvePlaywrightAllowedHosts(browser);
    const blockedOrigins = resolvePlaywrightBlockedOrigins(browser);

    mergedServers[PLAYWRIGHT_MCP_SERVER_KEY] = createPlaywrightMcpServerConfig({
      command: browserMcp.command,
      packageName: browserMcp.package,
      mode: browserMode,
      allowedHosts,
      blockedOrigins,
    });
  }

  const serverEntries = Object.entries(mergedServers);

  // Connect all MCP servers in parallel for faster startup
  const connectResults = await Promise.allSettled(
    serverEntries.map(([name, serverConfig]) =>
      connectMcpServer(name, serverConfig).then(conn => ({ name, conn }))
    )
  );

  for (const result of connectResults) {
    if (result.status === 'fulfilled') {
      const { name, conn } = result.value;
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
    } else {
      // Extract server name from the settled result — map index matches serverEntries order
      const idx = connectResults.indexOf(result);
      const name = serverEntries[idx]?.[0] ?? 'unknown';
      const msg = errorMessage(result.reason);
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

  // Load custom tools from .opta/tools/*.json
  const customToolDefs = await loadCustomTools(process.cwd());
  const customSchemas = customToolDefs.map(toToolSchema) as ToolSchema[];
  const customRoutes = new Map<string, CustomToolDef>();
  for (const tool of customToolDefs) {
    customRoutes.set(`custom__${tool.name}`, tool);
  }
  if (customToolDefs.length > 0) {
    debug(`Custom tools: ${customToolDefs.length} loaded (${customToolDefs.map(t => t.name).join(', ')})`);
  }

  const totalTools = baseSchemas.length + mcpSchemas.length + subAgentSchemas.length + customSchemas.length;
  const contextLimit = config.model?.contextLimit ?? 32768;
  // ~256 tokens of context per tool is a reasonable budget; exceeding this
  // means tool schemas consume too much of the model's working memory.
  const toolThreshold = Math.floor(contextLimit / 256);
  if (totalTools > toolThreshold) {
    const schemaJson = JSON.stringify(baseSchemas) + JSON.stringify(subAgentSchemas) + JSON.stringify(mcpSchemas) + JSON.stringify(customSchemas);
    const estimatedTokens = estimateTokens(schemaJson);
    console.warn(
      `  ${totalTools} tools (~${estimatedTokens} tokens) may degrade inference on ${(contextLimit / 1024).toFixed(0)}K context. Consider: lsp.enabled=false or reducing MCP servers.`
    );
  }

  const allSchemas = [...baseSchemas, ...subAgentSchemas, ...mcpSchemas, ...customSchemas];

  const WRITE_TOOL_NAMES = new Set([
    'edit_file', 'write_file', 'multi_edit', 'delete_file',
    'run_command', 'save_memory', 'bg_start', 'bg_kill',
    'spawn_agent', 'delegate_task', 'lsp_rename',
  ]);

  const filteredSchemas = mode === 'plan'
    ? allSchemas.filter(s => !WRITE_TOOL_NAMES.has(s.function.name) && !s.function.name.startsWith('custom__'))
    : allSchemas;

  // Build a self-reference for sub-agent tool execution
  const registryRef: { current: ToolRegistry | null } = { current: null };

  // Capture sub-agent callbacks from options for use inside execute() closure
  const subAgentCallbacks: SubAgentCallbacks = {
    onSubAgentSpawn: options?.onSubAgentSpawn,
    onSubAgentProgress: options?.onSubAgentProgress,
    onSubAgentDone: options?.onSubAgentDone,
  };

  // TTL cache for read-only tool results (avoids redundant file reads in multi-turn convos)
  const cache = new ToolResultCache();

  const registry: ToolRegistry = {
    schemas: filteredSchemas,
    async execute(name: string, argsJson: string, parentCtx?: SubAgentContext, signal?: AbortSignal): Promise<string> {
      // Check cache for read-only tools
      if (cache.isCacheable(name)) {
        const cacheKey = ToolResultCache.key(name, argsJson);
        const cached = cache.get(cacheKey);
        if (cached !== undefined) {
          debug(`Cache hit: ${name}`);
          return cached;
        }
      }

      // Flush cache on write operations
      if (cache.isWriteTool(name) && cache.size > 0) {
        debug(`Cache flush: ${name} (${cache.size} entries)`);
        cache.flush();
      }

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

      // Route sub-agent tools (pass context explicitly for concurrency safety)
      if (name === 'spawn_agent' || name === 'delegate_task') {
        return execSubAgentTool(name, argsJson, config, registryRef.current!, parentCtx, subAgentCallbacks);
      }

      // Route LSP tools through LspManager
      if (lspManager && LSP_TOOL_NAMES.has(name)) {
        let args: Record<string, unknown>;
        try {
          args = JSON.parse(argsJson);
        } catch {
          return 'Error: Invalid JSON arguments';
        }
        const result = await lspManager.execute(name, args);
        // Cache LSP read results
        if (cache.isCacheable(name)) {
          cache.set(ToolResultCache.key(name, argsJson), result);
        }
        return result;
      }

      // Route custom tools
      const customTool = customRoutes.get(name);
      if (customTool) {
        let args: Record<string, unknown>;
        try {
          args = JSON.parse(argsJson);
        } catch {
          return 'Error: Invalid JSON arguments for custom tool';
        }
        return executeCustomTool(customTool, args);
      }

      // Execute standard tools, then notify LSP of file changes
      const localToolExecutor = options?.executeLocalTool ?? executeTool;
      const result = await localToolExecutor(name, argsJson, signal);

      // Cache read-only tool results
      if (cache.isCacheable(name)) {
        cache.set(ToolResultCache.key(name, argsJson), result);
      }

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

/**
 * Resolve the model name to use for LMX sub-agent inference.
 *
 * When the main session is running a cloud provider model (anthropic/, zen/,
 * google/, etc.), the sub-agent cannot use that model because it connects
 * directly to LMX at config.connection.host:port/v1.
 *
 * Resolution order:
 *   1. If model is already an LMX-native HuggingFace repo (mlx-community/ etc.) → use as-is
 *   2. Query LMX admin API for the first loaded model → use that
 *   3. Fall back to config.model.default as-is
 */
async function resolveLmxModel(config: OptaConfig): Promise<string> {
  const model = config.model.default;

  // Known LMX-compatible HuggingFace org prefixes
  const LMX_ORG_PREFIXES = [
    'mlx-community', 'lmstudio-community', 'inferencerlabs',
    'unsloth', 'bartowski', 'TheBloke', 'NousResearch',
  ];

  const firstSlash = model.indexOf('/');
  const org = firstSlash > 0 ? model.slice(0, firstSlash) : '';

  if (LMX_ORG_PREFIXES.includes(org)) {
    return model; // Already a valid LMX model ID
  }

  // Model has a cloud provider prefix — query LMX for the loaded model
  try {
    const headers: Record<string, string> = {};
    if (config.connection.adminKey) {
      headers['X-Admin-Key'] = config.connection.adminKey;
    }
    const resp = await fetch(
      `http://${config.connection.host}:${config.connection.port}/admin/models`,
      { headers, signal: AbortSignal.timeout(3000) },
    );
    if (resp.ok) {
      const data = await resp.json() as { loaded?: Array<{ id: string }> };
      const firstLoaded = data.loaded?.[0]?.id;
      if (firstLoaded) return firstLoaded;
    }
  } catch {
    // LMX unreachable — fall through to default
  }

  return model; // Last resort: use as-is
}

async function execSubAgentTool(
  name: string,
  argsJson: string,
  config: OptaConfig,
  registry: ToolRegistry,
  parentCtx?: SubAgentContext,
  callbacks?: SubAgentCallbacks,
): Promise<string> {
  let args: Record<string, unknown>;
  try {
    args = JSON.parse(argsJson);
  } catch {
    return 'Error: Invalid JSON arguments for sub-agent tool';
  }

  // Lazy-load sub-agent modules
  const { spawnSubAgent, formatSubAgentResult, createSubAgentContext } = await import('../core/subagent.js');
  const { nanoid } = await import('nanoid');

  // Resolve the model to use for LMX sub-agent calls first (needed for childContext).
  // If the main session switched to a cloud model (anthropic/, zen/, etc.),
  // the sub-agent must still use the LMX-loaded model — not the cloud model name.
  const lmxModel = await resolveLmxModel(config);
  const subAgentConfig = lmxModel !== config.model.default
    ? { ...config, model: { ...config.model, default: lmxModel } }
    : config;

  // Validate depth before spawning (uses explicit context, not mutable registry state)
  let childContext: SubAgentContext;
  try {
    childContext = createSubAgentContext(
      parentCtx?.parentSessionId ?? 'root',
      parentCtx,
      subAgentConfig,
    );
  } catch (err) {
    return `Error: ${errorMessage(err)}`;
  }

  // Create an OpenAI client for the sub-agent (direct LMX connection)
  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({
    baseURL: `http://${config.connection.host}:${config.connection.port}/v1`,
    apiKey: resolveLmxApiKey(config.connection),
  });

  if (name === 'spawn_agent') {
    const task = String(args['task'] ?? '');
    if (!task) return 'Error: task is required for spawn_agent';

    const agentId = nanoid(8);
    callbacks?.onSubAgentSpawn?.(agentId, task.slice(0, 40), undefined);

    const result = await spawnSubAgent(
      {
        id: agentId,
        description: task,
        scope: args['scope'] ? String(args['scope']) : undefined,
        budget: args['max_tool_calls']
          ? { maxToolCalls: Number(args['max_tool_calls']) }
          : undefined,
        mode: args['mode'] ? String(args['mode']) : undefined,
        onProgress: callbacks?.onSubAgentProgress,
      },
      subAgentConfig,
      client,
      registry,
      childContext,
    );

    callbacks?.onSubAgentDone?.(agentId, result.response);
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
        subAgentConfig,
        client,
        registry,
        (task, cfg, cli, reg) => spawnSubAgent(task, cfg, cli, reg, childContext),
        {
          onAgentSpawn: callbacks?.onSubAgentSpawn,
          onAgentProgress: callbacks?.onSubAgentProgress,
          onAgentDone: callbacks?.onSubAgentDone,
        },
      );
    } catch (err) {
      return `Error: ${errorMessage(err)}`;
    }
  }

  return `Error: Unknown sub-agent tool "${name}"`;
}

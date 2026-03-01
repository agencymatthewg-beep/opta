import { z } from 'zod';
import { normalizeConfiguredModelId } from '../lmx/model-lifecycle.js';
import { DEFAULT_BROWSER_ADAPTATION_CONFIG } from '../browser/adaptation.js';

const ToolPermission = z.enum(['allow', 'ask', 'deny']);

const McpStdioServerSchema = z.object({
  transport: z.literal('stdio'),
  command: z.string(),
  args: z.array(z.string()).default([]),
  env: z.record(z.string(), z.string()).default({}),
});

const McpHttpServerSchema = z.object({
  transport: z.literal('http'),
  url: z.string().url(),
});

const McpServerConfigSchema = z.discriminatedUnion('transport', [
  McpStdioServerSchema,
  McpHttpServerSchema,
]);

export { McpServerConfigSchema };

const ResearchProviderNameSchema = z.enum(['auto', 'tavily', 'gemini', 'exa', 'brave', 'groq']);
const AutonomyModeSchema = z.enum(['execution', 'ceo']);
const WorkflowModeSchema = z.enum(['normal', 'plan', 'research', 'review']);
const ResponseIntentToneSchema = z.enum(['concise', 'technical', 'product']);

const AtpoConfigSchema = z.object({
  enabled: z.boolean().default(true),
  apiKey: z.string().default(''),
  model: z.string().default(''),
  provider: z.enum(['auto', 'anthropic', 'gemini', 'openai', 'opencode_zen']).default('auto'),
  paymentMethod: z.enum(['subscription', 'pay-as-you-go']).default('pay-as-you-go'),
  autonomyLevel: z.number().int().min(0).max(4).default(2),
  thresholds: z.object({
    errorCount: z.number().int().min(1).default(3),
    complexitySize: z.number().int().min(0).default(0),
    milestoneFrequency: z.enum(['sub-task', 'validation-only', 'n-tools']).default('sub-task'),
    nToolsCount: z.number().int().min(1).default(5),
  }).default({}),
  limits: z.object({
    maxCostPerSession: z.number().min(0).default(0),
    autoPauseThreshold: z.number().min(0).default(5.00),
    providerFailover: z.boolean().default(false),
    failoverModel: z.string().default(''),
  }).default({}),
  compactionAggressiveness: z.number().min(0).max(1).default(0.5),
});

const DEFAULT_TUI_TRIGGER_MODES: Array<{
  word: string;
  modeHint?: 'normal' | 'plan' | 'research' | 'review';
  priority: number;
  capabilities: string[];
  skills: string[];
}> = [
  {
    word: 'review',
    modeHint: 'review',
    priority: 400,
    capabilities: ['review'],
    skills: ['ai26-3b-code-quality-code-reviewer', 'ai26-3b-code-quality-requesting-code-review'],
  },
  {
    word: 'plan',
    modeHint: 'plan',
    priority: 300,
    capabilities: ['planning'],
    skills: ['ai26-3c-productivity-writing-plans'],
  },
  {
    word: 'research',
    modeHint: 'research',
    priority: 200,
    capabilities: ['research'],
    skills: ['ai26-3i-ai-research-perp'],
  },
  {
    word: 'browser',
    priority: 100,
    capabilities: ['browser'],
    skills: ['playwright'],
  },
];

const TuiTriggerModeSchema = z.object({
  word: z.string().min(1),
  modeHint: WorkflowModeSchema.optional(),
  priority: z.number().int().min(0).max(1000).default(0),
  capabilities: z.array(z.string()).default([]),
  skills: z.array(z.string()).default([]),
});

const TuiSkillRuntimeSchema = z.object({
  dynamicLoading: z.boolean().default(true),
  unloadInactive: z.boolean().default(true),
  ttlMinutes: z.number().min(1).max(1440).default(30),
  maxActiveSkills: z.number().int().min(1).max(500).default(24),
});

const ResearchProviderConfigSchema = z.object({
  enabled: z.boolean().default(false),
  apiKey: z.string().default(''),
  timeoutMs: z.number().min(1000).max(120_000).default(20_000),
});

export const OptaConfigSchema = z.object({
  connection: z
    .object({
      host: z.string().default('localhost'),
      fallbackHosts: z.array(z.string()).default([]),
      autoDiscover: z.boolean().default(true),
      port: z.number().default(1234),
      protocol: z.literal('http').default('http'),
      adminKey: z.string().optional(),
      apiKey: z.string().optional(),
      ssh: z
        .object({
          user: z.string().default('opta'),
          identityFile: z.string().default('~/.ssh/id_ed25519'),
          connectTimeoutSec: z.number().min(3).max(120).default(20),
          lmxPath: z.string().default('/Users/Shared/312/Opta/1-Apps/1M-Opta-LMX'),
          pythonPath: z.string().default('/Users/opta/.mlx-env/bin/python'),
        })
        .default({}),
      inferenceTimeout: z.number().min(5000).max(600_000).default(120_000),
      retry: z
        .object({
          maxRetries: z.number().min(0).max(10).default(3),
          backoffMs: z.number().min(100).default(1000),
          backoffMultiplier: z.number().min(1).default(2),
        })
        .default({}),
    })
    .default({}),
  model: z
    .object({
      default: z.string().default(''),
      contextLimit: z.number().default(32768),
      favourites: z.array(z.string()).default([]),
      /** User-defined groups. When absent, DEFAULT_GROUPS from model-catalog are used. */
      groups: z
        .array(
          z.object({
            name: z.string().min(1),
            label: z.string().min(1),
            color: z.string().optional(),
            patterns: z.array(z.string()).default([]),
          })
        )
        .optional(),
      /** HuggingFace model ID for embeddings (e.g. nomic-ai/nomic-embed-text-v2-moe) */
      embeddingModel: z.string().default(''),
      /** HuggingFace model ID for reranking (e.g. BAAI/bge-reranker-v2-m3) */
      rerankerModel: z.string().default(''),
    })
    .default({}),
  defaultMode: z
    .enum(['safe', 'auto', 'plan', 'review', 'research', 'dangerous', 'ci'])
    .default('safe'),
  autonomy: z
    .object({
      level: z.number().int().min(1).max(5).default(2),
      mode: AutonomyModeSchema.default('execution'),
      enforceProfile: z.boolean().default(true),
      objectiveReassessment: z.boolean().default(true),
      requireLiveData: z.boolean().default(false),
      reportStyle: z.enum(['standard', 'executive']).default('standard'),
      headlessContinue: z.boolean().default(false),
    })
    .default({}),
  computerControl: z
    .object({
      foreground: z
        .object({
          enabled: z.boolean().default(false),
          requireDangerousMode: z.boolean().default(true),
          allowScreenActions: z.boolean().default(false),
        })
        .default({}),
      background: z
        .object({
          enabled: z.boolean().default(true),
          allowBrowserSessionHosting: z.boolean().default(true),
          allowScreenStreaming: z.boolean().default(true),
          maxHostedBrowserSessions: z.number().int().min(1).max(5).default(5),
        })
        .default({}),
    })
    .default({}),
  permissions: z.record(z.string(), ToolPermission).default({
    // File operations
    read_file: 'allow',
    list_dir: 'allow',
    search_files: 'allow',
    find_files: 'allow',
    edit_file: 'ask',
    write_file: 'ask',
    multi_edit: 'ask',
    delete_file: 'ask',
    // Shell
    run_command: 'ask',
    // User interaction
    ask_user: 'allow',
    // Project docs
    read_project_docs: 'allow',
    // Web
    web_search: 'allow',
    web_fetch: 'allow',
    // Research
    research_query: 'allow',
    research_health: 'allow',
    // Browser automation
    browser_open: 'ask',
    browser_navigate: 'allow',
    browser_click: 'ask',
    browser_type: 'ask',
    browser_snapshot: 'allow',
    browser_screenshot: 'allow',
    browser_close: 'allow',
    // Learning
    learning_log: 'allow',
    learning_summary: 'allow',
    learning_retrieve: 'allow',
    // Memory
    save_memory: 'allow',
    // Background processes
    bg_start: 'ask',
    bg_status: 'allow',
    bg_output: 'allow',
    bg_kill: 'ask',
    // LSP
    lsp_definition: 'allow',
    lsp_references: 'allow',
    lsp_hover: 'allow',
    lsp_symbols: 'allow',
    lsp_document_symbols: 'allow',
    lsp_rename: 'ask',
    // Sub-agents
    spawn_agent: 'ask',
    delegate_task: 'ask',
    // Git
    git_status: 'allow',
    git_diff: 'allow',
    git_log: 'allow',
    git_commit: 'ask',
  }),
  safety: z
    .object({
      maxToolCalls: z.number().default(30), // backward compat
      maxParallelTools: z.number().min(1).max(16).default(8),
      diskHeadroomMb: z
        .number()
        .int()
        .min(1)
        .max(1024 * 1024)
        .default(64),
      compactAt: z.number().default(0.7),
      circuitBreaker: z
        .object({
          warnAt: z.number().default(20),
          pauseAt: z.number().default(40),
          hardStopAt: z.number().default(100),
          perToolLimit: z.number().default(0),
          maxDuration: z.number().default(0),
          silentBehavior: z.enum(['stop', 'warn-and-continue', 'error']).default('stop'),
        })
        .default({}),
    })
    .default({}),
  git: z
    .object({
      autoCommit: z.boolean().default(true),
      checkpoints: z.boolean().default(true),
    })
    .default({}),
  journal: z
    .object({
      enabled: z.boolean().default(true),
      sessionLogsDir: z.string().default('12-Session-Logs'),
      updateLogsDir: z.string().default('updates'),
      author: z.string().default(process.env['USER'] ?? process.env['USERNAME'] ?? 'unknown'),
      timezone: z.string().default('local'),
    })
    .default({}),
  mcp: z
    .object({
      servers: z.record(z.string(), McpServerConfigSchema).default({}),
    })
    .default({}),
  search: z
    .object({
      searxngUrl: z.string().default('http://localhost:8081'),
    })
    .default({}),
  research: z
    .object({
      enabled: z.boolean().default(true),
      defaultProvider: ResearchProviderNameSchema.default('auto'),
      alwaysIncludeDocumentation: z.boolean().default(true),
      maxResults: z.number().min(1).max(20).default(8),
      providers: z
        .object({
          tavily: ResearchProviderConfigSchema.default({}),
          gemini: ResearchProviderConfigSchema.default({}),
          exa: ResearchProviderConfigSchema.default({}),
          brave: ResearchProviderConfigSchema.default({}),
          groq: ResearchProviderConfigSchema.default({}),
        })
        .default({}),
    })
    .default({}),
  browser: z
    .object({
      enabled: z.boolean().default(false),
      mode: z.enum(['isolated', 'attach']).default('isolated'),
      autoInvoke: z.boolean().default(false),
      screenshotPolicy: z.enum(['on-demand', 'always', 'disabled']).default('on-demand'),
      runtime: z
        .object({
          enabled: z.boolean().default(true),
          persistSessions: z.boolean().default(true),
          persistProfileContinuity: z.boolean().default(false),
          maxSessions: z.number().min(1).max(20).default(3),
          profileRetentionDays: z.number().min(1).max(3650).default(30),
          maxPersistedProfiles: z.number().min(1).max(5000).default(200),
          profilePruneIntervalHours: z.number().min(1).max(720).default(24),
          runCorpus: z
            .object({
              enabled: z.boolean().default(true),
              windowHours: z.number().min(1).max(720).default(168),
            })
            .default({}),
        })
        .default({}),
      policy: z
        .object({
          requireApprovalForHighRisk: z.boolean().default(true),
          allowedHosts: z.array(z.string()).default(['*']),
          blockedOrigins: z.array(z.string()).default([]),
          sensitiveActions: z
            .array(z.string())
            .default(['auth_submit', 'post', 'checkout', 'delete']),
        })
        .default({}),
      adaptation: z
        .object({
          enabled: z.boolean().default(DEFAULT_BROWSER_ADAPTATION_CONFIG.enabled),
          minAssessedSessions: z
            .number()
            .min(1)
            .max(5000)
            .default(DEFAULT_BROWSER_ADAPTATION_CONFIG.minAssessedSessions),
          regressionPressureThreshold: z
            .number()
            .min(0)
            .max(1)
            .default(DEFAULT_BROWSER_ADAPTATION_CONFIG.regressionPressureThreshold),
          meanRegressionScoreThreshold: z
            .number()
            .min(0)
            .max(1)
            .default(DEFAULT_BROWSER_ADAPTATION_CONFIG.meanRegressionScoreThreshold),
          failureRateThreshold: z
            .number()
            .min(0)
            .max(1)
            .default(DEFAULT_BROWSER_ADAPTATION_CONFIG.failureRateThreshold),
          investigateWeight: z
            .number()
            .min(0)
            .max(1)
            .default(DEFAULT_BROWSER_ADAPTATION_CONFIG.investigateWeight),
        })
        .default({}),
      artifacts: z
        .object({
          enabled: z.boolean().default(true),
          screenshots: z.enum(['on_step', 'manual', 'off']).default('on_step'),
          trace: z.boolean().default(true),
          retention: z
            .object({
              enabled: z.boolean().default(false),
              retentionDays: z.number().min(1).max(3650).default(30),
              maxPersistedSessions: z.number().min(1).max(5000).default(200),
              pruneIntervalHours: z.number().min(1).max(720).default(24),
            })
            .default({}),
        })
        .default({}),
      mcp: z
        .object({
          enabled: z.boolean().default(true),
          command: z.string().default('npx'),
          package: z.string().default('@playwright/mcp@latest'),
        })
        .default({}),
      attach: z
        .object({
          enabled: z.boolean().default(false),
          wsEndpoint: z.string().default(''),
          requireApproval: z.boolean().default(true),
        })
        .default({}),
      /** URL to navigate to automatically when the Playwright browser starts. */
      homePage: z.string().optional(),
    })
    .default({}),
  background: z
    .object({
      maxConcurrent: z.number().min(1).max(20).default(5),
      defaultTimeout: z.number().min(0).default(300_000), // 5 min
      maxBufferSize: z.number().min(1024).default(1_048_576), // 1MB per stream
      killOnSessionEnd: z.boolean().default(true),
    })
    .default({}),
  hooks: z
    .array(
      z.object({
        event: z.enum([
          'session.start',
          'session.end',
          'tool.pre',
          'tool.post',
          'compact',
          'error',
        ]),
        command: z.string(),
        matcher: z.string().optional(),
        timeout: z.number().min(100).max(60000).optional(),
        background: z.boolean().optional(),
      })
    )
    .default([]),
  lsp: z
    .object({
      enabled: z.boolean().default(true),
      servers: z
        .record(
          z.string(),
          z.object({
            command: z.string(),
            args: z.array(z.string()).default([]),
            initializationOptions: z.record(z.string(), z.unknown()).default({}),
          })
        )
        .default({}),
      timeout: z.number().default(10000),
    })
    .default({}),
  subAgent: z
    .object({
      enabled: z.boolean().default(true),
      maxDepth: z.number().default(2),
      maxConcurrent: z.number().default(3),
      defaultBudget: z
        .object({
          maxToolCalls: z.number().default(15),
          maxTokens: z.number().default(8192),
          timeoutMs: z.number().default(60_000),
        })
        .default({}),
      inheritMode: z.boolean().default(true),
    })
    .default({}),
  learning: z
    .object({
      enabled: z.boolean().default(true),
      captureLevel: z.enum(['exhaustive', 'balanced', 'lean']).default('exhaustive'),
      includeUnverified: z.boolean().default(true),
      ledgerPath: z.string().default('.opta/learning/ledger.jsonl'),
      summaryDir: z.string().default('.opta/learning/summaries'),
      governor: z
        .object({
          // Keep legacy "combined" accepted for backward compatibility, but
          // use "hybrid" as the canonical default mode.
          mode: z.enum(['hybrid', 'combined']).default('hybrid'),
          autoCalibrate: z.boolean().default(true),
          allowAutoDownshift: z.boolean().default(true),
          restoreHysteresisSec: z.number().min(5).max(3600).default(120),
          thresholds: z
            .object({
              cpuHighPct: z.number().min(1).max(100).default(82),
              memoryHighPct: z.number().min(1).max(100).default(85),
              eventLoopLagMs: z.number().min(1).max(5000).default(220),
              diskWriteKbPerSec: z.number().min(1).max(10_000_000).default(50_000),
            })
            .default({}),
        })
        .default({}),
    })
    .default({}),
  policy: z
    .object({
      enabled: z.boolean().default(true),
      mode: z.enum(['full']).default('full'),
      gateAllAutonomy: z.boolean().default(true),
      failureMode: z.enum(['closed', 'degraded-safe', 'open']).default('closed'),
      requireApprovalForModeSwitch: z.boolean().default(true),
      runtimeEnforcement: z
        .object({
          enabled: z.boolean().default(false),
          endpoint: z.string().min(1).default('http://127.0.0.1:3002/api/capabilities/evaluate'),
          timeoutMs: z.number().int().min(100).max(30_000).default(2500),
          failOpen: z.boolean().default(true),
          applyTo: z
            .object({
              dangerous: z.boolean().default(true),
              highRiskWrites: z.boolean().default(true),
            })
            .default({}),
        })
        .default({}),
      audit: z
        .object({
          enabled: z.boolean().default(true),
          path: z.string().default('.opta/policy/audit.jsonl'),
          redactSecrets: z.boolean().default(true),
        })
        .default({}),
    })
    .default({}),
  context: z
    .object({
      exportMap: z.boolean().default(true),
    })
    .default({}),
  provider: z
    .object({
      active: z.enum(['lmx', 'anthropic']).default('lmx'),
      fallbackOnFailure: z.boolean().default(false),
      anthropic: z
        .object({
          apiKey: z.string().default(''),
          model: z.string().default('claude-sonnet-4-5-20250929'),
        })
        .default({}),
    })
    .default({}),
  insights: z
    .object({
      enabled: z.boolean().default(true),
    })
    .default({}),
  tui: z
    .object({
      default: z.boolean().default(false),
      triggerModes: z.array(TuiTriggerModeSchema).default(DEFAULT_TUI_TRIGGER_MODES),
      skillRuntime: TuiSkillRuntimeSchema.default({}),
      responseIntentTone: ResponseIntentToneSchema.default('technical'),
    })
    .default({}),
  reports: z
    .object({
      enabled: z.boolean().default(true),
      autoOpen: z.boolean().default(true),
      outputDir: z.string().default('.opta/reports'),
      threshold: z
        .object({
          toolCalls: z.number().int().min(1).max(500).default(15),
          elapsedSeconds: z.number().min(10).max(3600).default(120),
        })
        .default({}),
    })
    .default({}),
  atpo: AtpoConfigSchema.default({}),
});

export type OptaConfig = z.infer<typeof OptaConfigSchema>;

export const DEFAULT_CONFIG: OptaConfig = OptaConfigSchema.parse({});

const LOAD_CONFIG_CACHE_TTL_MS = 5_000;

interface LoadConfigCacheEntry {
  key: string;
  expiresAt: number;
  value: OptaConfig;
}

let loadConfigCache: LoadConfigCacheEntry | null = null;

function cloneConfig(config: OptaConfig): OptaConfig {
  return typeof structuredClone === 'function'
    ? structuredClone(config)
    : (JSON.parse(JSON.stringify(config)) as OptaConfig);
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value);
}

function buildLoadConfigCacheKey(overrides?: Record<string, unknown>): string {
  const envKey = [
    process.env['OPTA_HOST'] ?? '',
    process.env['OPTA_PORT'] ?? '',
    process.env['OPTA_ADMIN_KEY'] ?? '',
    process.env['OPTA_API_KEY'] ?? '',
    process.env['OPTA_MODEL'] ?? '',
    process.env['OPTA_DISK_HEADROOM_MB'] ?? '',
  ].join('|');
  const overrideKey = stableStringify(overrides ?? {});
  return `${envKey}::${overrideKey}`;
}

function applyProcessEnvFromConfig(config: OptaConfig): void {
  // Make the resolved key visible to components instantiated after loadConfig()
  // without threading connection.apiKey through every call site.
  const apiKey = config.connection.apiKey?.trim();
  if (apiKey && !process.env['OPTA_API_KEY']) {
    process.env['OPTA_API_KEY'] = apiKey;
  }
}

export function clearLoadConfigCache(): void {
  loadConfigCache = null;
}

/** Canonical permission defaults derived from the Zod schema. Single source of truth. */
export const DEFAULT_PERMISSIONS: Record<string, 'allow' | 'ask' | 'deny'> =
  DEFAULT_CONFIG.permissions;

// ---------------------------------------------------------------------------
// Part D: Zod error formatting
// ---------------------------------------------------------------------------

/**
 * Convert Zod validation issues into human-readable one-liners with fix suggestions.
 *
 * Maps common Zod error codes to plain-language descriptions and appends a
 * `Try: opta config set <path> <example>` hint where possible.
 */
export function formatZodErrors(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.join('.');
    let description: string;

    switch (issue.code) {
      case 'invalid_type':
        description = `Expected ${issue.expected} but got ${issue.received}`;
        break;
      case 'too_small': {
        const minIssue = issue as z.ZodTooSmallIssue;
        description = `Must be at least ${minIssue.minimum}`;
        break;
      }
      case 'too_big': {
        const maxIssue = issue as z.ZodTooBigIssue;
        description = `Must be at most ${maxIssue.maximum}`;
        break;
      }
      case 'invalid_enum_value': {
        const enumIssue = issue as z.ZodInvalidEnumValueIssue;
        description = `Must be one of: ${enumIssue.options.join(', ')}`;
        break;
      }
      default:
        description = issue.message;
    }

    // Build a helpful suggestion with the config path
    const suggestion = path
      ? `Try: opta config set ${path} <valid-value>`
      : 'Check your config file for syntax errors';

    return `Config warning: ${path || '(root)'} ${description}. ${suggestion}`;
  });
}

// ---------------------------------------------------------------------------
// Internal: strip broken keys from a raw config object
// ---------------------------------------------------------------------------

/**
 * Given a raw config object and a list of Zod issues, delete the top-level
 * keys that contain broken values so the schema can fill them with defaults.
 * Returns a shallow clone — the original object is not mutated.
 */
function stripBrokenKeys(
  raw: Record<string, unknown>,
  issues: z.ZodIssue[]
): Record<string, unknown> {
  const clone = { ...raw };
  for (const issue of issues) {
    const topKey = issue.path[0];
    if (topKey !== undefined && typeof topKey === 'string') {
      // For nested paths (e.g. connection.port), we delete the deepest
      // leaf we can reach so the rest of the sub-tree is preserved.
      deleteNestedKey(clone, issue.path as string[]);
    } else {
      // Root-level issue — nothing we can strip
    }
  }
  return clone;
}

/**
 * Delete a deeply-nested key described by `path` from `obj`.
 * If intermediate containers become empty objects after deletion they are
 * left in place (Zod will fill defaults).
 */
function deleteNestedKey(obj: Record<string, unknown>, path: (string | number)[]): void {
  if (path.length === 0) return;
  if (path.length === 1) {
    Reflect.deleteProperty(obj, path[0] as string);
    return;
  }

  const [head, ...rest] = path;
  const child = obj[head as string];
  if (child !== null && child !== undefined && typeof child === 'object' && !Array.isArray(child)) {
    deleteNestedKey(child as Record<string, unknown>, rest);
  } else {
    // Cannot traverse further — delete the whole branch
    Reflect.deleteProperty(obj, head as string);
  }
}

// ---------------------------------------------------------------------------
// Part A: loadConfig with safeParse + self-healing
// ---------------------------------------------------------------------------

export async function loadConfig(overrides?: Record<string, unknown>): Promise<OptaConfig> {
  const cacheKey = buildLoadConfigCacheKey(overrides);
  if (
    loadConfigCache &&
    loadConfigCache.key === cacheKey &&
    loadConfigCache.expiresAt > Date.now()
  ) {
    return cloneConfig(loadConfigCache.value);
  }

  const raw: Record<string, unknown> = {};

  // 1. Load user config (~/.config/opta/config.json)
  try {
    const store = await getConfigStore();
    Object.assign(raw, store.store);
  } catch {
    // conf not available or no saved config — use defaults
  }

  // 2. Load project config (.opta/config.json via cosmiconfig)
  try {
    const { cosmiconfig } = await import('cosmiconfig');
    const explorer = cosmiconfig('opta');
    const result = await explorer.search();
    if (result?.config) {
      Object.assign(raw, result.config);
    }
  } catch {
    // No project config found
  }

  // 3. Environment variable overrides
  const connectionPatch: Record<string, unknown> = {};
  if (process.env['OPTA_HOST']) connectionPatch['host'] = process.env['OPTA_HOST'];
  if (process.env['OPTA_PORT']) connectionPatch['port'] = parseInt(process.env['OPTA_PORT'], 10);
  if (process.env['OPTA_ADMIN_KEY']) connectionPatch['adminKey'] = process.env['OPTA_ADMIN_KEY'];
  if (process.env['OPTA_API_KEY']) connectionPatch['apiKey'] = process.env['OPTA_API_KEY'];
  if (Object.keys(connectionPatch).length > 0) {
    raw['connection'] = {
      ...((raw as Record<string, Record<string, unknown>>)['connection'] ?? {}),
      ...connectionPatch,
    };
  }
  const envModel = normalizeConfiguredModelId(process.env['OPTA_MODEL']);
  if (envModel) {
    raw.model = {
      ...((raw as Record<string, Record<string, unknown>>).model ?? {}),
      default: envModel,
    };
  }
  if (process.env['OPTA_DISK_HEADROOM_MB']) {
    const parsed = Number.parseInt(process.env['OPTA_DISK_HEADROOM_MB'], 10);
    if (Number.isFinite(parsed)) {
      raw.safety = {
        ...((raw as Record<string, Record<string, unknown>>).safety ?? {}),
        diskHeadroomMb: parsed,
      };
    }
  }

  // 4. CLI flag overrides
  if (overrides) {
    Object.assign(raw, overrides);
  }

  // 5. Validate with safeParse — self-heal on failure
  const result = OptaConfigSchema.safeParse(raw);

  if (result.success) {
    const normalized = {
      ...result.data,
      model: {
        ...result.data.model,
        default: normalizeConfiguredModelId(result.data.model.default),
      },
    };
    applyProcessEnvFromConfig(normalized);
    loadConfigCache = {
      key: cacheKey,
      expiresAt: Date.now() + LOAD_CONFIG_CACHE_TTL_MS,
      value: normalized,
    };
    return cloneConfig(normalized);
  }

  // Validation failed — show human-readable warnings
  const hints = formatZodErrors(result.error);
  for (const hint of hints) {
    console.error(hint);
  }

  // Attempt self-healing: strip broken keys and re-parse with defaults
  const healed = stripBrokenKeys(raw, result.error.issues);
  const retryResult = OptaConfigSchema.safeParse(healed);

  if (retryResult.success) {
    const issueCount = result.error.issues.length;
    console.error(
      `Auto-healed ${issueCount} config issue${issueCount === 1 ? '' : 's'}. Run /quickfix for details.`
    );
    const normalized = {
      ...retryResult.data,
      model: {
        ...retryResult.data.model,
        default: normalizeConfiguredModelId(retryResult.data.model.default),
      },
    };
    applyProcessEnvFromConfig(normalized);
    loadConfigCache = {
      key: cacheKey,
      expiresAt: Date.now() + LOAD_CONFIG_CACHE_TTL_MS,
      value: normalized,
    };
    return cloneConfig(normalized);
  }

  // Still broken after stripping — fatal error
  throw new Error(
    'Config is unparseable even after removing broken fields. ' +
      'Run "opta config reset" to restore defaults.\n' +
      formatZodErrors(retryResult.error).join('\n')
  );
}

// ---------------------------------------------------------------------------
// Part B: healConfig — self-healing for malformed JSON
// ---------------------------------------------------------------------------

export interface ConfigIssue {
  path: string;
  message: string;
  suggestion: string;
  autoFixed: boolean;
}

/**
 * Inspect the persisted user config, validate it against the schema, and
 * auto-fix any fields that can be reset to their defaults.
 *
 * Returns a list of every issue found, each annotated with whether it was
 * automatically repaired.
 */
export async function healConfig(): Promise<ConfigIssue[]> {
  clearLoadConfigCache();
  const store = await getConfigStore();
  const raw = { ...store.store } as Record<string, unknown>;

  const result = OptaConfigSchema.safeParse(raw);

  if (result.success) {
    return []; // Config is healthy
  }

  const issues: ConfigIssue[] = [];

  for (const zodIssue of result.error.issues) {
    const path = zodIssue.path.join('.');
    let message: string;

    switch (zodIssue.code) {
      case 'invalid_type':
        message = `Expected ${zodIssue.expected} but got ${zodIssue.received}`;
        break;
      case 'too_small': {
        const minIssue = zodIssue as z.ZodTooSmallIssue;
        message = `Must be at least ${minIssue.minimum}`;
        break;
      }
      case 'too_big': {
        const maxIssue = zodIssue as z.ZodTooBigIssue;
        message = `Must be at most ${maxIssue.maximum}`;
        break;
      }
      case 'invalid_enum_value': {
        const enumIssue = zodIssue as z.ZodInvalidEnumValueIssue;
        message = `Must be one of: ${enumIssue.options.join(', ')}`;
        break;
      }
      default:
        message = zodIssue.message;
    }

    const suggestion = path
      ? `opta config set ${path} <valid-value>`
      : 'Run "opta config reset" to restore all defaults';

    // Attempt auto-fix: delete the broken key and see if the schema passes
    const testRaw = { ...raw };
    deleteNestedKey(testRaw, zodIssue.path as string[]);
    const testResult = OptaConfigSchema.safeParse(testRaw);

    const canAutoFix =
      testResult.success || !testResult.error.issues.some((i) => i.path.join('.') === path);

    if (canAutoFix) {
      // Apply the fix to the persisted store
      const topKey = zodIssue.path[0];
      if (topKey !== undefined && typeof topKey === 'string') {
        // Delete the broken key from the conf store
        store.delete(topKey);
      }
      // Mutate raw for subsequent iterations
      deleteNestedKey(raw, zodIssue.path as string[]);
    }

    issues.push({
      path: path || '(root)',
      message,
      suggestion,
      autoFixed: canAutoFix,
    });
  }

  return issues;
}

export async function saveConfig(updates: Record<string, unknown>): Promise<void> {
  clearLoadConfigCache();
  const store = await getConfigStore();

  for (const [key, rawValue] of Object.entries(updates)) {
    let value = rawValue;
    if (key === 'model.default' && typeof rawValue === 'string') {
      value = normalizeConfiguredModelId(rawValue);
    } else if (
      key === 'model' &&
      rawValue &&
      typeof rawValue === 'object' &&
      !Array.isArray(rawValue)
    ) {
      const modelUpdate = { ...(rawValue as Record<string, unknown>) };
      if (typeof modelUpdate['default'] === 'string') {
        modelUpdate['default'] = normalizeConfiguredModelId(modelUpdate['default']);
      }
      value = modelUpdate;
    }
    store.set(key, value);
  }
}

let _configStore: import('conf').default | null = null;

export async function getConfigStore(): Promise<import('conf').default> {
  if (!_configStore) {
    const { default: Conf } = await import('conf');
    _configStore = new Conf({ projectName: 'opta' });
  }
  return _configStore;
}

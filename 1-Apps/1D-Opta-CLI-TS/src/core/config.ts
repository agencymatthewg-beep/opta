import { z } from 'zod';

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

export const OptaConfigSchema = z.object({
  connection: z
    .object({
      host: z.string().default('192.168.188.11'),
      port: z.number().default(1234),
      protocol: z.literal('http').default('http'),
      adminKey: z.string().optional(),
      ssh: z
        .object({
          user: z.string().default('opta'),
          identityFile: z.string().default('~/.ssh/id_ed25519'),
          lmxPath: z.string().default('/Users/Shared/312/Opta/1-Apps/1J-Opta-LMX'),
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
    })
    .default({}),
  defaultMode: z.enum(['safe', 'auto', 'plan', 'review', 'research', 'dangerous', 'ci']).default('safe'),
  permissions: z
    .record(z.string(), ToolPermission)
    .default({
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
      maxParallelTools: z.number().min(1).max(10).default(5),
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
  mcp: z
    .object({
      servers: z.record(z.string(), McpServerConfigSchema).default({}),
    })
    .default({}),
  search: z
    .object({
      searxngUrl: z.string().default('http://192.168.188.11:8081'),
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
      }),
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
    })
    .default({}),
});

export type OptaConfig = z.infer<typeof OptaConfigSchema>;

export const DEFAULT_CONFIG: OptaConfig = OptaConfigSchema.parse({});

/** Canonical permission defaults derived from the Zod schema. Single source of truth. */
export const DEFAULT_PERMISSIONS: Record<string, string> = DEFAULT_CONFIG.permissions;

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
  issues: z.ZodIssue[],
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
    delete obj[path[0] as string];
    return;
  }

  const [head, ...rest] = path;
  const child = obj[head as string];
  if (child !== null && child !== undefined && typeof child === 'object' && !Array.isArray(child)) {
    deleteNestedKey(child as Record<string, unknown>, rest);
  } else {
    // Cannot traverse further — delete the whole branch
    delete obj[head as string];
  }
}

// ---------------------------------------------------------------------------
// Part A: loadConfig with safeParse + self-healing
// ---------------------------------------------------------------------------

export async function loadConfig(
  overrides?: Record<string, unknown>
): Promise<OptaConfig> {
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
  if (process.env['OPTA_HOST']) {
    (raw as Record<string, unknown>).connection = {
      ...((raw as Record<string, Record<string, unknown>>).connection ?? {}),
      host: process.env['OPTA_HOST'],
    };
  }
  if (process.env['OPTA_PORT']) {
    (raw as Record<string, unknown>).connection = {
      ...((raw as Record<string, Record<string, unknown>>).connection ?? {}),
      port: parseInt(process.env['OPTA_PORT'], 10),
    };
  }
  if (process.env['OPTA_ADMIN_KEY']) {
    (raw as Record<string, unknown>).connection = {
      ...((raw as Record<string, Record<string, unknown>>).connection ?? {}),
      adminKey: process.env['OPTA_ADMIN_KEY'],
    };
  }
  if (process.env['OPTA_MODEL']) {
    (raw as Record<string, unknown>).model = {
      ...((raw as Record<string, Record<string, unknown>>).model ?? {}),
      default: process.env['OPTA_MODEL'],
    };
  }

  // 4. CLI flag overrides
  if (overrides) {
    Object.assign(raw, overrides);
  }

  // 5. Validate with safeParse — self-heal on failure
  const result = OptaConfigSchema.safeParse(raw);

  if (result.success) {
    return result.data;
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
      `Auto-healed ${issueCount} config issue${issueCount === 1 ? '' : 's'}. Run /quickfix for details.`,
    );
    return retryResult.data;
  }

  // Still broken after stripping — fatal error
  throw new Error(
    'Config is unparseable even after removing broken fields. ' +
    'Run "opta config reset" to restore defaults.\n' +
    formatZodErrors(retryResult.error).join('\n'),
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

    const canAutoFix = testResult.success ||
      !testResult.error.issues.some(i => i.path.join('.') === path);

    if (canAutoFix) {
      // Apply the fix to the persisted store
      const topKey = zodIssue.path[0];
      if (topKey !== undefined && typeof topKey === 'string') {
        // Delete the broken key from the conf store
        store.delete(topKey as string);
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

export async function saveConfig(
  updates: Record<string, unknown>
): Promise<void> {
  const store = await getConfigStore();

  for (const [key, value] of Object.entries(updates)) {
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

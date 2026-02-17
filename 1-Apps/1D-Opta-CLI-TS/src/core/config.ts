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

export async function loadConfig(
  overrides?: Record<string, unknown>
): Promise<OptaConfig> {
  const raw: Record<string, unknown> = {};

  // 1. Load user config (~/.config/opta/config.json)
  try {
    const { default: Conf } = await import('conf');
    const store = new Conf({ projectName: 'opta' });
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

  return OptaConfigSchema.parse(raw);
}

export async function saveConfig(
  updates: Record<string, unknown>
): Promise<void> {
  const { default: Conf } = await import('conf');
  const store = new Conf({ projectName: 'opta' });

  for (const [key, value] of Object.entries(updates)) {
    store.set(key, value);
  }
}

export async function getConfigStore(): Promise<import('conf').default> {
  const { default: Conf } = await import('conf');
  return new Conf({ projectName: 'opta' });
}

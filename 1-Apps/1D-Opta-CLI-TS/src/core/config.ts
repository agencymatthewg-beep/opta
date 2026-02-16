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
    })
    .default({}),
  model: z
    .object({
      default: z.string().default(''),
      contextLimit: z.number().default(32768),
    })
    .default({}),
  defaultMode: z.enum(['safe', 'auto', 'plan', 'dangerous', 'ci']).default('safe'),
  permissions: z
    .record(z.string(), ToolPermission)
    .default({
      read_file: 'allow',
      list_dir: 'allow',
      search_files: 'allow',
      find_files: 'allow',
      edit_file: 'ask',
      write_file: 'ask',
      multi_edit: 'ask',
      delete_file: 'ask',
      run_command: 'ask',
      ask_user: 'allow',
      web_search: 'allow',
      web_fetch: 'allow',
      save_memory: 'allow',
    }),
  safety: z
    .object({
      maxToolCalls: z.number().default(30), // backward compat
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
      searxngUrl: z.string().default('http://192.168.188.10:8888'),
    })
    .default({}),
});

export type OptaConfig = z.infer<typeof OptaConfigSchema>;

export const DEFAULT_CONFIG: OptaConfig = OptaConfigSchema.parse({});

export async function loadConfig(
  overrides?: Partial<Record<string, unknown>>
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
  updates: Partial<Record<string, unknown>>
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

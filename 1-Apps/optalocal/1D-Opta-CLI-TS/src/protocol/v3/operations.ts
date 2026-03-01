import { z } from 'zod';

export const OPERATION_IDS = [
  'doctor',
  'env.list',
  'env.show',
  'env.save',
  'env.use',
  'env.delete',
  'config.get',
  'config.set',
  'config.list',
  'config.reset',
  'account.status',
  'account.signup',
  'account.login',
  'account.keys.list',
  'account.keys.push',
  'account.keys.delete',
  'account.logout',
  'key.create',
  'key.show',
  'key.copy',
  'version.check',
  'completions.generate',
  'daemon.start',
  'daemon.stop',
  'daemon.status',
  'daemon.logs',
  'daemon.install',
  'daemon.uninstall',
  'serve.status',
  'serve.start',
  'serve.stop',
  'serve.restart',
  'serve.logs',
  'init.run',
  'update.run',
  'sessions.list',
  'sessions.search',
  'sessions.export',
  'sessions.delete',
  'diff',
  'mcp.list',
  'mcp.add',
  'mcp.add-playwright',
  'mcp.remove',
  'mcp.test',
  'embed',
  'rerank',
  'benchmark',
  'keychain.status',
  'keychain.set-anthropic',
  'keychain.set-lmx',
  'keychain.delete-anthropic',
  'keychain.delete-lmx',
] as const;

export type OperationId = (typeof OPERATION_IDS)[number];
export const OperationIdSchema = z.enum(OPERATION_IDS);

export const OperationSafetyClassSchema = z.enum(['read', 'write', 'dangerous']);
export type OperationSafetyClass = z.infer<typeof OperationSafetyClassSchema>;

export const OperationDescriptorSchema = z
  .object({
    id: OperationIdSchema,
    title: z.string().min(1),
    description: z.string().min(1),
    safety: OperationSafetyClassSchema,
  })
  .strict();
export type OperationDescriptor = z.infer<typeof OperationDescriptorSchema>;

const EmptyInputSchema = z.object({}).strict();

export const OperationInputSchemaById = {
  doctor: EmptyInputSchema,
  'env.list': EmptyInputSchema,
  'env.show': z
    .object({
      name: z.string().min(1).optional(),
    })
    .strict(),
  'env.save': z
    .object({
      name: z.string().min(1),
      host: z.string().min(1).optional(),
      port: z.union([z.string().min(1), z.number().int().min(1).max(65_535)]).optional(),
      adminKey: z.string().optional(),
      model: z.string().min(1).optional(),
      provider: z.enum(['lmx', 'anthropic']).optional(),
      mode: z.enum(['safe', 'auto', 'plan', 'review', 'research', 'dangerous', 'ci']).optional(),
    })
    .strict(),
  'env.use': z
    .object({
      name: z.string().min(1),
    })
    .strict(),
  'env.delete': z
    .object({
      name: z.string().min(1),
    })
    .strict(),
  'config.get': z
    .object({
      key: z.string().min(1),
    })
    .strict(),
  'config.set': z
    .object({
      key: z.string().min(1),
      value: z.unknown(),
    })
    .strict(),
  'config.list': EmptyInputSchema,
  'config.reset': z
    .object({
      key: z.string().min(1).optional(),
    })
    .strict(),
  'account.status': EmptyInputSchema,
  'account.signup': z
    .object({
      identifier: z.string().min(1),
      password: z.string().min(1).optional(),
      name: z.string().min(1).optional(),
    })
    .strict(),
  'account.login': z
    .object({
      identifier: z.string().min(1).optional(),
      password: z.string().min(1).optional(),
      oauth: z.boolean().optional(),
      oauthOptaBrowser: z.boolean().optional(),
      oauthCookieJar: z.string().min(1).optional(),
      oauthHeadless: z.boolean().optional(),
      timeout: z.union([z.string().min(1), z.number().int().min(1)]).optional(),
      accountsUrl: z.string().min(1).optional(),
    })
    .strict(),
  'account.keys.list': z
    .object({
      provider: z.string().min(1).optional(),
    })
    .strict(),
  'account.keys.push': z
    .object({
      provider: z.string().min(1),
      key: z.string().min(1),
      label: z.string().min(1).optional(),
    })
    .strict(),
  'account.keys.delete': z
    .object({
      keyId: z.string().min(1),
      provider: z.string().min(1).optional(),
    })
    .strict(),
  'account.logout': EmptyInputSchema,
  'key.create': z
    .object({
      value: z.string().min(1).optional(),
      remote: z.boolean().optional(),
      copy: z.boolean().optional(),
    })
    .strict(),
  'key.show': z
    .object({
      reveal: z.boolean().optional(),
      copy: z.boolean().optional(),
    })
    .strict(),
  'key.copy': EmptyInputSchema,
  'version.check': EmptyInputSchema,
  'completions.generate': z
    .object({
      shell: z.enum(['bash', 'zsh', 'fish']),
      install: z.boolean().optional(),
    })
    .strict(),
  'daemon.start': z
    .object({
      host: z.string().min(1).optional(),
      port: z.union([z.string().min(1), z.number().int().min(1).max(65_535)]).optional(),
    })
    .strict(),
  'daemon.stop': EmptyInputSchema,
  'daemon.status': EmptyInputSchema,
  'daemon.logs': EmptyInputSchema,
  'daemon.install': EmptyInputSchema,
  'daemon.uninstall': EmptyInputSchema,
  'serve.status': EmptyInputSchema,
  'serve.start': EmptyInputSchema,
  'serve.stop': EmptyInputSchema,
  'serve.restart': EmptyInputSchema,
  'serve.logs': EmptyInputSchema,
  'init.run': z
    .object({
      yes: z.boolean().optional(),
      force: z.boolean().optional(),
    })
    .strict(),
  'update.run': z
    .object({
      components: z.string().min(1).optional(),
      target: z.enum(['auto', 'local', 'remote', 'both']).optional(),
      remoteHost: z.string().min(1).optional(),
      remoteUser: z.string().min(1).optional(),
      identityFile: z.string().min(1).optional(),
      localRoot: z.string().min(1).optional(),
      remoteRoot: z.string().min(1).optional(),
      dryRun: z.boolean().optional(),
      build: z.boolean().optional(),
      pull: z.boolean().optional(),
    })
    .strict(),
  'sessions.list': z
    .object({
      model: z.string().min(1).optional(),
      since: z.string().min(1).optional(),
      tag: z.string().min(1).optional(),
      limit: z.union([z.string().min(1), z.number().int().min(1)]).optional(),
    })
    .strict(),
  'sessions.search': z
    .object({
      query: z.string().min(1),
    })
    .strict(),
  'sessions.export': z
    .object({
      id: z.string().min(1),
    })
    .strict(),
  'sessions.delete': z
    .object({
      id: z.string().min(1),
    })
    .strict(),
  diff: z
    .object({
      session: z.string().min(1).optional(),
    })
    .strict(),
  'mcp.list': EmptyInputSchema,
  'mcp.add': z
    .object({
      name: z.string().min(1),
      command: z.string().min(1),
      env: z.string().optional(),
    })
    .strict(),
  'mcp.add-playwright': z
    .object({
      name: z.string().min(1).optional(),
      mode: z.enum(['isolated', 'attach']).optional(),
      command: z.string().min(1).optional(),
      packageName: z.string().min(1).optional(),
      allowedHosts: z.array(z.string().min(1)).optional(),
      blockedOrigins: z.array(z.string().min(1)).optional(),
      env: z.string().optional(),
    })
    .strict(),
  'mcp.remove': z
    .object({
      name: z.string().min(1),
    })
    .strict(),
  'mcp.test': z
    .object({
      name: z.string().min(1),
    })
    .strict(),
  embed: z
    .object({
      text: z.string().min(1),
      model: z.string().min(1).optional(),
    })
    .strict(),
  rerank: z
    .object({
      query: z.string().min(1),
      documents: z.array(z.string().min(1)).min(1),
      model: z.string().min(1).optional(),
      topK: z.number().int().min(1).optional(),
    })
    .strict(),
  benchmark: z
    .object({
      output: z.string().min(1).optional(),
      query: z.string().min(1).optional(),
      words: z.number().int().min(500).max(4000).optional(),
      maxResults: z.number().int().min(3).max(20).optional(),
      providerOrder: z.string().min(1).optional(),
      host: z.string().min(1).optional(),
      port: z.number().int().min(1024).max(65_535).optional(),
      force: z.boolean().optional(),
    })
    .strict(),
  'keychain.status': EmptyInputSchema,
  'keychain.set-anthropic': z
    .object({
      apiKey: z.string().min(1),
    })
    .strict(),
  'keychain.set-lmx': z
    .object({
      apiKey: z.string().min(1),
    })
    .strict(),
  'keychain.delete-anthropic': EmptyInputSchema,
  'keychain.delete-lmx': EmptyInputSchema,
} as const satisfies Record<OperationId, z.ZodTypeAny>;

export type OperationInputById = {
  [K in OperationId]: z.infer<(typeof OperationInputSchemaById)[K]>;
};

const TextCommandOutputSchema = z
  .object({
    stdout: z.string(),
    stderr: z.string(),
  })
  .strict();

const AccountUserSchema = z
  .object({
    id: z.string().nullable(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
    name: z.string().nullable(),
  })
  .strict();

const AccountSessionSchema = z
  .object({
    tokenType: z.string().nullable(),
    expiresAt: z.string().nullable(),
  })
  .nullable();

const AccountAuthActionSchema = z
  .object({
    ok: z.literal(true),
    action: z.enum(['signup', 'login']),
    project: z.string().min(1),
    authenticated: z.boolean(),
    user: AccountUserSchema,
    session: AccountSessionSchema,
    mode: z.string().optional(),
  })
  .strict();

const AccountCloudKeySchema = z
  .object({
    id: z.string().min(1),
    provider: z.string().min(1),
    label: z.string().nullable().optional(),
    updatedAt: z.string().nullable().optional(),
  })
  .passthrough();

const SessionSummarySchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    tags: z.array(z.string()),
    model: z.string().min(1),
    created: z.string().min(1),
    messageCount: z.number().int().min(0),
    toolCallCount: z.number().int().min(0),
  })
  .strict();

export const OperationOutputSchemaById = {
  doctor: z.unknown(),
  'env.list': z.unknown(),
  'env.show': z.unknown(),
  'env.save': z.unknown(),
  'env.use': z.unknown(),
  'env.delete': z.unknown(),
  'config.get': z
    .object({
      key: z.string().min(1),
      value: z.string(),
    })
    .strict(),
  'config.set': z.unknown(),
  'config.list': z.unknown(),
  'config.reset': z.unknown(),
  'account.status': z
    .object({
      ok: z.literal(true),
      authenticated: z.boolean(),
      project: z.string().nullable(),
      user: AccountUserSchema,
      session: AccountSessionSchema,
      updatedAt: z.string().nullable(),
    })
    .strict(),
  'account.signup': AccountAuthActionSchema,
  'account.login': AccountAuthActionSchema,
  'account.keys.list': z.union([
    z
      .object({
        ok: z.literal(true),
        keys: z.array(AccountCloudKeySchema),
      })
      .strict(),
    z
      .object({
        ok: z.literal(false),
        error: z.string().min(1),
      })
      .strict(),
  ]),
  'account.keys.push': z
    .object({
      ok: z.boolean(),
      provider: z.string().min(1),
      label: z.string().min(1),
    })
    .strict(),
  'account.keys.delete': z
    .object({
      ok: z.boolean(),
      keyId: z.string().min(1),
    })
    .strict(),
  'account.logout': z
    .object({
      ok: z.literal(true),
      action: z.literal('logout'),
      cleared: z.boolean(),
      remoteRevoked: z.boolean(),
      warning: z.string().nullable(),
    })
    .strict(),
  'key.create': z.unknown(),
  'key.show': z.unknown(),
  'key.copy': z.unknown(),
  'version.check': z
    .object({
      current: z.string().min(1),
      latest: z.string().nullable(),
      upToDate: z.boolean().nullable(),
      updateAvailable: z.boolean().nullable(),
    })
    .strict(),
  'completions.generate': TextCommandOutputSchema,
  'daemon.start': z.unknown(),
  'daemon.stop': TextCommandOutputSchema,
  'daemon.status': z.unknown(),
  'daemon.logs': z.unknown(),
  'daemon.install': TextCommandOutputSchema,
  'daemon.uninstall': TextCommandOutputSchema,
  'serve.status': z
    .object({
      running: z.boolean(),
    })
    .passthrough(),
  'serve.start': TextCommandOutputSchema,
  'serve.stop': TextCommandOutputSchema,
  'serve.restart': TextCommandOutputSchema,
  'serve.logs': TextCommandOutputSchema,
  'init.run': TextCommandOutputSchema,
  'update.run': z.unknown(),
  'sessions.list': z.array(SessionSummarySchema),
  'sessions.search': z.array(SessionSummarySchema),
  'sessions.export': z.unknown(),
  'sessions.delete': TextCommandOutputSchema,
  diff: TextCommandOutputSchema,
  'mcp.list': z.unknown(),
  'mcp.add': TextCommandOutputSchema,
  'mcp.add-playwright': TextCommandOutputSchema,
  'mcp.remove': TextCommandOutputSchema,
  'mcp.test': TextCommandOutputSchema,
  embed: z.unknown(),
  rerank: z.unknown(),
  benchmark: z.unknown(),
  'keychain.status': z.unknown(),
  'keychain.set-anthropic': z.unknown(),
  'keychain.set-lmx': z.unknown(),
  'keychain.delete-anthropic': z.unknown(),
  'keychain.delete-lmx': z.unknown(),
} as const satisfies Record<OperationId, z.ZodTypeAny>;

export type OperationOutputById = {
  [K in OperationId]: z.infer<(typeof OperationOutputSchemaById)[K]>;
};

function makeExecuteRequestVariant<TId extends OperationId>(id: TId) {
  return z
    .object({
      id: z.literal(id),
      input: OperationInputSchemaById[id],
      confirmDangerous: z.boolean().optional(),
    })
    .strict();
}

export const OperationExecuteRequestSchema = z.discriminatedUnion('id', [
  makeExecuteRequestVariant('doctor'),
  makeExecuteRequestVariant('env.list'),
  makeExecuteRequestVariant('env.show'),
  makeExecuteRequestVariant('env.save'),
  makeExecuteRequestVariant('env.use'),
  makeExecuteRequestVariant('env.delete'),
  makeExecuteRequestVariant('config.get'),
  makeExecuteRequestVariant('config.set'),
  makeExecuteRequestVariant('config.list'),
  makeExecuteRequestVariant('config.reset'),
  makeExecuteRequestVariant('account.status'),
  makeExecuteRequestVariant('account.signup'),
  makeExecuteRequestVariant('account.login'),
  makeExecuteRequestVariant('account.keys.list'),
  makeExecuteRequestVariant('account.keys.push'),
  makeExecuteRequestVariant('account.keys.delete'),
  makeExecuteRequestVariant('account.logout'),
  makeExecuteRequestVariant('key.create'),
  makeExecuteRequestVariant('key.show'),
  makeExecuteRequestVariant('key.copy'),
  makeExecuteRequestVariant('version.check'),
  makeExecuteRequestVariant('completions.generate'),
  makeExecuteRequestVariant('daemon.start'),
  makeExecuteRequestVariant('daemon.stop'),
  makeExecuteRequestVariant('daemon.status'),
  makeExecuteRequestVariant('daemon.logs'),
  makeExecuteRequestVariant('daemon.install'),
  makeExecuteRequestVariant('daemon.uninstall'),
  makeExecuteRequestVariant('serve.status'),
  makeExecuteRequestVariant('serve.start'),
  makeExecuteRequestVariant('serve.stop'),
  makeExecuteRequestVariant('serve.restart'),
  makeExecuteRequestVariant('serve.logs'),
  makeExecuteRequestVariant('init.run'),
  makeExecuteRequestVariant('update.run'),
  makeExecuteRequestVariant('sessions.list'),
  makeExecuteRequestVariant('sessions.search'),
  makeExecuteRequestVariant('sessions.export'),
  makeExecuteRequestVariant('sessions.delete'),
  makeExecuteRequestVariant('diff'),
  makeExecuteRequestVariant('mcp.list'),
  makeExecuteRequestVariant('mcp.add'),
  makeExecuteRequestVariant('mcp.add-playwright'),
  makeExecuteRequestVariant('mcp.remove'),
  makeExecuteRequestVariant('mcp.test'),
  makeExecuteRequestVariant('embed'),
  makeExecuteRequestVariant('rerank'),
  makeExecuteRequestVariant('benchmark'),
  makeExecuteRequestVariant('keychain.status'),
  makeExecuteRequestVariant('keychain.set-anthropic'),
  makeExecuteRequestVariant('keychain.set-lmx'),
  makeExecuteRequestVariant('keychain.delete-anthropic'),
  makeExecuteRequestVariant('keychain.delete-lmx'),
]);
export type OperationExecuteRequest = z.infer<typeof OperationExecuteRequestSchema>;

export const OperationExecuteBodySchema = z
  .object({
    input: z.record(z.string(), z.unknown()).default({}),
    confirmDangerous: z.boolean().optional(),
  })
  .strict();
export type OperationExecuteBody = z.infer<typeof OperationExecuteBodySchema>;

export const OperationParamsSchema = z
  .object({
    id: OperationIdSchema,
  })
  .strict();
export type OperationParams = z.infer<typeof OperationParamsSchema>;

export const OperationErrorSchema = z
  .object({
    code: z.string().min(1),
    message: z.string().min(1),
    details: z.unknown().optional(),
  })
  .strict();
export type OperationError = z.infer<typeof OperationErrorSchema>;

export const OperationExecuteSuccessResponseSchema = z
  .object({
    ok: z.literal(true),
    id: OperationIdSchema,
    safety: OperationSafetyClassSchema,
    result: z.unknown(),
  })
  .strict();
export type OperationExecuteSuccessResponse = z.infer<typeof OperationExecuteSuccessResponseSchema>;

export const OperationExecuteErrorResponseSchema = z
  .object({
    ok: z.literal(false),
    id: OperationIdSchema,
    safety: OperationSafetyClassSchema,
    error: OperationErrorSchema,
  })
  .strict();
export type OperationExecuteErrorResponse = z.infer<typeof OperationExecuteErrorResponseSchema>;

export const OperationExecuteResponseSchema = z.union([
  OperationExecuteSuccessResponseSchema,
  OperationExecuteErrorResponseSchema,
]);
export type OperationExecuteResponse = z.infer<typeof OperationExecuteResponseSchema>;

export const OperationListResponseSchema = z
  .object({
    operations: z.array(OperationDescriptorSchema),
  })
  .strict();
export type OperationListResponse = z.infer<typeof OperationListResponseSchema>;

export const OPERATION_TAXONOMY = [
  {
    id: 'doctor',
    title: 'Doctor',
    description: 'Run daemon/CLI environment diagnostics.',
    safety: 'read',
  },
  {
    id: 'env.list',
    title: 'Environment Profiles List',
    description: 'List configured environment profiles.',
    safety: 'read',
  },
  {
    id: 'env.show',
    title: 'Environment Profile Detail',
    description: 'Show a named environment profile (or active profile).',
    safety: 'read',
  },
  {
    id: 'env.save',
    title: 'Environment Profile Save',
    description: 'Persist current settings as an environment profile.',
    safety: 'write',
  },
  {
    id: 'env.use',
    title: 'Environment Profile Activate',
    description: 'Apply an environment profile to active daemon config.',
    safety: 'write',
  },
  {
    id: 'env.delete',
    title: 'Environment Profile Delete',
    description: 'Delete an environment profile.',
    safety: 'write',
  },
  {
    id: 'config.get',
    title: 'Config Get',
    description: 'Read one flattened Opta config value by key.',
    safety: 'read',
  },
  {
    id: 'config.set',
    title: 'Config Set',
    description: 'Persist one Opta config key to a new value.',
    safety: 'write',
  },
  {
    id: 'config.list',
    title: 'Config List',
    description: 'List current Opta config with resolved defaults.',
    safety: 'read',
  },
  {
    id: 'config.reset',
    title: 'Config Reset',
    description: 'Reset one config key or all overrides back to defaults.',
    safety: 'write',
  },
  {
    id: 'account.status',
    title: 'Account Status',
    description: 'Inspect local Supabase account session status.',
    safety: 'read',
  },
  {
    id: 'account.signup',
    title: 'Account Signup',
    description: 'Create an Opta account using email/phone credentials.',
    safety: 'write',
  },
  {
    id: 'account.login',
    title: 'Account Login',
    description: 'Authenticate to Opta account via credentials or OAuth.',
    safety: 'write',
  },
  {
    id: 'account.keys.list',
    title: 'Account Keys List',
    description: 'List cloud-synced account API keys.',
    safety: 'read',
  },
  {
    id: 'account.keys.push',
    title: 'Account Keys Push',
    description: 'Store a provider API key in account cloud storage.',
    safety: 'write',
  },
  {
    id: 'account.keys.delete',
    title: 'Account Keys Delete',
    description: 'Delete a cloud-synced provider API key by id.',
    safety: 'write',
  },
  {
    id: 'account.logout',
    title: 'Account Logout',
    description: 'Clear local account session and revoke remote auth token when available.',
    safety: 'write',
  },
  {
    id: 'key.create',
    title: 'Key Create',
    description: 'Create or rotate local inference API key.',
    safety: 'write',
  },
  {
    id: 'key.show',
    title: 'Key Show',
    description: 'Inspect current local inference API key state.',
    safety: 'read',
  },
  {
    id: 'key.copy',
    title: 'Key Copy',
    description: 'Copy current inference API key to clipboard.',
    safety: 'write',
  },
  {
    id: 'version.check',
    title: 'Version Check',
    description: 'Check npm registry for latest Opta CLI version.',
    safety: 'read',
  },
  {
    id: 'completions.generate',
    title: 'Completions Generate',
    description: 'Generate or install shell completion scripts.',
    safety: 'write',
  },
  {
    id: 'daemon.start',
    title: 'Daemon Start',
    description: 'Start daemon process (or attach to running daemon).',
    safety: 'write',
  },
  {
    id: 'daemon.stop',
    title: 'Daemon Stop',
    description: 'Stop the running daemon process.',
    safety: 'write',
  },
  {
    id: 'daemon.status',
    title: 'Daemon Status',
    description: 'Inspect daemon lifecycle status.',
    safety: 'read',
  },
  {
    id: 'daemon.logs',
    title: 'Daemon Logs',
    description: 'Read daemon logs tail output.',
    safety: 'read',
  },
  {
    id: 'daemon.install',
    title: 'Daemon Install',
    description: 'Install daemon as system service.',
    safety: 'dangerous',
  },
  {
    id: 'daemon.uninstall',
    title: 'Daemon Uninstall',
    description: 'Uninstall daemon system service registration.',
    safety: 'dangerous',
  },
  {
    id: 'serve.status',
    title: 'Serve Status',
    description: 'Inspect Opta LMX service reachability and health.',
    safety: 'read',
  },
  {
    id: 'serve.start',
    title: 'Serve Start',
    description: 'Start Opta LMX inference service.',
    safety: 'write',
  },
  {
    id: 'serve.stop',
    title: 'Serve Stop',
    description: 'Stop Opta LMX inference service.',
    safety: 'write',
  },
  {
    id: 'serve.restart',
    title: 'Serve Restart',
    description: 'Restart Opta LMX inference service.',
    safety: 'write',
  },
  {
    id: 'serve.logs',
    title: 'Serve Logs',
    description: 'Tail recent Opta LMX service log output.',
    safety: 'read',
  },
  {
    id: 'init.run',
    title: 'Init Run',
    description: 'Initialize OPIS docs in the current project workspace.',
    safety: 'write',
  },
  {
    id: 'update.run',
    title: 'Update Run',
    description: 'Run Opta component updates for configured targets.',
    safety: 'write',
  },
  {
    id: 'sessions.list',
    title: 'Sessions List',
    description: 'List local chat sessions with optional filters.',
    safety: 'read',
  },
  {
    id: 'sessions.search',
    title: 'Sessions Search',
    description: 'Search local chat sessions by query.',
    safety: 'read',
  },
  {
    id: 'sessions.export',
    title: 'Sessions Export',
    description: 'Export a local chat session as JSON.',
    safety: 'read',
  },
  {
    id: 'sessions.delete',
    title: 'Sessions Delete',
    description: 'Delete a local chat session.',
    safety: 'write',
  },
  {
    id: 'diff',
    title: 'Git Diff',
    description: 'Show current git diff output or checkpoints for a session.',
    safety: 'read',
  },
  {
    id: 'mcp.list',
    title: 'MCP Servers List',
    description: 'List configured MCP servers.',
    safety: 'read',
  },
  {
    id: 'mcp.add',
    title: 'MCP Server Add',
    description: 'Add an MCP server configuration.',
    safety: 'write',
  },
  {
    id: 'mcp.add-playwright',
    title: 'MCP Playwright Add',
    description: 'Add a Playwright MCP server configuration.',
    safety: 'write',
  },
  {
    id: 'mcp.remove',
    title: 'MCP Server Remove',
    description: 'Remove an MCP server configuration.',
    safety: 'write',
  },
  {
    id: 'mcp.test',
    title: 'MCP Server Test',
    description: 'Open a live MCP server connection and inspect tools.',
    safety: 'dangerous',
  },
  {
    id: 'embed',
    title: 'Embeddings',
    description: 'Create embeddings using Opta LMX.',
    safety: 'read',
  },
  {
    id: 'rerank',
    title: 'Rerank',
    description: 'Rerank documents using Opta LMX.',
    safety: 'read',
  },
  {
    id: 'benchmark',
    title: 'Benchmark Suite',
    description: 'Generate benchmark suite artifacts and reports.',
    safety: 'dangerous',
  },
  {
    id: 'keychain.status',
    title: 'Keychain Status',
    description: 'Inspect keychain availability and stored provider keys.',
    safety: 'read',
  },
  {
    id: 'keychain.set-anthropic',
    title: 'Keychain Set Anthropic',
    description: 'Store Anthropic API key in system keychain.',
    safety: 'write',
  },
  {
    id: 'keychain.set-lmx',
    title: 'Keychain Set LMX',
    description: 'Store LMX API key in system keychain.',
    safety: 'write',
  },
  {
    id: 'keychain.delete-anthropic',
    title: 'Keychain Delete Anthropic',
    description: 'Delete Anthropic API key from system keychain.',
    safety: 'write',
  },
  {
    id: 'keychain.delete-lmx',
    title: 'Keychain Delete LMX',
    description: 'Delete LMX API key from system keychain.',
    safety: 'write',
  },
] as const satisfies readonly OperationDescriptor[];

export const OPERATION_TAXONOMY_BY_ID = Object.freeze(
  Object.fromEntries(OPERATION_TAXONOMY.map((operation) => [operation.id, operation])) as Record<
    OperationId,
    OperationDescriptor
  >
);

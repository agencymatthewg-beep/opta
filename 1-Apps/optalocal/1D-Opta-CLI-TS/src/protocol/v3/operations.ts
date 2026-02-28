import { z } from 'zod';

export const OPERATION_IDS = [
  'doctor',
  'env.list',
  'env.show',
  'env.save',
  'env.use',
  'env.delete',
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


import { z } from 'zod';
import {
  BackgroundSignalSchema,
  ClientSubmitTurnSchema,
  CreateSessionRequestSchema,
  PermissionDecisionSchema,
} from './types.js';

export const SessionParamsSchema = z.object({
  sessionId: z.string().min(1),
});

export const PermissionParamsSchema = z.object({
  sessionId: z.string().min(1),
  requestId: z.string().min(1),
});

export const EventsQuerySchema = z.object({
  afterSeq: z.coerce.number().int().min(0).default(0),
});

export const BackgroundListQuerySchema = z.object({
  sessionId: z.string().min(1).optional(),
});

export const BackgroundStartHttpSchema = z.object({
  sessionId: z.string().min(1),
  command: z.string().min(1),
  label: z.string().min(1).optional(),
  cwd: z.string().min(1).optional(),
  timeoutMs: z.coerce.number().int().min(0).max(86_400_000).optional(),
});

export const BackgroundProcessParamsSchema = z.object({
  processId: z.string().min(1),
});

export const BackgroundStatusQuerySchema = z.object({
  sessionId: z.string().min(1).optional(),
});

export const BackgroundOutputQuerySchema = z.object({
  afterSeq: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(500).default(200),
  stream: z.enum(['stdout', 'stderr', 'both']).default('both'),
});

export const BackgroundKillHttpSchema = z.object({
  signal: BackgroundSignalSchema.optional(),
});

export const BridgeConnectHttpSchema = z.object({
  deviceId: z.string().min(1),
  sessionId: z.string().min(1).optional(),
  bridgeToken: z.string().min(1).optional(),
  force: z.boolean().optional(),
});

export const DeviceBootstrapHttpSchema = z.object({
  includeAccount: z.boolean().optional().default(true),
  includeConnection: z.boolean().optional().default(true),
  includeRuntime: z.boolean().optional().default(true),
});

export const DeviceExecuteHttpSchema = z.object({
  operationId: z.string().min(1),
  input: z.record(z.string(), z.unknown()).optional().default({}),
  confirmDangerous: z.boolean().optional(),
  bridgeMetadata: z
    .object({
      commandId: z.string().min(1).optional(),
      actor: z.string().min(1).optional(),
      issuedAt: z.string().min(1).optional(),
    })
    .optional(),
});

export const CreateSessionHttpSchema = CreateSessionRequestSchema;
export const SubmitTurnHttpSchema = ClientSubmitTurnSchema;
export const PermissionDecisionHttpSchema = PermissionDecisionSchema;

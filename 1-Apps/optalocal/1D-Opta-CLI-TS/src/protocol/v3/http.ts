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

export const CreateSessionHttpSchema = CreateSessionRequestSchema;
export const SubmitTurnHttpSchema = ClientSubmitTurnSchema;
export const PermissionDecisionHttpSchema = PermissionDecisionSchema;

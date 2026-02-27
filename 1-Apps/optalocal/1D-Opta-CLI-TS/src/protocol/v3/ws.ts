import { z } from 'zod';

export const WsHelloSchema = z.object({
  type: z.literal('hello'),
  clientId: z.string().min(1),
  sessionId: z.string().min(1),
  afterSeq: z.number().int().min(0).optional(),
});

export const WsTurnSubmitSchema = z.object({
  type: z.literal('turn.submit'),
  clientId: z.string().min(1),
  writerId: z.string().min(1),
  sessionId: z.string().min(1),
  content: z.string().min(1),
  mode: z.enum(['chat', 'do']).default('chat'),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const WsPermissionResolveSchema = z.object({
  type: z.literal('permission.resolve'),
  sessionId: z.string().min(1),
  requestId: z.string().min(1),
  decision: z.enum(['allow', 'deny']),
  decidedBy: z.string().min(1),
});

export const WsCancelSchema = z.object({
  type: z.literal('turn.cancel'),
  sessionId: z.string().min(1),
  turnId: z.string().optional(),
  writerId: z.string().optional(),
});

export const WsInboundSchema = z.discriminatedUnion('type', [
  WsHelloSchema,
  WsTurnSubmitSchema,
  WsPermissionResolveSchema,
  WsCancelSchema,
]);

export type WsInbound = z.infer<typeof WsInboundSchema>;

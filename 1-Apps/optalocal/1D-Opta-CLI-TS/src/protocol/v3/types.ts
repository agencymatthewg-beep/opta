import { z } from 'zod';

export const V3_VERSION = '3' as const;

export const SessionModeSchema = z.enum(['chat', 'do']);
export type SessionMode = z.infer<typeof SessionModeSchema>;

export const V3EventSchema = z.enum([
  'session.snapshot',
  'turn.queued',
  'turn.start',
  'turn.token',
  'turn.thinking',
  'tool.start',
  'tool.end',
  'permission.request',
  'permission.resolved',
  'turn.progress',
  'turn.done',
  'turn.error',
  'session.updated',
  'session.cancelled',
  'background.output',
  'background.status',
]);
export type V3Event = z.infer<typeof V3EventSchema>;

export interface V3Envelope<T extends V3Event = V3Event, P = unknown> {
  v: typeof V3_VERSION;
  event: T;
  daemonId: string;
  sessionId?: string;
  seq: number;
  ts: string;
  payload: P;
}

export const ClientSubmitTurnSchema = z.object({
  clientId: z.string().min(1),
  writerId: z.string().min(1),
  content: z.string().min(1),
  mode: SessionModeSchema,
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type ClientSubmitTurn = z.infer<typeof ClientSubmitTurnSchema>;

export const PermissionDecisionSchema = z.object({
  requestId: z.string().min(1),
  decision: z.enum(['allow', 'deny']),
  decidedBy: z.string().min(1),
});
export type PermissionDecision = z.infer<typeof PermissionDecisionSchema>;

export const CreateSessionRequestSchema = z.object({
  sessionId: z.string().optional(),
  model: z.string().optional(),
  title: z.string().optional(),
  messages: z.array(z.unknown()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type CreateSessionRequest = z.infer<typeof CreateSessionRequestSchema>;

export interface SessionSnapshot {
  sessionId: string;
  model: string;
  title?: string;
  createdAt: string;
  updatedAt: string;
  activeTurnId?: string;
  queuedTurns: number;
  toolCallCount: number;
  writerCount: number;
}

export interface TurnDonePayload {
  turnId: string;
  writerId: string;
  clientId: string;
  stats: {
    tokens: number;
    promptTokens: number;
    completionTokens: number;
    toolCalls: number;
    elapsed: number;
    speed: number;
    firstTokenLatencyMs: number | null;
  };
}

export const TurnErrorCodeSchema = z.enum([
  'no-model-loaded',
  'lmx-ws-closed',
  'lmx-timeout',
  'lmx-connection-refused',
  'storage-full',
]);
export type TurnErrorCode = z.infer<typeof TurnErrorCodeSchema>;

export interface TurnErrorPayload {
  turnId: string;
  writerId: string;
  clientId: string;
  message: string;
  code?: TurnErrorCode;
}

export const BackgroundStreamSchema = z.enum(['stdout', 'stderr']);
export type BackgroundStream = z.infer<typeof BackgroundStreamSchema>;

export const BackgroundProcessStateSchema = z.enum([
  'running',
  'completed',
  'failed',
  'killed',
  'timeout',
]);
export type BackgroundProcessState = z.infer<typeof BackgroundProcessStateSchema>;

export const BackgroundSignalSchema = z.enum(['SIGTERM', 'SIGKILL', 'SIGINT']);
export type BackgroundSignal = z.infer<typeof BackgroundSignalSchema>;

export interface BackgroundProcessSnapshot {
  processId: string;
  sessionId: string;
  pid: number;
  command: string;
  label?: string;
  cwd: string;
  state: BackgroundProcessState;
  exitCode: number | null;
  startedAt: string;
  endedAt: string | null;
  runtimeMs: number;
  timeoutMs: number;
}

export interface BackgroundOutputChunk {
  seq: number;
  ts: string;
  stream: BackgroundStream;
  text: string;
}

export interface BackgroundOutputEventPayload extends BackgroundOutputChunk {
  processId: string;
  sessionId: string;
  pid: number;
}

export interface BackgroundStatusEventPayload {
  process: BackgroundProcessSnapshot;
  reason:
    | 'started'
    | 'running'
    | 'completed'
    | 'failed'
    | 'killed'
    | 'timeout'
    | 'spawn-error';
  previousState?: BackgroundProcessState;
  signal?: BackgroundSignal;
}

export interface BackgroundOutputSlice {
  process: BackgroundProcessSnapshot;
  chunks: BackgroundOutputChunk[];
  nextSeq: number;
  hasMore: boolean;
}

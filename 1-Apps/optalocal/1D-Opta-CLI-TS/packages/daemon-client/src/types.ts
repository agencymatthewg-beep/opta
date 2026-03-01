import type {
  BackgroundOutputSlice,
  BackgroundProcessSnapshot,
  BackgroundSignal,
  ClientSubmitTurn,
  CreateSessionRequest,
  OperationId,
  PermissionDecision,
  SessionSnapshot,
  V3Envelope,
  WsInbound,
} from '@opta/protocol-shared';

export type DaemonProtocol = 'http' | 'https';

export interface DaemonConnectionOptions {
  host: string;
  port: number;
  token: string;
  protocol?: DaemonProtocol;
}

export interface DaemonSessionDetail extends SessionSnapshot {
  messages: unknown[];
}

export interface DaemonHealthResponse {
  status: string;
  version?: string;
  daemonId?: string;
  runtime?: unknown;
}

export interface DaemonMetricsResponse {
  daemonId: string;
  runtime: unknown;
  ts: string;
}

export interface DaemonSubmitTurnResponse {
  turnId: string;
  queued: number;
}

export interface DaemonCancelResponse {
  cancelled: number;
}

export interface DaemonPermissionResponse {
  ok: boolean;
  conflict: boolean;
  message?: string;
}

export interface DaemonEventsResponse {
  events: V3Envelope[];
}

export interface DaemonBackgroundStartRequest {
  sessionId: string;
  command: string;
  label?: string;
  cwd?: string;
  timeoutMs?: number;
}

export interface DaemonBackgroundListResponse {
  processes: BackgroundProcessSnapshot[];
}

export interface DaemonBackgroundStatusResponse {
  process: BackgroundProcessSnapshot;
}

export type DaemonBackgroundOutputResponse = BackgroundOutputSlice;

export interface DaemonBackgroundOutputOptions {
  afterSeq?: number;
  limit?: number;
  stream?: 'stdout' | 'stderr' | 'both';
}

export interface DaemonBackgroundKillResponse {
  killed: boolean;
  process: BackgroundProcessSnapshot;
}

export interface DaemonLmxModelDetail {
  model_id: string;
  status: string;
  memory_bytes?: number;
  context_length?: number;
  loaded_at?: string;
  request_count?: number;
}

export interface DaemonLmxStatusResponse {
  status: string;
  version?: string;
  uptime_seconds?: number;
  models: DaemonLmxModelDetail[];
}

export interface DaemonLmxMemoryResponse {
  total_unified_memory_gb: number;
  used_gb: number;
  available_gb: number;
  models: Record<string, { memory_gb: number; loaded: boolean }>;
}

export interface DaemonLmxAvailableModel {
  model_id: string;
  size_bytes?: number;
  quantization?: string;
  modified_at?: string;
}

export interface DaemonLmxLoadOptions {
  backend?: string;
  autoDownload?: boolean;
}

export interface DaemonLmxDownloadResponse {
  download_id: string;
}

export type DaemonOperationSafetyClass = 'read' | 'write' | 'dangerous';
export type DaemonOperationId = OperationId;

export interface DaemonOperationDefinition {
  id: DaemonOperationId;
  title: string;
  description: string;
  safety: DaemonOperationSafetyClass;
  [key: string]: unknown;
}

export interface DaemonListOperationsResponse {
  operations: DaemonOperationDefinition[];
}

export type DaemonOperationPayload = Record<string, unknown>;
export type DaemonOperationExecuteBody<TPayload extends DaemonOperationPayload = DaemonOperationPayload> = {
  input?: TPayload;
  confirmDangerous?: boolean;
};
export type DaemonOperationRequestPayload<
  TPayload extends DaemonOperationPayload = DaemonOperationPayload,
> = TPayload | DaemonOperationExecuteBody<TPayload>;

export interface DaemonOperationError {
  code: string;
  message: string;
  details?: unknown;
}

export type DaemonRunOperationResponse<TResult = unknown> =
  | {
      ok: true;
      id: DaemonOperationId;
      safety: DaemonOperationSafetyClass;
      result: TResult;
    }
  | {
      ok: false;
      id: DaemonOperationId;
      safety: DaemonOperationSafetyClass;
      error: DaemonOperationError;
    };

export interface DaemonHttpApi {
  health(): Promise<DaemonHealthResponse>;
  metrics(): Promise<DaemonMetricsResponse>;
  createSession(req: CreateSessionRequest): Promise<SessionSnapshot>;
  getSession(sessionId: string): Promise<DaemonSessionDetail>;
  submitTurn(sessionId: string, payload: ClientSubmitTurn): Promise<DaemonSubmitTurnResponse>;
  cancel(
    sessionId: string,
    payload?: { turnId?: string; writerId?: string }
  ): Promise<DaemonCancelResponse>;
  resolvePermission(
    sessionId: string,
    payload: PermissionDecision
  ): Promise<DaemonPermissionResponse>;
  events(sessionId: string, afterSeq?: number): Promise<DaemonEventsResponse>;
  listOperations(): Promise<DaemonListOperationsResponse>;
  runOperation<TPayload extends DaemonOperationPayload = DaemonOperationPayload, TResult = unknown>(
    id: string,
    payload?: DaemonOperationRequestPayload<TPayload>
  ): Promise<DaemonRunOperationResponse<TResult>>;
  listBackground(sessionId?: string): Promise<DaemonBackgroundListResponse>;
  startBackground(payload: DaemonBackgroundStartRequest): Promise<DaemonBackgroundStatusResponse>;
  backgroundStatus(processId: string, sessionId?: string): Promise<DaemonBackgroundStatusResponse>;
  backgroundOutput(
    processId: string,
    options?: DaemonBackgroundOutputOptions
  ): Promise<DaemonBackgroundOutputResponse>;
  killBackground(
    processId: string,
    signal?: BackgroundSignal
  ): Promise<DaemonBackgroundKillResponse>;
  lmxStatus(): Promise<DaemonLmxStatusResponse>;
  lmxModels(): Promise<{ models: DaemonLmxModelDetail[] }>;
  lmxMemory(): Promise<DaemonLmxMemoryResponse>;
  lmxAvailable(): Promise<DaemonLmxAvailableModel[]>;
  lmxLoad(modelId: string, opts?: DaemonLmxLoadOptions): Promise<unknown>;
  lmxUnload(modelId: string): Promise<unknown>;
  lmxDelete(modelId: string): Promise<unknown>;
  lmxDownload(repoId: string): Promise<DaemonLmxDownloadResponse>;
}

export interface DaemonWsConnectOptions {
  sessionId: string;
  afterSeq?: number;
  includeTokenInQuery?: boolean;
}

export type DaemonWsServerMessage =
  | V3Envelope
  | { type: 'ack'; action?: string; [key: string]: unknown }
  | { error: string; [key: string]: unknown };

export interface DaemonWsHandlers {
  onOpen?: () => void;
  onClose?: (code: number, reason: string) => void;
  onError?: (err: Error) => void;
  onEvent?: (event: V3Envelope) => void;
  onMessage?: (message: DaemonWsServerMessage) => void;
}

export type DaemonWsMessage = WsInbound;
export type DaemonWsHelloMessage = Extract<WsInbound, { type: 'hello' }>;
export type DaemonWsSubmitTurnMessage = Extract<WsInbound, { type: 'turn.submit' }>;
export type DaemonWsResolvePermissionMessage = Extract<WsInbound, { type: 'permission.resolve' }>;
export type DaemonWsCancelMessage = Extract<WsInbound, { type: 'turn.cancel' }>;

export type DaemonWsHelloPayload = Omit<DaemonWsHelloMessage, 'type'>;
export type DaemonWsSubmitTurnPayload = Omit<DaemonWsSubmitTurnMessage, 'type'>;
export type DaemonWsResolvePermissionPayload = Omit<DaemonWsResolvePermissionMessage, 'type'>;
export type DaemonWsCancelPayload = Omit<DaemonWsCancelMessage, 'type'>;

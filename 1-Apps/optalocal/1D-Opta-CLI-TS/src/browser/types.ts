export type BrowserMode = 'isolated' | 'attach';

export type BrowserSessionStatus = 'open' | 'closed';

export type BrowserRuntimeState = 'playwright' | 'unavailable';

export type BrowserActionType =
  | 'openSession'
  | 'closeSession'
  | 'navigate'
  | 'click'
  | 'type'
  | 'snapshot'
  | 'screenshot';

export interface BrowserAction {
  id: string;
  sessionId: string;
  type: BrowserActionType;
  createdAt: string;
  input: Record<string, unknown>;
}

export interface BrowserActionError {
  code: string;
  message: string;
  retryable?: boolean;
  retryCategory?: BrowserRetryCategory;
  retryHint?: string;
}

export type BrowserRetryCategory =
  | 'policy'
  | 'runtime-unavailable'
  | 'session-state'
  | 'invalid-input'
  | 'selector'
  | 'timeout'
  | 'network'
  | 'transient'
  | 'unknown';

export interface BrowserActionResult<T = undefined> {
  ok: boolean;
  action: BrowserAction;
  data?: T;
  error?: BrowserActionError;
}

export interface BrowserSession {
  id: string;
  runId?: string;
  mode: BrowserMode;
  status: BrowserSessionStatus;
  runtime: BrowserRuntimeState;
  createdAt: string;
  updatedAt: string;
  artifactsDir: string;
  profileDir?: string;
  currentUrl?: string;
  wsEndpoint?: string;
  lastError?: BrowserActionError;
}

export interface BrowserOpenSessionInput {
  sessionId?: string;
  runId?: string;
  mode?: BrowserMode;
  wsEndpoint?: string;
  headless?: boolean;
  profileDir?: string;
}

export interface BrowserNavigateInput {
  url: string;
  timeoutMs?: number;
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' | 'commit';
}

export interface BrowserClickInput {
  selector: string;
  timeoutMs?: number;
}

export interface BrowserTypeInput {
  selector: string;
  text: string;
  timeoutMs?: number;
}

export interface BrowserScreenshotInput {
  fullPage?: boolean;
  type?: 'png' | 'jpeg';
  quality?: number;
}

export type BrowserArtifactKind = 'metadata' | 'snapshot' | 'screenshot';

export interface BrowserArtifactMetadata {
  id: string;
  sessionId: string;
  actionId: string;
  kind: BrowserArtifactKind;
  createdAt: string;
  relativePath: string;
  absolutePath: string;
  mimeType: string;
  sizeBytes: number;
}

export interface BrowserActionRecord {
  action: BrowserAction;
  ok: boolean;
  error?: BrowserActionError;
  artifactIds: string[];
}

export interface BrowserSessionStepRecord {
  sequence: number;
  sessionId: string;
  runId?: string;
  actionId: string;
  actionType: BrowserActionType;
  timestamp: string;
  ok: boolean;
  error?: BrowserActionError;
  artifactIds: string[];
  artifactPaths: string[];
}

export interface BrowserSessionRecordingEntry {
  sequence: number;
  sessionId: string;
  runId?: string;
  actionId: string;
  actionType: BrowserActionType;
  timestamp: string;
  ok: boolean;
  error?: BrowserActionError;
  artifactIds: string[];
  artifactPaths: string[];
}

export interface BrowserSessionRecordingIndex {
  schemaVersion: 1;
  sessionId: string;
  runId?: string;
  createdAt: string;
  updatedAt: string;
  recordings: BrowserSessionRecordingEntry[];
}

export interface BrowserVisualDiffManifestEntry {
  schemaVersion: 1;
  sessionId: string;
  runId?: string;
  sequence: number;
  actionId: string;
  actionType: BrowserActionType;
  timestamp: string;
  status: 'pending';
  artifactIds: string[];
  artifactPaths: string[];
}

export type BrowserVisualDiffResultStatus = 'changed' | 'unchanged' | 'missing';
export type BrowserVisualDiffSeverity = 'low' | 'medium' | 'high';
export type BrowserVisualDiffRegressionSignal = 'none' | 'investigate' | 'regression';

export interface BrowserVisualDiffResultEntry {
  schemaVersion: 1;
  sessionId: string;
  runId?: string;
  index: number;
  fromSequence: number;
  fromActionId: string;
  fromActionType: BrowserActionType;
  toSequence: number;
  toActionId: string;
  toActionType: BrowserActionType;
  fromScreenshotPath?: string;
  toScreenshotPath?: string;
  status: BrowserVisualDiffResultStatus;
  changedByteRatio?: number;
  perceptualDiffScore?: number;
  severity?: BrowserVisualDiffSeverity;
  regressionScore?: number;
  regressionSignal?: BrowserVisualDiffRegressionSignal;
}

export interface BrowserSessionMetadata {
  schemaVersion: 1;
  sessionId: string;
  runId?: string;
  mode: BrowserMode;
  status: BrowserSessionStatus;
  runtime: BrowserRuntimeState;
  createdAt: string;
  updatedAt: string;
  currentUrl?: string;
  wsEndpoint?: string;
  profileDir?: string;
  lastError?: BrowserActionError;
  artifacts: BrowserArtifactMetadata[];
  actions: BrowserActionRecord[];
}

export interface BrowserSnapshotData {
  html: string;
  artifact: BrowserArtifactMetadata;
}

export interface BrowserScreenshotData {
  artifact: BrowserArtifactMetadata;
}

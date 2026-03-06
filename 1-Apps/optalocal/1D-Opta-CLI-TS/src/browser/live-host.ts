import {
  createServer as createHttpServer,
  type IncomingMessage,
  type Server as HttpServer,
  type ServerResponse,
} from 'node:http';
import { randomBytes } from 'node:crypto';
import { createServer as createNetServer } from 'node:net';
import { readFile } from 'node:fs/promises';
import type { OptaConfig } from '../core/config.js';
import { getSharedBrowserRuntimeDaemon, type BrowserRuntimeHealth } from './runtime-daemon.js';
import {
  capturePeekabooScreenPng,
  isPeekabooAvailable,
  peekabooClickLabel,
  peekabooPressKey,
  peekabooTypeText,
  redactPeekabooSensitiveText,
} from './peekaboo.js';

const LOCALHOST_BIND = '127.0.0.1';
const DEFAULT_PORT_RANGE_START = 46_000;
// macOS app name for the Playwright-launched Chromium browser.
// Peekaboo's --app flag captures from this app's window buffer regardless of focus.
const PLAYWRIGHT_BROWSER_APP_NAME = 'Chromium';
const DEFAULT_PORT_RANGE_END = 47_000;
const DEFAULT_REQUIRED_PORT_COUNT = 6;
const DEFAULT_MAX_SESSION_SLOTS = 5;
const MAX_REQUEST_BODY_BYTES = 16 * 1024;
const PEEKABOO_FRAME_CACHE_MS = 500;
const PEEKABOO_TELEMETRY_PREFIX = '[peekaboo.telemetry]';
const PEEKABOO_MAX_LOG_TEXT_CHARS = 600;
const LOOPBACK_HOSTS = new Set(['127.0.0.1', '::1', 'localhost']);

export interface BrowserLiveHostStartOptions {
  config: OptaConfig;
  cwd?: string;
  host?: string;
  portRangeStart?: number;
  portRangeEnd?: number;
  requiredPortCount?: number;
  maxSessionSlots?: number;
  includePeekabooScreen?: boolean;
}

export interface BrowserLiveHostScanResult {
  host: string;
  scannedCandidateCount: number;
  ports: number[];
}

export interface BrowserLiveHostSlotStatus {
  slotIndex: number;
  port: number;
  sessionId?: string;
  currentUrl?: string;
  updatedAt?: string;
}

export interface PeekabooActionMetricCounters {
  total: number;
  clickLabel: number;
  type: number;
  key: number;
}

export interface PeekabooTelemetryMetrics {
  queueDepth: number;
  maxQueueDepth: number;
  jobsEnqueued: number;
  jobsCompleted: number;
  jobsFailed: number;
  frameRequests: number;
  frameCacheHits: number;
  frameCaptureFailures: number;
  actionRequests: PeekabooActionMetricCounters;
  actionFailures: PeekabooActionMetricCounters;
  lastFailureAt?: string;
}

export interface BrowserLiveHostStatus {
  running: boolean;
  host: string;
  startedAt?: string;
  controlPort?: number;
  viewerAuthToken?: string;
  safePorts: number[];
  scannedCandidateCount: number;
  requiredPortCount: number;
  maxSessionSlots: number;
  includePeekabooScreen: boolean;
  screenActionsEnabled: boolean;
  openSessionCount: number;
  slots: BrowserLiveHostSlotStatus[];
  peekabooMetrics: PeekabooTelemetryMetrics;
}

interface BrowserLiveHostRuntime {
  host: string;
  cwd: string;
  config: OptaConfig;
  startedAt: string;
  requiredPortCount: number;
  maxSessionSlots: number;
  includePeekabooScreen: boolean;
  safePorts: number[];
  scannedCandidateCount: number;
  controlPort: number;
  slotPorts: number[];
  controlServer: HttpServer;
  slotServers: HttpServer[];
  screenAuthToken?: string;
  peekabooJobChain: Promise<void>;
  peekabooMetrics: PeekabooTelemetryMetrics;
  peekabooFrameCache?: {
    capturedAtMs: number;
    image: Buffer;
  };
}

interface ScreenActionBody {
  label?: string;
  text?: string;
  key?: string;
}

type ScreenActionName = 'click-label' | 'type' | 'key';

interface PeekabooJobTelemetry {
  job: string;
  category: 'action' | 'frame';
  action?: ScreenActionName;
  context?: Record<string, unknown>;
}

let sharedLiveHost: BrowserLiveHostRuntime | null = null;
let liveHostLifecycleLock: Promise<void> = Promise.resolve();

async function withLiveHostLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = liveHostLifecycleLock.then(fn, fn);
  liveHostLifecycleLock = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

function toInt(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.floor(parsed);
}

function toSafeString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

function createActionCounters(): PeekabooActionMetricCounters {
  return {
    total: 0,
    clickLabel: 0,
    type: 0,
    key: 0,
  };
}

function createPeekabooMetrics(): PeekabooTelemetryMetrics {
  return {
    queueDepth: 0,
    maxQueueDepth: 0,
    jobsEnqueued: 0,
    jobsCompleted: 0,
    jobsFailed: 0,
    frameRequests: 0,
    frameCacheHits: 0,
    frameCaptureFailures: 0,
    actionRequests: createActionCounters(),
    actionFailures: createActionCounters(),
  };
}

function clonePeekabooMetrics(metrics: PeekabooTelemetryMetrics): PeekabooTelemetryMetrics {
  return {
    queueDepth: metrics.queueDepth,
    maxQueueDepth: metrics.maxQueueDepth,
    jobsEnqueued: metrics.jobsEnqueued,
    jobsCompleted: metrics.jobsCompleted,
    jobsFailed: metrics.jobsFailed,
    frameRequests: metrics.frameRequests,
    frameCacheHits: metrics.frameCacheHits,
    frameCaptureFailures: metrics.frameCaptureFailures,
    actionRequests: { ...metrics.actionRequests },
    actionFailures: { ...metrics.actionFailures },
    lastFailureAt: metrics.lastFailureAt,
  };
}

function counterKeyForAction(action: ScreenActionName): keyof Omit<PeekabooActionMetricCounters, 'total'> {
  if (action === 'click-label') return 'clickLabel';
  return action;
}

function incrementActionCounter(counters: PeekabooActionMetricCounters, action: ScreenActionName): void {
  counters.total += 1;
  counters[counterKeyForAction(action)] += 1;
}

function sanitizeTelemetryText(value: string): string {
  const redacted = redactPeekabooSensitiveText(value);
  if (redacted.length <= PEEKABOO_MAX_LOG_TEXT_CHARS) {
    return redacted;
  }
  return `${redacted.slice(0, PEEKABOO_MAX_LOG_TEXT_CHARS)}…`;
}

function sanitizeTelemetryValue(value: unknown, depth = 0): unknown {
  if (depth > 4) return '[TRUNCATED]';
  if (typeof value === 'string') return sanitizeTelemetryText(value);
  if (typeof value === 'number' || typeof value === 'boolean' || value === null || value === undefined) {
    return value;
  }
  if (value instanceof Error) {
    const maybeRecord = value as Error & Record<string, unknown>;
    return {
      name: value.name,
      message: sanitizeTelemetryText(value.message),
      stdout: sanitizeTelemetryValue(maybeRecord['stdout'], depth + 1),
      stderr: sanitizeTelemetryValue(maybeRecord['stderr'], depth + 1),
      exitCode: sanitizeTelemetryValue(maybeRecord['exitCode'], depth + 1),
      signal: sanitizeTelemetryValue(maybeRecord['signal'], depth + 1),
      timedOut: sanitizeTelemetryValue(maybeRecord['timedOut'], depth + 1),
    };
  }
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => sanitizeTelemetryValue(item, depth + 1));
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).slice(0, 30);
    const result: Record<string, unknown> = {};
    for (const [key, entryValue] of entries) {
      result[key] = sanitizeTelemetryValue(entryValue, depth + 1);
    }
    return result;
  }
  return sanitizeTelemetryText(String(value));
}

type PeekabooLogLevel = 'info' | 'warn' | 'error';

function logPeekabooTelemetry(
  level: PeekabooLogLevel,
  event: string,
  payload: Record<string, unknown>,
): void {
  const sanitizedPayload = sanitizeTelemetryValue(payload);
  const record = {
    ts: new Date().toISOString(),
    event,
    ...(typeof sanitizedPayload === 'object' && sanitizedPayload ? sanitizedPayload : {}),
  };
  const line = `${PEEKABOO_TELEMETRY_PREFIX} ${JSON.stringify(record)}`;
  if (level === 'error') {
    console.error(line);
    return;
  }
  if (level === 'warn') {
    console.warn(line);
    return;
  }
  console.info(line);
}

function htmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizePortRange(
  startRaw: number | undefined,
  endRaw: number | undefined,
): { start: number; end: number } {
  const start = toInt(startRaw, DEFAULT_PORT_RANGE_START);
  const end = toInt(endRaw, DEFAULT_PORT_RANGE_END);
  const normalizedStart = Math.max(1_024, Math.min(start, end));
  const normalizedEnd = Math.max(normalizedStart, Math.max(start, end));
  return { start: normalizedStart, end: normalizedEnd };
}

function normalizeRequiredPortCount(value: number | undefined): number {
  const parsed = toInt(value, DEFAULT_REQUIRED_PORT_COUNT);
  return Math.max(2, Math.min(parsed, 20));
}

function normalizeMaxSessionSlots(value: number | undefined): number {
  const parsed = toInt(value, DEFAULT_MAX_SESSION_SLOTS);
  return Math.max(1, Math.min(parsed, 5));
}

function isLoopbackHost(host: string): boolean {
  return LOOPBACK_HOSTS.has(host.trim().toLowerCase());
}

function areScreenActionsEnabled(config: OptaConfig): boolean {
  return config.computerControl.foreground.enabled && config.computerControl.foreground.allowScreenActions;
}

function requestUrl(req: IncomingMessage): URL {
  return new URL(req.url ?? '/', 'http://localhost');
}

function urlPath(req: IncomingMessage): string {
  return requestUrl(req).pathname;
}

function hasJsonContentType(req: IncomingMessage): boolean {
  const raw = getHeaderString(req, 'content-type');
  if (!raw) return false;
  return raw.toLowerCase().startsWith('application/json');
}

function getHeaderString(
  req: IncomingMessage,
  headerName: 'origin' | 'referer' | 'x-opta-screen-token' | 'content-type',
): string | undefined {
  const value = req.headers[headerName];
  if (Array.isArray(value)) return value[0];
  return value;
}

function assertLoopbackOriginHeaders(req: IncomingMessage): void {
  for (const headerName of ['origin', 'referer'] as const) {
    const rawHeader = getHeaderString(req, headerName);
    if (!rawHeader) continue;
    try {
      const parsed = new URL(rawHeader);
      if (!isLoopbackHost(parsed.hostname)) {
        throw new HttpError(403, `${headerName} host must be loopback for screen control endpoints.`);
      }
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError(403, `Invalid ${headerName} header.`);
    }
  }
}

function readScreenAuthToken(req: IncomingMessage): string | undefined {
  const queryToken = requestUrl(req).searchParams.get('token');
  if (queryToken) return queryToken;
  const headerToken = getHeaderString(req, 'x-opta-screen-token');
  return headerToken?.trim();
}

function assertScreenAuth(runtime: BrowserLiveHostRuntime, req: IncomingMessage): void {
  if (!runtime.includePeekabooScreen || !runtime.screenAuthToken) {
    throw new HttpError(404, 'Peekaboo screen mode is disabled.');
  }
  assertLoopbackOriginHeaders(req);

  const providedToken = readScreenAuthToken(req);
  if (!providedToken) {
    throw new HttpError(401, 'Missing screen auth token.');
  }
  if (providedToken !== runtime.screenAuthToken) {
    throw new HttpError(403, 'Invalid screen auth token.');
  }
}

function assertViewerAuth(runtime: BrowserLiveHostRuntime, req: IncomingMessage): void {
  if (!runtime.screenAuthToken) {
    throw new HttpError(503, 'Live host auth token is unavailable.');
  }
  assertLoopbackOriginHeaders(req);
  const providedToken = readScreenAuthToken(req);
  if (!providedToken) {
    throw new HttpError(401, 'Missing live host auth token.');
  }
  if (providedToken !== runtime.screenAuthToken) {
    throw new HttpError(403, 'Invalid live host auth token.');
  }
}

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  if (!hasJsonContentType(req)) {
    throw new HttpError(415, 'Expected application/json content type.');
  }

  const chunks: Uint8Array[] = [];
  let totalSize = 0;

  for await (const chunk of req) {
    const asChunk = chunk instanceof Uint8Array
      ? chunk
      : typeof chunk === 'string'
        ? Buffer.from(chunk)
        : Buffer.from(String(chunk));
    totalSize += asChunk.byteLength;
    if (totalSize > MAX_REQUEST_BODY_BYTES) {
      throw new HttpError(413, `Request body exceeded ${MAX_REQUEST_BODY_BYTES} bytes.`);
    }
    chunks.push(asChunk);
  }

  if (chunks.length === 0) return {};

  const text = Buffer.concat(chunks).toString('utf8').trim();
  if (!text) return {};

  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new HttpError(400, 'Invalid JSON body.');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new HttpError(400, 'Expected a JSON object body.');
  }
  return parsed as Record<string, unknown>;
}

function writeJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  const body = JSON.stringify(payload, null, 2);
  res.statusCode = statusCode;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(body);
}

function writeHtml(res: ServerResponse, html: string): void {
  res.statusCode = 200;
  res.setHeader('content-type', 'text/html; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(html);
}

function writeText(res: ServerResponse, statusCode: number, text: string): void {
  res.statusCode = statusCode;
  res.setHeader('content-type', 'text/plain; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(text);
}

function daemonOptionsFromConfig(
  config: OptaConfig,
  cwd: string,
  minMaxSessions: number,
): Parameters<typeof getSharedBrowserRuntimeDaemon>[0] {
  return {
    cwd,
    maxSessions: Math.max(config.browser.runtime.maxSessions, minMaxSessions),
    persistSessions: config.browser.runtime.persistSessions,
    persistProfileContinuity: config.browser.runtime.persistProfileContinuity,
    profileRetentionPolicy: {
      retentionDays: config.browser.runtime.profileRetentionDays,
      maxPersistedProfiles: config.browser.runtime.maxPersistedProfiles,
    },
    profilePruneIntervalMs: config.browser.runtime.profilePruneIntervalHours * 60 * 60 * 1_000,
    artifactPrune: {
      enabled: config.browser.artifacts.retention.enabled,
      policy: {
        retentionDays: config.browser.artifacts.retention.retentionDays,
        maxPersistedSessions: config.browser.artifacts.retention.maxPersistedSessions,
      },
      intervalMs: config.browser.artifacts.retention.pruneIntervalHours * 60 * 60 * 1_000,
    },
    runCorpusRefresh: {
      enabled: config.browser.runtime.runCorpus.enabled,
      windowHours: config.browser.runtime.runCorpus.windowHours,
    },
  };
}

async function getDaemon(runtime: BrowserLiveHostRuntime) {
  const daemon = await getSharedBrowserRuntimeDaemon(
    daemonOptionsFromConfig(runtime.config, runtime.cwd, runtime.maxSessionSlots),
  );
  await daemon.start();
  return daemon;
}

function sortedOpenSessions(health: BrowserRuntimeHealth): BrowserRuntimeHealth['sessions'] {
  return [...health.sessions]
    .filter((session) => session.status === 'open')
    .sort((left, right) => left.sessionId.localeCompare(right.sessionId));
}

function resolveSlots(runtime: BrowserLiveHostRuntime, health: BrowserRuntimeHealth): BrowserLiveHostSlotStatus[] {
  const sessions = sortedOpenSessions(health);

  return runtime.slotPorts.map((port, slotIndex) => {
    const session = sessions[slotIndex];
    return {
      slotIndex,
      port,
      sessionId: session?.sessionId,
      currentUrl: session?.currentUrl,
      updatedAt: session?.updatedAt,
    };
  });
}

async function buildRuntimeStatus(runtime: BrowserLiveHostRuntime): Promise<BrowserLiveHostStatus> {
  const daemon = await getDaemon(runtime);
  const health = daemon.health();

  return {
    running: true,
    host: runtime.host,
    startedAt: runtime.startedAt,
    controlPort: runtime.controlPort,
    viewerAuthToken: runtime.screenAuthToken,
    safePorts: [...runtime.safePorts],
    scannedCandidateCount: runtime.scannedCandidateCount,
    requiredPortCount: runtime.requiredPortCount,
    maxSessionSlots: runtime.maxSessionSlots,
    includePeekabooScreen: runtime.includePeekabooScreen,
    screenActionsEnabled: areScreenActionsEnabled(runtime.config),
    openSessionCount: sortedOpenSessions(health).length,
    slots: resolveSlots(runtime, health),
    peekabooMetrics: clonePeekabooMetrics(runtime.peekabooMetrics),
  };
}

async function closeServer(server: HttpServer): Promise<void> {
  await new Promise<void>((resolve) => {
    const closable = server as HttpServer & {
      closeIdleConnections: () => void;
      closeAllConnections: () => void;
    };

    const timer = setTimeout(() => {
      closable.closeIdleConnections();
      closable.closeAllConnections();
      resolve();
    }, 1_500);

    server.close(() => {
      clearTimeout(timer);
      resolve();
    });
  });
}

async function isPortAvailable(host: string, port: number): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const server = createNetServer();
    server.unref();
    server.once('error', () => resolve(false));
    server.listen(port, host, () => {
      server.close(() => resolve(true));
    });
  });
}

export async function scanSafeLocalhostPorts(
  requiredPortCount: number,
  options: {
    host?: string;
    startPort?: number;
    endPort?: number;
  } = {},
): Promise<BrowserLiveHostScanResult> {
  const host = options.host ?? LOCALHOST_BIND;
  const { start, end } = normalizePortRange(options.startPort, options.endPort);
  const needed = normalizeRequiredPortCount(requiredPortCount);

  const ports: number[] = [];
  let scannedCandidateCount = 0;

  for (let port = start; port <= end; port += 1) {
    scannedCandidateCount += 1;
    if (await isPortAvailable(host, port)) {
      ports.push(port);
      if (ports.length >= needed) break;
    }
  }

  if (ports.length < needed) {
    throw new Error(
      `Unable to locate ${needed} safe localhost ports in range ${start}-${end}. ` +
      `Found ${ports.length} after scanning ${scannedCandidateCount} candidates.`,
    );
  }

  return {
    host,
    scannedCandidateCount,
    ports,
  };
}

function renderSlotHtml(runtime: BrowserLiveHostRuntime, slotIndex: number): string {
  const slotNumber = slotIndex + 1;
  const title = `Opta Browser Live Slot ${slotNumber}`;
  const viewerToken = runtime.screenAuthToken ?? '';
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
    body { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; margin: 1rem; background: #0b1220; color: #e2e8f0; }
    .meta { margin-bottom: 0.75rem; color: #9aa9c7; }
    .frame { width: 100%; max-width: 1200px; border: 1px solid #334155; border-radius: 8px; background: #020617; }
    .hint { margin-top: 0.5rem; color: #7c8ba1; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <div class="meta" id="meta">Loading session status...</div>
  <img class="frame" id="frame" src="/frame?token=${encodeURIComponent(viewerToken)}&ts=0" alt="Live browser frame slot ${slotNumber}" />
  <div class="hint">Auto-refresh every 800ms.</div>
  <script>
    const frame = document.getElementById('frame');
    const meta = document.getElementById('meta');
    const viewerToken = ${JSON.stringify(viewerToken)};
    async function refresh() {
      frame.src = '/frame?token=' + encodeURIComponent(viewerToken) + '&ts=' + Date.now();
      try {
        const res = await fetch('/api/status?token=' + encodeURIComponent(viewerToken), { cache: 'no-store' });
        const data = await res.json();
        if (data.session_id) {
          meta.textContent = 'session=' + data.session_id + ' url=' + (data.current_url || '(none)') + ' updated=' + (data.updated_at || '-');
        } else {
          meta.textContent = 'No active Opta browser session currently mapped to this slot.';
        }
      } catch (err) {
        meta.textContent = 'Slot status unavailable: ' + (err && err.message ? err.message : String(err));
      }
    }
    refresh();
    setInterval(refresh, 800);
  </script>
</body>
</html>`;
}

function renderControlHtml(status: BrowserLiveHostStatus): string {
  const controlUrl = status.controlPort
    ? `http://${status.host}:${status.controlPort}`
    : '(not running)';
  const slotRows = status.slots.map((slot) => {
    const slotUrl = `http://${status.host}:${slot.port}`;
    const session = slot.sessionId ? htmlEscape(slot.sessionId) : '<span style="color:#94a3b8">idle</span>';
    const currentUrl = slot.currentUrl ? htmlEscape(slot.currentUrl) : '<span style="color:#94a3b8">(none)</span>';
    return `<tr>
      <td>${slot.slotIndex + 1}</td>
      <td><a href="${slotUrl}" target="_blank" rel="noreferrer">${slot.port}</a></td>
      <td>${session}</td>
      <td>${currentUrl}</td>
    </tr>`;
  }).join('\n');

  const screenBlock = status.includePeekabooScreen
    ? `<p><strong>Peekaboo screen stream:</strong> <a href="/screen" target="_blank" rel="noreferrer">${controlUrl}/screen</a> (token required for API calls; actions=${status.screenActionsEnabled ? 'enabled' : 'disabled'})</p>`
    : `<p style="color:#94a3b8">Peekaboo screen stream disabled.</p>`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Opta Browser Live Host</title>
  <style>
    body { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; margin: 1rem; background: #020617; color: #e2e8f0; }
    a { color: #60a5fa; }
    table { border-collapse: collapse; width: 100%; max-width: 1400px; }
    th, td { border: 1px solid #334155; padding: 0.5rem; text-align: left; }
    th { background: #111827; }
    .meta { color: #94a3b8; margin-bottom: 0.75rem; }
  </style>
</head>
<body>
  <h1>Opta Browser Live Host</h1>
  <div class="meta">control=${controlUrl} safe_ports=${status.safePorts.join(',')} scanned_candidates=${status.scannedCandidateCount}</div>
  <div class="meta">open_sessions=${status.openSessionCount} max_slots=${status.maxSessionSlots} started_at=${htmlEscape(status.startedAt ?? '-')} screen_actions=${String(status.screenActionsEnabled)}</div>
  <table>
    <thead>
      <tr><th>Slot</th><th>Viewer Port</th><th>Session</th><th>Current URL</th></tr>
    </thead>
    <tbody>
      ${slotRows}
    </tbody>
  </table>
  ${screenBlock}
  <p><a href="/api/status" target="_blank" rel="noreferrer">JSON status</a></p>
</body>
</html>`;
}

function renderPeekabooScreenHtml(screenAuthToken: string, actionsEnabled: boolean): string {
  const escapedToken = htmlEscape(screenAuthToken);
  const actionDisabledAttr = actionsEnabled ? '' : ' disabled';
  const actionModeLine = actionsEnabled
    ? '<p>Screen actions are enabled.</p>'
    : '<p style="color:#fca5a5">Screen actions are disabled by computerControl.foreground settings. Streaming remains available.</p>';
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Opta CEO Peekaboo Screen</title>
  <style>
    body { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; margin: 1rem; background: #020617; color: #e2e8f0; }
    .frame { width: 100%; max-width: 1400px; border: 1px solid #334155; border-radius: 8px; background: #000; }
    .row { display: flex; gap: 0.5rem; margin-top: 0.75rem; flex-wrap: wrap; }
    input { min-width: 260px; background: #0f172a; color: #e2e8f0; border: 1px solid #334155; padding: 0.45rem; }
    button { background: #1d4ed8; color: white; border: 0; padding: 0.5rem 0.75rem; cursor: pointer; }
    .status { color: #93c5fd; margin-top: 0.5rem; white-space: pre-wrap; }
  </style>
</head>
<body>
  <h1>Opta CEO Peekaboo Screen Stream</h1>
  <p>Auto-refresh every 800ms. This stream is local-only on 127.0.0.1.</p>
  ${actionModeLine}
  <img class="frame" id="frame" src="/api/screen/frame?token=${escapedToken}&ts=0" alt="Peekaboo screen stream" />
  <div class="row">
    <input id="labelInput" placeholder="Click label (e.g. Submit)"${actionDisabledAttr} />
    <button onclick="act('/api/screen/click-label', { label: v('labelInput') })"${actionDisabledAttr}>Click Label</button>
  </div>
  <div class="row">
    <input id="typeInput" placeholder="Type text into focused element"${actionDisabledAttr} />
    <button onclick="act('/api/screen/type', { text: v('typeInput') })"${actionDisabledAttr}>Type</button>
  </div>
  <div class="row">
    <input id="keyInput" placeholder="Press key chord (e.g. cmd+s)"${actionDisabledAttr} />
    <button onclick="act('/api/screen/key', { key: v('keyInput') })"${actionDisabledAttr}>Press Key</button>
  </div>
  <div class="status" id="status">ready</div>
<script>
    const frame = document.getElementById('frame');
    const status = document.getElementById('status');
    const screenToken = ${JSON.stringify(screenAuthToken)};
    const actionsEnabled = ${JSON.stringify(actionsEnabled)};
    const v = (id) => document.getElementById(id).value || '';
    async function act(path, body) {
      if (!actionsEnabled) {
        status.textContent = 'Screen actions are disabled by config.';
        return;
      }
      try {
        const res = await fetch(path, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-opta-screen-token': screenToken,
          },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        status.textContent = JSON.stringify(data, null, 2);
      } catch (err) {
        status.textContent = String(err);
      }
    }
    function refresh() {
      frame.src = '/api/screen/frame?token=' + encodeURIComponent(screenToken) + '&ts=' + Date.now();
    }
    setInterval(refresh, 800);
  </script>
</body>
</html>`;
}

async function serveSlotFrame(
  runtime: BrowserLiveHostRuntime,
  slotIndex: number,
  res: ServerResponse,
): Promise<void> {
  const daemon = await getDaemon(runtime);
  const slots = resolveSlots(runtime, daemon.health());
  const slot = slots[slotIndex];

  if (!slot || !slot.sessionId) {
    writeText(res, 404, `No active browser session is mapped to slot ${slotIndex + 1}.`);
    return;
  }

  const screenshot = await daemon.screenshot(slot.sessionId, {
    type: 'jpeg',
    quality: 80,
  });

  if (!screenshot.ok || !screenshot.data) {
    writeText(
      res,
      502,
      screenshot.error?.message ?? `Failed to capture screenshot for session ${slot.sessionId}.`,
    );
    return;
  }

  const image = await readFile(screenshot.data.artifact.absolutePath);
  res.statusCode = 200;
  res.setHeader('content-type', screenshot.data.artifact.mimeType);
  res.setHeader('cache-control', 'no-store');
  res.end(image);
}

async function handleScreenAction(
  runtime: BrowserLiveHostRuntime,
  req: IncomingMessage,
  res: ServerResponse,
  action: ScreenActionName,
): Promise<void> {
  const startedAtMs = Date.now();
  incrementActionCounter(runtime.peekabooMetrics.actionRequests, action);

  try {
    const body = await readJsonBody(req) as ScreenActionBody;
    if (action === 'click-label') {
      const label = toSafeString(body.label).trim();
      if (!label) {
        throw new HttpError(422, 'label must be non-empty.');
      }
      await enqueuePeekabooJob(
        runtime,
        {
          job: 'screen.action.click-label',
          category: 'action',
          action,
          context: { labelLength: label.length },
        },
        () => peekabooClickLabel(label),
      );
      writeJson(res, 200, { ok: true, action, label });
      logPeekabooTelemetry('info', 'peekaboo.screen_action.succeeded', {
        action,
        durationMs: Date.now() - startedAtMs,
      });
      return;
    }

    if (action === 'type') {
      const text = toSafeString(body.text);
      if (!text.trim()) {
        throw new HttpError(422, 'text must be non-empty.');
      }
      await enqueuePeekabooJob(
        runtime,
        {
          job: 'screen.action.type',
          category: 'action',
          action,
          context: { chars: text.length },
        },
        () => peekabooTypeText(text),
      );
      writeJson(res, 200, { ok: true, action, chars: text.length });
      logPeekabooTelemetry('info', 'peekaboo.screen_action.succeeded', {
        action,
        durationMs: Date.now() - startedAtMs,
      });
      return;
    }

    const key = toSafeString(body.key).trim();
    if (!key) {
      throw new HttpError(422, 'key must be non-empty.');
    }
    await enqueuePeekabooJob(
      runtime,
      {
        job: 'screen.action.key',
        category: 'action',
        action,
        context: { keyLength: key.length },
      },
      () => peekabooPressKey(key),
    );
    writeJson(res, 200, { ok: true, action, key });
    logPeekabooTelemetry('info', 'peekaboo.screen_action.succeeded', {
      action,
      durationMs: Date.now() - startedAtMs,
    });
  } catch (error) {
    incrementActionCounter(runtime.peekabooMetrics.actionFailures, action);
    runtime.peekabooMetrics.lastFailureAt = new Date().toISOString();
    logPeekabooTelemetry(error instanceof HttpError ? 'warn' : 'error', 'peekaboo.screen_action.failed', {
      action,
      durationMs: Date.now() - startedAtMs,
      error,
    });
    throw error;
  }
}

async function enqueuePeekabooJob<T>(
  runtime: BrowserLiveHostRuntime,
  telemetry: PeekabooJobTelemetry,
  task: () => Promise<T>,
): Promise<T> {
  const metrics = runtime.peekabooMetrics;
  const enqueuedAtMs = Date.now();
  metrics.jobsEnqueued += 1;
  metrics.queueDepth += 1;
  metrics.maxQueueDepth = Math.max(metrics.maxQueueDepth, metrics.queueDepth);

  const queueDepthAtEnqueue = metrics.queueDepth;
  logPeekabooTelemetry(
    queueDepthAtEnqueue > 1 ? 'warn' : 'info',
    'peekaboo.queue.enqueued',
    {
      job: telemetry.job,
      category: telemetry.category,
      action: telemetry.action,
      queueDepth: queueDepthAtEnqueue,
      maxQueueDepth: metrics.maxQueueDepth,
      context: telemetry.context ?? {},
    },
  );

  const runTask = async (): Promise<T> => {
    const waitMs = Date.now() - enqueuedAtMs;
    const startedAtMs = Date.now();
    logPeekabooTelemetry('info', 'peekaboo.queue.started', {
      job: telemetry.job,
      category: telemetry.category,
      action: telemetry.action,
      queueDepth: metrics.queueDepth,
      waitMs,
    });

    try {
      const result = await task();
      metrics.jobsCompleted += 1;
      logPeekabooTelemetry('info', 'peekaboo.queue.completed', {
        job: telemetry.job,
        category: telemetry.category,
        action: telemetry.action,
        waitMs,
        durationMs: Date.now() - startedAtMs,
      });
      return result;
    } catch (error) {
      metrics.jobsFailed += 1;
      metrics.lastFailureAt = new Date().toISOString();
      logPeekabooTelemetry('error', 'peekaboo.queue.failed', {
        job: telemetry.job,
        category: telemetry.category,
        action: telemetry.action,
        waitMs,
        durationMs: Date.now() - startedAtMs,
        error,
      });
      throw error;
    } finally {
      metrics.queueDepth = Math.max(0, metrics.queueDepth - 1);
      logPeekabooTelemetry('info', 'peekaboo.queue.depth', {
        queueDepth: metrics.queueDepth,
        maxQueueDepth: metrics.maxQueueDepth,
      });
    }
  };

  const resultPromise = runtime.peekabooJobChain.then(runTask, runTask);
  runtime.peekabooJobChain = resultPromise.then(
    () => undefined,
    () => undefined,
  );
  return resultPromise;
}

async function getPeekabooFrame(runtime: BrowserLiveHostRuntime): Promise<Buffer> {
  runtime.peekabooMetrics.frameRequests += 1;
  const now = Date.now();
  const cached = runtime.peekabooFrameCache;
  if (cached && now - cached.capturedAtMs < PEEKABOO_FRAME_CACHE_MS) {
    runtime.peekabooMetrics.frameCacheHits += 1;
    logPeekabooTelemetry('info', 'peekaboo.frame.cache_hit', {
      ageMs: now - cached.capturedAtMs,
    });
    return cached.image;
  }

  // When foreground computer control is active the browser runs as a visible window.
  // Target it by name so Peekaboo always captures the browser regardless of user focus.
  const appName = runtime.config.computerControl.foreground.enabled
    ? PLAYWRIGHT_BROWSER_APP_NAME
    : undefined;

  try {
    const image = await enqueuePeekabooJob(
      runtime,
      {
        job: 'screen.frame.capture',
        category: 'frame',
        context: { appName: appName ?? 'all-windows' },
      },
      () => capturePeekabooScreenPng(appName),
    );
    runtime.peekabooFrameCache = {
      capturedAtMs: now,
      image,
    };
    return image;
  } catch (error) {
    runtime.peekabooMetrics.frameCaptureFailures += 1;
    runtime.peekabooMetrics.lastFailureAt = new Date().toISOString();
    logPeekabooTelemetry('error', 'peekaboo.frame.capture_failed', {
      appName: appName ?? 'all-windows',
      error,
    });
    throw error;
  }
}

function createSlotServer(runtime: BrowserLiveHostRuntime, slotIndex: number): HttpServer {
  return createHttpServer((req, res) => {
    void (async (): Promise<void> => {
      try {
        const path = urlPath(req);
        if (path === '/api/status') {
          assertViewerAuth(runtime, req);
          const daemon = await getDaemon(runtime);
          const slots = resolveSlots(runtime, daemon.health());
          const slot = slots[slotIndex];
          if (!slot) {
            writeJson(res, 404, { ok: false, error: `Slot ${slotIndex + 1} unavailable.` });
            return;
          }
          writeJson(res, 200, {
            ok: true,
            slot: slot.slotIndex + 1,
            port: slot.port,
            session_id: slot.sessionId ?? null,
            current_url: slot.currentUrl ?? null,
            updated_at: slot.updatedAt ?? null,
          });
          return;
        }

        if (path === '/frame') {
          assertViewerAuth(runtime, req);
          await serveSlotFrame(runtime, slotIndex, res);
          return;
        }

        writeHtml(res, renderSlotHtml(runtime, slotIndex));
      } catch (error) {
        if (error instanceof HttpError) {
          writeJson(res, error.statusCode, {
            ok: false,
            error: error.message,
          });
          return;
        }
        writeText(
          res,
          500,
          `Browser slot server error: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    })();
  });
}

function createControlServer(runtime: BrowserLiveHostRuntime): HttpServer {
  return createHttpServer((req, res) => {
    void (async (): Promise<void> => {
      let path = '/';
      try {
        path = urlPath(req);
        if (path === '/api/status') {
          writeJson(res, 200, await buildRuntimeStatus(runtime));
          return;
        }

        if (path === '/api/screen/frame') {
          assertScreenAuth(runtime, req);
          const image = await getPeekabooFrame(runtime);
          res.statusCode = 200;
          res.setHeader('content-type', 'image/png');
          res.setHeader('cache-control', 'no-store');
          res.end(image);
          return;
        }

        if (path === '/api/screen/click-label' || path === '/api/screen/type' || path === '/api/screen/key') {
          assertScreenAuth(runtime, req);
          if (req.method !== 'POST') {
            writeJson(res, 405, { ok: false, error: 'Use POST for screen actions.' });
            return;
          }
          if (!areScreenActionsEnabled(runtime.config)) {
            writeJson(res, 403, {
              ok: false,
              error: 'Screen actions are disabled by computerControl.foreground settings.',
            });
            return;
          }

          if (path.endsWith('/click-label')) {
            await handleScreenAction(runtime, req, res, 'click-label');
            return;
          }
          if (path.endsWith('/type')) {
            await handleScreenAction(runtime, req, res, 'type');
            return;
          }

          await handleScreenAction(runtime, req, res, 'key');
          return;
        }

        if (path === '/screen') {
          if (!runtime.includePeekabooScreen || !runtime.screenAuthToken) {
            writeText(res, 404, 'Peekaboo screen stream is disabled.');
            return;
          }
          writeHtml(res, renderPeekabooScreenHtml(runtime.screenAuthToken, areScreenActionsEnabled(runtime.config)));
          return;
        }

        writeHtml(res, renderControlHtml(await buildRuntimeStatus(runtime)));
      } catch (error) {
        if (error instanceof HttpError) {
          if (path.startsWith('/api/screen')) {
            logPeekabooTelemetry('warn', 'peekaboo.screen_request.http_error', {
              method: req.method ?? 'UNKNOWN',
              path,
              statusCode: error.statusCode,
              message: error.message,
            });
          }
          writeJson(res, error.statusCode, {
            ok: false,
            error: error.message,
          });
          return;
        }
        if (path.startsWith('/api/screen')) {
          logPeekabooTelemetry('error', 'peekaboo.screen_request.unhandled_error', {
            method: req.method ?? 'UNKNOWN',
            path,
            error,
          });
        }
        writeJson(res, 500, {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    })();
  });
}

async function listenServer(server: HttpServer, host: string, port: number): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.removeListener('error', reject);
      resolve();
    });
  });
}

function makeStoppedStatus(runtime?: BrowserLiveHostRuntime): BrowserLiveHostStatus {
  const metrics = runtime ? clonePeekabooMetrics(runtime.peekabooMetrics) : createPeekabooMetrics();
  metrics.queueDepth = 0;

  return {
    running: false,
    host: runtime?.host ?? LOCALHOST_BIND,
    viewerAuthToken: undefined,
    safePorts: runtime ? [...runtime.safePorts] : [],
    scannedCandidateCount: runtime?.scannedCandidateCount ?? 0,
    requiredPortCount: runtime?.requiredPortCount ?? DEFAULT_REQUIRED_PORT_COUNT,
    maxSessionSlots: runtime?.maxSessionSlots ?? DEFAULT_MAX_SESSION_SLOTS,
    includePeekabooScreen: runtime?.includePeekabooScreen ?? false,
    screenActionsEnabled: runtime ? areScreenActionsEnabled(runtime.config) : false,
    openSessionCount: 0,
    slots: runtime
      ? runtime.slotPorts.map((port, slotIndex) => ({
        slotIndex,
        port,
      }))
      : [],
    peekabooMetrics: metrics,
  };
}

export async function getBrowserLiveHostStatus(): Promise<BrowserLiveHostStatus> {
  return withLiveHostLock(async () => {
    if (!sharedLiveHost) return makeStoppedStatus();
    return buildRuntimeStatus(sharedLiveHost);
  });
}

async function stopBrowserLiveHostUnlocked(): Promise<BrowserLiveHostStatus> {
  if (!sharedLiveHost) return makeStoppedStatus();
  const runtime = sharedLiveHost;
  sharedLiveHost = null;

  await closeServer(runtime.controlServer).catch(() => {});
  for (const server of runtime.slotServers) {
    await closeServer(server).catch(() => {});
  }

  return makeStoppedStatus(runtime);
}

export async function stopBrowserLiveHost(): Promise<BrowserLiveHostStatus> {
  return withLiveHostLock(async () => stopBrowserLiveHostUnlocked());
}

export async function startBrowserLiveHost(
  options: BrowserLiveHostStartOptions,
): Promise<BrowserLiveHostStatus> {
  return withLiveHostLock(async () => {
    const host = options.host ?? LOCALHOST_BIND;
    if (!isLoopbackHost(host)) {
      throw new Error(`Browser live host must bind to loopback only. Received host="${host}".`);
    }
    const backgroundControl = options.config.computerControl.background;
    if (!backgroundControl.enabled) {
      throw new Error(
        'Background computer control is disabled. Enable computerControl.background.enabled to host localhost sessions.',
      );
    }
    if (!backgroundControl.allowBrowserSessionHosting) {
      throw new Error(
        'Browser session hosting is disabled. Enable computerControl.background.allowBrowserSessionHosting.',
      );
    }
    const cwd = options.cwd ?? process.cwd();
    const configuredMaxSessionSlots = normalizeMaxSessionSlots(backgroundControl.maxHostedBrowserSessions);
    const requestedMaxSessionSlots = options.maxSessionSlots === undefined
      ? configuredMaxSessionSlots
      : normalizeMaxSessionSlots(options.maxSessionSlots);
    if (requestedMaxSessionSlots > configuredMaxSessionSlots) {
      throw new Error(
        `Requested maxSessionSlots (${requestedMaxSessionSlots}) exceeds computerControl.background.maxHostedBrowserSessions (${configuredMaxSessionSlots}).`,
      );
    }
    const maxSessionSlots = requestedMaxSessionSlots;
    const requiredPortCount = Math.max(
      normalizeRequiredPortCount(options.requiredPortCount),
      maxSessionSlots + 1,
    );
    const includePeekabooScreen = options.includePeekabooScreen === true;
    if (!backgroundControl.allowScreenStreaming) {
      throw new Error(
        'Screen streaming is disabled. Enable computerControl.background.allowScreenStreaming.',
      );
    }
    if (includePeekabooScreen) {
      const available = await isPeekabooAvailable();
      if (!available) {
        throw new Error('Peekaboo is required for screen mode. Install with: brew install peekaboo');
      }
    }

    if (
      sharedLiveHost &&
      sharedLiveHost.cwd === cwd &&
      sharedLiveHost.host === host &&
      sharedLiveHost.maxSessionSlots === maxSessionSlots &&
      sharedLiveHost.requiredPortCount === requiredPortCount &&
      sharedLiveHost.includePeekabooScreen === includePeekabooScreen
    ) {
      return buildRuntimeStatus(sharedLiveHost);
    }

    if (sharedLiveHost) {
      await stopBrowserLiveHostUnlocked();
    }

    const { start: startPort, end: endPort } = normalizePortRange(
      options.portRangeStart,
      options.portRangeEnd,
    );
    const scan = await scanSafeLocalhostPorts(requiredPortCount, {
      host,
      startPort,
      endPort,
    });

    const controlPort = scan.ports[0];
    if (controlPort === undefined) {
      throw new Error('No control port was allocated by localhost scan.');
    }

    const slotPorts = scan.ports.slice(1, maxSessionSlots + 1);
    const runtime: BrowserLiveHostRuntime = {
      host,
      cwd,
      config: options.config,
      startedAt: new Date().toISOString(),
      requiredPortCount,
      maxSessionSlots,
      includePeekabooScreen,
      safePorts: scan.ports,
      scannedCandidateCount: scan.scannedCandidateCount,
      controlPort,
      slotPorts,
      controlServer: createHttpServer((_req, res) => {
        writeText(res, 503, "Browser live host is initializing.");
      }),
      slotServers: [],
      screenAuthToken: randomBytes(24).toString('hex'),
      peekabooJobChain: Promise.resolve(),
      peekabooMetrics: createPeekabooMetrics(),
    };

    runtime.controlServer = createControlServer(runtime);
    await listenServer(runtime.controlServer, host, controlPort);

    let startedStatus: BrowserLiveHostStatus;
    try {
      for (let index = 0; index < slotPorts.length; index += 1) {
        const port = slotPorts[index];
        if (port === undefined) continue;
        const slotServer = createSlotServer(runtime, index);
        await listenServer(slotServer, host, port);
        runtime.slotServers.push(slotServer);
      }
      startedStatus = await buildRuntimeStatus(runtime);
    } catch (error) {
      await closeServer(runtime.controlServer).catch(() => {});
      for (const server of runtime.slotServers) {
        await closeServer(server).catch(() => {});
      }
      throw error;
    }

    sharedLiveHost = runtime;
    return startedStatus;
  });
}

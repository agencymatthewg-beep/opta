import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import {
  appendBrowserVisualDiffResultEntry,
  appendBrowserVisualDiffManifestEntry,
  appendBrowserSessionStep,
  browserSessionArtifactsDir,
  writeBrowserArtifact,
  writeBrowserSessionMetadata,
  writeBrowserSessionRecordings,
} from './artifacts.js';
import type {
  BrowserAction,
  BrowserActionError,
  BrowserActionRecord,
  BrowserActionResult,
  BrowserArtifactMetadata,
  BrowserClickInput,
  BrowserNavigateInput,
  BrowserOpenSessionInput,
  BrowserScreenshotData,
  BrowserScreenshotInput,
  BrowserSession,
  BrowserSessionMetadata,
  BrowserSessionRecordingEntry,
  BrowserSessionRecordingIndex,
  BrowserSessionStepRecord,
  BrowserSnapshotData,
  BrowserTypeInput,
  BrowserVisualDiffRegressionSignal,
  BrowserVisualDiffSeverity,
} from './types.js';
import {
  assessVisualDiffPair,
  inferVisualDiffRegression,
  inferVisualDiffSeverity,
} from './visual-diff.js';
import { withRetryTaxonomy } from './retry-taxonomy.js';
import { errorMessage } from '../utils/errors.js';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DEFAULT_NAVIGATION_TIMEOUT_MS = 30_000;
const DEFAULT_ACTION_TIMEOUT_MS = 10_000;
const ACTION_CANCELLED_MESSAGE = 'Browser action cancelled by runtime kill signal.';

const PLAYWRIGHT_UNAVAILABLE_ERROR: BrowserActionError = {
  code: 'PLAYWRIGHT_UNAVAILABLE',
  message: 'Playwright runtime is unavailable. Install "playwright" to enable native browser sessions.',
  retryable: false,
  retryCategory: 'runtime-unavailable',
  retryHint: 'Install Playwright or enable browser runtime before retrying.',
};

const LOOPBACK_ATTACH_HOSTS = new Set(['127.0.0.1', '::1', 'localhost']);

function normalizeAttachWsEndpoint(wsEndpoint: string): string {
  let parsed: URL;
  try {
    parsed = new URL(wsEndpoint);
  } catch {
    throw new Error('Attach mode requires a valid wsEndpoint URL.');
  }
  if (parsed.protocol !== 'ws:' && parsed.protocol !== 'wss:') {
    throw new Error('Attach mode requires wsEndpoint to use ws:// or wss://.');
  }
  const host = parsed.hostname.trim().toLowerCase();
  if (!LOOPBACK_ATTACH_HOSTS.has(host)) {
    throw new Error('Attach mode only allows loopback wsEndpoint hosts (127.0.0.1, ::1, localhost).');
  }
  return parsed.toString();
}

interface PlaywrightPageLike {
  goto(url: string, options?: Record<string, unknown>): Promise<unknown>;
  click(selector: string, options?: Record<string, unknown>): Promise<unknown>;
  fill(selector: string, text: string, options?: Record<string, unknown>): Promise<unknown>;
  content(): Promise<string>;
  screenshot(options?: Record<string, unknown>): Promise<Uint8Array>;
  evaluate(pageFunction: any, arg?: any): Promise<any>;
  url(): string;
}

interface PlaywrightContextLike {
  newPage(): Promise<PlaywrightPageLike>;
  pages(): PlaywrightPageLike[];
  close(): Promise<void>;
  addInitScript(script: { path?: string; content?: string } | ((...args: any[]) => unknown) | string, arg?: any): Promise<void>;
}

interface PlaywrightBrowserLike {
  newContext(options?: Record<string, unknown>): Promise<PlaywrightContextLike>;
  contexts(): PlaywrightContextLike[];
  close(): Promise<void>;
}

interface PlaywrightChromiumLike {
  launch(options?: Record<string, unknown>): Promise<PlaywrightBrowserLike>;
  launchPersistentContext?(
    userDataDir: string,
    options?: Record<string, unknown>,
  ): Promise<PlaywrightContextLike>;
  connectOverCDP(endpoint: string, options?: Record<string, unknown>): Promise<PlaywrightBrowserLike>;
}

interface PlaywrightRuntimeLike {
  chromium: PlaywrightChromiumLike;
}

interface ManagedSession {
  session: BrowserSession;
  browser?: PlaywrightBrowserLike;
  context?: PlaywrightContextLike;
  page?: PlaywrightPageLike;
  artifacts: BrowserArtifactMetadata[];
  actions: BrowserActionRecord[];
  recordings: BrowserSessionRecordingEntry[];
  artifactSequence: number;
  timelineSequence: number;
  timelineWrite: Promise<void>;
}

export interface NativeSessionManagerOptions {
  cwd?: string;
  now?: () => Date;
  idFactory?: () => string;
  loadPlaywright?: () => Promise<PlaywrightRuntimeLike | null>;
}

export interface NativeSessionActionOptions {
  signal?: AbortSignal;
}

async function defaultPlaywrightLoader(): Promise<PlaywrightRuntimeLike | null> {
  try {
    const specifier = 'playwright';
    const runtime = await import(specifier);
    if (!runtime || typeof runtime !== 'object' || !('chromium' in runtime)) {
      return null;
    }
    return runtime as PlaywrightRuntimeLike;
  } catch {
    return null;
  }
}

export class NativeSessionManager {
  private readonly sessions = new Map<string, ManagedSession>();
  private readonly cwd: string;
  private readonly now: () => Date;
  private readonly idFactory: () => string;
  private readonly loadPlaywright: () => Promise<PlaywrightRuntimeLike | null>;
  private globalActionSequence = 0;

  constructor(options: NativeSessionManagerOptions = {}) {
    this.cwd = options.cwd ?? process.cwd();
    this.now = options.now ?? (() => new Date());
    this.idFactory = options.idFactory ?? (() => randomUUID());
    this.loadPlaywright = options.loadPlaywright ?? defaultPlaywrightLoader;
  }

  async openSession(
    input: BrowserOpenSessionInput = {},
    options?: NativeSessionActionOptions,
  ): Promise<BrowserActionResult<BrowserSession>> {
    const sessionId = input.sessionId ?? this.idFactory();
    const runId = input.runId?.trim() ? input.runId.trim() : sessionId;
    const mode = input.mode ?? 'isolated';
    const action = this.createAction(sessionId, 'openSession', {
      runId,
      mode,
      wsEndpoint: input.wsEndpoint ?? '',
      headless: input.headless ?? true,
      profileDir: input.profileDir ?? '',
    });

    if (this.sessions.has(sessionId)) {
      return this.fail(action, 'SESSION_EXISTS', `Browser session "${sessionId}" already exists.`);
    }

    const nowIso = this.timestamp();
    const session: BrowserSession = {
      id: sessionId,
      runId,
      mode,
      status: 'open',
      runtime: 'unavailable',
      createdAt: nowIso,
      updatedAt: nowIso,
      artifactsDir: browserSessionArtifactsDir(this.cwd, sessionId),
      profileDir: input.profileDir,
      wsEndpoint: input.wsEndpoint,
    };

    const managed: ManagedSession = {
      session,
      artifacts: [],
      actions: [],
      recordings: [],
      artifactSequence: 0,
      timelineSequence: 0,
      timelineWrite: Promise.resolve(),
    };

    this.sessions.set(sessionId, managed);

    const runtime = await this.loadPlaywright();
    if (!runtime) {
      await this.recordAction(managed, action, false, PLAYWRIGHT_UNAVAILABLE_ERROR);
      await this.persist(managed);
      return {
        ok: false,
        action,
        data: { ...session },
        error: { ...PLAYWRIGHT_UNAVAILABLE_ERROR },
      };
    }

    try {
      const opened = await this.withActionSignal(managed, options, async () =>
        this.openRuntimeSession(
          runtime,
          mode,
          input.wsEndpoint,
          input.headless ?? true,
          input.profileDir,
        ));
      managed.browser = opened.browser;
      managed.context = opened.context;
      managed.page = opened.page;
      managed.session.runtime = 'playwright';
      managed.session.updatedAt = this.timestamp();

      await this.recordAction(managed, action, true);
      await this.persist(managed);
      return { ok: true, action, data: { ...managed.session } };
    } catch (err) {
      const error = this.isAbortError(err)
        ? this.error('ACTION_CANCELLED', ACTION_CANCELLED_MESSAGE)
        : this.error('OPEN_SESSION_FAILED', `Failed to open browser session: ${errorMessage(err)}`);
      managed.session.lastError = error;
      managed.session.updatedAt = this.timestamp();
      await this.recordAction(managed, action, false, error);
      await this.safeCloseRuntime(managed);
      await this.persist(managed);
      return { ok: false, action, data: { ...managed.session }, error };
    }
  }

  async closeSession(
    sessionId: string,
  ): Promise<BrowserActionResult<{ sessionId: string; status: 'closed' }>> {
    const action = this.createAction(sessionId, 'closeSession', {});
    const managed = this.sessions.get(sessionId);

    if (!managed) {
      return this.fail(action, 'SESSION_NOT_FOUND', `Browser session "${sessionId}" was not found.`);
    }

    await this.safeCloseRuntime(managed);
    managed.session.status = 'closed';
    managed.session.updatedAt = this.timestamp();

    await this.recordAction(managed, action, true);
    await this.persist(managed);

    this.sessions.delete(sessionId);
    return {
      ok: true,
      action,
      data: {
        sessionId,
        status: 'closed',
      },
    };
  }

  async navigate(
    sessionId: string,
    input: BrowserNavigateInput,
    options?: NativeSessionActionOptions,
  ): Promise<BrowserActionResult<{ url: string }>> {
    const action = this.createAction(sessionId, 'navigate', input as unknown as Record<string, unknown>);
    const managed = this.sessions.get(sessionId);
    if (!managed) {
      return this.fail(action, 'SESSION_NOT_FOUND', `Browser session "${sessionId}" was not found.`);
    }

    const gate = this.ensurePage(managed);
    if (gate) {
      await this.recordAction(managed, action, false, gate);
      await this.persist(managed);
      return { ok: false, action, error: gate };
    }

    try {
      await this.withActionSignal(managed, options, async () => {
        await managed.page!.goto(input.url, {
          timeout: input.timeoutMs ?? DEFAULT_NAVIGATION_TIMEOUT_MS,
          waitUntil: input.waitUntil ?? 'domcontentloaded',
        });
      });

      managed.session.currentUrl = managed.page!.url();
      managed.session.updatedAt = this.timestamp();

      await this.recordAction(managed, action, true);
      await this.persist(managed);
      return {
        ok: true,
        action,
        data: {
          url: managed.session.currentUrl,
        },
      };
    } catch (err) {
      const error = this.isAbortError(err)
        ? this.error('ACTION_CANCELLED', ACTION_CANCELLED_MESSAGE)
        : this.error('NAVIGATE_FAILED', `Navigate failed: ${errorMessage(err)}`);
      managed.session.updatedAt = this.timestamp();
      await this.recordAction(managed, action, false, error);
      await this.persist(managed);
      return { ok: false, action, error };
    }
  }

  async click(
    sessionId: string,
    input: BrowserClickInput,
    options?: NativeSessionActionOptions,
  ): Promise<BrowserActionResult> {
    const action = this.createAction(sessionId, 'click', input as unknown as Record<string, unknown>);
    const managed = this.sessions.get(sessionId);
    if (!managed) {
      return this.fail(action, 'SESSION_NOT_FOUND', `Browser session "${sessionId}" was not found.`);
    }

    const gate = this.ensurePage(managed);
    if (gate) {
      await this.recordAction(managed, action, false, gate);
      await this.persist(managed);
      return { ok: false, action, error: gate };
    }

    try {
      await this.withActionSignal(managed, options, async () => {
        // Trigger visual click animation
        await managed.page!.evaluate(
          ([selector]: string[]) => {
            type DOMGlobal = {
              dispatchEvent: (e: unknown) => void;
              CustomEvent: new (name: string, opts: unknown) => unknown;
            };
            const w = globalThis as unknown as DOMGlobal;
            w.dispatchEvent(
              new w.CustomEvent('opta:action', { detail: { type: 'click', selector } })
            );
          },
          [input.selector],
        ).catch(() => { }); // Best effort

        await managed.page!.click(input.selector, {
          timeout: input.timeoutMs ?? DEFAULT_ACTION_TIMEOUT_MS,
        });
      });
      managed.session.updatedAt = this.timestamp();
      await this.recordAction(managed, action, true);
      await this.persist(managed);
      return { ok: true, action };
    } catch (err) {
      const error = this.isAbortError(err)
        ? this.error('ACTION_CANCELLED', ACTION_CANCELLED_MESSAGE)
        : this.error('CLICK_FAILED', `Click failed: ${errorMessage(err)}`);
      managed.session.updatedAt = this.timestamp();
      await this.recordAction(managed, action, false, error);
      await this.persist(managed);
      return { ok: false, action, error };
    }
  }

  async type(
    sessionId: string,
    input: BrowserTypeInput,
    options?: NativeSessionActionOptions,
  ): Promise<BrowserActionResult> {
    const action = this.createAction(sessionId, 'type', input as unknown as Record<string, unknown>);
    const managed = this.sessions.get(sessionId);
    if (!managed) {
      return this.fail(action, 'SESSION_NOT_FOUND', `Browser session "${sessionId}" was not found.`);
    }

    const gate = this.ensurePage(managed);
    if (gate) {
      await this.recordAction(managed, action, false, gate);
      await this.persist(managed);
      return { ok: false, action, error: gate };
    }

    try {
      await this.withActionSignal(managed, options, async () => {
        // Trigger visual type animation
        await managed.page!.evaluate(
          ([selector]: string[]) => {
            type DOMGlobal = {
              dispatchEvent: (e: unknown) => void;
              CustomEvent: new (name: string, opts: unknown) => unknown;
            };
            const w = globalThis as unknown as DOMGlobal;
            w.dispatchEvent(
              new w.CustomEvent('opta:action', { detail: { type: 'type', selector } })
            );
          },
          [input.selector],
        ).catch(() => { }); // Best effort

        await managed.page!.fill(input.selector, input.text, {
          timeout: input.timeoutMs ?? DEFAULT_ACTION_TIMEOUT_MS,
        });
      });
      managed.session.updatedAt = this.timestamp();
      await this.recordAction(managed, action, true);
      await this.persist(managed);
      return { ok: true, action };
    } catch (err) {
      const error = this.isAbortError(err)
        ? this.error('ACTION_CANCELLED', ACTION_CANCELLED_MESSAGE)
        : this.error('TYPE_FAILED', `Type failed: ${errorMessage(err)}`);
      managed.session.updatedAt = this.timestamp();
      await this.recordAction(managed, action, false, error);
      await this.persist(managed);
      return { ok: false, action, error };
    }
  }

  async snapshot(
    sessionId: string,
    options?: NativeSessionActionOptions,
  ): Promise<BrowserActionResult<BrowserSnapshotData>> {
    const action = this.createAction(sessionId, 'snapshot', {});
    const managed = this.sessions.get(sessionId);
    if (!managed) {
      return this.fail(action, 'SESSION_NOT_FOUND', `Browser session "${sessionId}" was not found.`);
    }

    const gate = this.ensurePage(managed);
    if (gate) {
      await this.recordAction(managed, action, false, gate);
      await this.persist(managed);
      return { ok: false, action, error: gate };
    }

    try {
      const html = await this.withActionSignal(managed, options, async () => managed.page!.content());
      const artifact = await this.createArtifact(managed, action.id, 'snapshot', 'html', 'text/html', html);
      managed.session.updatedAt = this.timestamp();
      await this.recordAction(managed, action, true, undefined, artifact);
      await this.persist(managed);
      return {
        ok: true,
        action,
        data: {
          html,
          artifact,
        },
      };
    } catch (err) {
      const error = this.isAbortError(err)
        ? this.error('ACTION_CANCELLED', ACTION_CANCELLED_MESSAGE)
        : this.error('SNAPSHOT_FAILED', `Snapshot failed: ${errorMessage(err)}`);
      managed.session.updatedAt = this.timestamp();
      await this.recordAction(managed, action, false, error);
      await this.persist(managed);
      return { ok: false, action, error };
    }
  }

  async screenshot(
    sessionId: string,
    input: BrowserScreenshotInput = {},
    options?: NativeSessionActionOptions,
  ): Promise<BrowserActionResult<BrowserScreenshotData>> {
    const action = this.createAction(sessionId, 'screenshot', input as Record<string, unknown>);
    const managed = this.sessions.get(sessionId);
    if (!managed) {
      return this.fail(action, 'SESSION_NOT_FOUND', `Browser session "${sessionId}" was not found.`);
    }

    const gate = this.ensurePage(managed);
    if (gate) {
      await this.recordAction(managed, action, false, gate);
      await this.persist(managed);
      return { ok: false, action, error: gate };
    }

    try {
      const type = input.type ?? 'png';
      const screenshotOptions: Record<string, unknown> = {
        fullPage: input.fullPage ?? true,
        type,
      };

      if (typeof input.quality === 'number') {
        screenshotOptions.quality = input.quality;
      }

      const image = await this.withActionSignal(managed, options, async () =>
        managed.page!.screenshot(screenshotOptions));
      const artifact = await this.createArtifact(
        managed,
        action.id,
        'screenshot',
        type === 'jpeg' ? 'jpg' : 'png',
        type === 'jpeg' ? 'image/jpeg' : 'image/png',
        image,
      );

      managed.session.updatedAt = this.timestamp();
      await this.recordAction(managed, action, true, undefined, artifact);
      await this.persist(managed);

      return {
        ok: true,
        action,
        data: {
          artifact,
        },
      };
    } catch (err) {
      const error = this.isAbortError(err)
        ? this.error('ACTION_CANCELLED', ACTION_CANCELLED_MESSAGE)
        : this.error('SCREENSHOT_FAILED', `Screenshot failed: ${errorMessage(err)}`);
      managed.session.updatedAt = this.timestamp();
      await this.recordAction(managed, action, false, error);
      await this.persist(managed);
      return { ok: false, action, error };
    }
  }

  private async openRuntimeSession(
    runtime: PlaywrightRuntimeLike,
    mode: BrowserOpenSessionInput['mode'],
    wsEndpoint: string | undefined,
    headless: boolean,
    profileDir: string | undefined,
  ): Promise<{
    browser?: PlaywrightBrowserLike;
    context: PlaywrightContextLike;
    page: PlaywrightPageLike;
  }> {
    if (mode === 'attach') {
      if (!wsEndpoint) {
        throw new Error('Attach mode requires wsEndpoint.');
      }
      const normalizedEndpoint = normalizeAttachWsEndpoint(wsEndpoint);
      const browser = await runtime.chromium.connectOverCDP(normalizedEndpoint);
      const context = browser.contexts()[0] ?? await browser.newContext();

      await this.injectChromeOverlay(context);

      const page = context.pages()[0] ?? await context.newPage();
      return { browser, context, page };
    }

    if (profileDir && typeof runtime.chromium.launchPersistentContext === 'function') {
      const context = await runtime.chromium.launchPersistentContext(profileDir, { headless });

      await this.injectChromeOverlay(context);

      const page = context.pages()[0] ?? await context.newPage();
      return { context, page };
    }

    const browser = await runtime.chromium.launch({ headless });
    const context = await browser.newContext();

    await this.injectChromeOverlay(context);

    const page = await context.newPage();
    return { browser, context, page };
  }

  private async injectChromeOverlay(context: PlaywrightContextLike): Promise<void> {
    try {
      const overlayPath = join(__dirname, 'chrome-overlay.js'); // Assuming transpile output
      await context.addInitScript({ path: overlayPath });
    } catch {
      // Best effort fallback if running uncompiled (development)
      try {
        const overlayPathTs = join(__dirname, 'chrome-overlay.ts');
        await context.addInitScript({ path: overlayPathTs });
      } catch {
        // Silently fail if overlay injection fails so we don't block the browser
      }
    }
  }

  private ensurePage(managed: ManagedSession): BrowserActionError | null {
    if (managed.session.status !== 'open') {
      return this.error('SESSION_CLOSED', `Browser session "${managed.session.id}" is closed.`);
    }

    if (!managed.page || managed.session.runtime !== 'playwright') {
      return { ...PLAYWRIGHT_UNAVAILABLE_ERROR };
    }

    return null;
  }

  private async createArtifact(
    managed: ManagedSession,
    actionId: string,
    kind: 'snapshot' | 'screenshot',
    extension: string,
    mimeType: string,
    content: string | Uint8Array,
  ): Promise<BrowserArtifactMetadata> {
    managed.artifactSequence += 1;

    return writeBrowserArtifact({
      cwd: this.cwd,
      sessionId: managed.session.id,
      actionId,
      sequence: managed.artifactSequence,
      kind,
      extension,
      mimeType,
      content,
      createdAt: this.timestamp(),
    });
  }

  private async persist(managed: ManagedSession): Promise<void> {
    const metadata: BrowserSessionMetadata = {
      schemaVersion: 1,
      sessionId: managed.session.id,
      runId: managed.session.runId,
      mode: managed.session.mode,
      status: managed.session.status,
      runtime: managed.session.runtime,
      createdAt: managed.session.createdAt,
      updatedAt: managed.session.updatedAt,
      currentUrl: managed.session.currentUrl,
      wsEndpoint: managed.session.wsEndpoint,
      profileDir: managed.session.profileDir,
      lastError: managed.session.lastError,
      artifacts: [...managed.artifacts],
      actions: [...managed.actions],
    };

    const recordings: BrowserSessionRecordingIndex = {
      schemaVersion: 1,
      sessionId: managed.session.id,
      runId: managed.session.runId,
      createdAt: managed.session.createdAt,
      updatedAt: managed.session.updatedAt,
      recordings: [...managed.recordings].sort((left, right) => left.sequence - right.sequence),
    };

    await writeBrowserSessionMetadata(this.cwd, metadata);
    await writeBrowserSessionRecordings(this.cwd, recordings);
  }

  private async recordAction(
    managed: ManagedSession,
    action: BrowserAction,
    ok: boolean,
    error?: BrowserActionError,
    artifact?: BrowserArtifactMetadata,
  ): Promise<void> {
    const artifactIds: string[] = [];
    const artifactPaths: string[] = [];
    if (artifact) {
      managed.artifacts.push(artifact);
      artifactIds.push(artifact.id);
      artifactPaths.push(artifact.relativePath);
    }

    managed.actions.push({
      action,
      ok,
      error,
      artifactIds,
    });

    managed.timelineSequence += 1;
    const timestamp = this.timestamp();
    const step: BrowserSessionStepRecord = {
      sequence: managed.timelineSequence,
      sessionId: managed.session.id,
      runId: managed.session.runId,
      actionId: action.id,
      actionType: action.type,
      timestamp,
      ok,
      error,
      artifactIds: [...artifactIds],
      artifactPaths: [...artifactPaths],
    };

    managed.recordings.push({
      sequence: step.sequence,
      sessionId: step.sessionId,
      runId: step.runId,
      actionId: step.actionId,
      actionType: step.actionType,
      timestamp: step.timestamp,
      ok: step.ok,
      error: step.error,
      artifactIds: [...step.artifactIds],
      artifactPaths: [...step.artifactPaths],
    });

    managed.timelineWrite = managed.timelineWrite
      .catch(() => undefined)
      .then(async () => {
        await appendBrowserSessionStep(this.cwd, step);
        await appendBrowserVisualDiffManifestEntry(this.cwd, {
          schemaVersion: 1,
          sessionId: step.sessionId,
          runId: step.runId,
          sequence: step.sequence,
          actionId: step.actionId,
          actionType: step.actionType,
          timestamp: step.timestamp,
          status: 'pending',
          artifactIds: [...step.artifactIds],
          artifactPaths: [...step.artifactPaths],
        });

        const previousStep = managed.recordings.at(-2);
        if (previousStep) {
          const {
            status,
            fromScreenshotPath,
            toScreenshotPath,
            changedByteRatio,
            perceptualDiffScore,
            severity,
            regressionScore,
            regressionSignal,
          } = await this.computeVisualDiffStatus(
            previousStep,
            step,
          );
          await appendBrowserVisualDiffResultEntry(this.cwd, {
            schemaVersion: 1,
            sessionId: step.sessionId,
            runId: step.runId,
            index: step.sequence - 2,
            fromSequence: previousStep.sequence,
            fromActionId: previousStep.actionId,
            fromActionType: previousStep.actionType,
            toSequence: step.sequence,
            toActionId: step.actionId,
            toActionType: step.actionType,
            fromScreenshotPath,
            toScreenshotPath,
            status,
            changedByteRatio,
            perceptualDiffScore,
            severity,
            regressionScore,
            regressionSignal,
          });
        }
      })
      .then(() => undefined);
    await managed.timelineWrite;

    managed.session.updatedAt = timestamp;
    managed.session.lastError = error;
  }

  private resolveArtifactAbsolutePath(sessionId: string, artifactPath: string): string {
    if (isAbsolute(artifactPath)) return artifactPath;
    if (artifactPath.startsWith('.opta/')) {
      return join(this.cwd, artifactPath);
    }
    return join(browserSessionArtifactsDir(this.cwd, sessionId), artifactPath);
  }

  private isScreenshotArtifactPath(artifactPath: string): boolean {
    const lower = artifactPath.toLowerCase();
    return (
      lower.endsWith('.png') ||
      lower.endsWith('.jpg') ||
      lower.endsWith('.jpeg') ||
      lower.endsWith('.webp') ||
      lower.endsWith('.gif') ||
      lower.endsWith('.bmp')
    );
  }

  private findStepScreenshotPath(step: Pick<BrowserSessionStepRecord, 'sessionId' | 'artifactPaths'>): string | undefined {
    return step.artifactPaths.find((path) => this.isScreenshotArtifactPath(path));
  }

  private async computeVisualDiffStatus(
    fromStep: BrowserSessionStepRecord,
    toStep: BrowserSessionStepRecord,
  ): Promise<{
    status: 'changed' | 'unchanged' | 'missing';
    fromScreenshotPath?: string;
    toScreenshotPath?: string;
    changedByteRatio?: number;
    perceptualDiffScore?: number;
    severity: BrowserVisualDiffSeverity;
    regressionScore: number;
    regressionSignal: BrowserVisualDiffRegressionSignal;
  }> {
    const fromScreenshotPath = this.findStepScreenshotPath(fromStep);
    const toScreenshotPath = this.findStepScreenshotPath(toStep);
    if (!fromScreenshotPath || !toScreenshotPath) {
      const status = 'missing';
      const severity = inferVisualDiffSeverity(status);
      const regression = inferVisualDiffRegression(status, severity);
      return {
        status,
        fromScreenshotPath,
        toScreenshotPath,
        severity,
        ...regression,
      };
    }

    try {
      const [fromBytes, toBytes] = await Promise.all([
        readFile(this.resolveArtifactAbsolutePath(fromStep.sessionId, fromScreenshotPath)),
        readFile(this.resolveArtifactAbsolutePath(toStep.sessionId, toScreenshotPath)),
      ]);
      const assessment = assessVisualDiffPair(fromBytes, toBytes);

      return {
        status: assessment.status,
        fromScreenshotPath,
        toScreenshotPath,
        changedByteRatio: assessment.changedByteRatio,
        perceptualDiffScore: assessment.perceptualDiffScore,
        severity: assessment.severity,
        regressionScore: assessment.regressionScore,
        regressionSignal: assessment.regressionSignal,
      };
    } catch {
      const status = 'missing';
      const severity = inferVisualDiffSeverity(status);
      const regression = inferVisualDiffRegression(status, severity);
      return {
        status,
        fromScreenshotPath,
        toScreenshotPath,
        severity,
        ...regression,
      };
    }
  }

  private createAction(
    sessionId: string,
    type: BrowserAction['type'],
    input: Record<string, unknown>,
  ): BrowserAction {
    this.globalActionSequence += 1;
    return {
      id: `action-${String(this.globalActionSequence).padStart(6, '0')}`,
      sessionId,
      type,
      createdAt: this.timestamp(),
      input,
    };
  }

  private fail<T>(
    action: BrowserAction,
    code: string,
    message: string,
  ): BrowserActionResult<T> {
    return {
      ok: false,
      action,
      error: this.error(code, message),
    };
  }

  private error(code: string, message: string): BrowserActionError {
    return withRetryTaxonomy(code, message);
  }

  private isAbortError(err: unknown): boolean {
    return err instanceof Error && err.name === 'AbortError';
  }

  private makeAbortError(): Error {
    const err = new Error(ACTION_CANCELLED_MESSAGE);
    err.name = 'AbortError';
    return err;
  }

  private async withActionSignal<T>(
    managed: ManagedSession,
    options: NativeSessionActionOptions | undefined,
    execute: () => Promise<T>,
  ): Promise<T> {
    const signal = options?.signal;
    if (!signal) return execute();
    if (signal.aborted) {
      await this.safeCloseRuntime(managed);
      throw this.makeAbortError();
    }

    let onAbort: (() => void) | null = null;
    const abortPromise = new Promise<never>((_, reject) => {
      onAbort = () => {
        void this.safeCloseRuntime(managed);
        reject(this.makeAbortError());
      };
      signal.addEventListener('abort', onAbort, { once: true });
    });

    try {
      return await Promise.race([execute(), abortPromise]);
    } finally {
      if (onAbort) {
        signal.removeEventListener('abort', onAbort);
      }
    }
  }

  private timestamp(): string {
    return this.now().toISOString();
  }

  private async safeCloseRuntime(managed: ManagedSession): Promise<void> {
    const context = managed.context;
    if (context) {
      try {
        await context.close();
      } catch {
        // Best-effort cleanup
      }
    }

    const browser = managed.browser;
    if (browser) {
      try {
        await browser.close();
      } catch {
        // Best-effort cleanup
      }
    }

    managed.page = undefined;
    managed.context = undefined;
    managed.browser = undefined;
  }
}

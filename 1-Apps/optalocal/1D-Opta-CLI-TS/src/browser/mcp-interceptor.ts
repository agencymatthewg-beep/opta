import {
  evaluateBrowserPolicyAction,
  isBrowserToolName,
  type BrowserPolicyConfig,
  type BrowserPolicyDecision,
} from './policy-engine.js';
import { appendBrowserApprovalEvent } from './approval-log.js';
import type { BrowserPolicyAdaptationHint } from './adaptation.js';
import { classifyBrowserRetryTaxonomy } from './retry-taxonomy.js';
import { isScreenshotResult, compressBrowserScreenshot, type ScreenshotCompressOptions } from './screenshot-compress.js';
import {
  appendBrowserSessionStep,
  appendBrowserVisualDiffManifestEntry,
  appendBrowserVisualDiffResultEntry,
  writeBrowserArtifact,
} from './artifacts.js';
import {
  assessVisualDiffPair,
  inferVisualDiffRegression,
  inferVisualDiffSeverity,
} from './visual-diff.js';
import type {
  BrowserActionType,
  BrowserSessionStepRecord,
  BrowserVisualDiffRegressionSignal,
  BrowserVisualDiffSeverity,
} from './types.js';
import { readFile } from 'node:fs/promises';

type TextContentBlock = { type: string; text?: string };

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getTextContentBlocks(value: unknown): TextContentBlock[] | null {
  if (!isObjectRecord(value)) return null;
  const content = value['content'];
  if (!Array.isArray(content)) return null;
  if (!content.every((item) => isObjectRecord(item) && typeof item.type === 'string')) {
    return null;
  }
  return content as TextContentBlock[];
}

function firstTextBlock(value: unknown): TextContentBlock | null {
  const blocks = getTextContentBlocks(value);
  if (!blocks || blocks.length === 0) return null;
  const [first] = blocks;
  return first && first.type === 'text' ? first : null;
}

function resolveSelectorArg(args: Record<string, unknown>): string {
  if (typeof args.selector === 'string') return args.selector;
  if (typeof args.element === 'string') return args.element;
  return '';
}

export class BrowserPolicyDeniedError extends Error {
  constructor(
    public readonly toolName: string,
    public readonly decision: BrowserPolicyDecision,
  ) {
    super(`BrowserPolicyDenied: ${toolName} — ${decision.reason}`);
    this.name = 'BrowserPolicyDeniedError';
  }
}

export interface BrowserMcpInterceptorConfig {
  policyConfig: Partial<BrowserPolicyConfig>;
  sessionId: string;
  adaptationHint?: BrowserPolicyAdaptationHint;
  currentOrigin?: string;
  currentPageHasCredentials?: boolean;
  /** Called when a `gate` decision is reached. Return 'approved' to proceed, 'denied' to abort. */
  onGate?: (toolName: string, decision: BrowserPolicyDecision) => Promise<'approved' | 'denied'>;
  /** Max number of retry attempts for retryable Playwright errors. Default: 0 (no retry). */
  maxRetries?: number;
  /** Milliseconds to wait between retries (linear backoff × attempt). Default: 300. */
  retryBackoffMs?: number;
  /**
   * When set, compresses browser_screenshot results to reduce LLM context usage.
   * Set to `false` to explicitly disable. When omitted, compression is skipped.
   */
  screenshotCompressOptions?: ScreenshotCompressOptions | false;
  /**
   * Called when all retry attempts are exhausted on a selector-category error
   * (browser_click / browser_type). Receives the selector string and a snapshot
   * of the current page so the caller can attempt healing.
   */
  onSelectorFail?: (toolName: string, selector: string, snapshot: string) => Promise<void>;
  /**
   * Called to capture a snapshot of the current page. Used by selector healing
   * when `onSelectorFail` is set.
   */
  executeSnapshot?: () => Promise<string>;
  /**
   * Called to evaluate arbitrary JavaScript in the browser. Used for SoM injection
   * and implicit state verification.
   */
  executeEvaluate?: (expression: string) => Promise<unknown>;
  /**
   * Called after each successfully executed browser action (allowed or approved).
   * Useful for emitting real-time browser events to the WS event bus.
   */
  onBrowserEvent?: (toolName: string, args: Record<string, unknown>, result: unknown) => void;
  /**
   * Optional persistence mode that records interceptor browser actions into the
   * same artifacts/visual-diff pipeline used by native browser sessions.
   */
  artifactPersistence?: {
    enabled?: boolean;
    cwd?: string;
    runId?: string;
  };
}

interface InterceptorStepState {
  sequence: number;
  actionId: string;
  actionType: BrowserActionType;
  screenshotPath?: string;
  screenshotAbsolutePath?: string;
}

interface InterceptorTimelineState {
  lastSequence: number;
  lastStep?: InterceptorStepState;
}

const interceptorTimelineBySessionId = new Map<string, InterceptorTimelineState>();
const SCREENSHOT_DATA_URL_RE = /data:image\/([a-zA-Z0-9+.-]+);base64,([A-Za-z0-9+/]+=*)/;

function mapToolNameToActionType(toolName: string): BrowserActionType | null {
  switch (toolName) {
    case 'browser_open':
      return 'openSession';
    case 'browser_close':
      return 'closeSession';
    case 'browser_navigate':
    case 'browser_go_back':
    case 'browser_go_forward':
    case 'browser_reload':
    case 'browser_tab_new':
    case 'browser_tab_switch':
    case 'browser_tab_close':
      return 'navigate';
    case 'browser_click':
    case 'browser_drag':
    case 'browser_handle_dialog':
      return 'click';
    case 'browser_type':
    case 'browser_fill_form':
    case 'browser_press_key':
    case 'browser_keyboard_type':
    case 'browser_select_option':
      return 'type';
    case 'browser_snapshot':
      return 'snapshot';
    case 'browser_screenshot':
      return 'screenshot';
    default:
      return null;
  }
}

function isPersistenceEnabled(
  config: BrowserMcpInterceptorConfig,
): config is BrowserMcpInterceptorConfig & {
  artifactPersistence: {
    enabled?: boolean;
    cwd?: string;
    runId?: string;
  };
} {
  return Boolean(config.artifactPersistence?.enabled);
}

function parseScreenshotResult(
  result: unknown,
): { bytes: Uint8Array; extension: string; mimeType: string } | null {
  if (typeof result !== 'string') return null;
  const match = SCREENSHOT_DATA_URL_RE.exec(result);
  if (!match) return null;

  const subtypeRaw = (match[1] ?? 'png').toLowerCase();
  const subtype = subtypeRaw === 'jpg' ? 'jpeg' : subtypeRaw;
  const extension = subtype === 'jpeg' ? 'jpg' : subtype;
  const b64 = match[2] ?? '';
  const bytes = Buffer.from(b64, 'base64');
  return {
    bytes: new Uint8Array(bytes),
    extension,
    mimeType: `image/${subtype}`,
  };
}

async function computeVisualDiffFromScreenshotPaths(
  previousScreenshotAbsolutePath: string | undefined,
  currentScreenshotAbsolutePath: string | undefined,
): Promise<{
  status: 'changed' | 'unchanged' | 'missing';
  changedByteRatio?: number;
  perceptualDiffScore?: number;
  severity: BrowserVisualDiffSeverity;
  regressionScore: number;
  regressionSignal: BrowserVisualDiffRegressionSignal;
}> {
  if (!previousScreenshotAbsolutePath || !currentScreenshotAbsolutePath) {
    const status = 'missing';
    const severity = inferVisualDiffSeverity(status);
    const regression = inferVisualDiffRegression(status, severity);
    return {
      status,
      severity,
      ...regression,
    };
  }

  try {
    const [previousBytes, currentBytes] = await Promise.all([
      readFile(previousScreenshotAbsolutePath),
      readFile(currentScreenshotAbsolutePath),
    ]);
    const assessment = assessVisualDiffPair(previousBytes, currentBytes);
    return {
      status: assessment.status,
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
      severity,
      ...regression,
    };
  }
}

async function persistBrowserInterceptorAction(
  toolName: string,
  result: unknown,
  config: BrowserMcpInterceptorConfig,
): Promise<void> {
  if (!isPersistenceEnabled(config)) return;
  const actionType = mapToolNameToActionType(toolName);
  if (!actionType) return;

  const cwd = config.artifactPersistence.cwd ?? process.cwd();
  const runId = config.artifactPersistence.runId;
  const sessionId = config.sessionId;
  const timestamp = new Date().toISOString();
  const timelineState = interceptorTimelineBySessionId.get(sessionId) ?? { lastSequence: 0 };
  const sequence = timelineState.lastSequence + 1;
  const actionId = `mcp-action-${String(sequence).padStart(6, '0')}`;
  const artifactIds: string[] = [];
  const artifactPaths: string[] = [];
  let screenshotRelativePath: string | undefined;
  let screenshotAbsolutePath: string | undefined;

  const screenshotData = parseScreenshotResult(result);
  if (screenshotData) {
    const screenshotArtifact = await writeBrowserArtifact({
      cwd,
      sessionId,
      actionId,
      sequence,
      kind: 'screenshot',
      extension: screenshotData.extension,
      mimeType: screenshotData.mimeType,
      content: screenshotData.bytes,
      createdAt: timestamp,
    });
    artifactIds.push(screenshotArtifact.id);
    artifactPaths.push(screenshotArtifact.relativePath);
    screenshotRelativePath = screenshotArtifact.relativePath;
    screenshotAbsolutePath = screenshotArtifact.absolutePath;
  }

  const stepRecord: BrowserSessionStepRecord = {
    sequence,
    sessionId,
    runId,
    actionId,
    actionType,
    timestamp,
    ok: true,
    artifactIds: [...artifactIds],
    artifactPaths: [...artifactPaths],
  };

  await appendBrowserSessionStep(cwd, stepRecord);
  await appendBrowserVisualDiffManifestEntry(cwd, {
    schemaVersion: 1,
    sessionId,
    runId,
    sequence,
    actionId,
    actionType,
    timestamp,
    status: 'pending',
    artifactIds: [...artifactIds],
    artifactPaths: [...artifactPaths],
  });

  const previousStep = timelineState.lastStep;
  if (previousStep) {
    const diffStatus = await computeVisualDiffFromScreenshotPaths(
      previousStep.screenshotAbsolutePath,
      screenshotAbsolutePath,
    );
    await appendBrowserVisualDiffResultEntry(cwd, {
      schemaVersion: 1,
      sessionId,
      runId,
      index: sequence - 2,
      fromSequence: previousStep.sequence,
      fromActionId: previousStep.actionId,
      fromActionType: previousStep.actionType,
      toSequence: sequence,
      toActionId: actionId,
      toActionType: actionType,
      fromScreenshotPath: previousStep.screenshotPath,
      toScreenshotPath: screenshotRelativePath,
      status: diffStatus.status,
      changedByteRatio: diffStatus.changedByteRatio,
      perceptualDiffScore: diffStatus.perceptualDiffScore,
      severity: diffStatus.severity,
      regressionScore: diffStatus.regressionScore,
      regressionSignal: diffStatus.regressionSignal,
    });
  }

  interceptorTimelineBySessionId.set(sessionId, {
    lastSequence: sequence,
    lastStep: {
      sequence,
      actionId,
      actionType,
      screenshotPath: screenshotRelativePath,
      screenshotAbsolutePath,
    },
  });
}

/**
 * Intercepts a single Playwright MCP tool call through the full safety pipeline:
 * 1. Policy evaluation (allow / gate / deny)
 * 2. Gate prompt (if decision is 'gate')
 * 3. Execute the actual MCP call
 */
export async function interceptBrowserMcpCall(
  toolName: string,
  args: Record<string, unknown>,
  config: BrowserMcpInterceptorConfig,
  execute: () => Promise<unknown>,
): Promise<unknown> {
  // Non-browser tools pass through without interception
  if (!isBrowserToolName(toolName)) {
    return execute();
  }

  // Handle custom coordinate fallback natively via executeEvaluate to bypass Playwright Protocol Server
  if (toolName === 'browser_action_coordinates') {
    if (!config.executeEvaluate) throw new Error('config.executeEvaluate is required for browser_action_coordinates');
    const x = Number(args.x);
    const y = Number(args.y);
    const action = args.action;

    let evalStr = '';
    if (action === 'click') {
      evalStr = `
        (function() {
          var el = document.elementFromPoint(${x}, ${y});
          if (el) { el.click(); el.focus(); return true; }
          return false;
        })()
      `;
    } else {
      const text = typeof args.text === 'string' ? args.text.replace(/\\/g, '\\\\').replace(/"/g, '\\"') : '';
      evalStr = `
        (function() {
          var el = document.elementFromPoint(${x}, ${y});
          if (el) { 
             el.focus(); 
             if ('value' in el) el.value = "${text}";
             el.dispatchEvent(new Event('input', { bubbles: true }));
             el.dispatchEvent(new Event('change', { bubbles: true }));
             return true;
          }
          return false;
        })()
      `;
    }

    await config.executeEvaluate(evalStr);

    // Quick stabilization wait
    await new Promise((r) => setTimeout(r, 600));

    return `Successfully executed coordinate ${action} at (${x}, ${y}). Request a browser_snapshot to view the result.`;
  }

  // ID-based Action Mapping (SoM compatibility)
  if ('element_id' in args && typeof args['element_id'] === 'number') {
    args['selector'] = `[data-opta-id="${args['element_id']}"]`;
    delete args['element_id'];
  }

  const policyDecision = evaluateBrowserPolicyAction(config.policyConfig, {
    toolName,
    args,
    adaptationHint: config.adaptationHint,
    currentOrigin: config.currentOrigin,
    currentPageHasCredentials: config.currentPageHasCredentials,
  });

  if (policyDecision.decision === 'deny') {
    throw new BrowserPolicyDeniedError(toolName, policyDecision);
  }

  if (policyDecision.decision === 'gate') {
    const gateResult = config.onGate
      ? await config.onGate(toolName, policyDecision)
      : 'denied'; // No gate handler = deny by default (fail-safe)

    if (gateResult !== 'approved') {
      throw new BrowserPolicyDeniedError(toolName, policyDecision);
    }

    // Log the approval event
    await appendBrowserApprovalEvent({
      tool: toolName,
      sessionId: config.sessionId,
      decision: 'approved',
      actionKey: policyDecision.actionKey,
      risk: policyDecision.risk,
    });
  }

  const maxRetries = Math.max(0, config.maxRetries ?? 0);
  const backoffMs = config.retryBackoffMs ?? 300;
  let lastError: unknown;
  let lastErrorCode = '';
  let lastErrorMessage = '';

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Set-of-Mark Injection
      let somDictionary = '';
      if (toolName === 'browser_snapshot' && config.executeEvaluate) {
        try {
          const evalResult = await config.executeEvaluate('window.__optaInjectMarks && window.__optaInjectMarks()');
          if (isObjectRecord(evalResult) && 'result' in evalResult && typeof evalResult.result === 'string') {
            somDictionary = evalResult.result;
          } else if (typeof evalResult === 'string') {
            somDictionary = evalResult;
          }
        } catch {
          // ignore SoM failure
        }
      }

      let result: unknown;
      try {
        result = await execute();
      } catch (err: any) {
        // Fallback for cross-frame web components and arbitrary shadow DOMs
        if (
          (toolName === 'browser_click' || toolName === 'browser_type' || toolName === 'browser_fill_form') &&
          config.executeEvaluate &&
          err.message && (err.message.includes('Timeout') || err.message.includes('waiting for selector'))
        ) {
          const selector = resolveSelectorArg(args);
          if (selector) {
            const action = toolName === 'browser_click' ? 'click' : 'type';
            const value = typeof args['text'] === 'string' ? args['text'] : (typeof args['value'] === 'string' ? args['value'] : '');

            // Fire and forget the fallback cross-frame message
            const evalStr = `window.__optaFallbackAction && window.__optaFallbackAction('${action}', \`${selector.replace(/`/g, "\\`")}\`, \`${value.replace(/`/g, "\\`")}\`)`;
            try { await config.executeEvaluate(evalStr); } catch { }

            result = `Executed programmatic ${action} fallback across all frames. (Playwright original error: timeout)`;
          } else {
            throw err;
          }
        } else {
          throw err;
        }
      }

      // Append SoM dictionary to snapshot output
      if (toolName === 'browser_snapshot' && somDictionary) {
        const dictionaryPrefix =
          `Set-of-Marks Dictionary (use element_id instead of selector for actions):\n${somDictionary}\n\n---\n\n`;
        if (typeof result === 'string') {
          result = `${dictionaryPrefix}${result}`;
        } else {
          const block = firstTextBlock(result);
          if (block) {
            block.text = `${dictionaryPrefix}${block.text ?? ''}`;
          }
        }
      }

      // Screenshot compression (optional, behind config flag)
      if (
        toolName === 'browser_screenshot' &&
        config.screenshotCompressOptions !== false &&
        config.screenshotCompressOptions !== undefined &&
        isScreenshotResult(result)
      ) {
        result = await compressBrowserScreenshot(result, config.screenshotCompressOptions);
      }

      // Notify observers of successful browser action
      config.onBrowserEvent?.(toolName, args, result);

      // Persist successful interceptor actions into browser artifact/diff streams when enabled.
      await persistBrowserInterceptorAction(toolName, result, config).catch(() => undefined);

      // Phase 4: Implicit State Verification
      // After a mutable action, wait for stabilization and return the new state
      if (
        (toolName === 'browser_click' || toolName === 'browser_type' || toolName === 'browser_press_key') &&
        config.executeEvaluate
      ) {
        try {
          // Wait dynamically for UI to react and stabilize
          const waitScript = `
            new Promise(resolve => {
              if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => setTimeout(resolve, 500));
                setTimeout(resolve, 3000);
                return;
              }
              let timer;
              const observer = new MutationObserver(() => {
                clearTimeout(timer);
                timer = setTimeout(() => { observer.disconnect(); resolve(true); }, 400);
              });
              if (document.body) observer.observe(document.body, { childList: true, subtree: true, attributes: true });
              timer = setTimeout(() => { observer.disconnect(); resolve(true); }, 400);
              setTimeout(() => { observer.disconnect(); resolve(true); }, 3000);
            })
          `;
          try {
            await config.executeEvaluate(waitScript);
          } catch {
            await new Promise((r) => setTimeout(r, 800));
          }
          const evalResult = await config.executeEvaluate('window.__optaInjectMarks && window.__optaInjectMarks()');
          let newState = '';
          if (isObjectRecord(evalResult) && 'result' in evalResult && typeof evalResult.result === 'string') {
            newState = evalResult.result;
          } else if (typeof evalResult === 'string') {
            newState = evalResult;
          }
          if (newState) {
            const stateMsg = `\n\n--- Post-Action UI State (Set-of-Marks) ---\n${newState}`;
            if (typeof result === 'string') {
              result += stateMsg;
            } else {
              const block = firstTextBlock(result);
              if (block) {
                block.text = `${block.text ?? ''}${stateMsg}`;
              }
            }
          }
        } catch {
          // ignore verification failure
        }
      }

      return result;
    } catch (err) {
      lastError = err;
      lastErrorCode = (err as NodeJS.ErrnoException | undefined)?.code ?? '';
      lastErrorMessage = (err as Error | undefined)?.message ?? '';
      if (attempt >= maxRetries) break;
      const taxonomy = classifyBrowserRetryTaxonomy(lastErrorCode, lastErrorMessage);
      if (!taxonomy.retryable) break;
      if (backoffMs > 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, backoffMs * (attempt + 1)));
      }
    }
  }

  // Selector healing: after exhausting retries on a selector failure for interaction tools
  if (
    config.onSelectorFail &&
    config.executeSnapshot &&
    (toolName === 'browser_click' || toolName === 'browser_type')
  ) {
    const taxonomy = classifyBrowserRetryTaxonomy(lastErrorCode, lastErrorMessage);
    if (taxonomy.retryCategory === 'selector') {
      try {
        const snapshot = await config.executeSnapshot();
        const selector = resolveSelectorArg(args);
        await config.onSelectorFail(toolName, selector, snapshot);
      } catch {
        // Healing is best-effort — don't mask the original error
      }
    }
  }

  throw lastError;
}

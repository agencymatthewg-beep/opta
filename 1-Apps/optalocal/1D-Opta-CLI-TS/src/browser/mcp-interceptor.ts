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
   * Called after each successfully executed browser action (allowed or approved).
   * Useful for emitting real-time browser events to the WS event bus.
   */
  onBrowserEvent?: (toolName: string, args: Record<string, unknown>, result: unknown) => void;
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
      let result = await execute();

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
        const selector = String(args.selector ?? args.element ?? '');
        await config.onSelectorFail(toolName, selector, snapshot);
      } catch {
        // Healing is best-effort — don't mask the original error
      }
    }
  }

  throw lastError;
}

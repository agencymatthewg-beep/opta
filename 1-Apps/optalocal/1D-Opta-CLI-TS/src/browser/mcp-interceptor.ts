import {
  evaluateBrowserPolicyAction,
  isBrowserToolName,
  type BrowserPolicyConfig,
  type BrowserPolicyDecision,
} from './policy-engine.js';
import { appendBrowserApprovalEvent } from './approval-log.js';
import type { BrowserPolicyAdaptationHint } from './adaptation.js';
import { classifyBrowserRetryTaxonomy } from './retry-taxonomy.js';

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

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await execute();
    } catch (err) {
      lastError = err;
      if (attempt >= maxRetries) break;
      const code = (err as NodeJS.ErrnoException | undefined)?.code ?? '';
      const message = (err as Error | undefined)?.message ?? '';
      const taxonomy = classifyBrowserRetryTaxonomy(code, message);
      if (!taxonomy.retryable) break;
      if (backoffMs > 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, backoffMs * (attempt + 1)));
      }
    }
  }
  throw lastError;
}

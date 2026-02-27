import type { BrowserActionError, BrowserRetryCategory } from './types.js';

export interface BrowserRetryTaxonomy {
  retryable: boolean;
  retryCategory: BrowserRetryCategory;
  retryHint: string;
}

function hasMessageSignal(messageLower: string, signals: string[]): boolean {
  return signals.some((signal) => messageLower.includes(signal));
}

export function classifyBrowserRetryTaxonomy(
  code: string,
  message: string,
): BrowserRetryTaxonomy {
  const normalizedCode = code.trim().toUpperCase();
  const messageLower = message.trim().toLowerCase();

  if (
    normalizedCode === 'BROWSER_POLICY_DENY'
    || normalizedCode === 'BROWSER_POLICY_APPROVAL_REQUIRED'
  ) {
    return {
      retryable: false,
      retryCategory: 'policy',
      retryHint: 'Policy decisions are deterministic; adjust allow/block/approval configuration or operator decision.',
    };
  }

  if (
    normalizedCode === 'PLAYWRIGHT_UNAVAILABLE'
    || normalizedCode === 'DAEMON_STOPPED'
    || normalizedCode === 'BROWSER_RUNTIME_DISABLED'
    || normalizedCode === 'ACTION_CANCELLED'
  ) {
    return {
      retryable: false,
      retryCategory: 'runtime-unavailable',
      retryHint: 'Runtime unavailable; install Playwright or restart browser runtime before retrying.',
    };
  }

  if (
    normalizedCode === 'SESSION_NOT_FOUND'
    || normalizedCode === 'SESSION_CLOSED'
    || normalizedCode === 'SESSION_EXISTS'
    || normalizedCode === 'SESSION_OPENING'
    || normalizedCode === 'MAX_SESSIONS_REACHED'
    || normalizedCode === 'DAEMON_PAUSED'
  ) {
    return {
      retryable: false,
      retryCategory: 'session-state',
      retryHint: 'Session state conflict; open/resume/select a valid session before retrying.',
    };
  }

  if (
    hasMessageSignal(messageLower, [
      'invalid url',
      'missing/invalid',
      'session_id is required',
      'selector is required',
      'url is required',
    ])
  ) {
    return {
      retryable: false,
      retryCategory: 'invalid-input',
      retryHint: 'Input validation failed; correct tool arguments before retrying.',
    };
  }

  if (
    hasMessageSignal(messageLower, [
      'selector',
      'strict mode violation',
      'no node found',
      'cannot find',
      'not visible',
      'not attached',
      'element is not',
    ])
  ) {
    return {
      retryable: false,
      retryCategory: 'selector',
      retryHint: 'Selector interaction failed; verify DOM state or selector value before retrying.',
    };
  }

  if (
    normalizedCode.includes('TIMEOUT')
    || hasMessageSignal(messageLower, ['timeout', 'timed out'])
  ) {
    return {
      retryable: true,
      retryCategory: 'timeout',
      retryHint: 'Timeout detected; retry is safe with backoff and optional higher timeout.',
    };
  }

  if (
    hasMessageSignal(messageLower, [
      'net::err',
      'connection reset',
      'econnreset',
      'econnrefused',
      'dns',
      'temporarily unavailable',
      'socket hang up',
    ])
  ) {
    return {
      retryable: true,
      retryCategory: 'network',
      retryHint: 'Transient network fault detected; retry with backoff is recommended.',
    };
  }

  if (hasMessageSignal(messageLower, ['target closed', 'page crashed', 'context closed'])) {
    return {
      retryable: true,
      retryCategory: 'transient',
      retryHint: 'Runtime context interruption detected; reopen session and retry once.',
    };
  }

  return {
    retryable: false,
    retryCategory: 'unknown',
    retryHint: 'Unclassified failure; inspect error message before retrying.',
  };
}

export function withRetryTaxonomy(
  code: string,
  message: string,
): BrowserActionError {
  const taxonomy = classifyBrowserRetryTaxonomy(code, message);
  return {
    code,
    message,
    retryable: taxonomy.retryable,
    retryCategory: taxonomy.retryCategory,
    retryHint: taxonomy.retryHint,
  };
}

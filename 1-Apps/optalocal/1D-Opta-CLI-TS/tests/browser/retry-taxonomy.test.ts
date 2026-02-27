import { describe, expect, it } from 'vitest';
import {
  classifyBrowserRetryTaxonomy,
  withRetryTaxonomy,
  type BrowserRetryTaxonomy,
} from '../../src/browser/retry-taxonomy.js';

describe('classifyBrowserRetryTaxonomy', () => {
  describe('policy category (not retryable)', () => {
    it('classifies BROWSER_POLICY_DENY', () => {
      const result = classifyBrowserRetryTaxonomy('BROWSER_POLICY_DENY', 'access denied');
      expect(result.retryable).toBe(false);
      expect(result.retryCategory).toBe('policy');
      expect(result.retryHint).toContain('Policy decisions');
    });

    it('classifies BROWSER_POLICY_APPROVAL_REQUIRED', () => {
      const result = classifyBrowserRetryTaxonomy('BROWSER_POLICY_APPROVAL_REQUIRED', 'needs approval');
      expect(result.retryable).toBe(false);
      expect(result.retryCategory).toBe('policy');
    });

    it('handles case insensitivity and whitespace in code', () => {
      const result = classifyBrowserRetryTaxonomy('  browser_policy_deny  ', 'whatever');
      expect(result.retryCategory).toBe('policy');
    });
  });

  describe('runtime-unavailable category (not retryable)', () => {
    const codes = [
      'PLAYWRIGHT_UNAVAILABLE',
      'DAEMON_STOPPED',
      'BROWSER_RUNTIME_DISABLED',
      'ACTION_CANCELLED',
    ];

    for (const code of codes) {
      it(`classifies ${code}`, () => {
        const result = classifyBrowserRetryTaxonomy(code, 'some error');
        expect(result.retryable).toBe(false);
        expect(result.retryCategory).toBe('runtime-unavailable');
        expect(result.retryHint).toContain('Runtime unavailable');
      });
    }
  });

  describe('session-state category (not retryable)', () => {
    const codes = [
      'SESSION_NOT_FOUND',
      'SESSION_CLOSED',
      'SESSION_EXISTS',
      'SESSION_OPENING',
      'MAX_SESSIONS_REACHED',
      'DAEMON_PAUSED',
    ];

    for (const code of codes) {
      it(`classifies ${code}`, () => {
        const result = classifyBrowserRetryTaxonomy(code, 'some error');
        expect(result.retryable).toBe(false);
        expect(result.retryCategory).toBe('session-state');
        expect(result.retryHint).toContain('Session state');
      });
    }
  });

  describe('invalid-input category (not retryable)', () => {
    const messages = [
      'invalid url provided',
      'missing/invalid argument',
      'session_id is required for this operation',
      'selector is required',
      'url is required',
    ];

    for (const message of messages) {
      it(`classifies message: "${message}"`, () => {
        const result = classifyBrowserRetryTaxonomy('SOME_CODE', message);
        expect(result.retryable).toBe(false);
        expect(result.retryCategory).toBe('invalid-input');
        expect(result.retryHint).toContain('Input validation');
      });
    }

    it('is case-insensitive for message matching', () => {
      const result = classifyBrowserRetryTaxonomy('SOME_CODE', 'INVALID URL was given');
      expect(result.retryCategory).toBe('invalid-input');
    });
  });

  describe('selector category (not retryable)', () => {
    const messages = [
      'element with selector #btn not found',
      'strict mode violation: locator resolved to 2 elements',
      'no node found for selector div.item',
      'cannot find element by selector',
      'element is not visible',
      'element is not attached to the DOM',
      'element is not clickable',
    ];

    for (const message of messages) {
      it(`classifies message: "${message}"`, () => {
        const result = classifyBrowserRetryTaxonomy('SOME_CODE', message);
        expect(result.retryable).toBe(false);
        expect(result.retryCategory).toBe('selector');
        expect(result.retryHint).toContain('Selector');
      });
    }
  });

  describe('timeout category (retryable)', () => {
    it('classifies TIMEOUT code', () => {
      const result = classifyBrowserRetryTaxonomy('TIMEOUT', 'operation timed out');
      expect(result.retryable).toBe(true);
      expect(result.retryCategory).toBe('timeout');
      expect(result.retryHint).toContain('Timeout');
    });

    it('classifies NAVIGATION_TIMEOUT code', () => {
      const result = classifyBrowserRetryTaxonomy('NAVIGATION_TIMEOUT', 'page load timeout');
      expect(result.retryable).toBe(true);
      expect(result.retryCategory).toBe('timeout');
    });

    it('classifies timeout in message', () => {
      const result = classifyBrowserRetryTaxonomy('SOME_CODE', 'request timed out after 30s');
      expect(result.retryable).toBe(true);
      expect(result.retryCategory).toBe('timeout');
    });

    it('classifies message containing "timeout"', () => {
      const result = classifyBrowserRetryTaxonomy('SOME_CODE', 'navigation timeout exceeded');
      expect(result.retryable).toBe(true);
      expect(result.retryCategory).toBe('timeout');
    });
  });

  describe('network category (retryable)', () => {
    const messages = [
      'net::err_connection_refused',
      'connection reset by peer',
      'econnreset detected',
      'econnrefused on port 8080',
      'dns resolution failed',
      'server temporarily unavailable',
      'socket hang up during transfer',
    ];

    for (const message of messages) {
      it(`classifies message: "${message}"`, () => {
        const result = classifyBrowserRetryTaxonomy('SOME_CODE', message);
        expect(result.retryable).toBe(true);
        expect(result.retryCategory).toBe('network');
        expect(result.retryHint).toContain('network');
      });
    }
  });

  describe('transient category (retryable)', () => {
    const messages = [
      'target closed unexpectedly',
      'page crashed during operation',
      'browser context closed',
    ];

    for (const message of messages) {
      it(`classifies message: "${message}"`, () => {
        const result = classifyBrowserRetryTaxonomy('SOME_CODE', message);
        expect(result.retryable).toBe(true);
        expect(result.retryCategory).toBe('transient');
        expect(result.retryHint).toContain('context interruption');
      });
    }
  });

  describe('unknown category (not retryable)', () => {
    it('classifies unrecognized code and message', () => {
      const result = classifyBrowserRetryTaxonomy('UNRECOGNIZED_CODE', 'some random error');
      expect(result.retryable).toBe(false);
      expect(result.retryCategory).toBe('unknown');
      expect(result.retryHint).toContain('Unclassified');
    });

    it('classifies empty code and message', () => {
      const result = classifyBrowserRetryTaxonomy('', '');
      expect(result.retryable).toBe(false);
      expect(result.retryCategory).toBe('unknown');
    });
  });

  describe('classification priority', () => {
    it('policy codes take precedence over message-based classification', () => {
      // Even if message contains "timeout", policy code wins
      const result = classifyBrowserRetryTaxonomy('BROWSER_POLICY_DENY', 'timeout error');
      expect(result.retryCategory).toBe('policy');
    });

    it('runtime codes take precedence over message-based classification', () => {
      const result = classifyBrowserRetryTaxonomy('PLAYWRIGHT_UNAVAILABLE', 'timeout error');
      expect(result.retryCategory).toBe('runtime-unavailable');
    });

    it('session codes take precedence over message-based classification', () => {
      const result = classifyBrowserRetryTaxonomy('SESSION_NOT_FOUND', 'invalid url');
      expect(result.retryCategory).toBe('session-state');
    });

    it('invalid-input takes precedence over selector messages', () => {
      // "selector is required" matches invalid-input before selector check
      const result = classifyBrowserRetryTaxonomy('SOME_CODE', 'selector is required');
      expect(result.retryCategory).toBe('invalid-input');
    });

    it('selector takes precedence over timeout messages', () => {
      // "selector not visible" matches selector but not timeout
      const result = classifyBrowserRetryTaxonomy('SOME_CODE', 'not visible in DOM');
      expect(result.retryCategory).toBe('selector');
    });

    it('timeout code takes precedence over network messages', () => {
      const result = classifyBrowserRetryTaxonomy('NAVIGATION_TIMEOUT', 'net::err something');
      expect(result.retryCategory).toBe('timeout');
    });
  });
});

describe('withRetryTaxonomy', () => {
  it('returns BrowserActionError with taxonomy fields', () => {
    const result = withRetryTaxonomy('BROWSER_POLICY_DENY', 'blocked');
    expect(result.code).toBe('BROWSER_POLICY_DENY');
    expect(result.message).toBe('blocked');
    expect(result.retryable).toBe(false);
    expect(result.retryCategory).toBe('policy');
    expect(result.retryHint).toBeTruthy();
  });

  it('returns retryable=true for timeout errors', () => {
    const result = withRetryTaxonomy('TIMEOUT', 'operation timed out');
    expect(result.retryable).toBe(true);
    expect(result.retryCategory).toBe('timeout');
  });

  it('preserves original code and message exactly', () => {
    const result = withRetryTaxonomy('MY_CODE', 'My Original Message');
    expect(result.code).toBe('MY_CODE');
    expect(result.message).toBe('My Original Message');
  });

  it('returns all required fields of BrowserActionError', () => {
    const result = withRetryTaxonomy('SOME_CODE', 'some error');
    expect(result).toHaveProperty('code');
    expect(result).toHaveProperty('message');
    expect(result).toHaveProperty('retryable');
    expect(result).toHaveProperty('retryCategory');
    expect(result).toHaveProperty('retryHint');
  });
});

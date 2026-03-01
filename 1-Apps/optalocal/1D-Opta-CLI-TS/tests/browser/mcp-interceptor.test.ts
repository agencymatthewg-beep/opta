import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { interceptBrowserMcpCall, BrowserPolicyDeniedError, type BrowserMcpInterceptorConfig } from '../../src/browser/mcp-interceptor.js';

// Mock the policy engine
vi.mock('../../src/browser/policy-engine.js', () => ({
  evaluateBrowserPolicyAction: vi.fn(),
  isBrowserToolName: (name: string) => name.startsWith('browser_'),
}));

// Mock approval-log
vi.mock('../../src/browser/approval-log.js', () => ({
  appendBrowserApprovalEvent: vi.fn().mockResolvedValue(undefined),
}));

import { evaluateBrowserPolicyAction } from '../../src/browser/policy-engine.js';

const baseConfig: BrowserMcpInterceptorConfig = {
  policyConfig: {
    requireApprovalForHighRisk: true,
    allowedHosts: ['*'],
    blockedOrigins: [],
    sensitiveActions: ['auth_submit', 'post', 'checkout', 'delete'],
    credentialIsolation: true,
  },
  sessionId: 'test-sess-01',
};

afterEach(() => vi.clearAllMocks());

describe('BrowserMcpInterceptor', () => {
  it('allows low-risk tools and calls execute()', async () => {
    vi.mocked(evaluateBrowserPolicyAction).mockReturnValue({
      decision: 'allow', risk: 'low', actionKey: 'observe', reason: 'ok',
      riskEvidence: { classifier: 'static', matchedSignals: [] },
    });

    const execute = vi.fn().mockResolvedValue('snapshot-result');
    const result = await interceptBrowserMcpCall('browser_snapshot', {}, baseConfig, execute);

    expect(execute).toHaveBeenCalledOnce();
    expect(result).toBe('snapshot-result');
  });

  it('throws BrowserPolicyDeniedError on denied tools without calling execute()', async () => {
    vi.mocked(evaluateBrowserPolicyAction).mockReturnValue({
      decision: 'deny', risk: 'high', actionKey: 'upload', reason: 'blocked origin',
      riskEvidence: { classifier: 'static', matchedSignals: ['policy:blocked-origin'] },
    });

    const execute = vi.fn();
    await expect(interceptBrowserMcpCall('browser_file_upload', {}, baseConfig, execute))
      .rejects.toThrow(BrowserPolicyDeniedError);
    expect(execute).not.toHaveBeenCalled();
  });

  it('gates high-risk tools: calls onGate, then execute() if approved', async () => {
    vi.mocked(evaluateBrowserPolicyAction).mockReturnValue({
      decision: 'gate', risk: 'high', actionKey: 'execute', reason: 'js execution',
      riskEvidence: { classifier: 'static', matchedSignals: ['tool:browser_evaluate'] },
    });

    const execute = vi.fn().mockResolvedValue('eval-result');
    const onGate = vi.fn().mockResolvedValue('approved');

    const result = await interceptBrowserMcpCall(
      'browser_evaluate', { expression: 'window.title' },
      { ...baseConfig, onGate },
      execute,
    );

    expect(onGate).toHaveBeenCalledOnce();
    expect(execute).toHaveBeenCalledOnce();
    expect(result).toBe('eval-result');
  });

  it('gates high-risk tools: throws if gate is denied', async () => {
    vi.mocked(evaluateBrowserPolicyAction).mockReturnValue({
      decision: 'gate', risk: 'high', actionKey: 'execute', reason: 'js execution',
      riskEvidence: { classifier: 'static', matchedSignals: [] },
    });

    const execute = vi.fn();
    const onGate = vi.fn().mockResolvedValue('denied');

    await expect(interceptBrowserMcpCall('browser_evaluate', {}, { ...baseConfig, onGate }, execute))
      .rejects.toThrow(BrowserPolicyDeniedError);
    expect(execute).not.toHaveBeenCalled();
  });

  it('passes non-browser tools through without policy evaluation', async () => {
    const execute = vi.fn().mockResolvedValue('read-result');
    const result = await interceptBrowserMcpCall('read_file', { path: '/foo' }, baseConfig, execute);

    expect(evaluateBrowserPolicyAction).not.toHaveBeenCalled();
    expect(execute).toHaveBeenCalledOnce();
    expect(result).toBe('read-result');
  });

  it('denies gated tools with no onGate handler by default', async () => {
    vi.mocked(evaluateBrowserPolicyAction).mockReturnValue({
      decision: 'gate', risk: 'high', actionKey: 'execute', reason: 'js execution',
      riskEvidence: { classifier: 'static', matchedSignals: [] },
    });

    const execute = vi.fn();
    // No onGate provided — should deny by default
    await expect(interceptBrowserMcpCall('browser_evaluate', {}, baseConfig, execute))
      .rejects.toThrow(BrowserPolicyDeniedError);
    expect(execute).not.toHaveBeenCalled();
  });

  it('allows browser_scroll as low-risk observe tool', async () => {
    vi.mocked(evaluateBrowserPolicyAction).mockReturnValue({
      decision: 'allow', risk: 'low', actionKey: 'observe', reason: 'scroll is non-destructive',
      riskEvidence: { classifier: 'static', matchedSignals: [] },
    });

    const execute = vi.fn().mockResolvedValue('scrolled');
    const result = await interceptBrowserMcpCall(
      'browser_scroll', { direction: 'down', amount: 300 }, baseConfig, execute,
    );

    expect(evaluateBrowserPolicyAction).toHaveBeenCalledOnce();
    expect(execute).toHaveBeenCalledOnce();
    expect(result).toBe('scrolled');
  });

  it('allows browser_hover as low-risk observe tool', async () => {
    vi.mocked(evaluateBrowserPolicyAction).mockReturnValue({
      decision: 'allow', risk: 'low', actionKey: 'observe', reason: 'hover is non-destructive',
      riskEvidence: { classifier: 'static', matchedSignals: [] },
    });

    const execute = vi.fn().mockResolvedValue('hovered');
    const result = await interceptBrowserMcpCall(
      'browser_hover', { selector: '.tooltip-target' }, baseConfig, execute,
    );

    expect(execute).toHaveBeenCalledOnce();
    expect(result).toBe('hovered');
  });

  it('gates browser_evaluate with arbitrary JS expression and logs approval event', async () => {
    vi.mocked(evaluateBrowserPolicyAction).mockReturnValue({
      decision: 'gate', risk: 'high', actionKey: 'execute', reason: 'arbitrary JS execution',
      riskEvidence: { classifier: 'static', matchedSignals: ['tool:browser_evaluate', 'risk:js-execution'] },
    });

    const { appendBrowserApprovalEvent } = await import('../../src/browser/approval-log.js');
    const execute = vi.fn().mockResolvedValue('document.title');
    const onGate = vi.fn().mockResolvedValue('approved');

    await interceptBrowserMcpCall(
      'browser_evaluate',
      { expression: 'document.title' },
      { ...baseConfig, onGate },
      execute,
    );

    expect(appendBrowserApprovalEvent).toHaveBeenCalledWith(
      expect.objectContaining({ tool: 'browser_evaluate', decision: 'approved' }),
    );
    expect(execute).toHaveBeenCalledOnce();
  });

  it('allows browser_go_back as medium-risk navigation tool', async () => {
    vi.mocked(evaluateBrowserPolicyAction).mockReturnValue({
      decision: 'allow', risk: 'medium', actionKey: 'navigate', reason: 'back navigation allowed',
      riskEvidence: { classifier: 'static', matchedSignals: ['tool:browser_go_back'] },
    });

    const execute = vi.fn().mockResolvedValue('navigated back');
    const result = await interceptBrowserMcpCall('browser_go_back', {}, baseConfig, execute);

    expect(evaluateBrowserPolicyAction).toHaveBeenCalledWith(
      baseConfig.policyConfig,
      expect.objectContaining({ toolName: 'browser_go_back' }),
    );
    expect(result).toBe('navigated back');
  });

  describe('auto-retry on retryable errors', () => {
    beforeEach(() => {
      vi.mocked(evaluateBrowserPolicyAction).mockReturnValue({
        decision: 'allow', risk: 'low', actionKey: 'interact', reason: 'allowed',
        riskEvidence: { classifier: 'static', matchedSignals: [] },
      });
    });

    it('retries a timeout error and succeeds on second attempt', async () => {
      const timeoutErr = Object.assign(new Error('Timeout exceeded'), { code: 'ETIMEDOUT' });
      const execute = vi.fn()
        .mockRejectedValueOnce(timeoutErr)
        .mockResolvedValue({ ok: true });

      const result = await interceptBrowserMcpCall(
        'browser_click',
        { selector: '#btn' },
        { policyConfig: { allowedHosts: ['*'] }, sessionId: 'retry-test', maxRetries: 1, retryBackoffMs: 0 },
        execute,
      );

      expect(result).toEqual({ ok: true });
      expect(execute).toHaveBeenCalledTimes(2);
    });

    it('does not retry a selector error (non-retryable taxonomy)', async () => {
      const selectorErr = new Error('waiting for selector "#missing" failed');
      const execute = vi.fn().mockRejectedValue(selectorErr);

      await expect(interceptBrowserMcpCall(
        'browser_click',
        { selector: '#missing' },
        { policyConfig: { allowedHosts: ['*'] }, sessionId: 'no-retry-test', maxRetries: 2, retryBackoffMs: 0 },
        execute,
      )).rejects.toThrow('waiting for selector');

      // selector category is non-retryable — only 1 attempt
      expect(execute).toHaveBeenCalledTimes(1);
    });

    it('exhausts retries and throws last error', async () => {
      const netErr = Object.assign(new Error('net::ERR_CONNECTION_REFUSED'), { code: 'ECONNREFUSED' });
      const execute = vi.fn().mockRejectedValue(netErr);

      await expect(interceptBrowserMcpCall(
        'browser_navigate',
        { url: 'http://localhost:9999' },
        { policyConfig: { allowedHosts: ['*'] }, sessionId: 'exhaust-test', maxRetries: 2, retryBackoffMs: 0 },
        execute,
      )).rejects.toThrow('net::ERR_CONNECTION_REFUSED');

      expect(execute).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
    });
  });

  describe('selector healing via auto-snapshot', () => {
    it('calls executeSnapshot and onSelectorFail when selector error exhausts retries on browser_click', async () => {
      const selectorErr = new Error('waiting for selector "#missing" failed: timeout');
      const execute = vi.fn().mockRejectedValue(selectorErr);
      const executeSnapshot = vi.fn().mockResolvedValue('<snapshot>page html</snapshot>');
      const onSelectorFail = vi.fn().mockResolvedValue(undefined);

      await expect(
        interceptBrowserMcpCall(
          'browser_click',
          { selector: '#missing' },
          {
            policyConfig: {},
            sessionId: 'test',
            onSelectorFail,
            executeSnapshot,
          },
          execute,
        ),
      ).rejects.toThrow('waiting for selector');

      expect(executeSnapshot).toHaveBeenCalledOnce();
      expect(onSelectorFail).toHaveBeenCalledWith('browser_click', '#missing', '<snapshot>page html</snapshot>');
    });

    it('does not call onSelectorFail for non-selector errors', async () => {
      const networkErr = Object.assign(new Error('ECONNREFUSED'), { code: 'ECONNREFUSED' });
      const execute = vi.fn().mockRejectedValue(networkErr);
      const executeSnapshot = vi.fn().mockResolvedValue('<snapshot/>');
      const onSelectorFail = vi.fn();

      await expect(
        interceptBrowserMcpCall(
          'browser_click',
          { selector: '#btn' },
          {
            policyConfig: {},
            sessionId: 'test',
            onSelectorFail,
            executeSnapshot,
          },
          execute,
        ),
      ).rejects.toThrow('ECONNREFUSED');

      expect(onSelectorFail).not.toHaveBeenCalled();
    });
  });
});

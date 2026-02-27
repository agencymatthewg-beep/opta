import { describe, expect, it } from 'vitest';
import { routeBrowserIntent } from '../../src/browser/intent-router.js';
import { evaluateBrowserPolicyAction } from '../../src/browser/policy-engine.js';

describe('browser intent router', () => {
  it('routes explicit web URL tasks to browser automation', () => {
    const decision = routeBrowserIntent(
      'Open https://example.com/login, sign in, and check the dashboard status.',
    );

    expect(decision.shouldRoute).toBe(true);
    expect(decision.confidence).toBe('high');
    expect(decision.suggestedUrl).toBe('https://example.com/login');
  });

  it('does not route local-only coding tasks', () => {
    const decision = routeBrowserIntent('Refactor src/core/config.ts and run unit tests.');

    expect(decision.shouldRoute).toBe(false);
    expect(decision.confidence).toBe('low');
  });

  it('returns deterministic rationale and confidence scores for repeat evaluations', () => {
    const task = 'Open https://example.com/settings and then refactor local repository docs.';
    const first = routeBrowserIntent(task);
    const second = routeBrowserIntent(task);

    expect(first).toEqual(second);
    expect(first.confidenceScore).toBeGreaterThanOrEqual(0);
    expect(first.confidenceScore).toBeLessThanOrEqual(1);
    expect(first.rationale).toContain('score=');
    expect(first.rationale).toContain('threshold=');
  });

  it('does not route ambiguous local-first tasks with weak web wording', () => {
    const decision = routeBrowserIntent(
      'Update repository docs about our web architecture and run local unit tests.',
    );

    expect(decision.shouldRoute).toBe(false);
    expect(decision.confidence).toBe('low');
    expect(decision.rationale).toContain('route=false');
  });

  it('applies deterministic adaptation route penalties from run corpus hints', () => {
    const task = 'Navigate to https://example.com/dashboard and click the status tab.';
    const baseline = routeBrowserIntent(task);
    const adapted = routeBrowserIntent(task, {
      adaptationHint: {
        routePenalty: 6,
        reason: 'run-corpus adaptation enabled route penalty',
        regressionPressure: 0.6,
        meanRegressionScore: 0.4,
        failureRate: 0.3,
      },
    });

    expect(baseline.shouldRoute).toBe(true);
    expect(baseline.confidenceScore).toBeGreaterThan(0.5);
    expect(adapted.shouldRoute).toBe(false);
    expect(adapted.adaptationPenalty).toBe(6);
    expect(adapted.adaptationReason).toContain('run-corpus adaptation enabled');
    expect(adapted.rationale).toContain('adaptation_penalty=6');
    expect(adapted.signals).toContain('adaptive:route-penalty');
  });
});

describe('browser policy engine', () => {
  const baseConfig = {
    requireApprovalForHighRisk: true,
    allowedHosts: ['example.com', '*.example.com'],
    blockedOrigins: ['https://blocked.example.com'],
    sensitiveActions: ['auth_submit', 'post', 'checkout', 'delete'],
  };

  it('denies blocked origins deterministically', () => {
    const decision = evaluateBrowserPolicyAction(baseConfig, {
      toolName: 'browser_navigate',
      args: {
        session_id: 'sess-01',
        url: 'https://blocked.example.com/private',
      },
    });

    expect(decision.decision).toBe('deny');
    expect(decision.reason).toContain('blocked origin');
  });

  it('requires approval for high-risk sensitive actions', () => {
    const decision = evaluateBrowserPolicyAction(baseConfig, {
      toolName: 'browser_click',
      args: {
        session_id: 'sess-01',
        selector: 'button[data-action="delete-account"]',
      },
      currentOrigin: 'https://example.com',
    });

    expect(decision.risk).toBe('high');
    expect(decision.decision).toBe('gate');
  });

  it('allows low-risk screenshot actions', () => {
    const decision = evaluateBrowserPolicyAction(baseConfig, {
      toolName: 'browser_screenshot',
      args: {
        session_id: 'sess-01',
      },
    });

    expect(decision.risk).toBe('low');
    expect(decision.decision).toBe('allow');
  });
});

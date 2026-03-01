/**
 * Security: Browser policy engine audit.
 *
 * Verifies that the policy engine correctly:
 * - Denies blocked origins
 * - Denies hosts not on allowlist (when restrictive)
 * - Gates high-risk actions for approval
 * - Allows low-risk observation tools
 * - Detects sensitive keyword patterns for auth/checkout/delete
 */
import { describe, it, expect } from 'vitest';
import {
  evaluateBrowserPolicyAction,
  normalizeBrowserPolicyConfig,
  type BrowserPolicyConfig,
} from '../../src/browser/policy-engine.js';

describe('browser policy — security defaults', () => {
  it('default config denies all hosts and requires approval for high-risk', () => {
    const config = normalizeBrowserPolicyConfig();
    expect(config.requireApprovalForHighRisk).toBe(true);
    expect(config.allowedHosts).toEqual([]);
    expect(config.credentialIsolation).toBe(true);
    expect(config.blockedOrigins).toEqual([]);
    expect(config.sensitiveActions).toEqual(
      expect.arrayContaining(['auth_submit', 'post', 'checkout', 'delete']),
    );
  });

  it('denies navigation to blocked origins', () => {
    const config: Partial<BrowserPolicyConfig> = {
      blockedOrigins: ['https://evil.example.com'],
    };
    const decision = evaluateBrowserPolicyAction(config, {
      toolName: 'browser_navigate',
      args: { url: 'https://evil.example.com/phishing' },
    });
    expect(decision.decision).toBe('deny');
    expect(decision.risk).toBe('high');
  });

  it('denies navigation when host is not on a restrictive allowlist', () => {
    const config: Partial<BrowserPolicyConfig> = {
      allowedHosts: ['opta.app'],
    };
    const decision = evaluateBrowserPolicyAction(config, {
      toolName: 'browser_navigate',
      args: { url: 'https://external-bank.com/dashboard' },
    });
    expect(decision.decision).toBe('deny');
    expect(decision.risk).toBe('high');
  });

  it('allows navigation to hosts on the allowlist', () => {
    const config: Partial<BrowserPolicyConfig> = {
      allowedHosts: ['opta.app'],
    };
    const decision = evaluateBrowserPolicyAction(config, {
      toolName: 'browser_navigate',
      args: { url: 'https://opta.app/dashboard' },
    });
    expect(decision.decision).not.toBe('deny');
  });

  it('denies cross-origin navigation from credential-bearing pages', () => {
    const config: Partial<BrowserPolicyConfig> = {
      allowedHosts: ['login.opta.app', 'dashboard.opta.app'],
      credentialIsolation: true,
    };
    const decision = evaluateBrowserPolicyAction(config, {
      toolName: 'browser_navigate',
      args: { url: 'https://dashboard.opta.app/home' },
      currentOrigin: 'https://login.opta.app',
      currentPageHasCredentials: true,
    });

    expect(decision.decision).toBe('deny');
    expect(decision.riskEvidence.matchedSignals).toContain('policy:credential-isolation');
  });

  it('allows same-origin navigation from credential-bearing pages', () => {
    const config: Partial<BrowserPolicyConfig> = {
      allowedHosts: ['login.opta.app'],
      credentialIsolation: true,
    };
    const decision = evaluateBrowserPolicyAction(config, {
      toolName: 'browser_navigate',
      args: { url: 'https://login.opta.app/home' },
      currentOrigin: 'https://login.opta.app',
      currentPageHasCredentials: true,
    });

    expect(decision.decision).toBe('allow');
  });

  it('allows screenshot (low-risk observation)', () => {
    const decision = evaluateBrowserPolicyAction(undefined, {
      toolName: 'browser_screenshot',
      args: {},
    });
    expect(decision.decision).toBe('allow');
    expect(decision.risk).toBe('low');
  });

  it('allows snapshot (low-risk observation)', () => {
    const decision = evaluateBrowserPolicyAction(undefined, {
      toolName: 'browser_snapshot',
      args: {},
    });
    expect(decision.decision).toBe('allow');
    expect(decision.risk).toBe('low');
  });

  it('allows browser_close (low-risk)', () => {
    const decision = evaluateBrowserPolicyAction(undefined, {
      toolName: 'browser_close',
      args: {},
    });
    expect(decision.decision).toBe('allow');
    expect(decision.risk).toBe('low');
  });

  it('gates clicking a login button as high-risk', () => {
    const decision = evaluateBrowserPolicyAction(undefined, {
      toolName: 'browser_click',
      args: { selector: 'button.login', text: 'Sign In' },
    });
    expect(decision.risk).toBe('high');
    expect(decision.actionKey).toBe('auth_submit');
    expect(decision.decision).toBe('gate');
  });

  it('gates clicking a delete button as high-risk', () => {
    const decision = evaluateBrowserPolicyAction(undefined, {
      toolName: 'browser_click',
      args: { selector: 'button.delete-account', text: 'Delete Account' },
    });
    expect(decision.risk).toBe('high');
    expect(decision.actionKey).toBe('delete');
    expect(decision.decision).toBe('gate');
  });

  it('gates checkout-related navigation as high-risk', () => {
    const decision = evaluateBrowserPolicyAction(
      { allowedHosts: ['shop.example.com'] },
      {
        toolName: 'browser_navigate',
        args: { url: 'https://shop.example.com/checkout' },
      },
    );
    expect(decision.risk).toBe('high');
    expect(decision.actionKey).toBe('checkout');
    expect(decision.decision).toBe('gate');
  });

  it('gates form submission with submit flag as high-risk post', () => {
    const decision = evaluateBrowserPolicyAction(undefined, {
      toolName: 'browser_type',
      args: { text: 'some text', submit: true },
    });
    expect(decision.risk).toBe('high');
    expect(decision.actionKey).toBe('post');
    expect(decision.decision).toBe('gate');
  });

  it('allows high-risk action when pre-approved', () => {
    const decision = evaluateBrowserPolicyAction(undefined, {
      toolName: 'browser_click',
      args: { selector: 'button.login', text: 'Sign In' },
      approved: true,
    });
    expect(decision.decision).toBe('allow');
    expect(decision.risk).toBe('high');
  });

  it('denies navigation with missing URL', () => {
    const decision = evaluateBrowserPolicyAction(undefined, {
      toolName: 'browser_navigate',
      args: {},
    });
    expect(decision.decision).toBe('deny');
  });

  it('denies navigation with invalid URL', () => {
    const decision = evaluateBrowserPolicyAction(undefined, {
      toolName: 'browser_navigate',
      args: { url: 'not-a-valid-url' },
    });
    expect(decision.decision).toBe('deny');
  });

  it('classifies regular navigation as medium risk', () => {
    const decision = evaluateBrowserPolicyAction(
      { allowedHosts: ['docs.example.com'] },
      {
        toolName: 'browser_navigate',
        args: { url: 'https://docs.example.com/getting-started' },
      },
    );
    expect(decision.risk).toBe('medium');
    expect(decision.decision).toBe('allow');
  });

  it('escalates risk when adaptation hint is present', () => {
    // Use a non-sensitive selector so base classification is 'medium' (generic click)
    const decision = evaluateBrowserPolicyAction(undefined, {
      toolName: 'browser_click',
      args: { selector: 'button.next-page' },
      adaptationHint: {
        escalateRisk: true,
        reason: 'Recent quality regressions detected',
        regressionPressure: 0.5,
        meanRegressionScore: 0.3,
        failureRate: 0.25,
      },
    });
    // Medium -> High due to escalation
    expect(decision.risk).toBe('high');
    expect(decision.riskEvidence.classifier).toBe('adaptive-escalation');
  });

  it('does not escalate risk for observation tools even with adaptation hint', () => {
    const decision = evaluateBrowserPolicyAction(undefined, {
      toolName: 'browser_screenshot',
      args: {},
      adaptationHint: {
        escalateRisk: true,
        reason: 'Quality degradation',
        regressionPressure: 0.5,
        meanRegressionScore: 0.3,
        failureRate: 0.25,
      },
    });
    expect(decision.risk).toBe('low');
    expect(decision.riskEvidence.classifier).toBe('static');
  });

  it('supports wildcard host matching', () => {
    const config: Partial<BrowserPolicyConfig> = {
      allowedHosts: ['*.opta.app'],
    };
    const decision = evaluateBrowserPolicyAction(config, {
      toolName: 'browser_navigate',
      args: { url: 'https://docs.opta.app/api' },
    });
    expect(decision.decision).not.toBe('deny');
  });
});

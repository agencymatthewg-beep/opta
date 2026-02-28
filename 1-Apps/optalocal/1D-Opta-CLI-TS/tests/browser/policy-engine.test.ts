import { describe, expect, it } from 'vitest';
import {
  evaluateBrowserPolicyAction,
  normalizeBrowserPolicyConfig,
} from '../../src/browser/policy-engine.js';

const baseConfig = {
  requireApprovalForHighRisk: true,
  allowedHosts: ['*'],
  blockedOrigins: [],
  sensitiveActions: ['auth_submit', 'post', 'checkout', 'delete'],
};

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = ((state * 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function randomLabel(random: () => number): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz';
  const length = 3 + Math.floor(random() * 6);
  let label = '';
  for (let i = 0; i < length; i += 1) {
    label += alphabet[Math.floor(random() * alphabet.length)] ?? 'a';
  }
  return label;
}

function generateDeterministicHosts(count: number, seed: number): string[] {
  const random = seededRandom(seed);
  const hosts = new Set<string>();
  while (hosts.size < count) {
    const depth = 2 + Math.floor(random() * 3);
    const labels: string[] = [];
    for (let i = 0; i < depth; i += 1) {
      labels.push(randomLabel(random));
    }
    hosts.add(labels.join('.'));
  }
  return [...hosts];
}

describe('browser policy engine hardening matrix', () => {
  it('normalizes cased and spaced URL allowlist entries', () => {
    const decision = evaluateBrowserPolicyAction(
      {
        ...baseConfig,
        requireApprovalForHighRisk: false,
        allowedHosts: ['   HTTPS://ExAmPle.CoM/login?next=%2Fdashboard   '],
      },
      {
        toolName: 'browser_navigate',
        args: { url: 'https://example.com/dashboard' },
      },
    );

    expect(decision.decision).toBe('allow');
    expect(decision.targetHost).toBe('example.com');
  });

  it('treats host:port patterns consistently as host rules', () => {
    const allowedByHostPort = evaluateBrowserPolicyAction(
      {
        ...baseConfig,
        requireApprovalForHighRisk: false,
        allowedHosts: ['  ExAmPlE.Com:443  '],
      },
      {
        toolName: 'browser_navigate',
        args: { url: 'https://example.com/path' },
      },
    );

    expect(allowedByHostPort.decision).toBe('allow');
    expect(allowedByHostPort.targetHost).toBe('example.com');

    const blockedByHostPortPattern = evaluateBrowserPolicyAction(
      {
        ...baseConfig,
        allowedHosts: ['*'],
        blockedOrigins: ['  forbidden.example.com:8443/blocked?x=1  '],
      },
      {
        toolName: 'browser_navigate',
        args: { url: 'https://forbidden.example.com/profile' },
      },
    );

    expect(blockedByHostPortPattern.decision).toBe('deny');
    expect(blockedByHostPortPattern.reason).toContain('blocked origin');
    expect(blockedByHostPortPattern.targetHost).toBe('forbidden.example.com');
  });

  it('blocks on origin even when blocked URL pattern includes path/query/hash', () => {
    const decision = evaluateBrowserPolicyAction(
      {
        ...baseConfig,
        allowedHosts: ['*'],
        blockedOrigins: ['  HTTPS://blocked.example.com/private/path?token=abc#frag  '],
      },
      {
        toolName: 'browser_navigate',
        args: { url: 'https://blocked.example.com/public' },
      },
    );

    expect(decision.decision).toBe('deny');
    expect(decision.reason).toContain('blocked origin');
    expect(decision.targetOrigin).toBe('https://blocked.example.com');
  });

  it('supports wildcard and subdomain allowlist patterns', () => {
    const allowAnyHost = evaluateBrowserPolicyAction(
      {
        ...baseConfig,
        requireApprovalForHighRisk: false,
        allowedHosts: ['*'],
      },
      {
        toolName: 'browser_navigate',
        args: { url: 'https://unknown-domain.dev/path' },
      },
    );

    expect(allowAnyHost.decision).toBe('allow');
    expect(allowAnyHost.targetHost).toBe('unknown-domain.dev');

    const allowSubdomain = evaluateBrowserPolicyAction(
      {
        ...baseConfig,
        requireApprovalForHighRisk: false,
        allowedHosts: ['*.example.com'],
      },
      {
        toolName: 'browser_navigate',
        args: { url: 'https://api.example.com/dashboard' },
      },
    );

    expect(allowSubdomain.decision).toBe('allow');
    expect(allowSubdomain.targetHost).toBe('api.example.com');

    const denyApexWithoutExplicitEntry = evaluateBrowserPolicyAction(
      {
        ...baseConfig,
        requireApprovalForHighRisk: false,
        allowedHosts: ['*.example.com'],
      },
      {
        toolName: 'browser_navigate',
        args: { url: 'https://example.com/dashboard' },
      },
    );

    expect(denyApexWithoutExplicitEntry.decision).toBe('deny');
    expect(denyApexWithoutExplicitEntry.reason).toContain('allowlist mismatch');
  });

  it('denies blocked origins before evaluating broad allowlist permissions', () => {
    const exactOriginBlocked = evaluateBrowserPolicyAction(
      {
        ...baseConfig,
        allowedHosts: ['*'],
        blockedOrigins: ['https://blocked.example.com'],
      },
      {
        toolName: 'browser_navigate',
        args: { url: 'https://blocked.example.com/delete-account' },
        approved: true,
      },
    );

    expect(exactOriginBlocked.decision).toBe('deny');
    expect(exactOriginBlocked.reason).toContain('blocked origin');
    expect(exactOriginBlocked.targetOrigin).toBe('https://blocked.example.com');

    const wildcardHostBlocked = evaluateBrowserPolicyAction(
      {
        ...baseConfig,
        allowedHosts: ['*'],
        blockedOrigins: ['*.forbidden.example.com'],
      },
      {
        toolName: 'browser_navigate',
        args: { url: 'https://deep.forbidden.example.com/profile' },
      },
    );

    expect(wildcardHostBlocked.decision).toBe('deny');
    expect(wildcardHostBlocked.reason).toContain('blocked origin');
    expect(wildcardHostBlocked.targetHost).toBe('deep.forbidden.example.com');
  });

  it('gates high-risk actions without approval and passes through with approval', () => {
    const gated = evaluateBrowserPolicyAction(baseConfig, {
      toolName: 'browser_click',
      args: { selector: 'button[data-action="delete-account"]' },
    });

    expect(gated.decision).toBe('gate');
    expect(gated.risk).toBe('high');
    expect(gated.actionKey).toBe('delete');

    const approved = evaluateBrowserPolicyAction(baseConfig, {
      toolName: 'browser_click',
      args: { selector: 'button[data-action="delete-account"]' },
      approved: true,
    });

    expect(approved.decision).toBe('allow');
    expect(approved.risk).toBe('high');
    expect(approved.actionKey).toBe('delete');
  });

  it('re-checks blocked origins for sensitive click/type actions when URL context is present', () => {
    const blockedClick = evaluateBrowserPolicyAction(
      {
        ...baseConfig,
        allowedHosts: ['*'],
        blockedOrigins: ['https://blocked.example.com'],
      },
      {
        toolName: 'browser_click',
        args: {
          selector: 'button[data-action="delete-account"]',
          url: 'https://blocked.example.com/settings',
        },
      },
    );
    expect(blockedClick.decision).toBe('deny');
    expect(blockedClick.reason).toContain('blocked origin');
    expect(blockedClick.targetOrigin).toBe('https://blocked.example.com');

    const blockedType = evaluateBrowserPolicyAction(
      {
        ...baseConfig,
        allowedHosts: ['*'],
        blockedOrigins: ['https://blocked.example.com'],
      },
      {
        toolName: 'browser_type',
        args: {
          selector: '#status',
          text: 'ship it',
          submit: true,
          url: 'https://blocked.example.com/post',
        },
      },
    );
    expect(blockedType.decision).toBe('deny');
    expect(blockedType.reason).toContain('blocked origin');
  });

  it('re-checks allowlist for sensitive click/type actions when URL context is present', () => {
    const decision = evaluateBrowserPolicyAction(
      {
        ...baseConfig,
        allowedHosts: ['example.com'],
        blockedOrigins: [],
      },
      {
        toolName: 'browser_click',
        args: {
          selector: 'button[data-action="delete-account"]',
          url: 'https://other.example.net/profile',
        },
      },
    );

    expect(decision.decision).toBe('deny');
    expect(decision.reason).toContain('allowlist mismatch');
    expect(decision.targetHost).toBe('other.example.net');
  });

  it('classifies destructive click intents from element metadata as high-risk', () => {
    const decision = evaluateBrowserPolicyAction(baseConfig, {
      toolName: 'browser_click',
      args: { element: 'Delete account button in settings' },
    });

    expect(decision.decision).toBe('gate');
    expect(decision.risk).toBe('high');
    expect(decision.actionKey).toBe('delete');
  });

  it('classifies browser_type submit actions as high-risk post operations', () => {
    const decision = evaluateBrowserPolicyAction(baseConfig, {
      toolName: 'browser_type',
      args: {
        selector: '#status-input',
        text: 'All set',
        submit: true,
      },
    });

    expect(decision.decision).toBe('gate');
    expect(decision.risk).toBe('high');
    expect(decision.actionKey).toBe('post');
  });

  it('classifies accepted destructive confirmation dialogs as high-risk', () => {
    const decision = evaluateBrowserPolicyAction(baseConfig, {
      toolName: 'browser_handle_dialog',
      args: {
        accept: true,
        promptText: 'Delete this account permanently?',
      },
    });

    expect(decision.decision).toBe('gate');
    expect(decision.risk).toBe('high');
    expect(decision.actionKey).toBe('delete');
  });

  it.each(['', 'not-a-valid-url', 'ftp://example.com/resource', 'javascript:alert(1)'])(
    'denies invalid navigate URL: %s',
    (url) => {
      const decision = evaluateBrowserPolicyAction(baseConfig, {
        toolName: 'browser_navigate',
        args: { url },
      });

      expect(decision.decision).toBe('deny');
      expect(decision.risk).toBe('high');
      expect(decision.reason).toContain('missing/invalid URL');
      expect(decision.targetHost).toBeUndefined();
      expect(decision.targetOrigin).toBeUndefined();
    },
  );

  it('emits deterministic risk evidence for static high-risk actions', () => {
    const decision = evaluateBrowserPolicyAction(baseConfig, {
      toolName: 'browser_click',
      args: { selector: 'button[data-action="delete-account"]' },
    });

    expect(decision.decision).toBe('gate');
    expect(decision.riskEvidence.classifier).toBe('static');
    expect(decision.riskEvidence.matchedSignals).toEqual(
      expect.arrayContaining(['tool:browser_click', 'args:keyword:delete']),
    );
  });

  it('escalates policy risk deterministically when adaptation hint requests escalation', () => {
    const decision = evaluateBrowserPolicyAction(
      {
        ...baseConfig,
        requireApprovalForHighRisk: true,
      },
      {
        toolName: 'browser_navigate',
        args: { url: 'https://example.com/docs' },
        adaptationHint: {
          escalateRisk: true,
          reason: 'run-corpus adaptation requested escalation',
          regressionPressure: 0.7,
          meanRegressionScore: 0.4,
          failureRate: 0.3,
        },
      },
    );

    expect(decision.decision).toBe('gate');
    expect(decision.risk).toBe('high');
    expect(decision.reason).toContain('run-corpus adaptation requested escalation');
    expect(decision.riskEvidence.classifier).toBe('adaptive-escalation');
    expect(decision.riskEvidence.matchedSignals).toContain('adaptive:risk-escalation');
    expect(decision.riskEvidence.adaptationReason).toContain('run-corpus adaptation');
  });

  it('property: exact blocked origins deny matching HTTPS hosts while preserving strict origin semantics', () => {
    const hosts = generateDeterministicHosts(25, 20260224);
    for (const host of hosts) {
      const blocked = evaluateBrowserPolicyAction(
        {
          ...baseConfig,
          allowedHosts: ['*'],
          blockedOrigins: [`https://${host}`],
        },
        {
          toolName: 'browser_navigate',
          args: { url: `https://${host}/path?x=1` },
        },
      );

      expect(blocked.decision).toBe('deny');
      expect(blocked.targetHost).toBe(host);
      expect(blocked.targetOrigin).toBe(`https://${host}`);

      const differentOriginProtocol = evaluateBrowserPolicyAction(
        {
          ...baseConfig,
          requireApprovalForHighRisk: false,
          allowedHosts: ['*'],
          blockedOrigins: [`https://${host}`],
        },
        {
          toolName: 'browser_navigate',
          args: { url: `http://${host}/path?x=1` },
        },
      );

      expect(differentOriginProtocol.decision).toBe('allow');
      expect(differentOriginProtocol.targetOrigin).toBe(`http://${host}`);
    }
  });

  it('property: host allowlist matching remains strict for exact hosts and denies subdomain drift', () => {
    const hosts = generateDeterministicHosts(25, 20260225);
    for (const host of hosts) {
      const exactAllowed = evaluateBrowserPolicyAction(
        {
          ...baseConfig,
          requireApprovalForHighRisk: false,
          allowedHosts: [`  ${host.toUpperCase()}  `],
          blockedOrigins: [],
        },
        {
          toolName: 'browser_navigate',
          args: { url: `https://${host}/dashboard` },
        },
      );
      expect(exactAllowed.decision).toBe('allow');
      expect(exactAllowed.targetHost).toBe(host);

      const subdomainDenied = evaluateBrowserPolicyAction(
        {
          ...baseConfig,
          requireApprovalForHighRisk: false,
          allowedHosts: [host],
          blockedOrigins: [],
        },
        {
          toolName: 'browser_navigate',
          args: { url: `https://sub.${host}/dashboard` },
        },
      );
      expect(subdomainDenied.decision).toBe('deny');
      expect(subdomainDenied.reason).toContain('allowlist mismatch');
    }
  });
});

describe('browser policy deny-by-default posture', () => {
  it('normalizeBrowserPolicyConfig defaults to empty allowedHosts (deny-all)', () => {
    const config = normalizeBrowserPolicyConfig();
    expect(config.allowedHosts).toEqual([]);
    expect(config.credentialIsolation).toBe(true);
  });

  it('normalizeBrowserPolicyConfig preserves explicit empty allowedHosts as deny-all', () => {
    const config = normalizeBrowserPolicyConfig({ allowedHosts: [] });
    expect(config.allowedHosts).toEqual([]);
  });

  it('normalizeBrowserPolicyConfig does not back-fill wildcard for empty input', () => {
    const config = normalizeBrowserPolicyConfig({});
    expect(config.allowedHosts).toEqual([]);
    expect(config.allowedHosts).not.toContain('*');
  });

  it('denies navigation to any host when no allowedHosts are configured', () => {
    const decision = evaluateBrowserPolicyAction(
      { requireApprovalForHighRisk: false },
      {
        toolName: 'browser_navigate',
        args: { url: 'https://example.com/dashboard' },
      },
    );

    expect(decision.decision).toBe('deny');
    expect(decision.reason).toContain('allowlist mismatch');
    expect(decision.targetHost).toBe('example.com');
    expect(decision.riskEvidence.matchedSignals).toContain('policy:allowlist-mismatch');
  });

  it('denies navigation when config is undefined (no config = deny-all)', () => {
    const decision = evaluateBrowserPolicyAction(undefined, {
      toolName: 'browser_navigate',
      args: { url: 'https://any-host.example.net/path' },
    });

    expect(decision.decision).toBe('deny');
    expect(decision.reason).toContain('allowlist mismatch');
  });

  it('denies navigation when config is null (no config = deny-all)', () => {
    const config = normalizeBrowserPolicyConfig(null);
    expect(config.allowedHosts).toEqual([]);

    const decision = evaluateBrowserPolicyAction(
      { allowedHosts: [] },
      {
        toolName: 'browser_navigate',
        args: { url: 'https://example.com/' },
      },
    );

    expect(decision.decision).toBe('deny');
    expect(decision.reason).toContain('allowlist mismatch');
  });

  it('allows navigation only after explicit host allowlisting', () => {
    const denied = evaluateBrowserPolicyAction(
      { requireApprovalForHighRisk: false },
      {
        toolName: 'browser_navigate',
        args: { url: 'https://example.com/page' },
      },
    );
    expect(denied.decision).toBe('deny');

    const allowed = evaluateBrowserPolicyAction(
      { requireApprovalForHighRisk: false, allowedHosts: ['example.com'] },
      {
        toolName: 'browser_navigate',
        args: { url: 'https://example.com/page' },
      },
    );
    expect(allowed.decision).toBe('allow');
  });

  it('allows non-URL actions (click, type, screenshot) even with empty allowedHosts when no URL context present', () => {
    const click = evaluateBrowserPolicyAction(
      { requireApprovalForHighRisk: false, allowedHosts: [] },
      {
        toolName: 'browser_click',
        args: { selector: '#safe-button' },
      },
    );
    expect(click.decision).toBe('allow');
    expect(click.risk).toBe('medium');

    const screenshot = evaluateBrowserPolicyAction(
      { requireApprovalForHighRisk: false, allowedHosts: [] },
      {
        toolName: 'browser_screenshot',
        args: {},
      },
    );
    expect(screenshot.decision).toBe('allow');
    expect(screenshot.risk).toBe('low');
  });

  it('denies click/type with URL context when host not in allowedHosts', () => {
    const decision = evaluateBrowserPolicyAction(
      { requireApprovalForHighRisk: false, allowedHosts: [] },
      {
        toolName: 'browser_click',
        args: {
          selector: '#button',
          url: 'https://unknown-host.example.com/page',
        },
      },
    );

    expect(decision.decision).toBe('deny');
    expect(decision.reason).toContain('allowlist mismatch');
  });

  it('denies interactive actions with restrictive allowlist and no origin context', () => {
    const click = evaluateBrowserPolicyAction(
      { requireApprovalForHighRisk: false, allowedHosts: ['safe.example.com'] },
      {
        toolName: 'browser_click',
        args: { selector: '#button' },
      },
    );
    expect(click.decision).toBe('deny');
    expect(click.reason).toContain('no origin available');
    expect(click.riskEvidence.matchedSignals).toContain('policy:no-origin-for-allowlist');

    const type = evaluateBrowserPolicyAction(
      { requireApprovalForHighRisk: false, allowedHosts: ['safe.example.com'] },
      {
        toolName: 'browser_type',
        args: { text: 'hello' },
      },
    );
    expect(type.decision).toBe('deny');
  });

  it('allows interactive actions when currentOrigin matches restrictive allowlist', () => {
    const click = evaluateBrowserPolicyAction(
      { requireApprovalForHighRisk: false, allowedHosts: ['safe.example.com'] },
      {
        toolName: 'browser_click',
        args: { selector: '#button' },
        currentOrigin: 'https://safe.example.com',
      },
    );
    expect(click.decision).toBe('allow');
  });

  it('denies interactive actions when currentOrigin does not match restrictive allowlist', () => {
    const click = evaluateBrowserPolicyAction(
      { requireApprovalForHighRisk: false, allowedHosts: ['safe.example.com'] },
      {
        toolName: 'browser_click',
        args: { selector: '#button' },
        currentOrigin: 'https://evil.example.net',
      },
    );
    expect(click.decision).toBe('deny');
    expect(click.reason).toContain('allowlist mismatch');
  });

  it('allows interactive actions with wildcard allowlist and no origin', () => {
    const click = evaluateBrowserPolicyAction(
      { requireApprovalForHighRisk: false, allowedHosts: ['*'] },
      {
        toolName: 'browser_click',
        args: { selector: '#button' },
      },
    );
    expect(click.decision).toBe('allow');
  });

  it('does not deny observation tools even with restrictive allowlist and no origin', () => {
    const screenshot = evaluateBrowserPolicyAction(
      { requireApprovalForHighRisk: false, allowedHosts: ['safe.example.com'] },
      {
        toolName: 'browser_screenshot',
        args: {},
      },
    );
    expect(screenshot.decision).toBe('allow');
    expect(screenshot.risk).toBe('low');
  });
});

describe('browser policy credential isolation', () => {
  const credentialConfig = {
    requireApprovalForHighRisk: false,
    allowedHosts: ['login.example.com', 'dashboard.example.com', 'evil.example.net'],
    blockedOrigins: [] as string[],
    sensitiveActions: ['auth_submit', 'post', 'checkout', 'delete'],
    credentialIsolation: true,
  };

  it('denies cross-origin navigation from a credential page', () => {
    const decision = evaluateBrowserPolicyAction(credentialConfig, {
      toolName: 'browser_navigate',
      args: { url: 'https://evil.example.net/steal' },
      currentOrigin: 'https://login.example.com',
      currentPageHasCredentials: true,
    });

    expect(decision.decision).toBe('deny');
    expect(decision.risk).toBe('high');
    expect(decision.reason).toContain('credential page');
    expect(decision.reason).toContain('https://login.example.com');
    expect(decision.reason).toContain('https://evil.example.net');
    expect(decision.riskEvidence.matchedSignals).toContain('policy:credential-isolation');
  });

  it('allows same-origin navigation from a credential page', () => {
    const decision = evaluateBrowserPolicyAction(credentialConfig, {
      toolName: 'browser_navigate',
      args: { url: 'https://login.example.com/callback' },
      currentOrigin: 'https://login.example.com',
      currentPageHasCredentials: true,
    });

    expect(decision.decision).toBe('allow');
  });

  it('allows cross-origin navigation when credential isolation is disabled', () => {
    const decision = evaluateBrowserPolicyAction(
      { ...credentialConfig, credentialIsolation: false },
      {
        toolName: 'browser_navigate',
        args: { url: 'https://evil.example.net/steal' },
        currentOrigin: 'https://login.example.com',
        currentPageHasCredentials: true,
      },
    );

    expect(decision.decision).toBe('allow');
  });

  it('allows cross-origin navigation when current page has no credentials', () => {
    const decision = evaluateBrowserPolicyAction(credentialConfig, {
      toolName: 'browser_navigate',
      args: { url: 'https://dashboard.example.com/home' },
      currentOrigin: 'https://login.example.com',
      currentPageHasCredentials: false,
    });

    expect(decision.decision).toBe('allow');
  });

  it('allows cross-origin navigation when no currentOrigin is provided', () => {
    const decision = evaluateBrowserPolicyAction(credentialConfig, {
      toolName: 'browser_navigate',
      args: { url: 'https://dashboard.example.com/home' },
      currentPageHasCredentials: true,
    });

    expect(decision.decision).toBe('allow');
  });

  it('denies cross-origin click with URL context from credential page', () => {
    const decision = evaluateBrowserPolicyAction(credentialConfig, {
      toolName: 'browser_click',
      args: {
        selector: '#exfiltrate',
        url: 'https://evil.example.net/steal',
      },
      currentOrigin: 'https://login.example.com',
      currentPageHasCredentials: true,
    });

    expect(decision.decision).toBe('deny');
    expect(decision.reason).toContain('credential page');
    expect(decision.riskEvidence.matchedSignals).toContain('policy:credential-isolation');
  });

  it('credential isolation defaults to true when not specified', () => {
    const config = normalizeBrowserPolicyConfig({});
    expect(config.credentialIsolation).toBe(true);
  });

  it('credential isolation can be explicitly disabled', () => {
    const config = normalizeBrowserPolicyConfig({ credentialIsolation: false });
    expect(config.credentialIsolation).toBe(false);
  });

  it('performs case-insensitive origin comparison for credential isolation', () => {
    const decision = evaluateBrowserPolicyAction(credentialConfig, {
      toolName: 'browser_navigate',
      args: { url: 'https://evil.example.net/path' },
      currentOrigin: 'HTTPS://LOGIN.EXAMPLE.COM',
      currentPageHasCredentials: true,
    });

    expect(decision.decision).toBe('deny');
    expect(decision.reason).toContain('credential page');
  });

  it('blocked origins take precedence over credential isolation check', () => {
    const decision = evaluateBrowserPolicyAction(
      {
        ...credentialConfig,
        blockedOrigins: ['https://evil.example.net'],
      },
      {
        toolName: 'browser_navigate',
        args: { url: 'https://evil.example.net/steal' },
        currentOrigin: 'https://login.example.com',
        currentPageHasCredentials: true,
      },
    );

    expect(decision.decision).toBe('deny');
    expect(decision.reason).toContain('blocked origin');
    expect(decision.riskEvidence.matchedSignals).toContain('policy:blocked-origin');
  });
});

describe('regex URL allowlist patterns', () => {
  it('allows a host matching a regex pattern', () => {
    const decision = evaluateBrowserPolicyAction(
      { allowedHosts: ['{ "regex": "^app-[0-9]+\\\\.staging\\\\.example\\\\.com$" }'] },
      { toolName: 'browser_navigate', args: { url: 'https://app-42.staging.example.com/path' } },
    );
    expect(decision.decision).toBe('allow');
  });

  it('denies a host that does not match the regex', () => {
    const decision = evaluateBrowserPolicyAction(
      { allowedHosts: ['{ "regex": "^app-[0-9]+\\\\.staging\\\\.example\\\\.com$" }'] },
      { toolName: 'browser_navigate', args: { url: 'https://evil.com/path' } },
    );
    expect(decision.decision).toBe('deny');
  });

  it('ignores malformed regex patterns gracefully', () => {
    const decision = evaluateBrowserPolicyAction(
      { allowedHosts: ['{ "regex": "[invalid" }', 'example.com'] },
      { toolName: 'browser_navigate', args: { url: 'https://example.com/page' } },
    );
    expect(decision.decision).toBe('allow');
  });
});

describe('MCP-only tool risk classification', () => {
  it('classifies browser_evaluate as high risk (requires approval)', () => {
    const decision = evaluateBrowserPolicyAction(
      { ...baseConfig, requireApprovalForHighRisk: true, allowedHosts: ['*'] },
      { toolName: 'browser_evaluate', args: { expression: 'document.cookie' } },
    );
    expect(decision.risk).toBe('high');
    expect(decision.decision).toBe('gate');
    expect(decision.actionKey).toBe('execute');
  });

  it('classifies browser_file_upload as high risk', () => {
    const decision = evaluateBrowserPolicyAction(
      { ...baseConfig, requireApprovalForHighRisk: true, allowedHosts: ['*'] },
      { toolName: 'browser_file_upload', args: { selector: 'input[type=file]', files: ['/tmp/a.txt'] } },
    );
    expect(decision.risk).toBe('high');
    expect(decision.decision).toBe('gate');
    expect(decision.actionKey).toBe('upload');
  });

  it('classifies browser_select_option as medium risk', () => {
    const decision = evaluateBrowserPolicyAction(
      { ...baseConfig, requireApprovalForHighRisk: false, allowedHosts: ['*'] },
      { toolName: 'browser_select_option', args: { selector: 'select#country', value: 'AU' } },
    );
    expect(decision.risk).toBe('medium');
    expect(decision.decision).toBe('allow');
    expect(decision.actionKey).toBe('select');
  });

  it('classifies browser_go_back and browser_reload as medium risk', () => {
    for (const toolName of ['browser_go_back', 'browser_go_forward', 'browser_reload']) {
      const decision = evaluateBrowserPolicyAction(
        { ...baseConfig, requireApprovalForHighRisk: false, allowedHosts: ['*'] },
        { toolName, args: {} },
      );
      expect(decision.risk).toBe('medium');
      expect(decision.actionKey).toBe('navigate');
    }
  });

  it('classifies browser_scroll and browser_hover as low risk', () => {
    for (const toolName of ['browser_scroll', 'browser_hover', 'browser_wait_for_element', 'browser_wait_for_navigation']) {
      const decision = evaluateBrowserPolicyAction(
        { ...baseConfig, requireApprovalForHighRisk: true, allowedHosts: ['*'] },
        { toolName, args: {} },
      );
      expect(decision.risk).toBe('low');
      expect(decision.decision).toBe('allow');
    }
  });
});

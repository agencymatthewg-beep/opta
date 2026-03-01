import type { OptaConfig } from './config.js';

export interface ResolvedBrowserPolicyConfig {
  requireApprovalForHighRisk?: boolean;
  allowedHosts?: string[];
  blockedOrigins?: string[];
  sensitiveActions?: string[];
}

function normalizeHostList(values: string[] | undefined): string[] {
  if (!values || values.length === 0) return [];
  const normalized: string[] = [];
  for (const value of values) {
    const candidate = value.trim().toLowerCase();
    if (!candidate) continue;
    normalized.push(candidate);
  }
  return normalized;
}

export function resolveBrowserPolicyConfig(
  config: OptaConfig | null | undefined
): ResolvedBrowserPolicyConfig {
  const browser = config?.browser;
  if (!browser) return {};

  const legacy = browser as typeof browser & {
    globalAllowedHosts?: string[];
    blockedOrigins?: string[];
  };

  // Backward compatibility: `browser.globalAllowedHosts` historically provided
  // the top-level host allowlist. If present, it takes precedence.
  const allowedHosts = normalizeHostList(legacy.globalAllowedHosts ?? browser.policy?.allowedHosts);
  // Backward compatibility: `browser.blockedOrigins` was also supported before
  // the nested `browser.policy.blockedOrigins` shape.
  const blockedOrigins = normalizeHostList(legacy.blockedOrigins ?? browser.policy?.blockedOrigins);

  return {
    requireApprovalForHighRisk: browser.policy?.requireApprovalForHighRisk,
    allowedHosts: allowedHosts.length > 0 ? allowedHosts : undefined,
    blockedOrigins: blockedOrigins.length > 0 ? blockedOrigins : undefined,
    sensitiveActions: browser.policy?.sensitiveActions,
  };
}

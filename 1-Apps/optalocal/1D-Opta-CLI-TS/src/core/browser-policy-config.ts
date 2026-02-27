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

function isWildcardOnlyAllowlist(values: string[]): boolean {
  return values.length === 1 && values[0] === '*';
}

export function resolveBrowserPolicyConfig(config: OptaConfig | null | undefined): ResolvedBrowserPolicyConfig {
  const browser = config?.browser;
  if (!browser) return {};

  const policyAllowedHosts = normalizeHostList(browser.policy?.allowedHosts);
  const globalAllowedHosts = normalizeHostList(browser.globalAllowedHosts);
  const policyBlockedOrigins = normalizeHostList(browser.policy?.blockedOrigins);
  const globalBlockedOrigins = normalizeHostList(browser.blockedOrigins);

  const useGlobalAllowedHosts = (
    globalAllowedHosts.length > 0
    && (policyAllowedHosts.length === 0 || isWildcardOnlyAllowlist(policyAllowedHosts))
  );

  const allowedHosts = useGlobalAllowedHosts
    ? globalAllowedHosts
    : policyAllowedHosts;
  const blockedOrigins = policyBlockedOrigins.length > 0
    ? policyBlockedOrigins
    : globalBlockedOrigins;

  return {
    requireApprovalForHighRisk: browser.policy?.requireApprovalForHighRisk,
    allowedHosts: allowedHosts.length > 0 ? allowedHosts : undefined,
    blockedOrigins: blockedOrigins.length > 0 ? blockedOrigins : undefined,
    sensitiveActions: browser.policy?.sensitiveActions,
  };
}

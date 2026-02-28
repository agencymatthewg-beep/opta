import type { BrowserPolicyAdaptationHint } from './adaptation.js';

const DEFAULT_SENSITIVE_ACTIONS = ['auth_submit', 'post', 'checkout', 'delete'] as const;

export type BrowserRiskLevel = 'low' | 'medium' | 'high';
export type BrowserPolicyDecisionType = 'allow' | 'gate' | 'deny';

export interface BrowserPolicyConfig {
  requireApprovalForHighRisk: boolean;
  allowedHosts: string[];
  blockedOrigins: string[];
  sensitiveActions: string[];
  credentialIsolation: boolean;
}

export interface BrowserPolicyRequest {
  toolName: string;
  args: Record<string, unknown>;
  approved?: boolean;
  adaptationHint?: BrowserPolicyAdaptationHint;
  /** Origin of the page currently loaded in the browser session. */
  currentOrigin?: string;
  /** Whether the current page contains credential-related elements (login forms, auth cookies, etc.). */
  currentPageHasCredentials?: boolean;
}

export interface BrowserRiskEvidence {
  classifier: 'static' | 'adaptive-escalation';
  matchedSignals: string[];
  adaptationReason?: string;
}

export interface BrowserPolicyDecision {
  decision: BrowserPolicyDecisionType;
  risk: BrowserRiskLevel;
  reason: string;
  actionKey: string;
  targetHost?: string;
  targetOrigin?: string;
  riskEvidence: BrowserRiskEvidence;
}

function normalizeList(values: string[] | undefined): string[] {
  if (!values || values.length === 0) return [];
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const value of values) {
    const candidate = value.trim().toLowerCase();
    if (!candidate || seen.has(candidate)) continue;
    seen.add(candidate);
    normalized.push(candidate);
  }
  return normalized;
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

export function normalizeBrowserPolicyConfig(
  input?: Partial<BrowserPolicyConfig> | null,
): BrowserPolicyConfig {
  return {
    requireApprovalForHighRisk: input?.requireApprovalForHighRisk !== false,
    allowedHosts: normalizeList(input?.allowedHosts ?? []),
    blockedOrigins: normalizeList(input?.blockedOrigins ?? []),
    sensitiveActions: normalizeList(
      input?.sensitiveActions?.length
        ? input.sensitiveActions
        : [...DEFAULT_SENSITIVE_ACTIONS],
    ),
    credentialIsolation: input?.credentialIsolation !== false,
  };
}

function wildcardHostMatch(host: string, pattern: string): boolean {
  if (pattern === '*') return true;
  if (pattern.startsWith('*.')) {
    const suffix = pattern.slice(1);
    return host.endsWith(suffix);
  }
  return host === pattern;
}

function normalizePatternInput(pattern: string): string {
  return pattern.trim().toLowerCase();
}

function parseHostPattern(pattern: string): string {
  const normalized = normalizePatternInput(pattern);
  if (!normalized) return '';
  if (normalized === '*') return '*';

  if (normalized.startsWith('*.')) {
    const wildcardHost = normalized.split('/')[0] ?? '';
    return wildcardHost.replace(/:\d+$/, '');
  }

  const candidate = normalized.includes('://') ? normalized : `https://${normalized}`;
  try {
    const parsed = new URL(candidate);
    return parsed.hostname.toLowerCase();
  } catch {
    return '';
  }
}

function parseOriginPattern(pattern: string): string | null {
  const normalized = normalizePatternInput(pattern);
  if (!normalized) return null;
  if (normalized.includes('://')) {
    try {
      const parsed = new URL(normalized);
      return `${parsed.protocol}//${parsed.host}`.toLowerCase();
    } catch {
      return null;
    }
  }
  return null;
}

/** Try to parse an allowedHosts entry as a JSON object with a "regex" field. */
function tryParseRegexPattern(pattern: string): RegExp | null {
  const trimmed = pattern.trim();
  if (!trimmed.startsWith('{')) return null;
  try {
    const obj = JSON.parse(trimmed) as unknown;
    if (typeof obj !== 'object' || obj === null) return null;
    const regexStr = (obj as Record<string, unknown>).regex;
    if (typeof regexStr !== 'string') return null;
    return new RegExp(regexStr);
  } catch {
    return null;
  }
}

function hostAllowed(host: string, allowedHosts: string[]): boolean {
  if (allowedHosts.length === 0) return false;
  for (const pattern of allowedHosts) {
    const regex = tryParseRegexPattern(pattern);
    if (regex !== null) {
      try {
        if (regex.test(host)) return true;
      } catch {
        // invalid regex — skip this pattern
      }
      continue;
    }
    const parsedPattern = parseHostPattern(pattern);
    if (!parsedPattern) continue;
    if (wildcardHostMatch(host, parsedPattern)) return true;
  }
  return false;
}

function originBlocked(origin: string, host: string, blockedOrigins: string[]): boolean {
  for (const pattern of blockedOrigins) {
    const parsedOrigin = parseOriginPattern(pattern);
    if (parsedOrigin) {
      if (origin === parsedOrigin) return true;
      continue;
    }
    const hostPattern = parseHostPattern(pattern);
    if (!hostPattern) continue;
    if (wildcardHostMatch(host, hostPattern)) return true;
  }
  return false;
}

function extractUrlTarget(args: Record<string, unknown>): {
  url?: URL;
  host?: string;
  origin?: string;
} {
  const raw = String(args['url'] ?? '').trim();
  if (!raw) return {};
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return {};
    }
    return {
      url: parsed,
      host: parsed.hostname.toLowerCase(),
      origin: `${parsed.protocol}//${parsed.host}`.toLowerCase(),
    };
  } catch {
    return {};
  }
}

interface SensitiveSignalMatch {
  actionKey: string;
  signal: string;
}

function signalContainsSensitiveKeyword(value: string): SensitiveSignalMatch | null {
  const text = value.toLowerCase();
  if (/(login|sign[-_\s]?in|auth|password|otp|2fa)/.test(text)) {
    return { actionKey: 'auth_submit', signal: 'keyword:auth' };
  }
  if (/(checkout|payment|billing|purchase|buy|order)/.test(text)) {
    return { actionKey: 'checkout', signal: 'keyword:checkout' };
  }
  if (/(delete|remove|destroy|erase|deactivate)/.test(text)) {
    return { actionKey: 'delete', signal: 'keyword:delete' };
  }
  if (/(post|publish|submit|send|comment|tweet)/.test(text)) {
    return { actionKey: 'post', signal: 'keyword:post' };
  }
  return null;
}

const SENSITIVE_TEXT_ARG_KEYS = [
  'selector',
  'text',
  'element',
  'name',
  'label',
  'title',
  'value',
  'promptText',
  'url',
  'href',
] as const;

function collectSensitiveSignalText(args: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const key of SENSITIVE_TEXT_ARG_KEYS) {
    const candidate = args[key];
    if (typeof candidate === 'string' && candidate.trim()) {
      parts.push(candidate);
    }
  }
  return parts.join(' ');
}

function isTruthyFlag(value: unknown): boolean {
  if (value === true || value === 1) return true;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on';
  }
  return false;
}

function classifyAction(
  toolName: string,
  args: Record<string, unknown>,
  sensitiveActions: Set<string>,
): { risk: BrowserRiskLevel; actionKey: string; matchedSignals: string[] } {
  if (toolName === 'browser_snapshot' || toolName === 'browser_screenshot' || toolName === 'browser_close') {
    return { risk: 'low', actionKey: 'observe', matchedSignals: [`tool:${toolName}`] };
  }

  if (toolName === 'browser_open') {
    const mode = String(args['mode'] ?? 'isolated').toLowerCase();
    return mode === 'attach'
      ? { risk: 'medium', actionKey: 'attach', matchedSignals: ['tool:browser_open', 'mode:attach'] }
      : { risk: 'low', actionKey: 'open', matchedSignals: ['tool:browser_open', 'mode:isolated'] };
  }

  if (toolName === 'browser_navigate') {
    const target = extractUrlTarget(args);
    const matchedSignals = ['tool:browser_navigate'];
    if (target.url) {
      const candidate = signalContainsSensitiveKeyword(
        `${target.url.pathname} ${target.url.search} ${target.url.hash}`,
      );
      if (candidate && sensitiveActions.has(candidate.actionKey)) {
        matchedSignals.push(`url:${candidate.signal}`);
        return { risk: 'high', actionKey: candidate.actionKey, matchedSignals };
      }
    }
    return { risk: 'medium', actionKey: 'navigate', matchedSignals };
  }

  if (toolName === 'browser_click' || toolName === 'browser_type') {
    const matchedSignals = [`tool:${toolName}`];
    const keywordMatch = signalContainsSensitiveKeyword(collectSensitiveSignalText(args));
    if (keywordMatch && sensitiveActions.has(keywordMatch.actionKey)) {
      matchedSignals.push(`args:${keywordMatch.signal}`);
      return { risk: 'high', actionKey: keywordMatch.actionKey, matchedSignals };
    }

    if (toolName === 'browser_type' && isTruthyFlag(args['submit']) && sensitiveActions.has('post')) {
      matchedSignals.push('flag:submit');
      return { risk: 'high', actionKey: 'post', matchedSignals };
    }

    return {
      risk: 'medium',
      actionKey: toolName === 'browser_click' ? 'click' : 'type',
      matchedSignals,
    };
  }

  if (toolName === 'browser_handle_dialog') {
    const accepted = isTruthyFlag(args['accept']);
    const matchedSignals = ['tool:browser_handle_dialog', accepted ? 'dialog:accept' : 'dialog:dismiss'];
    const keywordMatch = signalContainsSensitiveKeyword(collectSensitiveSignalText(args));

    if (accepted && keywordMatch && sensitiveActions.has(keywordMatch.actionKey)) {
      matchedSignals.push(`dialog:${keywordMatch.signal}`);
      return { risk: 'high', actionKey: keywordMatch.actionKey, matchedSignals };
    }

    return accepted
      ? { risk: 'medium', actionKey: 'confirm', matchedSignals }
      : { risk: 'low', actionKey: 'dismiss', matchedSignals };
  }

  // MCP-only high-risk tools
  if (toolName === 'browser_evaluate') {
    return { risk: 'high', actionKey: 'execute', matchedSignals: ['tool:browser_evaluate', 'risk:js-execution'] };
  }

  if (toolName === 'browser_file_upload') {
    return { risk: 'high', actionKey: 'upload', matchedSignals: ['tool:browser_file_upload', 'risk:filesystem'] };
  }

  // MCP-only medium-risk interaction tools
  if (toolName === 'browser_select_option') {
    const matchedSignals = ['tool:browser_select_option'];
    const keywordMatch = signalContainsSensitiveKeyword(collectSensitiveSignalText(args));
    if (keywordMatch && sensitiveActions.has(keywordMatch.actionKey)) {
      matchedSignals.push(`args:${keywordMatch.signal}`);
      return { risk: 'high', actionKey: keywordMatch.actionKey, matchedSignals };
    }
    return { risk: 'medium', actionKey: 'select', matchedSignals };
  }

  if (toolName === 'browser_drag') {
    return { risk: 'medium', actionKey: 'click', matchedSignals: ['tool:browser_drag'] };
  }

  if (toolName === 'browser_press_key' || toolName === 'browser_keyboard_type') {
    const matchedSignals = [`tool:${toolName}`];
    const keywordMatch = signalContainsSensitiveKeyword(collectSensitiveSignalText(args));
    if (keywordMatch && sensitiveActions.has(keywordMatch.actionKey)) {
      matchedSignals.push(`args:${keywordMatch.signal}`);
      return { risk: 'high', actionKey: keywordMatch.actionKey, matchedSignals };
    }
    return { risk: 'medium', actionKey: 'type', matchedSignals };
  }

  if (toolName === 'browser_go_back' || toolName === 'browser_go_forward' || toolName === 'browser_reload') {
    return { risk: 'medium', actionKey: 'navigate', matchedSignals: [`tool:${toolName}`] };
  }

  if (toolName === 'browser_tab_new' || toolName === 'browser_tab_close' || toolName === 'browser_tab_switch') {
    return { risk: 'medium', actionKey: 'navigate', matchedSignals: [`tool:${toolName}`] };
  }

  return { risk: 'low', actionKey: 'other', matchedSignals: [`tool:${toolName}`] };
}

export function isBrowserToolName(toolName: string): boolean {
  return toolName.startsWith('browser_');
}

export function evaluateBrowserPolicyAction(
  configInput: Partial<BrowserPolicyConfig> | undefined,
  request: BrowserPolicyRequest,
): BrowserPolicyDecision {
  const config = normalizeBrowserPolicyConfig(configInput);
  const target = extractUrlTarget(request.args);
  const hasTarget = Boolean(target.url && target.host && target.origin);

  if (request.toolName === 'browser_navigate') {
    if (!hasTarget || !target.host || !target.origin) {
      return {
        decision: 'deny',
        risk: 'high',
        actionKey: 'navigate',
        reason: 'Policy denied browser navigate action due to missing/invalid URL.',
        riskEvidence: {
          classifier: 'static',
          matchedSignals: ['url:invalid'],
        },
      };
    }
  }

  // Determine the effective host/origin for policy evaluation.
  // URL-bearing actions use args.url; non-URL actions (click, type, handle_dialog)
  // fall back to request.currentOrigin so they're checked against the same allowlist.
  let effectiveHost = target.host;
  let effectiveOrigin = target.origin;
  if (!effectiveHost && request.currentOrigin) {
    try {
      const parsed = new URL(request.currentOrigin);
      effectiveHost = parsed.hostname.toLowerCase();
      effectiveOrigin = `${parsed.protocol}//${parsed.host}`.toLowerCase();
    } catch {
      // malformed currentOrigin — handled below
    }
  }

  const hasEffectiveTarget = Boolean(effectiveHost && effectiveOrigin);
  const isInteractiveAction =
    request.toolName === 'browser_click'
    || request.toolName === 'browser_type'
    || request.toolName === 'browser_handle_dialog'
    || request.toolName === 'browser_navigate';

  if (hasEffectiveTarget && effectiveHost && effectiveOrigin) {
    if (originBlocked(effectiveOrigin, effectiveHost, config.blockedOrigins)) {
      return {
        decision: 'deny',
        risk: 'high',
        actionKey: request.toolName === 'browser_navigate' ? 'navigate' : 'interaction',
        reason: `Policy denied browser action due to blocked origin: ${effectiveOrigin}`,
        targetHost: effectiveHost,
        targetOrigin: effectiveOrigin,
        riskEvidence: {
          classifier: 'static',
          matchedSignals: ['policy:blocked-origin'],
        },
      };
    }

    if (!hostAllowed(effectiveHost, config.allowedHosts)) {
      return {
        decision: 'deny',
        risk: 'high',
        actionKey: request.toolName === 'browser_navigate' ? 'navigate' : 'interaction',
        reason: `Policy denied browser action due to host allowlist mismatch: ${effectiveHost}`,
        targetHost: effectiveHost,
        targetOrigin: effectiveOrigin,
        riskEvidence: {
          classifier: 'static',
          matchedSignals: ['policy:allowlist-mismatch'],
        },
      };
    }

    if (
      config.credentialIsolation
      && request.currentPageHasCredentials
      && request.currentOrigin
      && effectiveOrigin !== request.currentOrigin.toLowerCase()
    ) {
      return {
        decision: 'deny',
        risk: 'high',
        actionKey: request.toolName === 'browser_navigate' ? 'navigate' : 'interaction',
        reason: `Policy denied cross-origin action from credential page: ${request.currentOrigin} -> ${effectiveOrigin}`,
        targetHost: effectiveHost,
        targetOrigin: effectiveOrigin,
        riskEvidence: {
          classifier: 'static',
          matchedSignals: ['policy:credential-isolation'],
        },
      };
    }
  } else if (
    !hasEffectiveTarget
    && isInteractiveAction
    && config.allowedHosts.length > 0
    && !config.allowedHosts.includes('*')
  ) {
    // Restrictive allowlist is configured but we have no origin to validate against.
    // Deny rather than allow unchecked interaction on an unknown page.
    // Wildcard ('*') is excluded because it explicitly means "allow all hosts".
    return {
      decision: 'deny',
      risk: 'high',
      actionKey: 'interaction',
      reason: 'Policy denied browser action: restrictive allowlist configured but no origin available to validate.',
      riskEvidence: {
        classifier: 'static',
        matchedSignals: ['policy:no-origin-for-allowlist'],
      },
    };
  }

  const sensitiveActions = new Set(config.sensitiveActions);
  const classified = classifyAction(request.toolName, request.args, sensitiveActions);

  let risk = classified.risk;
  let classifier: BrowserRiskEvidence['classifier'] = 'static';
  const matchedSignals = [...classified.matchedSignals];
  let adaptationReason: string | undefined;

  if (
    request.adaptationHint?.escalateRisk === true
    && (classified.risk === 'medium' || classified.risk === 'low')
    && request.toolName !== 'browser_snapshot'
    && request.toolName !== 'browser_screenshot'
    && request.toolName !== 'browser_close'
  ) {
    classifier = 'adaptive-escalation';
    matchedSignals.push('adaptive:risk-escalation');
    adaptationReason = request.adaptationHint.reason;
    if (classified.risk === 'medium') {
      risk = 'high';
    } else {
      risk = 'medium';
    }
  }

  const riskEvidence: BrowserRiskEvidence = {
    classifier,
    matchedSignals: uniqueSorted(matchedSignals),
    adaptationReason,
  };

  if (risk === 'high' && config.requireApprovalForHighRisk && !request.approved) {
    return {
      decision: 'gate',
      risk,
      actionKey: classified.actionKey,
      reason: adaptationReason
        ? `Policy requires explicit approval for high-risk browser action: ${classified.actionKey}. ${adaptationReason}`
        : `Policy requires explicit approval for high-risk browser action: ${classified.actionKey}.`,
      targetHost: target.host,
      targetOrigin: target.origin,
      riskEvidence,
    };
  }

  return {
    decision: 'allow',
    risk,
    actionKey: classified.actionKey,
    reason: adaptationReason
      ? `Allowed by browser policy checks with adaptive risk context. ${adaptationReason}`
      : 'Allowed by browser policy checks.',
    targetHost: target.host,
    targetOrigin: target.origin,
    riskEvidence,
  };
}

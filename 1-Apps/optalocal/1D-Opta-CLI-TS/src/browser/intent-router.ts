import type { BrowserIntentAdaptationHint } from './adaptation.js';
import { clamp } from '../utils/common.js';

export type BrowserIntentConfidence = 'low' | 'medium' | 'high';

export interface BrowserIntentDecision {
  shouldRoute: boolean;
  confidence: BrowserIntentConfidence;
  confidenceScore?: number;
  reason: string;
  rationale?: string;
  signals: string[];
  suggestedUrl?: string;
  adaptationPenalty?: number;
  adaptationReason?: string;
}

const URL_PATTERN = /\bhttps?:\/\/[^\s<>"'`)]+/gi;

const STRONG_SIGNALS = [
  'open website',
  'open this site',
  'browser',
  'web page',
  'website',
  'navigate',
  'fill form',
  'submit form',
  'click',
  'screenshot',
  'login',
  'sign in',
  'checkout',
];

const WEAK_SIGNALS = [
  'scrape',
  'crawl',
  'web',
  'url',
  'search online',
  'online',
  'dashboard',
];

const LOCAL_ONLY_SIGNALS = [
  'refactor',
  'unit test',
  'typecheck',
  'tsconfig',
  'eslint',
  'local file',
  'repository',
  'git',
];

const ROUTE_SCORE_THRESHOLD = 3;
const HIGH_CONFIDENCE_SCORE_THRESHOLD = 6;
const NORMALIZED_SCORE_MIN = -4;
const NORMALIZED_SCORE_MAX = 8;

function firstUrl(task: string): string | undefined {
  const match = task.match(URL_PATTERN);
  if (!match || match.length === 0) return undefined;
  return match[0]?.replace(/[),.;:!?]+$/, '');
}

function includesSignal(taskLower: string, signal: string): boolean {
  return taskLower.includes(signal);
}

function normalizeConfidenceScore(score: number): number {
  const normalized = (score - NORMALIZED_SCORE_MIN) / (NORMALIZED_SCORE_MAX - NORMALIZED_SCORE_MIN);
  return Number(clamp(normalized, 0, 1).toFixed(2));
}

function stableSignals(signals: string[]): string[] {
  return [...new Set(signals)].sort((a, b) => a.localeCompare(b));
}

export function routeBrowserIntent(
  task: string,
  options: {
    adaptationHint?: BrowserIntentAdaptationHint;
  } = {},
): BrowserIntentDecision {
  const normalized = task.trim();
  const adaptationPenalty = Math.max(0, Math.floor(options.adaptationHint?.routePenalty ?? 0));
  const adaptationReason = options.adaptationHint?.reason;

  if (!normalized) {
    return {
      shouldRoute: false,
      confidence: 'low',
      confidenceScore: 0,
      reason: 'Empty task did not contain browser intent.',
      rationale: `route=false; score=0; threshold=${ROUTE_SCORE_THRESHOLD}; positive=0; negative=0; adaptation_penalty=${adaptationPenalty}; matched=none`,
      signals: [],
      adaptationPenalty,
      adaptationReason,
    };
  }

  const lower = normalized.toLowerCase();
  const positiveSignals: string[] = [];
  const negativeSignals: string[] = [];
  let positiveScore = 0;
  let negativeScore = 0;

  const suggestedUrl = firstUrl(normalized);
  if (suggestedUrl) {
    positiveSignals.push('explicit:url');
    positiveScore += 3;
  }

  for (const signal of STRONG_SIGNALS) {
    if (includesSignal(lower, signal)) {
      positiveSignals.push(`strong:${signal}`);
      positiveScore += 2;
    }
  }

  for (const signal of WEAK_SIGNALS) {
    if (includesSignal(lower, signal)) {
      positiveSignals.push(`weak:${signal}`);
      positiveScore += 1;
    }
  }

  for (const signal of LOCAL_ONLY_SIGNALS) {
    if (includesSignal(lower, signal)) {
      negativeSignals.push(`local:${signal}`);
      negativeScore += 1;
    }
  }

  if (adaptationPenalty > 0) {
    negativeSignals.push('adaptive:route-penalty');
    negativeScore += adaptationPenalty;
  }

  const score = positiveScore - negativeScore;
  const shouldRoute = score >= ROUTE_SCORE_THRESHOLD;
  const confidenceScore = normalizeConfidenceScore(score);
  const signals = stableSignals([...positiveSignals, ...negativeSignals]);
  const rationale = [
    `route=${shouldRoute}`,
    `score=${score}`,
    `threshold=${ROUTE_SCORE_THRESHOLD}`,
    `positive=${positiveScore}`,
    `negative=${negativeScore}`,
    `adaptation_penalty=${adaptationPenalty}`,
    `matched=${signals.join('|') || 'none'}`,
  ].join('; ');

  let confidence: BrowserIntentConfidence = 'low';
  if (shouldRoute && (score >= HIGH_CONFIDENCE_SCORE_THRESHOLD || confidenceScore >= 0.8)) {
    confidence = 'high';
  } else if (shouldRoute) {
    confidence = 'medium';
  }

  return {
    shouldRoute,
    confidence,
    confidenceScore,
    reason: shouldRoute
      ? `Intent router matched browser workflow signals with score ${score} (threshold ${ROUTE_SCORE_THRESHOLD}).`
      : `Intent router did not meet browser routing threshold (score ${score}, threshold ${ROUTE_SCORE_THRESHOLD}).`,
    rationale,
    signals,
    suggestedUrl,
    adaptationPenalty,
    adaptationReason,
  };
}

/**
 * Returns a brief system-prompt injection informing the agent which browser tools are available.
 * Returns null when the request is not browser-related and MCP is not enabled.
 */
export function buildBrowserAvailabilityInstruction(
  explicitRequest: boolean,
  mcpEnabled: boolean = false,
): string | null {
  if (!explicitRequest && !mcpEnabled) return null;

  const toolList = mcpEnabled
    ? 'browser_navigate, browser_click, browser_type, browser_select_option, browser_hover, browser_scroll, browser_snapshot, browser_screenshot, browser_evaluate, browser_go_back, browser_go_forward, browser_tab_new, browser_press_key, browser_handle_dialog, browser_wait_for_element'
    : 'browser_open, browser_navigate, browser_click, browser_type, browser_snapshot, browser_screenshot, browser_close';

  return `### Browser Tools Available\n\nUse ${toolList} for browser automation tasks. Always snapshot first to understand page state.`;
}

export function buildBrowserRoutingInstruction(
  decision: BrowserIntentDecision,
  sessionId?: string,
): string {
  if (!decision.shouldRoute) return '';

  const lines: string[] = [
    '### Browser Auto-Routing',
    `Detected browser-capable intent (${decision.confidence} confidence${typeof decision.confidenceScore === 'number' ? `, score ${decision.confidenceScore.toFixed(2)}` : ''}). ${decision.reason}`,
    'Prefer browser tools for web interaction steps in this task.',
  ];

  if (decision.rationale) {
    lines.push(`Routing rationale: ${decision.rationale}`);
  }

  if (decision.adaptationReason) {
    lines.push(`Routing adaptation: ${decision.adaptationReason}`);
  }

  if (sessionId) {
    lines.push(
      `Use browser session_id "${sessionId}" for browser_navigate/browser_click/browser_type/browser_snapshot/browser_screenshot.`,
    );
  } else {
    lines.push('Open a browser session first with browser_open before browser interactions.');
  }

  lines.push('Policy reminder: blocked hosts are denied and high-risk actions require approval.');
  return lines.join('\n');
}

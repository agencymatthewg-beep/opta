/**
 * Lightweight model recommendation heuristic.
 *
 * Recommends a model based on task keywords and known model capabilities.
 * This is a pure heuristic with NO external calls — just string matching
 * against the task description and the available model profiles.
 */

import type { OptaConfig } from './config.js';
import { getModelProfile } from './models.js';

// ---------------------------------------------------------------------------
// Model capability tags
// ---------------------------------------------------------------------------

interface ModelCapability {
  /** Regex patterns that match model IDs */
  pattern: RegExp;
  /** Human-readable name for display */
  displayName: string;
  /** What the model is good at */
  strengths: ('code' | 'general' | 'reasoning' | 'long-context' | 'fast')[];
}

const MODEL_CAPABILITIES: ModelCapability[] = [
  {
    pattern: /qwen.*coder/i,
    displayName: 'Qwen Coder',
    strengths: ['code', 'fast'],
  },
  {
    pattern: /deepseek-v3|deepseek-chat/i,
    displayName: 'DeepSeek V3',
    strengths: ['code', 'general', 'long-context'],
  },
  {
    pattern: /deepseek-r1/i,
    displayName: 'DeepSeek R1',
    strengths: ['reasoning', 'code'],
  },
  {
    pattern: /glm-4\.7-flash/i,
    displayName: 'GLM-4.7 Flash',
    strengths: ['general', 'fast', 'long-context'],
  },
  {
    pattern: /glm-4\.7/i,
    displayName: 'GLM-4.7',
    strengths: ['general', 'reasoning', 'long-context'],
  },
  {
    pattern: /kimi|k2\.5/i,
    displayName: 'Kimi K2.5',
    strengths: ['long-context', 'general'],
  },
  {
    pattern: /minimax/i,
    displayName: 'MiniMax',
    strengths: ['long-context', 'general'],
  },
  {
    pattern: /qwq/i,
    displayName: 'QwQ',
    strengths: ['reasoning'],
  },
  {
    pattern: /gemma/i,
    displayName: 'Gemma',
    strengths: ['fast', 'general'],
  },
  {
    pattern: /step-3\.5/i,
    displayName: 'Step 3.5',
    strengths: ['general'],
  },
  {
    pattern: /claude/i,
    displayName: 'Claude',
    strengths: ['code', 'general', 'reasoning'],
  },
];

// ---------------------------------------------------------------------------
// Task keyword patterns
// ---------------------------------------------------------------------------

/** Keywords that suggest code-focused work */
const CODE_KEYWORDS = /\b(code|edit|refactor|debug|fix|implement|function|class|module|test|lint|type|compile|build|deploy|api|endpoint|bug|error|exception|stack\s?trace)\b/i;

/** Keywords that suggest general/writing work */
const GENERAL_KEYWORDS = /\b(write|summarize|explain|describe|document|readme|blog|draft|review|translate|outline|compare|analyze|report)\b/i;

/** Keywords that suggest reasoning-heavy work */
const REASONING_KEYWORDS = /\b(reason|think|plan|architect|design|strategy|evaluate|decide|trade-?off|pros?\s+and\s+cons?|why|complex)\b/i;

/** Keywords that suggest long context is needed */
const LONG_CONTEXT_KEYWORDS = /\b(large\s+file|many\s+files|entire\s+codebase|whole\s+project|all\s+files|monorepo|repository|scan\s+all|full\s+codebase)\b/i;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface ModelRecommendation {
  /** The recommended model ID */
  model: string;
  /** Human-readable reason for the recommendation */
  reason: string;
}

/**
 * Recommend a model based on task description keywords.
 *
 * This is a lightweight heuristic — it scores each known model against
 * the detected task type and returns the best match. If no strong signal
 * is found, falls back to the user's configured default model.
 */
export function recommendModel(
  task: string,
  config: OptaConfig,
): ModelRecommendation {
  const defaultModel = config.model.default;

  // Detect task type from keywords
  const wantsCode = CODE_KEYWORDS.test(task);
  const wantsGeneral = GENERAL_KEYWORDS.test(task);
  const wantsReasoning = REASONING_KEYWORDS.test(task);
  const wantsLongContext = LONG_CONTEXT_KEYWORDS.test(task);

  // If no keywords match, stick with default
  if (!wantsCode && !wantsGeneral && !wantsReasoning && !wantsLongContext) {
    return {
      model: defaultModel || 'current model',
      reason: 'No specific task pattern detected — using your default model.',
    };
  }

  // Score each known model against the task
  let bestScore = -1;
  let bestCapability: ModelCapability | null = null;

  for (const cap of MODEL_CAPABILITIES) {
    let score = 0;

    if (wantsCode && cap.strengths.includes('code')) score += 3;
    if (wantsGeneral && cap.strengths.includes('general')) score += 2;
    if (wantsReasoning && cap.strengths.includes('reasoning')) score += 3;
    if (wantsLongContext && cap.strengths.includes('long-context')) {
      // Also check actual context limit from model profiles
      const profile = getModelProfile(cap.displayName);
      if (profile.contextLimit >= 128000) score += 4;
      else score += 2;
    }

    if (score > bestScore) {
      bestScore = score;
      bestCapability = cap;
    }
  }

  if (!bestCapability || bestScore <= 0) {
    return {
      model: defaultModel || 'current model',
      reason: 'No strong model preference detected — using your default model.',
    };
  }

  // Build a human-readable reason
  const needs: string[] = [];
  if (wantsCode) needs.push('code editing');
  if (wantsGeneral) needs.push('general text');
  if (wantsReasoning) needs.push('reasoning');
  if (wantsLongContext) needs.push('long context');

  const reason = `${bestCapability.displayName} is strong at ${bestCapability.strengths.join(', ')} — good fit for ${needs.join(' + ')}.`;

  return {
    model: bestCapability.displayName,
    reason,
  };
}

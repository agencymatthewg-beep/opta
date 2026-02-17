/**
 * Canonical model metadata — single source of truth for model profiles.
 *
 * TODO: src/lmx/client.ts has a duplicate CONTEXT_LIMIT_TABLE that should
 * be replaced with getContextLimit() from this module.
 */

export interface ModelProfile {
  contextLimit: number;
  compactAt: number;
  observationWindow: number;
}

const MODEL_PROFILES: Array<{ pattern: RegExp; profile: ModelProfile }> = [
  {
    pattern: /qwen.*coder|qwen2\.5/i,
    profile: { contextLimit: 32768, compactAt: 0.70, observationWindow: 4 },
  },
  {
    pattern: /glm-4\.7-flash/i,
    profile: { contextLimit: 128000, compactAt: 0.75, observationWindow: 8 },
  },
  {
    pattern: /glm-4\.7/i,
    profile: { contextLimit: 200000, compactAt: 0.70, observationWindow: 8 },
  },
  {
    pattern: /deepseek-v3|deepseek-chat/i,
    profile: { contextLimit: 128000, compactAt: 0.80, observationWindow: 8 },
  },
  {
    pattern: /deepseek-r1-distill/i,
    profile: { contextLimit: 32768, compactAt: 0.70, observationWindow: 4 },
  },
  {
    pattern: /kimi|k2\.5/i,
    profile: { contextLimit: 256000, compactAt: 0.70, observationWindow: 8 },
  },
  {
    pattern: /minimax/i,
    profile: { contextLimit: 1000000, compactAt: 0.85, observationWindow: 12 },
  },
  {
    pattern: /gemma.*3/i,
    profile: { contextLimit: 8192, compactAt: 0.65, observationWindow: 2 },
  },
  {
    pattern: /wizard/i,
    profile: { contextLimit: 4096, compactAt: 0.60, observationWindow: 2 },
  },
  {
    pattern: /step-3\.5/i,
    profile: { contextLimit: 32768, compactAt: 0.70, observationWindow: 4 },
  },
  {
    pattern: /qwq/i,
    profile: { contextLimit: 32768, compactAt: 0.70, observationWindow: 4 },
  },
];

const DEFAULT_PROFILE: ModelProfile = {
  contextLimit: 32768,
  compactAt: 0.70,
  observationWindow: 4,
};

export function getModelProfile(modelName: string): ModelProfile {
  for (const { pattern, profile } of MODEL_PROFILES) {
    if (pattern.test(modelName)) return profile;
  }
  return DEFAULT_PROFILE;
}

/**
 * Get the context limit for a model by name.
 * Convenience wrapper over getModelProfile().
 */
export function getContextLimit(modelId: string): number {
  return getModelProfile(modelId).contextLimit;
}

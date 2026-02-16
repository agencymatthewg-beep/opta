export interface ModelProfile {
  contextLimit: number;
  compactAt: number;
  observationWindow: number;
  charToTokenRatio: number;
  architecture: 'dense' | 'moe' | 'mla' | 'hybrid';
}

const MODEL_PROFILES: Array<{ pattern: RegExp; profile: ModelProfile }> = [
  {
    pattern: /qwen.*coder|qwen2\.5/i,
    profile: { contextLimit: 32768, compactAt: 0.70, observationWindow: 4, charToTokenRatio: 3.5, architecture: 'dense' },
  },
  {
    pattern: /glm-4\.7-flash/i,
    profile: { contextLimit: 128000, compactAt: 0.75, observationWindow: 8, charToTokenRatio: 4.0, architecture: 'moe' },
  },
  {
    pattern: /glm-4\.7/i,
    profile: { contextLimit: 200000, compactAt: 0.70, observationWindow: 8, charToTokenRatio: 4.0, architecture: 'moe' },
  },
  {
    pattern: /deepseek-v3|deepseek-chat/i,
    profile: { contextLimit: 128000, compactAt: 0.80, observationWindow: 8, charToTokenRatio: 3.8, architecture: 'mla' },
  },
  {
    pattern: /deepseek-r1-distill/i,
    profile: { contextLimit: 32768, compactAt: 0.70, observationWindow: 4, charToTokenRatio: 4.0, architecture: 'dense' },
  },
  {
    pattern: /kimi|k2\.5/i,
    profile: { contextLimit: 256000, compactAt: 0.70, observationWindow: 8, charToTokenRatio: 4.0, architecture: 'moe' },
  },
  {
    pattern: /minimax/i,
    profile: { contextLimit: 1000000, compactAt: 0.85, observationWindow: 12, charToTokenRatio: 4.0, architecture: 'hybrid' },
  },
  {
    pattern: /gemma.*3/i,
    profile: { contextLimit: 8192, compactAt: 0.65, observationWindow: 2, charToTokenRatio: 3.5, architecture: 'dense' },
  },
  {
    pattern: /wizard/i,
    profile: { contextLimit: 4096, compactAt: 0.60, observationWindow: 2, charToTokenRatio: 4.0, architecture: 'dense' },
  },
];

const DEFAULT_PROFILE: ModelProfile = {
  contextLimit: 32768,
  compactAt: 0.70,
  observationWindow: 4,
  charToTokenRatio: 4.0,
  architecture: 'dense',
};

export function getModelProfile(modelName: string): ModelProfile {
  for (const { pattern, profile } of MODEL_PROFILES) {
    if (pattern.test(modelName)) return profile;
  }
  return DEFAULT_PROFILE;
}

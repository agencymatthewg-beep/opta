import { describe, it, expect } from 'vitest';
import { getModelProfile, getContextLimit, type ModelProfile } from '../../src/core/models.js';

describe('getModelProfile', () => {
  it('returns profile for known model', () => {
    const profile = getModelProfile('qwen2.5-72b');
    expect(profile.contextLimit).toBe(32768);
    expect(profile.compactAt).toBe(0.70);
  });

  it('returns profile for GLM Flash', () => {
    const profile = getModelProfile('glm-4.7-flash');
    expect(profile.compactAt).toBe(0.75);
  });

  it('returns profile for DeepSeek V3', () => {
    const profile = getModelProfile('deepseek-v3');
    expect(profile.compactAt).toBe(0.80);
  });

  it('returns default profile for unknown model', () => {
    const profile = getModelProfile('unknown-model');
    expect(profile.contextLimit).toBe(32768);
    expect(profile.compactAt).toBe(0.70);
  });

  it('matches partial model names', () => {
    const profile = getModelProfile('Qwen2.5-Coder-72B-Instruct-4bit');
    expect(profile.compactAt).toBe(0.70);
  });
});

describe('getContextLimit', () => {
  it('returns context limit for known model', () => {
    expect(getContextLimit('qwen2.5-72b')).toBe(32768);
    expect(getContextLimit('glm-4.7-flash')).toBe(128000);
    expect(getContextLimit('minimax-m2.5')).toBe(1000000);
  });

  it('returns default for unknown model', () => {
    expect(getContextLimit('unknown-model')).toBe(32768);
  });
});

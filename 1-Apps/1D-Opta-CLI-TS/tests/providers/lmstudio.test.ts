import { describe, it, expect } from 'vitest';
import { LMStudioProvider } from '../../src/providers/lmstudio.js';

describe('LMStudioProvider', () => {
  it('creates with host and port', () => {
    const provider = new LMStudioProvider('192.168.188.11', 1234);
    expect(provider.name).toBe('lmstudio');
    expect(provider.host).toBe('192.168.188.11');
    expect(provider.port).toBe(1234);
  });

  it('looks up context limits for known models', () => {
    const provider = new LMStudioProvider('localhost', 1234);

    expect(provider.lookupContextLimit('GLM-4.7-Flash-MLX-8bit')).toBe(128_000);
    expect(provider.lookupContextLimit('Qwen2.5-72B-Instruct-4bit')).toBe(32_768);
    expect(provider.lookupContextLimit('gemma-3-4b-instruct')).toBe(8_192);
    expect(provider.lookupContextLimit('WizardLM-Uncensored-13B')).toBe(4_096);
    expect(provider.lookupContextLimit('QwQ-32B-abliterated')).toBe(32_768);
    expect(provider.lookupContextLimit('deepseek-r1-distill-qwen')).toBe(32_768);
    expect(provider.lookupContextLimit('Step-3.5-Flash-Int4')).toBe(32_768);
  });

  it('returns undefined for unknown models', () => {
    const provider = new LMStudioProvider('localhost', 1234);
    expect(provider.lookupContextLimit('totally-unknown-model')).toBeUndefined();
  });

  it('reports unavailable when host is unreachable', async () => {
    const provider = new LMStudioProvider('127.0.0.1', 19999); // closed port = instant ECONNREFUSED
    const available = await provider.isAvailable();
    expect(available).toBe(false);
  }, 5000);
});

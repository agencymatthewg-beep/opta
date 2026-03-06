import { describe, expect, it } from 'vitest';
import {
  hasProviderApiKey,
  normalizeProviderName,
  parseCloudFallbackOrder,
  parseProviderName,
  providerOptionHelp,
  resolveGeminiRuntimeAuth,
  toCloudProviderName,
} from '../../src/utils/provider-normalization.js';
import { DEFAULT_CONFIG } from '../../src/core/config.js';

describe('provider-normalization', () => {
  it('normalizes common aliases to canonical providers', () => {
    expect(parseProviderName('claude')).toBe('anthropic');
    expect(parseProviderName('google')).toBe('gemini');
    expect(parseProviderName('codex')).toBe('openai');
    expect(parseProviderName('minimax')).toBe('openai');
    expect(parseProviderName('opencode')).toBe('opencode_zen');
  });

  it('returns fallback for unknown names via normalizeProviderName', () => {
    expect(normalizeProviderName('unknown-provider', 'lmx')).toBe('lmx');
  });

  it('exposes alias-aware provider option help text', () => {
    expect(providerOptionHelp()).toContain('lmx|anthropic|gemini|openai|opencode_zen');
    expect(providerOptionHelp()).toContain('aliases: claude, google, codex, minimax, opencode');
  });

  it('parses fallback order using aliases and removes duplicates', () => {
    expect(parseCloudFallbackOrder('google,claude,codex,minimax,opencode')).toEqual([
      'gemini',
      'anthropic',
      'openai',
      'opencode_zen',
    ]);
  });

  it('falls back to default fallback order when no valid cloud providers are provided', () => {
    expect(parseCloudFallbackOrder('lmx,invalid')).toEqual([
      'anthropic',
      'gemini',
      'openai',
      'opencode_zen',
    ]);
  });

  it('maps to cloud provider names and excludes lmx', () => {
    expect(toCloudProviderName('claude')).toBe('anthropic');
    expect(toCloudProviderName('lmx')).toBeNull();
  });

  it('supports Gemini Vertex auth mode via environment flags', async () => {
    process.env['GOOGLE_GENAI_USE_VERTEXAI'] = 'true';
    process.env['GOOGLE_CLOUD_PROJECT'] = 'opta-test-project';
    process.env['GOOGLE_CLOUD_LOCATION'] = 'australia-southeast1';
    try {
      const auth = resolveGeminiRuntimeAuth();

      expect(auth.mode).toBe('vertex');
      expect(auth.project).toBe('opta-test-project');
      expect(auth.location).toBe('australia-southeast1');
      await expect(hasProviderApiKey(DEFAULT_CONFIG, 'gemini')).resolves.toBe(true);
    } finally {
      delete process.env['GOOGLE_GENAI_USE_VERTEXAI'];
      delete process.env['GOOGLE_CLOUD_PROJECT'];
      delete process.env['GOOGLE_CLOUD_LOCATION'];
    }
  });
});

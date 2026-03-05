import { describe, expect, it } from 'vitest';
import {
  normalizeProviderName,
  parseCloudFallbackOrder,
  parseProviderName,
  providerOptionHelp,
  toCloudProviderName,
} from '../../src/utils/provider-normalization.js';

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
});

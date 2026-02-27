import { afterEach, describe, expect, it } from 'vitest';
import {
  generateOptaInferenceKey,
  maskKey,
  resolveConfiguredInferenceKey,
} from '../../src/commands/key.js';

const ORIGINAL_OPTA_API_KEY = process.env['OPTA_API_KEY'];

afterEach(() => {
  if (ORIGINAL_OPTA_API_KEY === undefined) {
    delete process.env['OPTA_API_KEY'];
    return;
  }
  process.env['OPTA_API_KEY'] = ORIGINAL_OPTA_API_KEY;
});

describe('key command helpers', () => {
  describe('generateOptaInferenceKey', () => {
    it('generates prefixed random keys', () => {
      const a = generateOptaInferenceKey();
      const b = generateOptaInferenceKey();
      expect(a.startsWith('opta_sk_')).toBe(true);
      expect(b.startsWith('opta_sk_')).toBe(true);
      expect(a).not.toBe(b);
      expect(a.length).toBeGreaterThan(20);
    });
  });

  describe('maskKey', () => {
    it('masks long keys while preserving start/end', () => {
      const masked = maskKey('opta_sk_abcdefghijklmnopqrstuvwxyz123456');
      expect(masked.startsWith('opta_sk')).toBe(true);
      expect(masked.endsWith('3456')).toBe(true);
      expect(masked).toContain('*');
    });

    it('fully masks short keys', () => {
      expect(maskKey('short')).toBe('*****');
    });
  });

  describe('resolveConfiguredInferenceKey', () => {
    it('prefers environment key over config key', () => {
      process.env['OPTA_API_KEY'] = 'env-value';
      const resolved = resolveConfiguredInferenceKey({ apiKey: 'config-value' });
      expect(resolved).toEqual({ key: 'env-value', source: 'env' });
    });

    it('uses config key when env key is absent', () => {
      delete process.env['OPTA_API_KEY'];
      const resolved = resolveConfiguredInferenceKey({ apiKey: 'config-value' });
      expect(resolved).toEqual({ key: 'config-value', source: 'config' });
    });

    it('returns unset when no key exists', () => {
      delete process.env['OPTA_API_KEY'];
      const resolved = resolveConfiguredInferenceKey({});
      expect(resolved).toEqual({ key: null, source: 'unset' });
    });
  });
});

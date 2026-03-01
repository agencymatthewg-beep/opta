import { describe, it, expect } from 'vitest';
import { buildConfigOverrides } from '../../src/utils/config-helpers.js';

describe('buildConfigOverrides', () => {
  it('returns empty object when no options set', () => {
    expect(buildConfigOverrides({})).toEqual({});
  });

  it('sets model override', () => {
    const result = buildConfigOverrides({ model: 'qwen2.5-72b' });
    expect(result).toEqual({ model: { default: 'qwen2.5-72b' } });
  });

  it('sets provider override', () => {
    const result = buildConfigOverrides({ provider: 'anthropic' });
    expect(result).toEqual({ provider: { active: 'anthropic' } });
  });

  it('normalizes provider override', () => {
    const result = buildConfigOverrides({ provider: ' LMX ' });
    expect(result).toEqual({ provider: { active: 'lmx' } });
  });

  it('throws for invalid provider override', () => {
    expect(() => buildConfigOverrides({ provider: 'openai' })).toThrow(
      'Invalid provider "openai". Expected one of: lmx, anthropic.'
    );
  });

  it('sets git.autoCommit to false', () => {
    const result = buildConfigOverrides({ commit: false });
    expect(result).toEqual({ git: { autoCommit: false } });
  });

  it('sets git.checkpoints to false', () => {
    const result = buildConfigOverrides({ checkpoints: false });
    expect(result).toEqual({ git: { checkpoints: false } });
  });

  it('combines git flags', () => {
    const result = buildConfigOverrides({ commit: false, checkpoints: false });
    expect(result).toEqual({ git: { autoCommit: false, checkpoints: false } });
  });

  it('sets dangerous mode', () => {
    const result = buildConfigOverrides({ dangerous: true });
    expect(result).toEqual({ defaultMode: 'dangerous' });
  });

  it('sets yolo as dangerous mode', () => {
    const result = buildConfigOverrides({ yolo: true });
    expect(result).toEqual({ defaultMode: 'dangerous' });
  });

  it('sets auto mode', () => {
    const result = buildConfigOverrides({ auto: true });
    expect(result).toEqual({ defaultMode: 'auto' });
  });

  it('sets plan mode', () => {
    const result = buildConfigOverrides({ plan: true });
    expect(result).toEqual({ defaultMode: 'plan' });
  });

  it('dangerous takes precedence over auto', () => {
    const result = buildConfigOverrides({ dangerous: true, auto: true });
    expect(result).toEqual({ defaultMode: 'dangerous' });
  });

  it('auto takes precedence over plan', () => {
    const result = buildConfigOverrides({ auto: true, plan: true });
    expect(result).toEqual({ defaultMode: 'auto' });
  });

  it('combines model and mode overrides', () => {
    const result = buildConfigOverrides({ model: 'test-model', auto: true, commit: false });
    expect(result).toEqual({
      model: { default: 'test-model' },
      git: { autoCommit: false },
      defaultMode: 'auto',
    });
  });

  it('does not set commit when true (default)', () => {
    const result = buildConfigOverrides({ commit: true });
    expect(result).toEqual({});
  });
});

import { describe, it, expect } from 'vitest';
import { resolvePermission } from '../../src/core/tools/index.js';
import { OptaConfigSchema } from '../../src/core/config.js';

describe('permission modes', () => {
  it('safe mode: edits require ask', () => {
    const config = OptaConfigSchema.parse({ defaultMode: 'safe' });
    expect(resolvePermission('edit_file', config)).toBe('ask');
    expect(resolvePermission('read_file', config)).toBe('allow');
  });

  it('auto mode: edits allowed, shell asks', () => {
    const config = OptaConfigSchema.parse({ defaultMode: 'auto' });
    expect(resolvePermission('edit_file', config)).toBe('allow');
    expect(resolvePermission('write_file', config)).toBe('allow');
    expect(resolvePermission('run_command', config)).toBe('ask');
  });

  it('plan mode: all writes denied', () => {
    const config = OptaConfigSchema.parse({ defaultMode: 'plan' });
    expect(resolvePermission('edit_file', config)).toBe('deny');
    expect(resolvePermission('write_file', config)).toBe('deny');
    expect(resolvePermission('run_command', config)).toBe('deny');
    expect(resolvePermission('read_file', config)).toBe('allow');
  });

  it('dangerous mode: everything allowed', () => {
    const config = OptaConfigSchema.parse({ defaultMode: 'dangerous' });
    expect(resolvePermission('edit_file', config)).toBe('allow');
    expect(resolvePermission('run_command', config)).toBe('allow');
  });

  it('per-tool overrides take precedence over mode', () => {
    const config = OptaConfigSchema.parse({
      defaultMode: 'dangerous',
      permissions: { run_command: 'deny' },
    });
    expect(resolvePermission('run_command', config)).toBe('deny');
  });

  it('bg_start defaults to ask in safe mode', () => {
    const config = OptaConfigSchema.parse({ defaultMode: 'safe' });
    expect(resolvePermission('bg_start', config)).toBe('ask');
    expect(resolvePermission('bg_status', config)).toBe('allow');
    expect(resolvePermission('bg_output', config)).toBe('allow');
    expect(resolvePermission('bg_kill', config)).toBe('ask');
  });

  it('bg_start and bg_kill allowed in auto mode', () => {
    const config = OptaConfigSchema.parse({ defaultMode: 'auto' });
    expect(resolvePermission('bg_start', config)).toBe('allow');
    expect(resolvePermission('bg_kill', config)).toBe('allow');
  });

  it('bg_start and bg_kill denied in plan mode', () => {
    const config = OptaConfigSchema.parse({ defaultMode: 'plan' });
    expect(resolvePermission('bg_start', config)).toBe('deny');
    expect(resolvePermission('bg_kill', config)).toBe('deny');
    expect(resolvePermission('bg_status', config)).toBe('allow');
    expect(resolvePermission('bg_output', config)).toBe('allow');
  });

  it('bg_start and bg_kill denied in ci mode', () => {
    const config = OptaConfigSchema.parse({ defaultMode: 'ci' });
    expect(resolvePermission('bg_start', config)).toBe('deny');
    expect(resolvePermission('bg_kill', config)).toBe('deny');
  });
});

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { resolvePermission } from '../../src/core/tools.js';
import { DEFAULT_CONFIG, type OptaConfig } from '../../src/core/config.js';

describe('Custom tool permissions', () => {
  it('custom tools get ask permission by default (same as run_command)', () => {
    // Custom tools execute shell commands, so they inherit run_command's permission
    const perm = resolvePermission('custom__deploy', DEFAULT_CONFIG);
    expect(perm).toBe('ask');
  });

  it('custom tools are ask in auto mode (same as run_command)', () => {
    // auto mode does NOT auto-approve run_command, so custom tools also stay at 'ask'
    const autoConfig = {
      ...DEFAULT_CONFIG,
      defaultMode: 'auto' as const,
    };
    const perm = resolvePermission('custom__deploy', autoConfig);
    expect(perm).toBe('ask');
  });

  it('custom tools are allowed in dangerous mode', () => {
    const dangerousConfig = {
      ...DEFAULT_CONFIG,
      defaultMode: 'dangerous' as const,
    };
    const perm = resolvePermission('custom__deploy', dangerousConfig);
    expect(perm).toBe('allow');
  });

  it('custom tools are denied in plan mode', () => {
    const planConfig = {
      ...DEFAULT_CONFIG,
      defaultMode: 'plan' as const,
    };
    const perm = resolvePermission('custom__deploy', planConfig);
    expect(perm).toBe('deny');
  });

  it('custom tools are denied in CI mode', () => {
    const ciConfig = {
      ...DEFAULT_CONFIG,
      defaultMode: 'ci' as const,
    };
    const perm = resolvePermission('custom__deploy', ciConfig);
    expect(perm).toBe('deny');
  });

  it('per-tool permission override works for custom tools', () => {
    const config = {
      ...DEFAULT_CONFIG,
      permissions: {
        ...DEFAULT_CONFIG.permissions,
        'custom__deploy': 'allow' as const,
      },
    };
    const perm = resolvePermission('custom__deploy', config);
    expect(perm).toBe('allow');
  });
});

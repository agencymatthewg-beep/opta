import { describe, it, expect } from 'vitest';
import { resolvePermission } from '../../src/core/tools/index.js';
import { OptaConfigSchema } from '../../src/core/config.js';

describe('permission modes', () => {
  it('safe mode: edits require ask', () => {
    const config = OptaConfigSchema.parse({ defaultMode: 'safe' });
    expect(resolvePermission('edit_file', config)).toBe('ask');
    expect(resolvePermission('read_file', config)).toBe('allow');
    expect(resolvePermission('research_query', config)).toBe('allow');
    expect(resolvePermission('learning_summary', config)).toBe('allow');
    expect(resolvePermission('learning_retrieve', config)).toBe('allow');
    expect(resolvePermission('browser_open', config)).toBe('ask');
  });

  it('auto mode: edits allowed at autonomy >= 3, shell asks', () => {
    // Autonomy level 3 allows destructive tools through without the floor override
    const config = OptaConfigSchema.parse({ defaultMode: 'auto', autonomy: { level: 3 } });
    expect(resolvePermission('edit_file', config)).toBe('allow');
    expect(resolvePermission('write_file', config)).toBe('allow');
    expect(resolvePermission('run_command', config)).toBe('ask');
    expect(resolvePermission('browser_open', config)).toBe('allow');
    expect(resolvePermission('browser_type', config)).toBe('allow');
    expect(resolvePermission('learning_log', config)).toBe('allow');
  });

  it('plan mode: all writes denied', () => {
    const config = OptaConfigSchema.parse({ defaultMode: 'plan' });
    expect(resolvePermission('edit_file', config)).toBe('deny');
    expect(resolvePermission('write_file', config)).toBe('deny');
    expect(resolvePermission('run_command', config)).toBe('deny');
    expect(resolvePermission('read_file', config)).toBe('allow');
    expect(resolvePermission('browser_open', config)).toBe('deny');
    expect(resolvePermission('learning_log', config)).toBe('deny');
    expect(resolvePermission('research_query', config)).toBe('allow');
    expect(resolvePermission('learning_summary', config)).toBe('allow');
  });

  it('dangerous mode: everything allowed at autonomy >= 3', () => {
    const config = OptaConfigSchema.parse({ defaultMode: 'dangerous', autonomy: { level: 3 } });
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

  it('bg_start and bg_kill allowed in auto mode at autonomy >= 3', () => {
    const config = OptaConfigSchema.parse({ defaultMode: 'auto', autonomy: { level: 3 } });
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
    expect(resolvePermission('browser_open', config)).toBe('deny');
    expect(resolvePermission('browser_navigate', config)).toBe('deny');
    expect(resolvePermission('learning_log', config)).toBe('deny');
    expect(resolvePermission('research_health', config)).toBe('allow');
  });

  it('research mode: research and read-only learning are allowed, logging is denied', () => {
    const config = OptaConfigSchema.parse({ defaultMode: 'research' });
    expect(resolvePermission('research_query', config)).toBe('allow');
    expect(resolvePermission('research_health', config)).toBe('allow');
    expect(resolvePermission('browser_open', config)).toBe('allow');
    expect(resolvePermission('browser_snapshot', config)).toBe('allow');
    expect(resolvePermission('browser_click', config)).toBe('ask');
    expect(resolvePermission('browser_type', config)).toBe('ask');
    expect(resolvePermission('learning_log', config)).toBe('deny');
    expect(resolvePermission('learning_summary', config)).toBe('allow');
    expect(resolvePermission('learning_retrieve', config)).toBe('allow');
  });
});

describe('autonomy floor enforcement', () => {
  it('autonomy level 1: destructive tool resolved as allow gets overridden to ask', () => {
    // Auto mode would normally allow edit_file, but autonomy level 1 forces ask
    const config = OptaConfigSchema.parse({
      defaultMode: 'auto',
      autonomy: { level: 1 },
    });
    expect(resolvePermission('edit_file', config)).toBe('ask');
    expect(resolvePermission('write_file', config)).toBe('ask');
    expect(resolvePermission('run_command', config)).toBe('ask');
    expect(resolvePermission('delete_file', config)).toBe('ask');
    expect(resolvePermission('browser_click', config)).toBe('ask');
    expect(resolvePermission('browser_type', config)).toBe('ask');
    expect(resolvePermission('browser_navigate', config)).toBe('ask');
  });

  it('autonomy level 2: destructive tool resolved as allow gets overridden to ask', () => {
    const config = OptaConfigSchema.parse({
      defaultMode: 'auto',
      autonomy: { level: 2 },
    });
    expect(resolvePermission('edit_file', config)).toBe('ask');
    expect(resolvePermission('write_file', config)).toBe('ask');
    expect(resolvePermission('browser_click', config)).toBe('ask');
  });

  it('autonomy level 3: destructive tool resolved as allow stays allow', () => {
    const config = OptaConfigSchema.parse({
      defaultMode: 'auto',
      autonomy: { level: 3 },
    });
    expect(resolvePermission('edit_file', config)).toBe('allow');
    expect(resolvePermission('write_file', config)).toBe('allow');
    expect(resolvePermission('browser_click', config)).toBe('allow');
    expect(resolvePermission('browser_type', config)).toBe('allow');
    expect(resolvePermission('browser_navigate', config)).toBe('allow');
  });

  it('autonomy level 2: non-destructive tool resolved as allow stays allow', () => {
    const config = OptaConfigSchema.parse({
      defaultMode: 'auto',
      autonomy: { level: 2 },
    });
    expect(resolvePermission('read_file', config)).toBe('allow');
    expect(resolvePermission('list_dir', config)).toBe('allow');
    expect(resolvePermission('search_files', config)).toBe('allow');
    expect(resolvePermission('learning_log', config)).toBe('allow');
    expect(resolvePermission('research_query', config)).toBe('allow');
  });

  it('autonomy level 1: deny permissions are not escalated by the floor', () => {
    const config = OptaConfigSchema.parse({
      defaultMode: 'plan',
      autonomy: { level: 1 },
    });
    // Plan mode denies these — floor should not change deny to ask
    expect(resolvePermission('edit_file', config)).toBe('deny');
    expect(resolvePermission('write_file', config)).toBe('deny');
    expect(resolvePermission('run_command', config)).toBe('deny');
  });

  it('autonomy level 2: explicit config allow on destructive tool is overridden to ask', () => {
    // User set edit_file to allow in config, but autonomy level 2 forces ask
    const config = OptaConfigSchema.parse({
      defaultMode: 'safe',
      autonomy: { level: 2 },
      permissions: { edit_file: 'allow' },
    });
    expect(resolvePermission('edit_file', config)).toBe('ask');
  });

  it('dangerous mode at autonomy level 1: destructive tools still forced to ask', () => {
    const config = OptaConfigSchema.parse({
      defaultMode: 'dangerous',
      autonomy: { level: 1 },
    });
    expect(resolvePermission('edit_file', config)).toBe('ask');
    expect(resolvePermission('write_file', config)).toBe('ask');
    expect(resolvePermission('run_command', config)).toBe('ask');
    expect(resolvePermission('delete_file', config)).toBe('ask');
    expect(resolvePermission('browser_click', config)).toBe('ask');
  });

  it('dangerous mode at autonomy level 5: destructive tools stay allowed', () => {
    const config = OptaConfigSchema.parse({
      defaultMode: 'dangerous',
      autonomy: { level: 5 },
    });
    expect(resolvePermission('edit_file', config)).toBe('allow');
    expect(resolvePermission('write_file', config)).toBe('allow');
    expect(resolvePermission('run_command', config)).toBe('allow');
    expect(resolvePermission('delete_file', config)).toBe('allow');
    expect(resolvePermission('browser_click', config)).toBe('allow');
  });

  it('autonomy level 1: newly added destructive tools (multi_edit, spawn_agent, etc.) forced to ask', () => {
    const config = OptaConfigSchema.parse({
      defaultMode: 'auto',
      autonomy: { level: 1 },
    });
    expect(resolvePermission('multi_edit', config)).toBe('ask');
    expect(resolvePermission('spawn_agent', config)).toBe('ask');
    expect(resolvePermission('delegate_task', config)).toBe('ask');
    expect(resolvePermission('bg_start', config)).toBe('ask');
    expect(resolvePermission('lsp_rename', config)).toBe('ask');
  });

  it('autonomy level 3: newly added destructive tools allowed in auto mode', () => {
    const config = OptaConfigSchema.parse({
      defaultMode: 'auto',
      autonomy: { level: 3 },
    });
    expect(resolvePermission('multi_edit', config)).toBe('allow');
    expect(resolvePermission('spawn_agent', config)).toBe('allow');
    expect(resolvePermission('delegate_task', config)).toBe('allow');
    expect(resolvePermission('bg_start', config)).toBe('allow');
  });
});

import { describe, expect, it } from 'vitest';
import { buildConfigSections, manageCommands } from '../../src/commands/slash/manage.js';

describe('buildConfigSections', () => {
  it('groups flattened config keys by top-level section', () => {
    const sections = buildConfigSections({
      connection: { host: '127.0.0.1', port: 1234 },
      model: { default: 'mlx-community/MiniMax-M2.5-4bit', contextLimit: 200000 },
      git: { autoCommit: true },
    });

    expect(sections.map((s) => s.id)).toEqual(['connection', 'git', 'model']);

    const connectionItems = sections.find((s) => s.id === 'connection')?.items.map((i) => i.id) ?? [];
    expect(connectionItems).toEqual(['connection.host', 'connection.port']);

    const modelItems = sections.find((s) => s.id === 'model')?.items.map((i) => i.id) ?? [];
    expect(modelItems).toContain('model.default');
    expect(modelItems).toContain('model.contextLimit');
  });

  it('builds short descriptions for long values', () => {
    const sections = buildConfigSections({
      model: {
        default: 'inferencelabs/GLM-5-MLX-4.8bit-with-a-very-long-suffix-that-should-be-truncated',
      },
    });

    const desc = sections[0]?.items[0]?.description ?? '';
    expect(desc.length).toBeLessThanOrEqual(45);
    expect(desc.endsWith('…')).toBe(true);
  });

  it('masks sensitive config values in section descriptions', () => {
    const sections = buildConfigSections({
      research: {
        providers: {
          tavily: {
            apiKey: 'tvly-sensitive-secret-12345',
          },
        },
      },
    });

    const item = sections
      .find((s) => s.id === 'research')
      ?.items.find((i) => i.id === 'research.providers.tavily.apiKey');

    expect(item).toBeDefined();
    expect(item?.description).toContain('(set)');
    expect(item?.description).not.toContain('tvly-sensitive-secret-12345');
  });
});

describe('manageCommands', () => {
  it('includes full management command surface for chat/menu usage', () => {
    const ids = new Set(manageCommands.map((cmd) => cmd.command));
    expect(ids.has('config')).toBe(true);
    expect(ids.has('doctor')).toBe(true);
    expect(ids.has('mcp')).toBe(true);
    expect(ids.has('update')).toBe(true);
    expect(ids.has('key')).toBe(true);
    expect(ids.has('keys')).toBe(true);
    expect(ids.has('server')).toBe(true);
    expect(ids.has('daemon')).toBe(true);
    expect(ids.has('completions')).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import type { SlashCommandDef, SlashResult } from '../../src/commands/slash/types.js';
import { buildHelpSections } from '../../src/commands/slash/display.js';

const noop = async (): Promise<SlashResult> => 'handled';

function cmd(
  command: string,
  description: string,
  category: SlashCommandDef['category'],
): SlashCommandDef {
  return { command, description, category, handler: noop };
}

describe('buildHelpSections', () => {
  it('groups commands by area and appends all-commands section', () => {
    const sections = buildHelpSections([
      cmd('model', 'Switch model', 'session'),
      cmd('plan', 'Plan mode', 'tools'),
      cmd('sessions', 'Session manager', 'session'),
      cmd('config', 'Settings', 'tools'),
      cmd('history', 'History', 'info'),
    ]);

    expect(sections.map((s) => s.id)).toEqual(['models', 'coding', 'session', 'management', 'all']);
    expect(sections.find((s) => s.id === 'models')?.items.map((i) => i.id)).toContain('model');
    expect(sections.find((s) => s.id === 'coding')?.items.map((i) => i.id)).toContain('plan');
    expect(sections.find((s) => s.id === 'session')?.items.map((i) => i.id)).toContain('sessions');
    expect(sections.find((s) => s.id === 'management')?.items.map((i) => i.id)).toContain('config');
  });

  it('de-duplicates repeated commands and keeps all section sorted', () => {
    const sections = buildHelpSections([
      cmd('config', 'Settings', 'tools'),
      cmd('config', 'Settings duplicate', 'tools'),
      cmd('doctor', 'Health checks', 'info'),
      cmd('model', 'Switch model', 'session'),
    ]);

    const allItems = sections.find((s) => s.id === 'all')?.items.map((i) => i.id) ?? [];
    expect(allItems).toEqual(['config', 'doctor', 'model']);
  });
});

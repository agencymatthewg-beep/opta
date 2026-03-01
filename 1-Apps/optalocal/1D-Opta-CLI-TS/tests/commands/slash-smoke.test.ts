import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/core/config.js';
import { dispatchSlashCommand, getAllCommands } from '../../src/commands/slash/index.js';

let logs: string[] = [];

beforeEach(() => {
  logs = [];
  vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
    logs.push(args.map(String).join(' '));
  });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('slash command smoke checks', () => {
  it('registered slash commands are unique by command id', () => {
    const all = getAllCommands();
    const unique = new Set(all.map((c) => c.command));
    expect(unique.size).toBe(all.length);
  });

  it('exposes full command coverage for chat/menu command routing', () => {
    const commands = new Set(getAllCommands().map((c) => c.command));

    // Top-level command parity that must remain available in slash/menu flows.
    const required = [
      'status',
      'autonomy',
      'models',
      'config',
      'key',
      'sessions',
      'mcp',
      'init',
      'diff',
      'serve',
      'update',
      'server',
      'daemon',
      'doctor',
      'completions',
      'browser',
    ];

    for (const command of required) {
      expect(commands.has(command)).toBe(true);
    }
  });

  it('all registered commands render --help output without throwing', async () => {
    const ctx = {
      session: { id: 'test-session', messages: [] },
      config: structuredClone(DEFAULT_CONFIG),
      chatState: {},
    } as any;

    const commands = [...new Map(getAllCommands().map((c) => [c.command, c])).values()];
    for (const command of commands) {
      const result = await dispatchSlashCommand(`/${command.command} --help`, ctx);
      expect(result).toBe('handled');
    }

    expect(logs.join('\n')).toContain('/help');
    expect(logs.join('\n')).toContain('/config');
    expect(logs.join('\n')).toContain('/scan');
    expect(logs.join('\n')).toContain('ceo-max');
    expect(logs.join('\n')).toContain('/browser host start');
    expect(logs.join('\n')).toContain('--screen peekaboo');
  });
});

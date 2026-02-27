import { describe, it, expect, vi, beforeEach } from 'vitest';

// Capture console.log output
let output: string[] = [];
beforeEach(() => {
  output = [];
  vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
    output.push(args.map(String).join(' '));
  });
});

// All commands that should appear in completions
const ALL_COMMANDS = [
  'chat', 'tui', 'do', 'benchmark', 'init', 'status', 'models', 'env', 'config',
  'sessions', 'mcp', 'diff', 'server', 'daemon', 'serve', 'update', 'completions',
];

describe('completions', () => {
  it('generates bash completions', async () => {
    const { completions } = await import('../../src/commands/completions.js');
    await completions('bash');
    const text = output.join('\n');
    expect(text).toContain('_opta_completions');
    expect(text).toContain('complete -F');
    expect(text).toContain('chat');
    expect(text).toContain('status');
  });

  it('generates zsh completions', async () => {
    const { completions } = await import('../../src/commands/completions.js');
    await completions('zsh');
    const text = output.join('\n');
    expect(text).toContain('#compdef opta');
    expect(text).toContain('_opta');
    expect(text).toContain('chat');
  });

  it('generates fish completions', async () => {
    const { completions } = await import('../../src/commands/completions.js');
    await completions('fish');
    const text = output.join('\n');
    expect(text).toContain('complete -c opta');
    expect(text).toContain('__fish_use_subcommand');
    expect(text).toContain('chat');
  });

  it('is case-insensitive', async () => {
    const { completions } = await import('../../src/commands/completions.js');
    await completions('BASH');
    const text = output.join('\n');
    expect(text).toContain('_opta_completions');
  });

  describe('bash completions include all commands', () => {
    it('has all commands in the commands variable', async () => {
      const { completions } = await import('../../src/commands/completions.js');
      await completions('bash');
      const text = output.join('\n');
      for (const cmd of ALL_COMMANDS) {
        expect(text).toContain(cmd);
      }
    });

    it('has flag completions for chat command', async () => {
      const { completions } = await import('../../src/commands/completions.js');
      await completions('bash');
      const text = output.join('\n');
      expect(text).toContain('--resume');
      expect(text).toContain('--plan');
      expect(text).toContain('--format');
      expect(text).toContain('--no-commit');
      expect(text).toContain('--no-checkpoints');
      expect(text).toContain('--auto');
      expect(text).toContain('--dangerous');
      expect(text).toContain('--yolo');
      expect(text).toContain('--tui');
    });

    it('has flag completions for do command', async () => {
      const { completions } = await import('../../src/commands/completions.js');
      await completions('bash');
      const text = output.join('\n');
      expect(text).toContain('--no-commit');
      expect(text).toContain('--no-checkpoints');
      expect(text).toContain('--auto');
      expect(text).toContain('--dangerous');
      expect(text).toContain('--yolo');
    });

    it('has mcp subcommands', async () => {
      const { completions } = await import('../../src/commands/completions.js');
      await completions('bash');
      const text = output.join('\n');
      // mcp subcommands should include add, remove, test, list
      expect(text).toMatch(/mcp\)[\s\S]*add/);
      expect(text).toMatch(/mcp\)[\s\S]*remove/);
      expect(text).toMatch(/mcp\)[\s\S]*test/);
    });

    it('has server flags', async () => {
      const { completions } = await import('../../src/commands/completions.js');
      await completions('bash');
      const text = output.join('\n');
      expect(text).toContain('--port');
      expect(text).toContain('--host');
    });

    it('has config menu subcommand in bash', async () => {
      const { completions } = await import('../../src/commands/completions.js');
      await completions('bash');
      const text = output.join('\n');
      expect(text).toContain('list get set reset menu');
    });

    it('has update flags in bash', async () => {
      const { completions } = await import('../../src/commands/completions.js');
      await completions('bash');
      const text = output.join('\n');
      expect(text).toContain('--components');
      expect(text).toContain('--target');
      expect(text).toContain('--remote-host');
      expect(text).toContain('--dry-run');
      expect(text).toContain('--no-build');
      expect(text).toContain('--no-pull');
    });

    it('has env subcommands and flags in bash', async () => {
      const { completions } = await import('../../src/commands/completions.js');
      await completions('bash');
      const text = output.join('\n');
      expect(text).toContain('list show save use delete');
      expect(text).toContain('--provider');
      expect(text).toContain('--mode');
    });
  });

  describe('zsh completions include all commands', () => {
    it('has all commands in the commands array', async () => {
      const { completions } = await import('../../src/commands/completions.js');
      await completions('zsh');
      const text = output.join('\n');
      for (const cmd of ALL_COMMANDS) {
        expect(text).toContain(cmd);
      }
    });

    it('has chat flags in zsh', async () => {
      const { completions } = await import('../../src/commands/completions.js');
      await completions('zsh');
      const text = output.join('\n');
      expect(text).toContain('--tui');
      expect(text).toContain('--dangerous');
      expect(text).toContain('--no-commit');
    });

    it('has update flags in zsh', async () => {
      const { completions } = await import('../../src/commands/completions.js');
      await completions('zsh');
      const text = output.join('\n');
      expect(text).toContain('--components');
      expect(text).toContain('components:(cli lmx plus web)');
      expect(text).toContain('--target');
      expect(text).toContain('--remote-host');
      expect(text).toContain('--no-build');
      expect(text).toContain('--no-pull');
    });

    it('has config menu subcommand in zsh', async () => {
      const { completions } = await import('../../src/commands/completions.js');
      await completions('zsh');
      const text = output.join('\n');
      expect(text).toContain('list get set reset menu');
    });
  });

  describe('fish completions include all commands', () => {
    it('has all commands as subcommands', async () => {
      const { completions } = await import('../../src/commands/completions.js');
      await completions('fish');
      const text = output.join('\n');
      for (const cmd of ALL_COMMANDS) {
        expect(text).toContain(cmd);
      }
    });

    it('has chat flags in fish', async () => {
      const { completions } = await import('../../src/commands/completions.js');
      await completions('fish');
      const text = output.join('\n');
      // Fish uses -l for long flags (not --)
      expect(text).toContain('-l tui');
      expect(text).toContain('-l dangerous');
      expect(text).toContain('-l no-commit');
      expect(text).toContain('-l no-checkpoints');
    });

    it('has do flags in fish', async () => {
      const { completions } = await import('../../src/commands/completions.js');
      await completions('fish');
      const text = output.join('\n');
      // Fish uses -l for long flags and -s for short flags
      expect(text).toContain('-l quiet');
      expect(text).toContain('-l output');
      expect(text).toContain('-l yolo');
    });

    it('has update flags in fish', async () => {
      const { completions } = await import('../../src/commands/completions.js');
      await completions('fish');
      const text = output.join('\n');
      expect(text).toContain('-l components');
      expect(text).toContain('Components: cli,lmx,plus,web');
      expect(text).toContain("-a 'cli lmx plus web'");
      expect(text).toContain('-l target');
      expect(text).toContain('-l remote-host');
      expect(text).toContain('-l no-build');
      expect(text).toContain('-l no-pull');
    });

    it('has config menu subcommand in fish', async () => {
      const { completions } = await import('../../src/commands/completions.js');
      await completions('fish');
      const text = output.join('\n');
      expect(text).toContain("list get set reset menu");
    });
  });
});

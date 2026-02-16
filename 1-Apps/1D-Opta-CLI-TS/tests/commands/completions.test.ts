import { describe, it, expect, vi, beforeEach } from 'vitest';

// Capture console.log output
let output: string[] = [];
beforeEach(() => {
  output = [];
  vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
    output.push(args.map(String).join(' '));
  });
});

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
});

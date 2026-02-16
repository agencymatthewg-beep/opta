import { describe, it, expect } from 'vitest';
import { execaNode } from 'execa';
import { resolve } from 'node:path';

const CLI_PATH = resolve(import.meta.dirname, '../src/index.ts');
const run = (args: string[]) =>
  execaNode(CLI_PATH, args, {
    nodeOptions: ['--import', 'tsx'],
    reject: false,
  });

describe('opta CLI', () => {
  it('shows help when no command given', async () => {
    const result = await run([]);
    expect(result.stdout).toContain('Agentic AI coding CLI powered by local LLMs');
    expect(result.stdout).toContain('chat');
    expect(result.stdout).toContain('status');
    expect(result.stdout).toContain('do');
    expect(result.exitCode).toBe(0);
  });

  it('shows version with --version', async () => {
    const result = await run(['--version']);
    expect(result.stdout).toMatch(/^\d+\.\d+\.\d+/);
    expect(result.exitCode).toBe(0);
  });

  it('shows version with -V', async () => {
    const result = await run(['-V']);
    expect(result.stdout).toMatch(/^\d+\.\d+\.\d+/);
    expect(result.exitCode).toBe(0);
  });

  it('shows error for unknown command', async () => {
    const result = await run(['nonexistent']);
    expect(result.exitCode).not.toBe(0);
  });

  it('lists all expected commands in help', async () => {
    const result = await run(['--help']);
    const commands = ['chat', 'do', 'status', 'models', 'config', 'sessions', 'mcp', 'init', 'diff', 'completions'];
    for (const cmd of commands) {
      expect(result.stdout).toContain(cmd);
    }
  });

  it('shows global options in help', async () => {
    const result = await run(['--help']);
    expect(result.stdout).toContain('--verbose');
    expect(result.stdout).toContain('--debug');
    expect(result.stdout).toContain('--version');
  });

  it('shows command-specific help for chat', async () => {
    const result = await run(['chat', '--help']);
    expect(result.stdout).toContain('--resume');
    expect(result.stdout).toContain('--plan');
    expect(result.stdout).toContain('--model');
    expect(result.stdout).toContain('--format');
    expect(result.exitCode).toBe(0);
  });

  it('do command accepts --format flag', async () => {
    const result = await run(['do', '--help']);
    expect(result.stdout).toContain('--format');
    expect(result.stdout).toContain('json');
    expect(result.exitCode).toBe(0);
  });

  it('shows command-specific help for status', async () => {
    const result = await run(['status', '--help']);
    expect(result.stdout).toContain('--json');
    expect(result.exitCode).toBe(0);
  });
});

describe('opta mcp', () => {
  it('mcp list runs without error', async () => {
    const result = await run(['mcp', 'list']);
    expect(result.exitCode).toBe(0);
  });

  it('mcp shows help with subcommands', async () => {
    const result = await run(['mcp', '--help']);
    expect(result.stdout).toContain('list');
    expect(result.stdout).toContain('add');
    expect(result.stdout).toContain('remove');
    expect(result.stdout).toContain('test');
  });

  it('mcp list accepts --json flag', async () => {
    const result = await run(['mcp', 'list', '--json']);
    expect(result.exitCode).toBe(0);
  });

  it('mcp add shows help with required args', async () => {
    const result = await run(['mcp', 'add', '--help']);
    expect(result.stdout).toContain('name');
    expect(result.stdout).toContain('command');
    expect(result.exitCode).toBe(0);
  });

  it('mcp remove shows help', async () => {
    const result = await run(['mcp', 'remove', '--help']);
    expect(result.exitCode).toBe(0);
  });

  it('mcp test shows help', async () => {
    const result = await run(['mcp', 'test', '--help']);
    expect(result.exitCode).toBe(0);
  });
});

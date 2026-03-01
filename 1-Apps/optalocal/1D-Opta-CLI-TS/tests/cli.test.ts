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
    expect(result.stdout).toContain('do');
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
    const commands = ['do', 'benchmark', 'status', 'models', 'env', 'config', 'sessions', 'mcp', 'init', 'diff', 'completions', 'daemon', 'update'];
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
    const result = await run(['do', '--help']);
    expect(result.stdout).toContain('--resume');
    expect(result.stdout).toContain('--plan');
    expect(result.stdout).toContain('--model');
    expect(result.stdout).toContain('--provider');
    expect(result.stdout).toContain('--device');
    expect(result.stdout).toContain('--format');
    expect(result.exitCode).toBe(0);
  });

  it('shows command-specific help for tui alias', async () => {
    const result = await run(['do', '--help']);
    expect(result.stdout).toContain('--resume');
    expect(result.stdout).toContain('--plan');
    expect(result.stdout).toContain('--model');
    expect(result.stdout).toContain('--format');
    expect(result.exitCode).toBe(0);
  });

  it('do command accepts --format flag', async () => {
    const result = await run(['do', '--help']);
    expect(result.stdout).toContain('--format');
    expect(result.stdout).toContain('--provider');
    expect(result.stdout).toContain('--device');
    expect(result.stdout).toContain('json');
    expect(result.exitCode).toBe(0);
  });

  it('fails clearly for invalid chat provider', async () => {
    const result = await run(['do', '--provider', 'invalid', 'test']);
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain('Invalid provider');
    expect(result.stderr).toContain('lmx, anthropic');
  });

  it('fails clearly for invalid do provider', async () => {
    const result = await run(['do', 'echo ok', '--provider', 'invalid']);
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain('Invalid provider');
    expect(result.stderr).toContain('lmx, anthropic');
  });

  it('chat command accepts --auto flag', async () => {
    const result = await run(['do', '--help']);
    expect(result.stdout).toContain('--auto');
    expect(result.stdout).toContain('--dangerous');
  });

  it('do command accepts --auto flag', async () => {
    const result = await run(['do', '--help']);
    expect(result.stdout).toContain('--auto');
    expect(result.stdout).toContain('--dangerous');
  });

  it('shows command-specific help for status', async () => {
    const result = await run(['status', '--help']);
    expect(result.stdout).toContain('--json');
    expect(result.stdout).toContain('--device');
    expect(result.exitCode).toBe(0);
  });

  it('shows browse model options in models help', async () => {
    const result = await run(['models', '--help']);
    expect(result.stdout).toContain('--device');
    expect(result.stdout).toContain('browse-local');
    expect(result.stdout).toContain('browse-library');
    expect(result.stdout).toContain('dashboard');
    expect(result.stdout).toContain('alias');
    expect(result.exitCode).toBe(0);
  });

  it('shows command-specific help for env', async () => {
    const result = await run(['env', '--help']);
    expect(result.stdout).toContain('--host');
    expect(result.stdout).toContain('--provider');
    expect(result.stdout).toContain('save');
    expect(result.stdout).toContain('use');
    expect(result.exitCode).toBe(0);
  });

  it('do --format json outputs valid JSON on empty task error', async () => {
    // Empty task with --format json should output JSON error, not chalk text
    const result = await run(['do', '--format', 'json', '']);
    // Should output JSON with error field
    const lines = result.stdout.trim().split('\n').filter(Boolean);
    if (lines.length > 0) {
      const parsed = JSON.parse(lines[lines.length - 1]!);
      expect(parsed).toHaveProperty('error');
      expect(parsed).toHaveProperty('exit_code');
    }
    // No ANSI escape codes in stdout
    // eslint-disable-next-line no-control-regex
    expect(result.stdout).not.toMatch(/\x1b\[/);
  });

  it('do command shows --quiet and --output in help', async () => {
    const result = await run(['do', '--help']);
    expect(result.stdout).toContain('--quiet');
    expect(result.stdout).toContain('--output');
    expect(result.exitCode).toBe(0);
  });

  it('chat command shows --format flag with json description', async () => {
    const result = await run(['do', '--help']);
    expect(result.stdout).toContain('--format');
    expect(result.stdout).toContain('json');
  });

  it('update command shows core orchestration flags', async () => {
    const result = await run(['update', '--help']);
    expect(result.stdout).toContain('--components');
    expect(result.stdout).toContain('--target');
    expect(result.stdout).toContain('--remote-host');
    expect(result.stdout).toContain('--dry-run');
    expect(result.stdout).toContain('--no-build');
    expect(result.stdout).toContain('--no-pull');
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

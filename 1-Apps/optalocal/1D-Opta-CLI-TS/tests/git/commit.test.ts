import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execa } from 'execa';
import type { AgentMessage } from '../../src/core/agent.js';
import {
  getSessionSummary,
  generateCommitMessage,
  commitSessionChanges,
} from '../../src/git/commit.js';

let testDir: string;

beforeEach(async () => {
  testDir = await mkdtemp(join(tmpdir(), 'opta-commit-test-'));
});

afterEach(async () => {
  await rm(testDir, { recursive: true, force: true });
});

async function gitInit(dir: string) {
  await execa('git', ['init'], { cwd: dir });
  await execa('git', ['config', 'user.email', 'test@test.com'], { cwd: dir });
  await execa('git', ['config', 'user.name', 'Test'], { cwd: dir });
}

async function gitCommitAll(dir: string, msg: string) {
  await execa('git', ['add', '-A'], { cwd: dir });
  await execa('git', ['commit', '-m', msg], { cwd: dir });
}

describe('getSessionSummary', () => {
  it('extracts user and assistant messages', () => {
    const messages: AgentMessage[] = [
      { role: 'system', content: 'You are Opta.' },
      { role: 'user', content: 'Fix the login bug' },
      { role: 'assistant', content: 'I found the issue in auth.ts' },
      { role: 'user', content: 'Great, apply the fix' },
      { role: 'assistant', content: 'Done, fixed the null check' },
    ];

    const summary = getSessionSummary(messages);
    expect(summary).toContain('[user] Fix the login bug');
    expect(summary).toContain('[assistant] I found the issue in auth.ts');
    expect(summary).toContain('[user] Great, apply the fix');
    expect(summary).toContain('[assistant] Done, fixed the null check');
  });

  it('skips system and tool messages', () => {
    const messages: AgentMessage[] = [
      { role: 'system', content: 'You are Opta.' },
      { role: 'user', content: 'Read the file' },
      {
        role: 'assistant',
        content: null,
        tool_calls: [
          {
            id: 'tc1',
            type: 'function',
            function: { name: 'read_file', arguments: '{"path":"a.ts"}' },
          },
        ],
      },
      { role: 'tool', content: 'file contents here', tool_call_id: 'tc1' },
      { role: 'assistant', content: 'I read the file' },
    ];

    const summary = getSessionSummary(messages);
    expect(summary).not.toContain('[system]');
    expect(summary).not.toContain('[tool]');
    expect(summary).toContain('[user] Read the file');
    expect(summary).toContain('[assistant] I read the file');
  });

  it('truncates long messages to 200 chars', () => {
    const longContent = 'A'.repeat(300);
    const messages: AgentMessage[] = [
      { role: 'user', content: longContent },
    ];

    const summary = getSessionSummary(messages);
    // The user line should be truncated: "[user] " + 200 chars + "..."
    const lines = summary.split('\n').filter((l) => l.length > 0);
    expect(lines).toHaveLength(1);
    // Content portion should be 200 chars + "..."
    const contentPart = lines[0]!.replace('[user] ', '');
    expect(contentPart.length).toBeLessThanOrEqual(203); // 200 + "..."
    expect(contentPart).toContain('...');
  });
});

describe('generateCommitMessage', () => {
  it('falls back to default message on error', async () => {
    const mockClient = {
      chat: {
        completions: {
          create: vi.fn().mockRejectedValue(new Error('Connection refused')),
        },
      },
    } as unknown as import('openai').default;

    const messages: AgentMessage[] = [
      { role: 'user', content: 'Fix the bug' },
      { role: 'assistant', content: 'Fixed it' },
    ];

    const result = await generateCommitMessage(messages, mockClient, 'test-model');
    expect(result).toBe('feat: apply AI-assisted changes');
  });

  it('returns LLM-generated message on success', async () => {
    const mockClient = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [
              {
                message: {
                  content: 'fix: resolve null check in auth middleware',
                },
              },
            ],
          }),
        },
      },
    } as unknown as import('openai').default;

    const messages: AgentMessage[] = [
      { role: 'user', content: 'Fix the auth bug' },
      { role: 'assistant', content: 'Fixed the null check' },
    ];

    const result = await generateCommitMessage(messages, mockClient, 'test-model');
    expect(result).toBe('fix: resolve null check in auth middleware');
  });
});

describe('commitSessionChanges', () => {
  it('stages and commits files in a real git repo', async () => {
    await gitInit(testDir);
    await writeFile(join(testDir, 'init.txt'), 'initial');
    await gitCommitAll(testDir, 'initial commit');

    // Create new files to commit
    await writeFile(join(testDir, 'feature.ts'), 'export const x = 1;');
    await writeFile(join(testDir, 'test.ts'), 'import { x } from "./feature";');

    const success = await commitSessionChanges(
      testDir,
      ['feature.ts', 'test.ts'],
      'feat: add feature module',
    );

    expect(success).toBe(true);

    // Verify commit happened
    const log = await execa('git', ['log', '--oneline', '-1'], { cwd: testDir });
    expect(log.stdout).toContain('feat: add feature module');

    // Verify working tree is clean
    const status = await execa('git', ['status', '--porcelain'], { cwd: testDir });
    expect(status.stdout.trim()).toBe('');
  });

  it('returns false when no files provided', async () => {
    await gitInit(testDir);
    await writeFile(join(testDir, 'init.txt'), 'initial');
    await gitCommitAll(testDir, 'initial commit');

    const success = await commitSessionChanges(testDir, [], 'feat: empty');
    expect(success).toBe(false);
  });
});

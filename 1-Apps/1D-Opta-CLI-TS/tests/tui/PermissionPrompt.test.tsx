import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { PermissionPrompt } from '../../src/tui/PermissionPrompt.js';

/** Wait for React effects to flush (useInput registers via useEffect). */
const flush = () => new Promise<void>(r => setTimeout(r, 50));

afterEach(() => {
  vi.useRealTimers();
});

describe('PermissionPrompt', () => {
  it('renders tool name and prompt text', () => {
    const onDecision = vi.fn();
    const { lastFrame, unmount } = render(
      <PermissionPrompt
        toolName="edit_file"
        args={{ path: 'src/index.ts' }}
        onDecision={onDecision}
      />
    );
    const frame = lastFrame()!;
    expect(frame).toContain('Permission Required');
    expect(frame).toContain('edit_file');
    expect(frame).toContain('[Y]es');
    expect(frame).toContain('[n]o');
    expect(frame).toContain('[a]lways');
    unmount();
  });

  it('shows file path for edit_file tool', () => {
    const onDecision = vi.fn();
    const { lastFrame, unmount } = render(
      <PermissionPrompt
        toolName="edit_file"
        args={{
          path: '/Users/matt/project/src/index.ts',
          old_text: 'const x = 1;',
          new_text: 'const x = 2;',
        }}
        onDecision={onDecision}
      />
    );
    const frame = lastFrame()!;
    expect(frame).toContain('project/src/index.ts');
    expect(frame).toContain('const x = 1;');
    expect(frame).toContain('const x = 2;');
    unmount();
  });

  it('shows command for run_command tool', () => {
    const onDecision = vi.fn();
    const { lastFrame, unmount } = render(
      <PermissionPrompt
        toolName="run_command"
        args={{ command: 'npm test' }}
        onDecision={onDecision}
      />
    );
    const frame = lastFrame()!;
    expect(frame).toContain('run_command');
    expect(frame).toContain('$ npm test');
    unmount();
  });

  it('shows file path for write_file tool', () => {
    const onDecision = vi.fn();
    const { lastFrame, unmount } = render(
      <PermissionPrompt
        toolName="write_file"
        args={{ path: 'src/new-file.ts', content: 'line1\nline2\nline3' }}
        onDecision={onDecision}
      />
    );
    const frame = lastFrame()!;
    expect(frame).toContain('src/new-file.ts');
    expect(frame).toContain('3 lines');
    unmount();
  });

  it('shows file path for delete_file tool', () => {
    const onDecision = vi.fn();
    const { lastFrame, unmount } = render(
      <PermissionPrompt
        toolName="delete_file"
        args={{ path: 'src/old-file.ts' }}
        onDecision={onDecision}
      />
    );
    const frame = lastFrame()!;
    expect(frame).toContain('delete_file');
    expect(frame).toContain('src/old-file.ts');
    unmount();
  });

  it('auto-deny timer displays countdown', () => {
    const onDecision = vi.fn();
    const { lastFrame, unmount } = render(
      <PermissionPrompt
        toolName="edit_file"
        args={{ path: 'src/index.ts' }}
        onDecision={onDecision}
      />
    );
    const frame = lastFrame()!;
    // Initially shows 30s countdown
    expect(frame).toContain('30s');
    unmount();
  });

  it('y key calls onDecision with allow', async () => {
    const onDecision = vi.fn();
    const { stdin, unmount } = render(
      <PermissionPrompt
        toolName="run_command"
        args={{ command: 'ls' }}
        onDecision={onDecision}
      />
    );
    await flush();
    stdin.write('y');
    await flush();
    expect(onDecision).toHaveBeenCalledWith('allow');
    unmount();
  });

  it('Y key calls onDecision with allow', async () => {
    const onDecision = vi.fn();
    const { stdin, unmount } = render(
      <PermissionPrompt
        toolName="run_command"
        args={{ command: 'ls' }}
        onDecision={onDecision}
      />
    );
    await flush();
    stdin.write('Y');
    await flush();
    expect(onDecision).toHaveBeenCalledWith('allow');
    unmount();
  });

  it('Enter key calls onDecision with allow (default)', async () => {
    const onDecision = vi.fn();
    const { stdin, unmount } = render(
      <PermissionPrompt
        toolName="run_command"
        args={{ command: 'ls' }}
        onDecision={onDecision}
      />
    );
    await flush();
    stdin.write('\r');
    await flush();
    expect(onDecision).toHaveBeenCalledWith('allow');
    unmount();
  });

  it('n key calls onDecision with deny', async () => {
    const onDecision = vi.fn();
    const { stdin, unmount } = render(
      <PermissionPrompt
        toolName="run_command"
        args={{ command: 'rm -rf /' }}
        onDecision={onDecision}
      />
    );
    await flush();
    stdin.write('n');
    await flush();
    expect(onDecision).toHaveBeenCalledWith('deny');
    unmount();
  });

  it('a key calls onDecision with always', async () => {
    const onDecision = vi.fn();
    const { stdin, unmount } = render(
      <PermissionPrompt
        toolName="edit_file"
        args={{ path: 'src/index.ts' }}
        onDecision={onDecision}
      />
    );
    await flush();
    stdin.write('a');
    await flush();
    expect(onDecision).toHaveBeenCalledWith('always');
    unmount();
  });

  it('ignores repeated decisions after first', async () => {
    const onDecision = vi.fn();
    const { stdin, unmount } = render(
      <PermissionPrompt
        toolName="run_command"
        args={{ command: 'ls' }}
        onDecision={onDecision}
      />
    );
    await flush();
    stdin.write('y');
    await flush();
    stdin.write('n');
    await flush();
    stdin.write('a');
    await flush();
    expect(onDecision).toHaveBeenCalledTimes(1);
    expect(onDecision).toHaveBeenCalledWith('allow');
    unmount();
  });

  it('renders generic tool with args', () => {
    const onDecision = vi.fn();
    const { lastFrame, unmount } = render(
      <PermissionPrompt
        toolName="bg_start"
        args={{ command: 'node server.js', name: 'dev-server' }}
        onDecision={onDecision}
      />
    );
    const frame = lastFrame()!;
    expect(frame).toContain('bg_start');
    expect(frame).toContain('$ node server.js');
    unmount();
  });
});

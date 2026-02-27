import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { ToolCard } from '../../src/tui/ToolCard.js';

describe('ToolCard', () => {
  it('running state displays spinner icon and tool name', () => {
    const { lastFrame } = render(
      <ToolCard name="read_file" status="running" />
    );
    const frame = lastFrame()!;
    expect(frame).toContain('read_file');
    expect(frame).toContain('*');
    expect(frame).toContain('running...');
  });

  it('done state displays checkmark and result preview', () => {
    const { lastFrame } = render(
      <ToolCard
        name="read_file"
        status="done"
        result="file contents here"
      />
    );
    const frame = lastFrame()!;
    expect(frame).toContain('read_file');
    expect(frame).toContain('\u2714');
    expect(frame).toContain('file contents here');
  });

  it('error state displays X and error message', () => {
    const { lastFrame } = render(
      <ToolCard
        name="run_command"
        status="error"
        result="permission denied"
      />
    );
    const frame = lastFrame()!;
    expect(frame).toContain('run_command');
    expect(frame).toContain('\u2718');
    expect(frame).toContain('error');
    expect(frame).toContain('permission denied');
  });

  it('read_file shows formatted path', () => {
    const { lastFrame } = render(
      <ToolCard
        name="read_file"
        status="running"
        args={{ path: '/Users/matt/project/src/index.ts' }}
      />
    );
    const frame = lastFrame()!;
    // Path should be truncated to last 3 segments
    expect(frame).toContain('project/src/index.ts');
  });

  it('write_file shows path and line count', () => {
    const { lastFrame } = render(
      <ToolCard
        name="write_file"
        status="done"
        args={{ path: 'src/hello.ts', content: 'line1\nline2\nline3' }}
        result="OK"
      />
    );
    const frame = lastFrame()!;
    expect(frame).toContain('src/hello.ts');
    expect(frame).toContain('3 lines');
  });

  it('edit_file shows path and diff summary', () => {
    const { lastFrame } = render(
      <ToolCard
        name="edit_file"
        status="done"
        args={{
          path: 'src/app.ts',
          old_text: 'old line 1\nold line 2',
          new_text: 'new line 1\nnew line 2\nnew line 3',
        }}
        result="OK"
      />
    );
    const frame = lastFrame()!;
    expect(frame).toContain('src/app.ts');
    expect(frame).toContain('-2 lines');
    expect(frame).toContain('+3 lines');
  });

  it('run_command shows command string', () => {
    const { lastFrame } = render(
      <ToolCard
        name="run_command"
        status="running"
        args={{ command: 'npm test' }}
      />
    );
    const frame = lastFrame()!;
    expect(frame).toContain('$ npm test');
  });

  it('search_files shows pattern and scope', () => {
    const { lastFrame } = render(
      <ToolCard
        name="search_files"
        status="done"
        args={{ pattern: 'TODO', path: 'src/' }}
        result="3 matches found"
      />
    );
    const frame = lastFrame()!;
    expect(frame).toContain('/TODO/');
    expect(frame).toContain('in src/');
  });

  it('long results are truncated when collapsed', () => {
    const longResult = Array.from({ length: 20 }, (_, i) => `line ${i + 1}`).join('\n');
    const { lastFrame } = render(
      <ToolCard
        name="read_file"
        status="done"
        result={longResult}
        collapsed={true}
      />
    );
    const frame = lastFrame()!;
    // Should show first 3 lines
    expect(frame).toContain('line 1');
    expect(frame).toContain('line 2');
    expect(frame).toContain('line 3');
    // Should show truncation indicator
    expect(frame).toContain('more line');
    // Should NOT show all lines
    expect(frame).not.toContain('line 20');
  });

  it('full results are shown when not collapsed', () => {
    const result = 'line 1\nline 2\nline 3\nline 4\nline 5';
    const { lastFrame } = render(
      <ToolCard
        name="read_file"
        status="done"
        result={result}
        collapsed={false}
      />
    );
    const frame = lastFrame()!;
    expect(frame).toContain('line 1');
    expect(frame).toContain('line 5');
    expect(frame).not.toContain('more line');
  });

  it('does not show result while running', () => {
    const { lastFrame } = render(
      <ToolCard
        name="read_file"
        status="running"
        result="should not appear"
      />
    );
    const frame = lastFrame()!;
    expect(frame).not.toContain('should not appear');
  });

  it('renders generic tool with key-value args', () => {
    const { lastFrame } = render(
      <ToolCard
        name="custom_tool"
        status="done"
        args={{ foo: 'bar', count: 42 }}
        result="done"
      />
    );
    const frame = lastFrame()!;
    expect(frame).toContain('custom_tool');
    expect(frame).toContain('foo:');
    expect(frame).toContain('bar');
  });

  it('renders without args gracefully', () => {
    const { lastFrame } = render(
      <ToolCard name="list_dir" status="done" result="file1.ts\nfile2.ts" />
    );
    const frame = lastFrame()!;
    expect(frame).toContain('list_dir');
    expect(frame).toContain('file1.ts');
  });
});

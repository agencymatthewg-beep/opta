import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { InputBox } from '../../src/tui/InputBox.js';
import { InputHistory } from '../../src/ui/history.js';

// Mock fast-glob to avoid real filesystem calls in tests
vi.mock('fast-glob', () => ({
  default: vi.fn().mockResolvedValue([]),
}));

/** Wait for React effects to flush (useInput registers via useEffect). */
const flush = () => new Promise<void>(r => setTimeout(r, 50));

describe('InputBox', () => {
  it('should render with prompt', () => {
    const { lastFrame } = render(<InputBox onSubmit={() => {}} mode="normal" />);
    expect(lastFrame()).toContain('>');
  });

  it('should show mode indicator', () => {
    const { lastFrame } = render(<InputBox onSubmit={() => {}} mode="plan" />);
    expect(lastFrame()).toContain('plan');
  });

  it('should show loading state', () => {
    const { lastFrame } = render(<InputBox onSubmit={() => {}} mode="normal" isLoading />);
    expect(lastFrame()).toContain('thinking...');
  });

  it('should show auto mode indicator', () => {
    const { lastFrame } = render(<InputBox onSubmit={() => {}} mode="auto" />);
    expect(lastFrame()).toContain('auto');
  });

  it('should accept text input and show it', async () => {
    const { lastFrame, stdin } = render(<InputBox onSubmit={() => {}} mode="normal" />);
    await flush();
    stdin.write('hello');
    expect(lastFrame()).toContain('hello');
  });

  it('should call onSubmit when return is pressed', async () => {
    const onSubmit = vi.fn();
    const { stdin } = render(<InputBox onSubmit={onSubmit} mode="normal" />);
    await flush();
    stdin.write('test input');
    stdin.write('\r');
    expect(onSubmit).toHaveBeenCalledWith('test input');
  });

  it('should clear input after submit', async () => {
    const onSubmit = vi.fn();
    const { lastFrame, stdin } = render(<InputBox onSubmit={onSubmit} mode="normal" />);
    await flush();
    stdin.write('hello');
    expect(lastFrame()).toContain('hello');
    stdin.write('\r');
    // After submit, the buffer should be empty
    expect(lastFrame()).not.toContain('hello');
  });

  it('should not submit empty input', async () => {
    const onSubmit = vi.fn();
    const { stdin } = render(<InputBox onSubmit={onSubmit} mode="normal" />);
    await flush();
    stdin.write('\r');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('should show cursor indicator', () => {
    const { lastFrame } = render(<InputBox onSubmit={() => {}} mode="normal" />);
    const frame = lastFrame() ?? '';
    expect(frame).toContain('>');
  });

  it('should clear buffer on escape', async () => {
    const { lastFrame, stdin } = render(<InputBox onSubmit={() => {}} mode="normal" />);
    await flush();
    stdin.write('some text');
    expect(lastFrame()).toContain('some text');
    stdin.write('\x1B');
    expect(lastFrame()).not.toContain('some text');
  });

  it('should handle backspace', async () => {
    const { lastFrame, stdin } = render(<InputBox onSubmit={() => {}} mode="normal" />);
    await flush();
    stdin.write('abc');
    expect(lastFrame()).toContain('abc');
    stdin.write('\x7F');
    // After backspace, 'c' is removed
    const frame = lastFrame() ?? '';
    expect(frame).toContain('ab');
    expect(frame).not.toContain('abc');
  });

  it('should navigate history with up arrow', async () => {
    const history = new InputHistory();
    history.push('first command');
    history.push('second command');
    const { lastFrame, stdin } = render(
      <InputBox onSubmit={() => {}} mode="normal" history={history} />
    );
    await flush();
    // Up arrow escape sequence
    stdin.write('\x1B[A');
    expect(lastFrame()).toContain('second command');
    // Up arrow again
    stdin.write('\x1B[A');
    expect(lastFrame()).toContain('first command');
  });

  it('should navigate history with down arrow', async () => {
    const history = new InputHistory();
    history.push('first');
    history.push('second');
    const { lastFrame, stdin } = render(
      <InputBox onSubmit={() => {}} mode="normal" history={history} />
    );
    await flush();
    // Navigate up twice
    stdin.write('\x1B[A');
    stdin.write('\x1B[A');
    expect(lastFrame()).toContain('first');
    // Navigate down
    stdin.write('\x1B[B');
    expect(lastFrame()).toContain('second');
  });

  it('should push to history on submit', async () => {
    const history = new InputHistory();
    const onSubmit = vi.fn();
    const { stdin } = render(
      <InputBox onSubmit={onSubmit} mode="normal" history={history} />
    );
    await flush();
    stdin.write('new entry');
    stdin.write('\r');
    expect(history.size()).toBe(1);
  });

  it('should detect shell mode from ! prefix', async () => {
    const { lastFrame, stdin } = render(<InputBox onSubmit={() => {}} mode="normal" />);
    await flush();
    stdin.write('!ls');
    const frame = lastFrame() ?? '';
    // Shell mode displays a yellow ! indicator
    expect(frame).toContain('!');
  });

  it('should show line count for multiline content', async () => {
    const { lastFrame, stdin } = render(<InputBox onSubmit={() => {}} mode="normal" />);
    await flush();
    stdin.write('line one');
    // Alt+Return to insert newline
    stdin.write('\x1B\r');
    stdin.write('line two');
    const frame = lastFrame() ?? '';
    expect(frame).toContain('[2 lines]');
  });
});

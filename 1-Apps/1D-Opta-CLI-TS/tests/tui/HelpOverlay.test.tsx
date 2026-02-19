import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { HelpOverlay } from '../../src/tui/HelpOverlay.js';
import { defaultKeybindings } from '../../src/tui/keybindings.js';

/** Wait for React effects to flush (useInput registers via useEffect). */
const flush = () => new Promise<void>(r => setTimeout(r, 50));

describe('HelpOverlay', () => {
  it('renders without crashing', () => {
    const onClose = vi.fn();
    const { lastFrame, unmount } = render(<HelpOverlay onClose={onClose} />);
    expect(lastFrame()).toBeDefined();
    unmount();
  });

  it('renders "Keybindings" header', () => {
    const onClose = vi.fn();
    const { lastFrame, unmount } = render(<HelpOverlay onClose={onClose} />);
    const frame = lastFrame()!;
    expect(frame).toContain('Keybindings');
    unmount();
  });

  it('renders all keybinding descriptions', () => {
    const onClose = vi.fn();
    // Use a taller stdout so all keybindings fit (default 24 rows clips new entries)
    const { lastFrame, unmount } = render(<HelpOverlay onClose={onClose} />, {
      stdout: { columns: 100, rows: 50 } as NodeJS.WriteStream,
    });
    const frame = lastFrame()!;
    const bindings = defaultKeybindings();

    for (const [, binding] of Object.entries(bindings)) {
      expect(frame).toContain(binding.description);
    }
    unmount();
  });

  it('renders formatted key labels', () => {
    const onClose = vi.fn();
    const { lastFrame, unmount } = render(<HelpOverlay onClose={onClose} />, {
      stdout: { columns: 100, rows: 50 } as NodeJS.WriteStream,
    });
    const frame = lastFrame()!;

    // Core keybindings — capitalized format
    expect(frame).toContain('Ctrl+C');
    expect(frame).toContain('Ctrl+B');
    expect(frame).toContain('Ctrl+L');
    // New mode/bypass bindings
    expect(frame).toContain('Shift+Tab');
    expect(frame).toContain('Ctrl+Y');
    unmount();
  });

  it('renders slash command hint', () => {
    const onClose = vi.fn();
    const { lastFrame, unmount } = render(<HelpOverlay onClose={onClose} />);
    const frame = lastFrame()!;
    expect(frame).toContain('Slash commands');
    unmount();
  });

  it('renders file reference hint', () => {
    const onClose = vi.fn();
    const { lastFrame, unmount } = render(<HelpOverlay onClose={onClose} />);
    const frame = lastFrame()!;
    expect(frame).toContain('File references');
    unmount();
  });

  it('renders shell command hint', () => {
    const onClose = vi.fn();
    const { lastFrame, unmount } = render(<HelpOverlay onClose={onClose} />);
    const frame = lastFrame()!;
    expect(frame).toContain('Shell commands');
    unmount();
  });

  it('renders Alt+Enter newline hint', () => {
    const onClose = vi.fn();
    const { lastFrame, unmount } = render(<HelpOverlay onClose={onClose} />);
    const frame = lastFrame()!;
    expect(frame).toContain('Alt+Enter');
    expect(frame).toContain('Insert newline');
    unmount();
  });

  it('renders dismiss instruction', () => {
    const onClose = vi.fn();
    const { lastFrame, unmount } = render(<HelpOverlay onClose={onClose} />);
    const frame = lastFrame()!;
    expect(frame).toContain('Press any key to close');
    unmount();
  });

  it('calls onClose when any key is pressed', async () => {
    const onClose = vi.fn();
    const { stdin, unmount } = render(<HelpOverlay onClose={onClose} />);
    await flush();
    stdin.write('x');
    await flush();
    expect(onClose).toHaveBeenCalled();
    unmount();
  });

  it('calls onClose on Escape key', async () => {
    const onClose = vi.fn();
    const { stdin, unmount } = render(<HelpOverlay onClose={onClose} />);
    await flush();
    stdin.write('\x1B');
    await flush();
    expect(onClose).toHaveBeenCalled();
    unmount();
  });

  it('calls onClose on Enter key', async () => {
    const onClose = vi.fn();
    const { stdin, unmount } = render(<HelpOverlay onClose={onClose} />);
    await flush();
    stdin.write('\r');
    await flush();
    expect(onClose).toHaveBeenCalled();
    unmount();
  });
});

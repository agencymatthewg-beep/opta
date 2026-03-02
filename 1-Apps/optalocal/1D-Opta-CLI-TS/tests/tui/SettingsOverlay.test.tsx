// tests/tui/SettingsOverlay.test.tsx
import { render } from 'ink-testing-library';
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { SettingsOverlay } from '../../src/tui/SettingsOverlay.js';
import { OPTA_BRAND_GLYPH } from '../../src/ui/brand.js';

const flush = (ms = 20) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const SHIFT_TAB = '\u001B[Z';
const ARROW_DOWN = '\u001B[B';
const ARROW_RIGHT = '\u001B[C';
const ENTER = '\r';

const baseProps = {
  animationPhase: 'open' as const,
  animationProgress: 1,
  config: {
    connection: { host: 'localhost', port: 1234 },
    model: { default: 'test-model' },
  } as Record<string, unknown>,
  onClose: vi.fn(),
  onSave: vi.fn(),
};

describe('SettingsOverlay', () => {
  it('renders Connection page by default', () => {
    const { lastFrame } = render(<SettingsOverlay {...baseProps} />);
    expect(lastFrame()).toContain('Settings');
    expect(lastFrame()).toContain(OPTA_BRAND_GLYPH);
    expect(lastFrame()).toContain('Connection');
  });

  it('shows all page tabs', () => {
    const { lastFrame } = render(<SettingsOverlay {...baseProps} />);
    const frame = lastFrame() ?? '';
    expect(frame).toContain('Connection');
    expect(frame).toContain('Models');
    expect(frame).toContain('Safety');
    expect(frame).toContain('System');
    expect(frame).toContain('Advanced');
    expect(frame).toContain('Atpo');
    expect(frame).toContain('Account');
  });

  it('shows current value for host setting', () => {
    const { lastFrame } = render(<SettingsOverlay {...baseProps} />);
    expect(lastFrame()).toContain('localhost');
  });

  it('closes on Esc', async () => {
    const onClose = vi.fn();
    const { stdin } = render(<SettingsOverlay {...baseProps} onClose={onClose} />);
    await flush();
    stdin.write('\x1b');
    await flush();
    expect(onClose).toHaveBeenCalled();
  });

  it('saves and closes on Ctrl+S control-code input', async () => {
    const onClose = vi.fn();
    const onSave = vi.fn();
    const { stdin } = render(<SettingsOverlay {...baseProps} onClose={onClose} onSave={onSave} />);
    await flush();
    // Cover both legacy Ctrl+S and CSI-u key-reporting terminals.
    stdin.write('\x13');
    stdin.write('\x1B[115;5u');
    await flush(60);
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows response intent tone option on Advanced page', async () => {
    const { stdin, lastFrame } = render(<SettingsOverlay {...baseProps} />);
    await flush();
    stdin.write('5');
    await flush();
    expect(lastFrame()).not.toContain('Response Intent Tone');
    stdin.write(SHIFT_TAB);
    await flush();
    expect(lastFrame()).toContain('Response Intent Tone');
  });

  it('cycles settings view profile with Shift+Tab', async () => {
    const { stdin, lastFrame } = render(<SettingsOverlay {...baseProps} />);
    await flush();

    expect(lastFrame()).toContain('View: Opta');

    stdin.write(SHIFT_TAB);
    await flush();
    expect(lastFrame()).toContain('View: Advanced');

    stdin.write(SHIFT_TAB);
    await flush();
    expect(lastFrame()).toContain('View: Compact');
  });

  it('applies Compact/Advanced profile filtering on settings items', async () => {
    const { stdin, lastFrame } = render(<SettingsOverlay {...baseProps} />);
    await flush();

    stdin.write('5');
    await flush();
    const optaFrame = lastFrame() ?? '';
    expect(optaFrame).toContain('Browser Enable');
    expect(optaFrame).not.toContain('Response Intent Tone');
    expect(optaFrame).not.toContain('Gemini API Key');

    stdin.write(SHIFT_TAB);
    await flush();
    const advancedFrame = lastFrame() ?? '';
    expect(advancedFrame).toContain('Response Intent Tone');
    expect(advancedFrame).toContain('Gemini API Key');

    stdin.write(SHIFT_TAB);
    await flush();
    const compactFrame = lastFrame() ?? '';
    expect(compactFrame).toContain('Browser Enable');
    expect(compactFrame).not.toContain('Response Intent Tone');
    expect(compactFrame).not.toContain('Gemini API Key');
  });

  it('shows toggle indicator for boolean settings', async () => {
    const { stdin, lastFrame } = render(<SettingsOverlay {...baseProps} maxWidth={140} />);
    await flush();
    // Navigate to Advanced page (page 5)
    stdin.write('5');
    await flush();
    const frame = lastFrame() ?? '';
    // Browser Enabled is a toggle with default 'false'
    expect(frame).toContain('Browser Enable');
    expect(frame).toContain('[ ]');
  });

  it('uses left/right arrows for page navigation until a setting is activated', async () => {
    const { stdin, lastFrame } = render(<SettingsOverlay {...baseProps} />);
    await flush();
    stdin.write('5'); // Advanced
    await flush();
    const advancedFrame = lastFrame() ?? '';
    expect(advancedFrame).toMatch(/\[x\]\s*5\./);
    expect(advancedFrame).toContain('\n│  Advanced');

    stdin.write(ARROW_RIGHT);
    await flush();
    const atpoFrame = lastFrame() ?? '';
    expect(atpoFrame).toMatch(/\[x\]\s*6\./);
    expect(atpoFrame).toContain('\n│  Atpo');
  });

  it('shows select options when editing a select-type setting', async () => {
    const { stdin, lastFrame } = render(<SettingsOverlay {...baseProps} />);
    await flush();
    // Navigate to Safety page (page 3)
    stdin.write('3');
    await flush();
    // Skip first item (Autonomy Level - slider) to get to Default Mode (select)
    stdin.write(ARROW_DOWN); // arrow down
    await flush();
    // Press Enter to open select for Default Mode
    stdin.write(ENTER);
    await flush();
    const frame = lastFrame() ?? '';
    expect(frame).toContain('Safe');
    expect(frame).toContain('Auto');
    expect(frame).toContain('Plan');
    expect(frame).toContain('navigate');
  });

  it('uses arrows for select choices only after Enter activates editing', async () => {
    const { stdin, lastFrame } = render(<SettingsOverlay {...baseProps} />);
    await flush();
    stdin.write('3'); // Safety
    await flush();
    stdin.write(ARROW_DOWN); // Default Mode (select)
    await flush();
    stdin.write(ENTER); // enter edit mode
    await flush();
    expect(lastFrame()).toContain('Editing: Default Mode');
    expect(lastFrame()).toMatch(/\[x\]\s*3\./);

    stdin.write(ARROW_RIGHT); // move select cursor (Safe -> Auto)
    await flush();
    const editFrame = lastFrame() ?? '';
    expect(editFrame).toContain('Balanced autonomy with guardrails');
    expect(editFrame).toMatch(/\[x\]\s*3\./); // still on Safety page

    stdin.write(ENTER); // confirm select
    await flush();
    stdin.write(ARROW_DOWN); // back to list navigation
    await flush();
    expect(lastFrame() ?? '').toMatch(/▶\s+Autonomy Mode/);
  });

  it('shows slider when editing autonomy level', async () => {
    const { stdin, lastFrame } = render(<SettingsOverlay {...baseProps} />);
    await flush();
    // Navigate to Safety page (page 3)
    stdin.write('3');
    await flush();
    // First item is Autonomy Level (slider)
    stdin.write(ENTER);
    await flush();
    const frame = lastFrame() ?? '';
    expect(frame).toContain('Autonomy Level');
    expect(frame).toContain('adjust');
    expect(frame).toContain('/5');
  });

  it('activates toggle editing on Enter and applies changes from arrow navigation', async () => {
    const { stdin, lastFrame } = render(
      <SettingsOverlay {...baseProps} maxWidth={140} />
    );
    await flush();
    stdin.write('5'); // Advanced
    await flush();
    expect(lastFrame()).toContain('[ ]');

    stdin.write(ENTER); // open inline selector
    await flush();
    expect(lastFrame()).toContain('Editing: Browser Enable');

    stdin.write(ARROW_DOWN); // move selection to Enabled
    await flush();
    stdin.write(ENTER); // confirm
    await flush();
    expect(lastFrame()).toContain('[x]');
  });

  it('select-type settings show option labels instead of raw values', async () => {
    const { stdin, lastFrame } = render(
      <SettingsOverlay
        {...baseProps}
        config={{ 'provider.active': 'anthropic' } as Record<string, unknown>}
      />
    );
    await flush();
    // Navigate to Models page (page 2)
    stdin.write('2');
    await flush();
    const frame = lastFrame() ?? '';
    // Active Provider should show the provider label, not raw 'anthropic'
    expect(frame).toContain('Anthropic');
  });
});

// tests/tui/SettingsOverlay.test.tsx
import { render } from 'ink-testing-library';
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { SettingsOverlay } from '../../src/tui/SettingsOverlay.js';
import { OPTA_BRAND_GLYPH } from '../../src/ui/brand.js';

const flush = (ms = 20) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const SHIFT_TAB = '\u001B[Z';

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

  it('shows all 5 page tabs', () => {
    const { lastFrame } = render(<SettingsOverlay {...baseProps} />);
    const frame = lastFrame() ?? '';
    expect(frame).toContain('Connection');
    expect(frame).toContain('Models');
    expect(frame).toContain('Safety');
    expect(frame).toContain('Paths');
    expect(frame).toContain('Advanced');
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
    stdin.write('\x13'); // Ctrl+S
    await flush();
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows response intent tone option on Advanced page', async () => {
    const { stdin, lastFrame } = render(<SettingsOverlay {...baseProps} />);
    await flush();
    stdin.write('5');
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
    expect(lastFrame()).toContain('Response Intent Tone');

    stdin.write(SHIFT_TAB);
    await flush();
    expect(lastFrame()).toContain('Gemini API Key');

    stdin.write(SHIFT_TAB);
    await flush();
    const compactFrame = lastFrame() ?? '';
    expect(compactFrame).toContain('Browser Enabled');
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

  it('toggles boolean setting on Enter without opening editor', async () => {
    const onSave = vi.fn();
    const { stdin, lastFrame } = render(
      <SettingsOverlay {...baseProps} onSave={onSave} />
    );
    await flush();
    // Navigate to Advanced page
    stdin.write('5');
    await flush();
    // First item on Advanced is Browser Enabled (toggle)
    // Press Enter to toggle it
    stdin.write('\r');
    await flush();
    // Should show [x] now (toggled from false to true)
    const frame = lastFrame() ?? '';
    expect(frame).toContain('[x]');
  });

  it('shows select options when editing a select-type setting', async () => {
    const { stdin, lastFrame } = render(<SettingsOverlay {...baseProps} />);
    await flush();
    // Navigate to Safety page (page 3)
    stdin.write('3');
    await flush();
    // Skip first item (Autonomy Level - slider) to get to Default Mode (select)
    stdin.write('\u001B[B'); // arrow down
    await flush();
    // Press Enter to open select for Default Mode
    stdin.write('\r');
    await flush();
    const frame = lastFrame() ?? '';
    expect(frame).toContain('Safe');
    expect(frame).toContain('Auto');
    expect(frame).toContain('Plan');
    expect(frame).toContain('navigate');
  });

  it('shows slider when editing autonomy level', async () => {
    const { stdin, lastFrame } = render(<SettingsOverlay {...baseProps} />);
    await flush();
    // Navigate to Safety page (page 3)
    stdin.write('3');
    await flush();
    // First item is Autonomy Level (slider)
    stdin.write('\r');
    await flush();
    const frame = lastFrame() ?? '';
    expect(frame).toContain('Autonomy Level');
    expect(frame).toContain('adjust');
    expect(frame).toContain('/5');
  });

  it('toggle items cycle value on Enter without opening editor', async () => {
    // Browser Enabled toggles from [ ] to [x] and back
    const { stdin, lastFrame } = render(
      <SettingsOverlay {...baseProps} maxWidth={140} />
    );
    await flush();
    // Navigate to Advanced page
    stdin.write('5');
    await flush();
    // First item: Browser Enabled (toggle, default 'false')
    expect(lastFrame()).toContain('[ ]');
    // Press Enter to toggle to true
    stdin.write('\r');
    await flush();
    expect(lastFrame()).toContain('[x]');
    // Press Enter again to toggle back to false
    stdin.write('\r');
    await flush();
    expect(lastFrame()).toContain('[ ]');
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
    // Active Provider should show the label 'Anthropic (cloud)' not raw 'anthropic'
    expect(frame).toContain('Anthropic (cloud)');
  });
});

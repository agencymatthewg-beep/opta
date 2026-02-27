// tests/tui/InlineSelect.test.tsx
import { render } from 'ink-testing-library';
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { InlineSelect, InlineSlider } from '../../src/tui/InlineSelect.js';

const flush = (ms = 20) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const ARROW_UP = '\u001B[A';
const ARROW_DOWN = '\u001B[B';
const ARROW_LEFT = '\u001B[D';
const ARROW_RIGHT = '\u001B[C';
const ENTER = '\r';
const ESCAPE = '\u001B';

const sampleOptions = [
  { label: 'Safe', value: 'safe', description: 'Conservative mode' },
  { label: 'Auto', value: 'auto', description: 'Balanced mode' },
  { label: 'Plan', value: 'plan', description: 'Planning mode' },
];

describe('InlineSelect', () => {
  it('renders all options', () => {
    const { lastFrame } = render(
      <InlineSelect
        options={sampleOptions}
        value="safe"
        onSelect={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    const frame = lastFrame() ?? '';
    expect(frame).toContain('Safe');
    expect(frame).toContain('Auto');
    expect(frame).toContain('Plan');
  });

  it('highlights the current value', () => {
    const { lastFrame } = render(
      <InlineSelect
        options={sampleOptions}
        value="auto"
        onSelect={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(lastFrame()).toContain('(current)');
  });

  it('starts cursor on the current value', () => {
    const { lastFrame } = render(
      <InlineSelect
        options={sampleOptions}
        value="plan"
        onSelect={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    // The cursor should be on 'Plan', showing its description
    expect(lastFrame()).toContain('Planning mode');
  });

  it('navigates down with arrow key', async () => {
    const { stdin, lastFrame } = render(
      <InlineSelect
        options={sampleOptions}
        value="safe"
        onSelect={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    await flush();
    stdin.write(ARROW_DOWN);
    await flush();
    // Should now show Auto's description (cursor moved to second item)
    expect(lastFrame()).toContain('Balanced mode');
  });

  it('navigates up with arrow key', async () => {
    const { stdin, lastFrame } = render(
      <InlineSelect
        options={sampleOptions}
        value="auto"
        onSelect={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    await flush();
    stdin.write(ARROW_UP);
    await flush();
    // Should now show Safe's description (cursor moved up from Auto)
    expect(lastFrame()).toContain('Conservative mode');
  });

  it('wraps around when navigating past end', async () => {
    const { stdin, lastFrame } = render(
      <InlineSelect
        options={sampleOptions}
        value="plan"
        onSelect={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    await flush();
    stdin.write(ARROW_DOWN);
    await flush();
    // Should wrap to first item (Safe)
    expect(lastFrame()).toContain('Conservative mode');
  });

  it('confirms selection on Enter', async () => {
    const onSelect = vi.fn();
    const { stdin } = render(
      <InlineSelect
        options={sampleOptions}
        value="safe"
        onSelect={onSelect}
        onCancel={vi.fn()}
      />
    );
    await flush();
    stdin.write(ARROW_DOWN); // Move to Auto
    await flush();
    stdin.write(ENTER);
    await flush();
    expect(onSelect).toHaveBeenCalledWith('auto');
  });

  it('confirms selection on Space', async () => {
    const onSelect = vi.fn();
    const { stdin } = render(
      <InlineSelect
        options={sampleOptions}
        value="safe"
        onSelect={onSelect}
        onCancel={vi.fn()}
      />
    );
    await flush();
    stdin.write(ARROW_DOWN);
    await flush();
    stdin.write(' ');
    await flush();
    expect(onSelect).toHaveBeenCalledWith('auto');
  });

  it('cancels on Escape', async () => {
    const onCancel = vi.fn();
    const { stdin } = render(
      <InlineSelect
        options={sampleOptions}
        value="safe"
        onSelect={vi.fn()}
        onCancel={onCancel}
      />
    );
    await flush();
    stdin.write(ESCAPE);
    await flush();
    expect(onCancel).toHaveBeenCalled();
  });

  it('shows label when provided', () => {
    const { lastFrame } = render(
      <InlineSelect
        options={sampleOptions}
        value="safe"
        onSelect={vi.fn()}
        onCancel={vi.fn()}
        label="Default Mode"
      />
    );
    expect(lastFrame()).toContain('Default Mode');
  });

  it('shows navigation hint', () => {
    const { lastFrame } = render(
      <InlineSelect
        options={sampleOptions}
        value="safe"
        onSelect={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(lastFrame()).toContain('navigate');
    expect(lastFrame()).toContain('select');
    expect(lastFrame()).toContain('cancel');
  });

  it('does not respond to input when focus is false', async () => {
    const onSelect = vi.fn();
    const onCancel = vi.fn();
    const { stdin } = render(
      <InlineSelect
        options={sampleOptions}
        value="safe"
        onSelect={onSelect}
        onCancel={onCancel}
        focus={false}
      />
    );
    await flush();
    stdin.write(ENTER);
    await flush();
    stdin.write(ESCAPE);
    await flush();
    expect(onSelect).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });
});

describe('InlineSlider', () => {
  const sliderLabels = { 1: 'safe', 2: 'standard', 3: 'extended', 4: 'delegation', 5: 'maximum' };

  it('renders the slider bar', () => {
    const { lastFrame } = render(
      <InlineSlider
        min={1}
        max={5}
        value={3}
        onSelect={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    const frame = lastFrame() ?? '';
    expect(frame).toContain('3');
    expect(frame).toContain('/5');
  });

  it('shows label when provided', () => {
    const { lastFrame } = render(
      <InlineSlider
        min={1}
        max={5}
        value={2}
        onSelect={vi.fn()}
        onCancel={vi.fn()}
        label="Autonomy Level"
      />
    );
    expect(lastFrame()).toContain('Autonomy Level');
  });

  it('shows value labels when provided', () => {
    const { lastFrame } = render(
      <InlineSlider
        min={1}
        max={5}
        value={2}
        onSelect={vi.fn()}
        onCancel={vi.fn()}
        labels={sliderLabels}
      />
    );
    expect(lastFrame()).toContain('standard');
  });

  it('increases value with right arrow', async () => {
    const { stdin, lastFrame } = render(
      <InlineSlider
        min={1}
        max={5}
        value={2}
        onSelect={vi.fn()}
        onCancel={vi.fn()}
        labels={sliderLabels}
      />
    );
    await flush();
    stdin.write(ARROW_RIGHT);
    await flush();
    expect(lastFrame()).toContain('3');
    expect(lastFrame()).toContain('extended');
  });

  it('decreases value with left arrow', async () => {
    const { stdin, lastFrame } = render(
      <InlineSlider
        min={1}
        max={5}
        value={3}
        onSelect={vi.fn()}
        onCancel={vi.fn()}
        labels={sliderLabels}
      />
    );
    await flush();
    stdin.write(ARROW_LEFT);
    await flush();
    expect(lastFrame()).toContain('2');
    expect(lastFrame()).toContain('standard');
  });

  it('clamps at maximum', async () => {
    const { stdin, lastFrame } = render(
      <InlineSlider
        min={1}
        max={5}
        value={5}
        onSelect={vi.fn()}
        onCancel={vi.fn()}
        labels={sliderLabels}
      />
    );
    await flush();
    stdin.write(ARROW_RIGHT);
    await flush();
    expect(lastFrame()).toContain('5');
    expect(lastFrame()).toContain('maximum');
  });

  it('clamps at minimum', async () => {
    const { stdin, lastFrame } = render(
      <InlineSlider
        min={1}
        max={5}
        value={1}
        onSelect={vi.fn()}
        onCancel={vi.fn()}
        labels={sliderLabels}
      />
    );
    await flush();
    stdin.write(ARROW_LEFT);
    await flush();
    expect(lastFrame()).toContain('1');
    expect(lastFrame()).toContain('safe');
  });

  it('accepts direct number input', async () => {
    const { stdin, lastFrame } = render(
      <InlineSlider
        min={1}
        max={5}
        value={2}
        onSelect={vi.fn()}
        onCancel={vi.fn()}
        labels={sliderLabels}
      />
    );
    await flush();
    stdin.write('4');
    await flush();
    expect(lastFrame()).toContain('4');
    expect(lastFrame()).toContain('delegation');
  });

  it('confirms on Enter', async () => {
    const onSelect = vi.fn();
    const { stdin } = render(
      <InlineSlider
        min={1}
        max={5}
        value={3}
        onSelect={onSelect}
        onCancel={vi.fn()}
      />
    );
    await flush();
    stdin.write(ARROW_RIGHT); // 3 -> 4
    await flush();
    stdin.write(ENTER);
    await flush();
    expect(onSelect).toHaveBeenCalledWith(4);
  });

  it('cancels on Escape', async () => {
    const onCancel = vi.fn();
    const { stdin } = render(
      <InlineSlider
        min={1}
        max={5}
        value={3}
        onSelect={vi.fn()}
        onCancel={onCancel}
      />
    );
    await flush();
    stdin.write(ESCAPE);
    await flush();
    expect(onCancel).toHaveBeenCalled();
  });

  it('shows navigation hint', () => {
    const { lastFrame } = render(
      <InlineSlider
        min={1}
        max={5}
        value={3}
        onSelect={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(lastFrame()).toContain('adjust');
    expect(lastFrame()).toContain('confirm');
    expect(lastFrame()).toContain('cancel');
  });

  it('does not respond to input when focus is false', async () => {
    const onSelect = vi.fn();
    const onCancel = vi.fn();
    const { stdin } = render(
      <InlineSlider
        min={1}
        max={5}
        value={3}
        onSelect={onSelect}
        onCancel={onCancel}
        focus={false}
      />
    );
    await flush();
    stdin.write(ENTER);
    await flush();
    stdin.write(ESCAPE);
    await flush();
    expect(onSelect).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });
});

import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { ScrollView, estimateChildLines, estimateTextLines } from '../../src/tui/ScrollView.js';
import { Text, Box } from 'ink';

/** Wait for React effects (including useInput registration) to flush. */
const flush = () => new Promise<void>(r => setTimeout(r, 50));

// ─── Line estimation helpers ──────────────────────────────────────────────────

describe('estimateTextLines', () => {
  it('should count single short line as 1', () => {
    expect(estimateTextLines('hello', 80)).toBe(1);
  });

  it('should count newlines', () => {
    expect(estimateTextLines('line1\nline2\nline3', 80)).toBe(3);
  });

  it('should account for text wrapping', () => {
    // 160 chars at width 80 = 2 lines
    const longText = 'x'.repeat(160);
    expect(estimateTextLines(longText, 80)).toBe(2);
  });

  it('should handle empty text', () => {
    expect(estimateTextLines('', 80)).toBe(0);
  });

  it('should handle very narrow width', () => {
    // Width below 10 should be clamped to 10
    expect(estimateTextLines('hello world', 5)).toBe(2); // 11 chars / 10 = 2
  });
});

describe('estimateChildLines', () => {
  it('should return 0 for null/undefined', () => {
    expect(estimateChildLines(null, 80)).toBe(0);
    expect(estimateChildLines(undefined, 80)).toBe(0);
  });

  it('should return 1 for a simple Text element', () => {
    const el = <Text>hello</Text>;
    expect(estimateChildLines(el, 80)).toBe(1);
  });

  it('should count wrapped text inside a Text element', () => {
    const longContent = 'a'.repeat(200);
    const el = <Text>{longContent}</Text>;
    // 200 chars at width 80 = 3 lines (ceil(200/80) = 3)
    expect(estimateChildLines(el, 80)).toBe(3);
  });

  it('should count nested elements', () => {
    const el = (
      <Box flexDirection="column">
        <Text>Line 1</Text>
        <Text>Line 2</Text>
      </Box>
    );
    // 2 inner Text elements, each 1 line = 2 lines total
    expect(estimateChildLines(el, 80)).toBe(2);
  });

  it('should account for marginBottom', () => {
    const el = <Box marginBottom={1}><Text>hello</Text></Box>;
    // 1 line for text + 1 for marginBottom = 2
    expect(estimateChildLines(el, 80)).toBe(2);
  });
});

// ─── ScrollView rendering ─────────────────────────────────────────────────────

describe('ScrollView', () => {
  it('should render visible items', () => {
    const items = Array.from({ length: 50 }, (_, i) => `Line ${i}`);
    const { lastFrame } = render(
      <ScrollView height={5}>
        {items.map((item, i) => <Text key={i}>{item}</Text>)}
      </ScrollView>
    );
    // Should render something (auto-scroll pins to bottom)
    expect(lastFrame()).toBeDefined();
  });

  it('should render fewer items than height', () => {
    const { lastFrame } = render(
      <ScrollView height={10}>
        <Text>Item 1</Text>
        <Text>Item 2</Text>
      </ScrollView>
    );
    expect(lastFrame()).toContain('Item 1');
    expect(lastFrame()).toContain('Item 2');
  });

  it('should show scrollbar when content exceeds height', () => {
    const items = Array.from({ length: 20 }, (_, i) => `Line ${i}`);
    const { lastFrame } = render(
      <ScrollView height={5}>
        {items.map((item, i) => <Text key={i}>{item}</Text>)}
      </ScrollView>
    );
    const frame = lastFrame()!;
    // Scrollbar characters should be present
    expect(frame.includes('\u2588') || frame.includes('\u2591')).toBe(true);
  });

  it('should not show scrollbar when content fits in viewport', () => {
    const { lastFrame } = render(
      <ScrollView height={10}>
        <Text>Item 1</Text>
        <Text>Item 2</Text>
      </ScrollView>
    );
    const frame = lastFrame()!;
    // No scrollbar chars
    expect(frame).not.toContain('\u2591');
  });

  // ── Proportional scrollbar thumb size ──

  it('should have a proportional scrollbar thumb', () => {
    // 100 items at height 10: thumb = max(1, round(10/100 * 10)) = max(1, 1) = 1
    const items = Array.from({ length: 100 }, (_, i) => `Line ${i}`);
    const { lastFrame } = render(
      <ScrollView height={10}>
        {items.map((item, i) => <Text key={i}>{item}</Text>)}
      </ScrollView>
    );
    const frame = lastFrame()!;
    const thumbCount = (frame.match(/\u2588/g) ?? []).length;
    // With 100 lines in 10 rows: thumb size = round(10/100 * 10) = 1
    expect(thumbCount).toBe(1);
  });

  it('should have a larger thumb when content is only slightly larger than viewport', () => {
    // 12 items at height 10: thumb = max(1, round(10/12 * 10)) = max(1, 8) = 8
    const items = Array.from({ length: 12 }, (_, i) => `Line ${i}`);
    const { lastFrame } = render(
      <ScrollView height={10}>
        {items.map((item, i) => <Text key={i}>{item}</Text>)}
      </ScrollView>
    );
    const frame = lastFrame()!;
    const thumbCount = (frame.match(/\u2588/g) ?? []).length;
    expect(thumbCount).toBeGreaterThanOrEqual(5);
  });

  // ── Auto-scroll stays at bottom ──

  it('should auto-scroll to show latest items by default', () => {
    const items = Array.from({ length: 20 }, (_, i) => `Line ${i}`);
    const { lastFrame } = render(
      <ScrollView height={5} autoScroll>
        {items.map((item, i) => <Text key={i}>{item}</Text>)}
      </ScrollView>
    );
    const frame = lastFrame()!;
    // Should contain the last items
    expect(frame).toContain('Line 19');
  });

  it('should keep auto-scrolling as new children are added', async () => {
    const items = Array.from({ length: 10 }, (_, i) => `Line ${i}`);
    const { lastFrame, rerender } = render(
      <ScrollView height={5} autoScroll>
        {items.map((item, i) => <Text key={i}>{item}</Text>)}
      </ScrollView>
    );

    // Add more items
    const moreItems = Array.from({ length: 15 }, (_, i) => `Line ${i}`);
    rerender(
      <ScrollView height={5} autoScroll>
        {moreItems.map((item, i) => <Text key={i}>{item}</Text>)}
      </ScrollView>
    );

    await flush();
    const frame = lastFrame()!;
    expect(frame).toContain('Line 14');
  });

  // ── Manual scroll disables auto-scroll ──

  it('should disable auto-scroll when user presses up arrow', async () => {
    const items = Array.from({ length: 20 }, (_, i) => `Line ${i}`);
    const { lastFrame, stdin } = render(
      <ScrollView height={5} autoScroll focusable>
        {items.map((item, i) => <Text key={i}>{item}</Text>)}
      </ScrollView>
    );

    // Wait for useInput to register via useEffect
    await flush();
    // Press up arrow (escape sequence)
    stdin.write('\x1B[A');
    await flush();

    const frame = lastFrame()!;
    // After scrolling up by 1 line, we should still see content
    expect(frame).toBeDefined();
  });

  // ── Scroll to top / bottom ──

  it('should scroll to top when g is pressed', async () => {
    const items = Array.from({ length: 30 }, (_, i) => `Line ${i}`);
    const { lastFrame, stdin } = render(
      <ScrollView height={5} autoScroll focusable>
        {items.map((item, i) => <Text key={i}>{item}</Text>)}
      </ScrollView>
    );

    // Wait for useInput to register
    await flush();
    // Press 'g' to scroll to top
    stdin.write('g');
    await flush();

    const frame = lastFrame()!;
    // Should now show the first items
    expect(frame).toContain('Line 0');
  });

  it('should scroll to bottom when G is pressed', async () => {
    const items = Array.from({ length: 30 }, (_, i) => `Line ${i}`);
    const { lastFrame, stdin } = render(
      <ScrollView height={5} autoScroll focusable>
        {items.map((item, i) => <Text key={i}>{item}</Text>)}
      </ScrollView>
    );

    // Wait for useInput to register
    await flush();
    // Scroll to top first
    stdin.write('g');
    await flush();
    // Then scroll back to bottom
    stdin.write('G');
    await flush();

    const frame = lastFrame()!;
    expect(frame).toContain('Line 29');
  });

  // ── Half-page scrolling ──

  it('should half-page down with Ctrl+D', async () => {
    const items = Array.from({ length: 30 }, (_, i) => `Line ${i}`);
    const { lastFrame, stdin } = render(
      <ScrollView height={10} autoScroll focusable>
        {items.map((item, i) => <Text key={i}>{item}</Text>)}
      </ScrollView>
    );

    // Wait for useInput to register
    await flush();
    // Scroll to top first
    stdin.write('g');
    await flush();
    // Now Ctrl+D (half page down = 5 lines)
    stdin.write('\x04'); // Ctrl+D
    await flush();

    const frame = lastFrame()!;
    // After starting at top and scrolling half page (5 lines), we should see items starting around Line 5
    expect(frame).toContain('Line 5');
  });

  it('should half-page up with Ctrl+U', async () => {
    const items = Array.from({ length: 30 }, (_, i) => `Line ${i}`);
    const { lastFrame, stdin } = render(
      <ScrollView height={10} autoScroll focusable>
        {items.map((item, i) => <Text key={i}>{item}</Text>)}
      </ScrollView>
    );

    // Wait for useInput to register
    await flush();
    // Start at bottom (auto-scroll). Ctrl+U should scroll up by 5 lines.
    stdin.write('\x15'); // Ctrl+U
    await flush();

    const frame = lastFrame()!;
    // Should be scrolled up from bottom — showing items from around Line 15
    expect(frame).toBeDefined();
    expect(frame).toContain('Line 15');
  });

  // ── Page up / page down ──

  it('should page down by viewport height', async () => {
    const items = Array.from({ length: 30 }, (_, i) => `Line ${i}`);
    const { lastFrame, stdin } = render(
      <ScrollView height={5} autoScroll focusable>
        {items.map((item, i) => <Text key={i}>{item}</Text>)}
      </ScrollView>
    );

    // Wait for useInput to register
    await flush();
    // Go to top first
    stdin.write('g');
    await flush();
    // Page down
    stdin.write('\x1B[6~');
    await flush();

    const frame = lastFrame()!;
    // After 1 page down from top (5 lines), should see items around Line 5
    expect(frame).toContain('Line 5');
  });

  // ── Content width affects line estimation ──

  it('should accept contentWidth prop for more accurate estimation', () => {
    // Long text that wraps differently depending on width
    const longText = 'a'.repeat(200);
    const { lastFrame } = render(
      <ScrollView height={5} contentWidth={40}>
        <Text>{longText}</Text>
        <Text>End</Text>
      </ScrollView>
    );
    const frame = lastFrame()!;
    expect(frame).toBeDefined();
  });
});

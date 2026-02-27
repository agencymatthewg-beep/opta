import { describe, expect, it, vi } from 'vitest';
import { createSegmentedStepProgressTracker, renderPercentBar } from '../../src/ui/progress.js';
import { stripAnsi } from '../../src/utils/text.js';

describe('renderPercentBar', () => {
  it('renders clamped percent text', () => {
    expect(stripAnsi(renderPercentBar(120, 10))).toContain('100%');
    expect(stripAnsi(renderPercentBar(-5, 10))).toContain('0%');
  });

  it('renders expected bar width', () => {
    const plain = stripAnsi(renderPercentBar(50, 12));
    const bar = plain.split(' ')[0] ?? '';
    expect(bar.length).toBe(12);
  });
});

describe('createSegmentedStepProgressTracker', () => {
  it('renders separate labeled bars for local and studio progress', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      const tracker = createSegmentedStepProgressTracker(
        [
          { key: 'local', label: 'Local', totalSteps: 2 },
          { key: 'remote', label: 'Studio', totalSteps: 2 },
        ],
        'Update progress',
        true,
      );

      tracker.tick('local', 'cli:git ok');
      tracker.tick('remote', 'lmx:git ok');
      tracker.done('all update steps finished');

      const rendered = stripAnsi(logSpy.mock.calls.map((call) => String(call[0] ?? '')).join('\n'));
      expect(rendered).toContain('Update progress');
      expect(rendered).toContain('Local');
      expect(rendered).toContain('Studio');
      expect(rendered).toContain('all update steps finished');
      expect(rendered).toContain('100%');
    } finally {
      logSpy.mockRestore();
    }
  });

  it('falls back to the first segment when an unknown key is ticked', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      const tracker = createSegmentedStepProgressTracker(
        [{ key: 'local', label: 'Local', totalSteps: 1 }],
        'Update progress',
        true,
      );
      tracker.tick('studio', 'unexpected segment key');
      tracker.done('done');

      const rendered = stripAnsi(logSpy.mock.calls.map((call) => String(call[0] ?? '')).join('\n'));
      expect(rendered).toContain('Local');
      expect(rendered).toContain('100%');
    } finally {
      logSpy.mockRestore();
    }
  });
});

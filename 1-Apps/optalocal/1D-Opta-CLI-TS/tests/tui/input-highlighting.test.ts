import { describe, it, expect } from 'vitest';
import {
  buildTriggerHighlightMask,
  chunkTextByTriggerMask,
  collectTriggerHighlightMatches,
  normalizeTriggerWords,
} from '../../src/tui/input-highlighting.js';

describe('input trigger highlighting helpers', () => {
  it('normalizes trigger words case-insensitively and de-duplicates', () => {
    expect(normalizeTriggerWords([' Browser ', 'browser', 'WEB', ''])).toEqual(['browser', 'web']);
  });

  it('collects case-insensitive whole-word trigger matches', () => {
    const matches = collectTriggerHighlightMatches(
      'Open Browser then browser-driven flows and web.',
      ['browser', 'web'],
    );

    expect(matches.map((item) => ({ trigger: item.trigger, value: 'Open Browser then browser-driven flows and web.'.slice(item.start, item.end) }))).toEqual([
      { trigger: 'browser', value: 'Browser' },
      { trigger: 'browser', value: 'browser' },
      { trigger: 'web', value: 'web' },
    ]);
  });

  it('does not match trigger words as partial substrings', () => {
    const matches = collectTriggerHighlightMatches('brownfield browsing browserize', ['browser']);
    expect(matches).toHaveLength(0);
  });

  it('builds highlight chunks from masks', () => {
    const line = 'use browser now';
    const matches = collectTriggerHighlightMatches(line, ['browser']);
    const mask = buildTriggerHighlightMask(line.length, matches);
    const chunks = chunkTextByTriggerMask(line, 0, mask);

    expect(chunks).toEqual([
      { text: 'use ', highlighted: false },
      { text: 'browser', highlighted: true },
      { text: ' now', highlighted: false },
    ]);
  });
});

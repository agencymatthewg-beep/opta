import { describe, expect, it } from 'vitest';
import {
  collectMatchedTriggerDefinitions,
  normalizeTriggerModeDefinitions,
  resolveEffectiveMode,
  resolveTriggerRouting,
} from '../../src/tui/trigger-router.js';

describe('trigger-router', () => {
  it('normalizes and de-duplicates trigger definitions by word', () => {
    const normalized = normalizeTriggerModeDefinitions([
      { word: ' Browser ', capabilities: ['browser'] },
      { word: 'browser', capabilities: ['duplicate'] },
      { word: 'REVIEW', modeHint: 'review', skills: ['code-review'] },
    ]);

    expect(normalized).toEqual([
      { word: 'browser', modeHint: undefined, priority: 0, capabilities: ['browser'], skills: [] },
      { word: 'review', modeHint: 'review', priority: 0, capabilities: [], skills: ['code-review'] },
    ]);
  });

  it('matches trigger words as whole words only', () => {
    const matched = collectMatchedTriggerDefinitions(
      'Run review for browser, but ignore preview and browserize',
      [
        { word: 'review', modeHint: 'review' },
        { word: 'browser' },
      ],
    );

    expect(matched.map((definition) => definition.word)).toEqual(['browser', 'review']);
  });

  it('resolves highest-precedence mode across stacked triggers', () => {
    const routing = resolveTriggerRouting({
      prompt: 'Please research and plan then do browser checks and final review',
      currentMode: 'normal',
      definitions: [
        { word: 'research', modeHint: 'research', priority: 100 },
        { word: 'plan', modeHint: 'plan', priority: 200 },
        { word: 'review', modeHint: 'review', priority: 300 },
        { word: 'browser', capabilities: ['browser'], priority: 50 },
      ],
    });

    expect(routing.effectiveMode).toBe('review');
    expect(routing.matchedWords).toEqual(['review', 'plan', 'research', 'browser']);
    expect(routing.requestedCapabilities).toEqual(['browser']);
  });

  it('never downgrades from a stricter current mode', () => {
    expect(resolveEffectiveMode('review', ['plan', 'research'])).toBe('review');
    expect(resolveEffectiveMode('plan', ['research'])).toBe('plan');
  });

  it('keeps mode unchanged when only browser capability is requested', () => {
    const routing = resolveTriggerRouting({
      prompt: 'Use browser to inspect checkout flow',
      currentMode: 'normal',
      definitions: [
        { word: 'browser', capabilities: ['browser'], skills: ['playwright'] },
      ],
    });

    expect(routing.effectiveMode).toBe('normal');
    expect(routing.requestedCapabilities).toEqual(['browser']);
    expect(routing.requestedSkills).toEqual(['playwright']);
  });
});

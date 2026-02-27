import { describe, expect, it } from 'vitest';
import {
  buildPseudoToolCorrectionMessage,
  detectPseudoToolMarkup,
} from '../../src/core/tool-protocol.js';

describe('tool protocol guards', () => {
  it('detects XML-style pseudo tool tags', () => {
    const detection = detectPseudoToolMarkup(
      '<execute_command><command>echo ok</command></execute_command>',
    );
    expect(detection.detected).toBe(true);
    expect(detection.toolTags).toContain('execute_command');
  });

  it('detects plain-text pseudo tool directives', () => {
    const detection = detectPseudoToolMarkup(
      'run_shell_command command: open -a "Google Chrome"\nsearch_files path: /tmp pattern: timer',
    );
    expect(detection.detected).toBe(true);
    expect(detection.toolTags).toEqual(expect.arrayContaining(['run_command', 'search_files']));
  });

  it('does not flag normal assistant prose', () => {
    const detection = detectPseudoToolMarkup(
      'I reviewed the code and found a race in the session lifecycle.',
    );
    expect(detection.detected).toBe(false);
    expect(detection.toolTags).toEqual([]);
  });

  it('builds browser-aware correction guidance', () => {
    const message = buildPseudoToolCorrectionMessage(
      { detected: true, toolTags: ['browser_open', 'run_command'] },
      true,
    );
    expect(message).toContain('Detected pseudo tags: browser_open, run_command.');
    expect(message).toContain('Use native JSON tool calls only.');
    expect(message).toContain('For web tasks, use browser_open/browser_navigate/browser_click/browser_type/browser_snapshot/browser_screenshot/browser_close.');
  });
});

import { describe, expect, it } from 'vitest';
import { evaluateMenuBackKey } from '../../src/ui/prompt-nav.js';

describe('evaluateMenuBackKey', () => {
  it('triggers back on left arrow for select menus', () => {
    const result = evaluateMenuBackKey({
      mode: 'select',
      key: { name: 'left' },
      searchTermLength: 0,
    });
    expect(result.triggerBack).toBe(true);
  });

  it('supports raw terminal escape sequences when key metadata is missing', () => {
    const rawLeft = evaluateMenuBackKey({
      mode: 'select',
      input: '\u001b[D',
      searchTermLength: 0,
    });
    expect(rawLeft.triggerBack).toBe(true);

    const rawBackspace = evaluateMenuBackKey({
      mode: 'select',
      input: '\u007f',
      searchTermLength: 0,
    });
    expect(rawBackspace.triggerBack).toBe(true);

    const rawEscape = evaluateMenuBackKey({
      mode: 'search',
      input: '\u001b',
      searchTermLength: 2,
    });
    expect(rawEscape.triggerBack).toBe(true);
    expect(rawEscape.nextSearchTermLength).toBe(0);
  });

  it('triggers back on backspace/delete for select menus', () => {
    const backspace = evaluateMenuBackKey({
      mode: 'select',
      key: { name: 'backspace' },
      searchTermLength: 0,
    });
    expect(backspace.triggerBack).toBe(true);

    const del = evaluateMenuBackKey({
      mode: 'select',
      key: { name: 'delete' },
      searchTermLength: 0,
    });
    expect(del.triggerBack).toBe(true);
  });

  it('does not trigger back when modifier keys are pressed', () => {
    const result = evaluateMenuBackKey({
      mode: 'select',
      key: { name: 'left', ctrl: true },
      searchTermLength: 0,
    });
    expect(result.triggerBack).toBe(false);
  });

  it('tracks search input and only goes back on empty search', () => {
    const typed = evaluateMenuBackKey({
      mode: 'search',
      key: { name: 'a' },
      input: 'a',
      searchTermLength: 0,
    });
    expect(typed.triggerBack).toBe(false);
    expect(typed.nextSearchTermLength).toBe(1);

    const eraseOne = evaluateMenuBackKey({
      mode: 'search',
      key: { name: 'backspace' },
      searchTermLength: typed.nextSearchTermLength,
    });
    expect(eraseOne.triggerBack).toBe(false);
    expect(eraseOne.nextSearchTermLength).toBe(0);

    const backOut = evaluateMenuBackKey({
      mode: 'search',
      key: { name: 'backspace' },
      searchTermLength: eraseOne.nextSearchTermLength,
    });
    expect(backOut.triggerBack).toBe(true);
    expect(backOut.nextSearchTermLength).toBe(0);
  });

  it('resets search buffer on ctrl+u/w and handles escape', () => {
    const ctrlBuffer = evaluateMenuBackKey({
      mode: 'search',
      key: { name: 'u', ctrl: true },
      searchTermLength: 5,
    });
    expect(ctrlBuffer.triggerBack).toBe(false);
    expect(ctrlBuffer.nextSearchTermLength).toBe(0);

    const escape = evaluateMenuBackKey({
      mode: 'search',
      key: { name: 'escape' },
      searchTermLength: 3,
    });
    expect(escape.triggerBack).toBe(true);
    expect(escape.nextSearchTermLength).toBe(0);
  });
});

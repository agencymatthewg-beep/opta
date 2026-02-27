import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getEditorCommand } from '../../src/commands/editor.js';

describe('/editor', () => {
  let originalEditor: string | undefined;
  let originalVisual: string | undefined;

  beforeEach(() => {
    originalEditor = process.env.EDITOR;
    originalVisual = process.env.VISUAL;
  });

  afterEach(() => {
    if (originalEditor !== undefined) process.env.EDITOR = originalEditor;
    else delete process.env.EDITOR;
    if (originalVisual !== undefined) process.env.VISUAL = originalVisual;
    else delete process.env.VISUAL;
  });

  it('should detect $EDITOR from environment', () => {
    process.env.EDITOR = 'vim';
    delete process.env.VISUAL;
    const editor = getEditorCommand();
    expect(editor).toBe('vim');
  });

  it('should fallback to vi if no $EDITOR', () => {
    delete process.env.EDITOR;
    delete process.env.VISUAL;
    const editor = getEditorCommand();
    expect(editor).toBe('vi');
  });

  it('should prefer $VISUAL over $EDITOR', () => {
    process.env.VISUAL = 'code';
    process.env.EDITOR = 'vim';
    const editor = getEditorCommand();
    expect(editor).toBe('code');
  });
});

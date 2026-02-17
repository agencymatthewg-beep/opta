import { describe, it, expect } from 'vitest';
import { InputEditor } from '../../src/ui/input.js';

describe('InputEditor', () => {
  it('should create with default options', () => {
    const editor = new InputEditor({ prompt: '>' });
    expect(editor).toBeDefined();
    expect(editor.getBuffer()).toBe('');
  });

  it('should track buffer content', () => {
    const editor = new InputEditor({ prompt: '>' });
    editor.insertText('hello');
    expect(editor.getBuffer()).toBe('hello');
  });

  it('should clear buffer', () => {
    const editor = new InputEditor({ prompt: '>' });
    editor.insertText('hello');
    editor.clear();
    expect(editor.getBuffer()).toBe('');
  });
});

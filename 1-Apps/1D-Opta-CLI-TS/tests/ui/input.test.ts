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

describe('multiline', () => {
  it('should insert newline in multiline mode', () => {
    const editor = new InputEditor({ prompt: '>', multiline: true });
    editor.insertText('line 1');
    editor.insertNewline();
    editor.insertText('line 2');
    expect(editor.getBuffer()).toBe('line 1\nline 2');
    expect(editor.getLineCount()).toBe(2);
  });

  it('should NOT insert newline in single-line mode', () => {
    const editor = new InputEditor({ prompt: '>', multiline: false });
    editor.insertText('line 1');
    editor.insertNewline();
    expect(editor.getBuffer()).toBe('line 1');
    expect(editor.getLineCount()).toBe(1);
  });

  it('should track cursor position across lines', () => {
    const editor = new InputEditor({ prompt: '>', multiline: true });
    editor.insertText('abc');
    editor.insertNewline();
    editor.insertText('def');
    expect(editor.getCursorLine()).toBe(1);
    expect(editor.getCursorCol()).toBe(3);
  });
});

describe('shell mode', () => {
  it('should detect shell mode from ! prefix', () => {
    const editor = new InputEditor({ prompt: '>' });
    editor.insertText('!ls -la');
    expect(editor.isShellMode()).toBe(true);
    expect(editor.getShellCommand()).toBe('ls -la');
  });

  it('should NOT be shell mode without ! prefix', () => {
    const editor = new InputEditor({ prompt: '>' });
    editor.insertText('hello');
    expect(editor.isShellMode()).toBe(false);
    expect(editor.getShellCommand()).toBeNull();
  });

  it('should exit shell mode when ! is deleted', () => {
    const editor = new InputEditor({ prompt: '>' });
    editor.insertText('!cmd');
    expect(editor.isShellMode()).toBe(true);
    editor.clear();
    editor.insertText('cmd');
    expect(editor.isShellMode()).toBe(false);
  });
});

describe('escape handling', () => {
  it('should track escape state', () => {
    const editor = new InputEditor({ prompt: '>' });
    expect(editor.shouldCancel()).toBe(false);
    editor.handleEscape();
    expect(editor.shouldCancel()).toBe(true);
  });

  it('should exit shell mode on escape', () => {
    const editor = new InputEditor({ prompt: '>' });
    editor.insertText('!ls');
    expect(editor.isShellMode()).toBe(true);
    editor.handleEscape();
    expect(editor.isShellMode()).toBe(false);
    expect(editor.getBuffer()).toBe('');
  });

  it('should clear multiline on escape', () => {
    const editor = new InputEditor({ prompt: '>', multiline: true });
    editor.insertText('line 1');
    editor.insertNewline();
    editor.insertText('line 2');
    editor.handleEscape();
    expect(editor.getBuffer()).toBe('');
  });
});

describe('paste detection', () => {
  it('should detect multi-line paste', () => {
    const editor = new InputEditor({ prompt: '>' });
    const result = editor.handlePaste('line1\nline2\nline3');
    expect(result.isPaste).toBe(true);
    expect(result.lineCount).toBe(3);
    expect(result.abbreviated).toBe('[Pasted ~3 lines]');
  });

  it('should NOT detect single-line as paste', () => {
    const editor = new InputEditor({ prompt: '>' });
    const result = editor.handlePaste('just text');
    expect(result.isPaste).toBe(false);
  });

  it('should store full paste content while showing abbreviated', () => {
    const editor = new InputEditor({ prompt: '>' });
    const result = editor.handlePaste('a\nb\nc\nd\ne');
    expect(result.isPaste).toBe(true);
    expect(result.fullContent).toBe('a\nb\nc\nd\ne');
  });
});

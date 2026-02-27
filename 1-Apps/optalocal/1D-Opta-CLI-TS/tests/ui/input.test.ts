import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/lmx/connection.js', () => ({
  probeLmxConnection: vi.fn(),
}));

vi.mock('../../src/lmx/endpoints.js', () => ({
  resolveLmxEndpoint: vi.fn(),
}));

import { InputEditor, checkConnection, getConnectionStatusDetail } from '../../src/ui/input.js';
import { probeLmxConnection } from '../../src/lmx/connection.js';
import { resolveLmxEndpoint } from '../../src/lmx/endpoints.js';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(resolveLmxEndpoint).mockResolvedValue({
    host: 'localhost',
    port: 1234,
    source: 'primary',
    state: 'connected',
  });
  vi.mocked(probeLmxConnection).mockResolvedValue({
    state: 'connected',
    latencyMs: 5,
    modelsLoaded: 1,
  });
});

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

  it('should expand abbreviated marker in getSubmitText', () => {
    const editor = new InputEditor({ prompt: '>' });
    editor.insertText('Before ');
    editor.handlePaste('line1\nline2\nline3');
    editor.insertText(' after');
    const submitted = editor.getSubmitText();
    expect(submitted).toContain('line1\nline2\nline3');
    expect(submitted).not.toContain('[Pasted');
    expect(submitted).toBe('Before [Pasted ~3 lines] after'.replace('[Pasted ~3 lines]', 'line1\nline2\nline3'));
  });

  it('should pass through single-line paste without abbreviation', () => {
    const editor = new InputEditor({ prompt: '>' });
    editor.handlePaste('single line');
    expect(editor.getSubmitText()).toBe('single line');
    expect(editor.getBuffer()).toBe('single line');
  });
});

describe('mode indicators', () => {
  it('should show shell mode indicator', () => {
    const editor = new InputEditor({ prompt: '>', mode: 'shell' });
    const display = editor.getPromptDisplay();
    expect(display).toContain('!');
  });

  it('should show plan mode indicator', () => {
    const editor = new InputEditor({ prompt: '>', mode: 'plan' });
    const display = editor.getPromptDisplay();
    expect(display).toContain('plan');
  });

  it('should update mode dynamically', () => {
    const editor = new InputEditor({ prompt: '>' });
    editor.setMode('shell');
    expect(editor.getPromptDisplay()).toContain('!');
    editor.setMode('normal');
    expect(editor.getPromptDisplay()).not.toContain('!');
  });

  it('should auto-detect shell mode from buffer', () => {
    const editor = new InputEditor({ prompt: '>' });
    editor.insertText('!ls');
    expect(editor.getEffectiveMode()).toBe('shell');
  });

  it('should return configured mode when no buffer override', () => {
    const editor = new InputEditor({ prompt: '>', mode: 'plan' });
    editor.insertText('hello');
    expect(editor.getEffectiveMode()).toBe('plan');
  });

  it('should default to normal mode', () => {
    const editor = new InputEditor({ prompt: '>' });
    expect(editor.getEffectiveMode()).toBe('normal');
  });
});

describe('connection status detail', () => {
  it('stores degraded connection reason for prompt diagnostics', async () => {
    vi.mocked(probeLmxConnection).mockResolvedValue({
      state: 'degraded',
      latencyMs: 15,
      reason: 'no_models_loaded',
    });

    await checkConnection('localhost', 1234, []);
    expect(getConnectionStatusDetail()).toContain('no_models_loaded');
  });

  it('clears status detail after a successful reconnect', async () => {
    vi.mocked(probeLmxConnection).mockResolvedValueOnce({
      state: 'disconnected',
      latencyMs: 20,
      reason: 'connection_refused',
    }).mockResolvedValueOnce({
      state: 'connected',
      latencyMs: 8,
      modelsLoaded: 2,
    });

    await checkConnection('localhost', 1234, []);
    expect(getConnectionStatusDetail()).toContain('connection_refused');

    await checkConnection('localhost', 1234, []);
    expect(getConnectionStatusDetail()).toBe('');
  });
});

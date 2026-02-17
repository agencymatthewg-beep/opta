import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock isTTY to true so the renderer initializes with marked-terminal
vi.mock('../../src/ui/output.js', () => ({
  isTTY: true,
}));

describe('markdown rendering', () => {
  beforeEach(() => {
    // Reset module cache so renderer re-initializes
    vi.resetModules();
  });

  it('should export renderMarkdown function', async () => {
    const { renderMarkdown } = await import('../../src/ui/markdown.js');
    expect(typeof renderMarkdown).toBe('function');
  });

  it('should render code blocks with language hints', async () => {
    const { renderMarkdownToString } = await import('../../src/ui/markdown.js');
    const input = '```typescript\nconst x = 42;\n```';
    const output = await renderMarkdownToString(input);
    expect(output).toBeDefined();
    expect(output.length).toBeGreaterThan(0);
    // Should contain the code content
    expect(output).toContain('const');
    expect(output).toContain('42');
  });

  it('should render inline code with styling', async () => {
    const { renderMarkdownToString } = await import('../../src/ui/markdown.js');
    const input = 'Use `npm install` to install deps';
    const output = await renderMarkdownToString(input);
    expect(output).toContain('npm install');
  });

  it('should render headings', async () => {
    const { renderMarkdownToString } = await import('../../src/ui/markdown.js');
    const input = '# Title\n\nSome text';
    const output = await renderMarkdownToString(input);
    expect(output).toContain('Title');
    expect(output).toContain('Some text');
  });

  it('should handle empty input gracefully', async () => {
    const { renderMarkdownToString } = await import('../../src/ui/markdown.js');
    const output = await renderMarkdownToString('');
    expect(output).toBe('');
  });

  it('should render multi-line code blocks', async () => {
    const { renderMarkdownToString } = await import('../../src/ui/markdown.js');
    const input = '```js\nfunction add(a, b) {\n  return a + b;\n}\n```';
    const output = await renderMarkdownToString(input);
    expect(output).toContain('function');
    expect(output).toContain('return');
  });
});

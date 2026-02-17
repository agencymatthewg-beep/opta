import chalk from 'chalk';
import { isTTY } from './output.js';

let renderer: ((md: string) => string) | null = null;

async function getRenderer(): Promise<(md: string) => string> {
  if (renderer) return renderer;

  if (!isTTY) {
    renderer = (md: string) => md;
    return renderer;
  }

  const { Marked } = await import('marked');
  const { default: TerminalRenderer } = await import('marked-terminal');

  // Enhanced styling options for better terminal rendering
  const marked = new Marked(
    TerminalRenderer(
      {
        // Code blocks: bright yellow for visibility
        code: chalk.hex('#F59E0B'),
        // Inline code: distinct from regular text
        codespan: chalk.hex('#F59E0B').bold,
        // Headings
        firstHeading: chalk.hex('#8B5CF6').bold.underline,
        heading: chalk.hex('#3B82F6').bold,
        // Text styling
        strong: chalk.bold,
        em: chalk.italic,
        del: chalk.dim.strikethrough,
        // Block elements
        blockquote: chalk.hex('#71717A').italic,
        // Links
        link: chalk.hex('#3B82F6').underline,
        href: chalk.hex('#3B82F6').underline,
        // Lists
        listitem: chalk.reset,
        // Tables
        table: chalk.reset,
        // Horizontal rules
        hr: chalk.dim,
        // Paragraphs
        paragraph: chalk.reset,
        // HTML pass-through
        html: chalk.dim,
        // Layout
        width: 100,
        reflowText: false,
        showSectionPrefix: true,
        unescape: true,
        emoji: true,
        tab: 2,
      }
    )
  );

  renderer = (md: string) => {
    const result = marked.parse(md, { async: false });
    return typeof result === 'string' ? result : String(result);
  };
  return renderer;
}

/**
 * Render markdown text to the terminal via stdout.
 */
export async function renderMarkdown(text: string): Promise<void> {
  if (!text?.trim()) return;
  try {
    const render = await getRenderer();
    const result = render(text);
    if (result) process.stdout.write(result);
  } catch {
    // Fallback: just print the raw text if markdown rendering fails
    process.stdout.write(text);
  }
}

/**
 * Render markdown text to a string (for testing and programmatic use).
 */
export async function renderMarkdownToString(text: string): Promise<string> {
  if (!text?.trim()) return '';
  try {
    const render = await getRenderer();
    return render(text) || '';
  } catch {
    return text;
  }
}

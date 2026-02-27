import chalk from 'chalk';
import { isTTY } from './output.js';
import { visibleTextWidth } from '../utils/text.js';
import { fitTextToWidth } from '../utils/terminal-layout.js';

let renderer: ((md: string) => string) | null = null;
let rendererBackend: 'plain' | 'marked-terminal' = 'plain';

function isTableSeparator(line: string): boolean {
  const t = line.trim();
  return /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(t);
}

function splitTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return trimmed.split('|').map(c => c.trim());
}

function formatTableBlock(lines: string[], width: number): string[] {
  if (lines.length < 2 || !isTableSeparator(lines[1]!)) return lines;
  const rows = lines.map(splitTableRow);
  const colCount = Math.max(...rows.map(r => r.length));
  const normalized = rows.map(r => [...r, ...Array(Math.max(0, colCount - r.length)).fill('')]);

  const maxTotal = Math.max(20, width - 6);
  const baseCol = Math.max(4, Math.floor(maxTotal / colCount) - 3);
  const colWidths = Array.from({ length: colCount }, (_, i) =>
    Math.min(baseCol, Math.max(4, ...normalized.map(r => visibleTextWidth(String(r[i] ?? '')))))
  );

  const render = (cells: string[]) => `| ${cells.map((c, i) => fitTextToWidth(String(c), colWidths[i]!, { pad: true })).join(' | ')} |`;
  const rule = `|-${colWidths.map(w => '-'.repeat(w)).join('-|-')}-|`;

  const out: string[] = [];
  out.push(render(normalized[0]!));
  out.push(rule);
  for (let i = 2; i < normalized.length; i++) out.push(render(normalized[i]!));
  return out;
}

/**
 * Format markdown pipe tables into aligned plain-text tables for terminal readability.
 */
export function formatMarkdownTables(text: string, width = 100): string {
  if (!text.includes('|')) return text;
  const lines = text.split('\n');
  const out: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const next = lines[i + 1];
    if (line.includes('|') && next && isTableSeparator(next)) {
      const block: string[] = [line, next];
      i += 2;
      while (i < lines.length && lines[i]!.includes('|')) {
        block.push(lines[i]!);
        i++;
      }
      i -= 1;
      out.push(...formatTableBlock(block, width));
    } else {
      out.push(line);
    }
  }

  return out.join('\n');
}

function setPlainRenderer(): (md: string) => string {
  renderer = (md: string) => md;
  rendererBackend = 'plain';
  return renderer;
}

async function getRenderer(): Promise<(md: string) => string> {
  if (renderer) return renderer;

  if (!isTTY) {
    return setPlainRenderer();
  }

  try {
    const { Marked } = await import('marked');
    const { markedTerminal } = await import('marked-terminal');

    const marked = new Marked(
      markedTerminal(
        {
          code: chalk.hex('#F59E0B'),
          codespan: chalk.hex('#F59E0B').bold,
          firstHeading: chalk.hex('#8B5CF6').bold.underline,
          heading: chalk.hex('#3B82F6').bold,
          strong: chalk.bold,
          em: chalk.italic,
          del: chalk.dim.strikethrough,
          blockquote: chalk.hex('#71717A').italic,
          link: chalk.hex('#3B82F6').underline,
          href: chalk.hex('#3B82F6').underline,
          listitem: chalk.reset,
          table: chalk.reset,
          hr: chalk.dim,
          paragraph: chalk.reset,
          html: chalk.dim,
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
      try {
        const result = marked.parse(md, { async: false });
        return typeof result === 'string' ? result : String(result);
      } catch {
        setPlainRenderer();
        return md;
      }
    };
    rendererBackend = 'marked-terminal';
    return renderer;
  } catch {
    return setPlainRenderer();
  }
}

/**
 * Render markdown text to the terminal via stdout.
 */
export async function renderMarkdown(text: string): Promise<void> {
  if (!text?.trim()) return;
  try {
    const prepared = formatMarkdownTables(text, 100);
    const render = await getRenderer();
    const result = render(prepared);
    if (result) process.stdout.write(result);
  } catch (err) {
    // Fallback: just print the raw text if markdown rendering fails
    setPlainRenderer();
    if (process.env.OPTA_DEBUG) {
      console.error(`Markdown render failed (${rendererBackend}), using plain text:`, err);
    }
    process.stdout.write(text);
  }
}

/**
 * Render markdown text to a string (for testing and programmatic use).
 */
export async function renderMarkdownToString(text: string): Promise<string> {
  if (!text?.trim()) return '';
  try {
    const prepared = formatMarkdownTables(text, 100);
    const render = await getRenderer();
    return render(prepared) || '';
  } catch (err) {
    setPlainRenderer();
    if (process.env.OPTA_DEBUG) {
      console.error(`Markdown render to string failed (${rendererBackend}):`, err);
    }
    return text;
  }
}

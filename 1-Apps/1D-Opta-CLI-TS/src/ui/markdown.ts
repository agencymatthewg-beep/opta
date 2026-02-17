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
  const marked = new Marked(TerminalRenderer());

  renderer = (md: string) => marked.parse(md) as string;
  return renderer;
}

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

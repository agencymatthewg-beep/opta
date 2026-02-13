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
  const render = await getRenderer();
  process.stdout.write(render(text));
}

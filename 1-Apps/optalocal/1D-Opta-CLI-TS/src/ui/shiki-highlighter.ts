import { createHighlighter, type HighlighterGeneric } from 'shiki';
import { createJavaScriptRegexEngine } from '@shikijs/engine-javascript';
import chalk from 'chalk';

let highlighter: HighlighterGeneric<any, any> | null = null;
let initPromise: Promise<HighlighterGeneric<any, any>> | null = null;

const THEME = 'vitesse-dark';
const DEFAULT_LANGS = [
  'javascript', 'typescript', 'tsx', 'jsx', 'json', 'bash', 'yaml', 'python',
  'html', 'css', 'markdown', 'rust', 'go', 'cpp', 'c', 'text'
];

export async function initShiki(): Promise<void> {
  if (highlighter) return;
  if (initPromise) {
    await initPromise;
    return;
  }

  initPromise = createHighlighter({
    themes: [THEME],
    langs: DEFAULT_LANGS,
    engine: createJavaScriptRegexEngine(),
  }).then((hl) => {
    highlighter = hl;
    return hl;
  });

  await initPromise;
}

export function highlightCodeAnsiSync(code: string, lang: string): string {
  if (!highlighter) return code;
  
  try {
    const loadedLangs = highlighter.getLoadedLanguages();
    let targetLang = lang;
    if (!lang || !loadedLangs.includes(lang)) {
      targetLang = 'text';
    }

    if (targetLang === 'text') {
      return code;
    }

    const { tokens } = highlighter.codeToTokens(code, { lang: targetLang, theme: THEME });
    
    const lines = tokens.map((lineTokens) => {
      return lineTokens.map((token) => {
        let text = token.content;
        if (token.color) {
          text = chalk.hex(token.color)(text);
        }
        if (token.fontStyle && token.fontStyle & 1) { // 1 is italic
          text = chalk.italic(text);
        }
        if (token.fontStyle && token.fontStyle & 2) { // 2 is bold
          text = chalk.bold(text);
        }
        if (token.fontStyle && token.fontStyle & 4) { // 4 is underline
          text = chalk.underline(text);
        }
        return text;
      }).join('');
    });
    
    return lines.join('\n');
  } catch {
    return code;
  }
}

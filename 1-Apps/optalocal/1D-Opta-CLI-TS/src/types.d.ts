declare module 'marked-terminal' {
  import type { MarkedExtension } from 'marked';
  import type { ChalkInstance } from 'chalk';

  interface TerminalRendererOptions {
    // Text styling
    code?: ChalkInstance;
    codespan?: ChalkInstance;
    firstHeading?: ChalkInstance;
    heading?: ChalkInstance;
    strong?: ChalkInstance;
    em?: ChalkInstance;
    del?: ChalkInstance;
    blockquote?: ChalkInstance;
    link?: ChalkInstance;
    href?: ChalkInstance;
    listitem?: ChalkInstance;
    table?: ChalkInstance;
    hr?: ChalkInstance;
    paragraph?: ChalkInstance;
    html?: ChalkInstance;

    // Layout options
    width?: number;
    reflowText?: boolean;
    showSectionPrefix?: boolean;
    unescape?: boolean;
    emoji?: boolean;
    tab?: number;

    // Allow additional options
    [key: string]: unknown;
  }

  export default function TerminalRenderer(options?: TerminalRendererOptions): MarkedExtension;
  export function markedTerminal(options?: TerminalRendererOptions): MarkedExtension;
}

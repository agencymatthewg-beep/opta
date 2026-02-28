import { type ReactNode } from "react";

// ── Inline node types ──────────────────────────────────────────────────────
type InlineNode =
  | string
  | { tag: "strong"; content: string }
  | { tag: "em"; content: string }
  | { tag: "code"; content: string }
  | { tag: "a"; content: string; href: string };

function sanitizeHref(href: string): string {
  try {
    const { protocol } = new URL(href);
    return protocol === "http:" || protocol === "https:" ? href : "#";
  } catch {
    return "#";
  }
}

function parseInline(text: string): InlineNode[] {
  const pattern =
    /(\*\*\*([^*]+)\*\*\*|\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\))/g;
  const nodes: InlineNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = pattern.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    if (m[2]) {
      nodes.push({ tag: "strong", content: m[2] });
    } else if (m[3]) {
      nodes.push({ tag: "strong", content: m[3] });
    } else if (m[4]) {
      nodes.push({ tag: "em", content: m[4] });
    } else if (m[5]) {
      nodes.push({ tag: "code", content: m[5] });
    } else if (m[6] !== undefined && m[7] !== undefined) {
      nodes.push({ tag: "a", content: m[6], href: m[7] });
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function renderInlineNodes(nodes: InlineNode[]): ReactNode[] {
  return nodes.map((node, i) => {
    const key = String(i);
    if (typeof node === "string") return node;
    switch (node.tag) {
      case "strong":
        return <strong key={key}>{node.content}</strong>;
      case "em":
        return <em key={key}>{node.content}</em>;
      case "code":
        return (
          <code key={key} className="md-inline-code">
            {node.content}
          </code>
        );
      case "a":
        return (
          <a
            key={key}
            href={sanitizeHref(node.href)}
            target="_blank"
            rel="noreferrer noopener"
            className="md-link"
          >
            {node.content}
          </a>
        );
    }
  });
}

// ── Block-level parsing ────────────────────────────────────────────────────
type Block =
  | { type: "code"; lang: string; content: string }
  | { type: "text"; lines: string[] };

function parseBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  const lines = text.split("\n");
  let i = 0;
  let textLines: string[] = [];

  const flushText = () => {
    if (textLines.length > 0) {
      blocks.push({ type: "text", lines: [...textLines] });
      textLines = [];
    }
  };

  while (i < lines.length) {
    const line = lines[i];
    const fenceMatch = line.match(/^```(\w*)$/);
    if (fenceMatch) {
      flushText();
      const lang = fenceMatch[1] ?? "";
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && lines[i] !== "```") {
        codeLines.push(lines[i]);
        i++;
      }
      blocks.push({ type: "code", lang, content: codeLines.join("\n") });
      i++; // skip closing fence
    } else {
      textLines.push(line);
      i++;
    }
  }

  flushText();
  return blocks;
}

// ── Text-block renderer ────────────────────────────────────────────────────
function renderTextLines(lines: string[]): ReactNode {
  const nodes: ReactNode[] = [];
  let k = 0;
  type ListState = { ordered: boolean; items: string[] } | null;
  let list: ListState = null;
  let paraLines: string[] = [];

  const flushPara = () => {
    if (paraLines.length === 0) return;
    const joined = paraLines.join(" ");
    nodes.push(
      <p key={String(k++)} className="md-p">
        {renderInlineNodes(parseInline(joined))}
      </p>,
    );
    paraLines = [];
  };

  const flushList = () => {
    if (!list) return;
    const Tag = list.ordered ? "ol" : "ul";
    nodes.push(
      <Tag key={String(k++)} className="md-list">
        {list.items.map((item, idx) => (
          <li key={String(idx)}>{renderInlineNodes(parseInline(item))}</li>
        ))}
      </Tag>,
    );
    list = null;
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      flushList();
      flushPara();
      continue;
    }

    // Headings
    const h3m = trimmed.match(/^###\s+(.+)$/);
    const h2m = !h3m ? trimmed.match(/^##\s+(.+)$/) : null;
    const h1m = !h3m && !h2m ? trimmed.match(/^#\s+(.+)$/) : null;
    const headingMatch = h1m ?? h2m ?? h3m;
    if (headingMatch) {
      flushList();
      flushPara();
      const Tag = h1m ? "h2" : h2m ? "h3" : "h4";
      const cls = h1m ? "md-h1" : h2m ? "md-h2" : "md-h3";
      nodes.push(
        <Tag key={String(k++)} className={cls}>
          {renderInlineNodes(parseInline(headingMatch[1]))}
        </Tag>,
      );
      continue;
    }

    // Horizontal rule
    if (/^[-*_]{3,}$/.test(trimmed)) {
      flushList();
      flushPara();
      nodes.push(<hr key={String(k++)} className="md-hr" />);
      continue;
    }

    // Blockquote
    const bqm = trimmed.match(/^>\s+(.+)$/);
    if (bqm) {
      flushList();
      flushPara();
      nodes.push(
        <blockquote key={String(k++)} className="md-blockquote">
          {renderInlineNodes(parseInline(bqm[1]))}
        </blockquote>,
      );
      continue;
    }

    // Unordered list
    const ulm = trimmed.match(/^[-*+]\s+(.+)$/);
    if (ulm) {
      flushPara();
      if (!list || list.ordered) {
        flushList();
        list = { ordered: false, items: [] };
      }
      list.items.push(ulm[1]);
      continue;
    }

    // Ordered list
    const olm = trimmed.match(/^\d+[.)]\s+(.+)$/);
    if (olm) {
      flushPara();
      if (!list || !list.ordered) {
        flushList();
        list = { ordered: true, items: [] };
      }
      list.items.push(olm[1]);
      continue;
    }

    // Regular line
    flushList();
    paraLines.push(trimmed);
  }

  flushList();
  flushPara();
  return <>{nodes}</>;
}

// ── Public component ───────────────────────────────────────────────────────
export function MarkdownMessage({ content }: { content: string }) {
  const blocks = parseBlocks(content);

  return (
    <div className="md-message">
      {blocks.map((block, i) => {
        if (block.type === "code") {
          return (
            <div key={String(i)} className="md-code-block">
              {block.lang ? (
                <span className="md-code-lang">{block.lang}</span>
              ) : null}
              <pre className="md-code-pre">
                <code>{block.content}</code>
              </pre>
            </div>
          );
        }
        return (
          <div key={String(i)} className="md-text-block">
            {renderTextLines(block.lines)}
          </div>
        );
      })}
    </div>
  );
}

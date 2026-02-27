/**
 * Data-driven HTML report renderer.
 *
 * Accepts an array of typed ReportSection objects and composes them into
 * a complete Opta-glass-styled HTML document. Report types (session summary,
 * benchmark, plan) are just different arrangements of sections.
 */

import { OPTA_GLASS_CSS, escapeHtml } from './html-tokens.js';

// Re-export for convenience
export { escapeHtml } from './html-tokens.js';

// ── Section types ──────────────────────────────────────────────────

export interface StatItem {
  value: string;
  label: string;
}

export interface KeyValuePair {
  key: string;
  value: string;
  /** CSS color class: c-violet, c-green, c-amber, c-blue, c-red, c-cyan */
  color?: string;
}

export interface TimelineEvent {
  time: string;
  label: string;
  detail?: string;
  /** CSS color for the dot, e.g. 'var(--neon-green)' */
  color?: string;
}

export interface CardItem {
  title: string;
  description: string;
  /** Status badge text */
  status?: string;
  /** Badge color class: green, amber, red, blue, violet */
  statusColor?: string;
  tags?: string[];
}

export type ReportSection =
  | { type: 'stats-grid'; items: StatItem[] }
  | { type: 'key-value'; pairs: KeyValuePair[] }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'timeline'; events: TimelineEvent[] }
  | { type: 'file-changes'; created: string[]; modified: string[]; deleted: string[] }
  | { type: 'card-grid'; cards: CardItem[] }
  | { type: 'list'; title?: string; items: string[]; style?: 'bullet' | 'numbered' | 'check' }
  | { type: 'text-block'; title?: string; content: string }
  | { type: 'divider' }
  | { type: 'section-header'; number: string; title: string };

export interface ReportOptions {
  /** Page <title> */
  title: string;
  /** Subtitle shown below the title */
  subtitle?: string;
  /** Small badge above the title (e.g. 'Session Report') */
  badge?: string;
  /** Ordered list of sections to render */
  sections: ReportSection[];
  /** Footer line (defaults to generated timestamp) */
  footer?: string;
}

// ── Section renderers ──────────────────────────────────────────────

function renderStatsGrid(items: StatItem[]): string {
  const cells = items.map((s) =>
    `<div class="opta-stat glass">
      <div class="opta-stat-value">${escapeHtml(s.value)}</div>
      <div class="opta-stat-label">${escapeHtml(s.label)}</div>
    </div>`
  ).join('\n');
  return `<div class="opta-stats">${cells}</div>`;
}

function renderKeyValue(pairs: KeyValuePair[]): string {
  const rows = pairs.map((p) => {
    const valClass = p.color ? ` class="${p.color}"` : '';
    return `<div class="opta-kv-row">
      <span class="opta-kv-key">${escapeHtml(p.key)}</span>
      <span class="opta-kv-val"${valClass}>${escapeHtml(p.value)}</span>
    </div>`;
  }).join('\n');
  return `<div class="opta-kv glass">${rows}</div>`;
}

function renderTable(headers: string[], rows: string[][]): string {
  const ths = headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('');
  const trs = rows.map((row) => {
    const tds = row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('');
    return `<tr>${tds}</tr>`;
  }).join('\n');
  return `<div class="opta-table-wrap glass">
    <table class="opta-table">
      <thead><tr>${ths}</tr></thead>
      <tbody>${trs}</tbody>
    </table>
  </div>`;
}

function renderTimeline(events: TimelineEvent[]): string {
  const items = events.map((e) => {
    const dotColor = e.color ?? 'var(--primary)';
    const detail = e.detail ? `<div class="opta-tl-detail">${escapeHtml(e.detail)}</div>` : '';
    return `<div class="opta-tl-event">
      <span class="opta-tl-time">${escapeHtml(e.time)}</span>
      <span class="opta-tl-dot" style="background:${dotColor}"></span>
      <div>
        <div class="opta-tl-label">${escapeHtml(e.label)}</div>
        ${detail}
      </div>
    </div>`;
  }).join('\n');
  return `<div class="opta-timeline glass">${items}</div>`;
}

function renderFileChanges(created: string[], modified: string[], deleted: string[]): string {
  const fileList = (files: string[]) =>
    files.length > 0
      ? files.map((f) => `<div class="opta-file-item">${escapeHtml(f)}</div>`).join('\n')
      : '<div class="opta-file-none">none</div>';

  return `<div class="opta-files glass">
    <div class="opta-files-group">
      <div class="opta-files-label created">Created (${created.length})</div>
      ${fileList(created)}
    </div>
    <div class="opta-files-group">
      <div class="opta-files-label modified">Modified (${modified.length})</div>
      ${fileList(modified)}
    </div>
    <div class="opta-files-group">
      <div class="opta-files-label deleted">Deleted (${deleted.length})</div>
      ${fileList(deleted)}
    </div>
  </div>`;
}

function renderCardGrid(cards: CardItem[]): string {
  const items = cards.map((c) => {
    const statusBadge = c.status
      ? `<span class="opta-card-status ${c.statusColor ?? 'violet'}">${escapeHtml(c.status)}</span>`
      : '';
    const tags = (c.tags ?? [])
      .map((t) => `<span class="opta-card-tag">${escapeHtml(t)}</span>`)
      .join('\n');
    const tagsHtml = tags ? `<div class="opta-card-tags">${tags}</div>` : '';
    return `<div class="opta-card glass">
      <div class="opta-card-header">
        <div class="opta-card-title">${escapeHtml(c.title)}</div>
        ${statusBadge}
      </div>
      <div class="opta-card-desc">${escapeHtml(c.description)}</div>
      ${tagsHtml}
    </div>`;
  }).join('\n');
  return `<div class="opta-cards">${items}</div>`;
}

function renderList(title: string | undefined, items: string[], style: string): string {
  const titleHtml = title ? `<div class="opta-list-title">${escapeHtml(title)}</div>` : '';
  const lis = items.map((item, i) => {
    const cls = style === 'check' ? ' check' : style === 'numbered' ? ' numbered' : '';
    const dataAttr = style === 'numbered' ? ` data-n="${i + 1}"` : '';
    return `<div class="opta-list-item${cls}"${dataAttr}>${escapeHtml(item)}</div>`;
  }).join('\n');
  return `<div class="opta-list glass">${titleHtml}${lis}</div>`;
}

function renderTextBlock(title: string | undefined, content: string): string {
  const titleHtml = title ? `<div class="opta-text-title">${escapeHtml(title)}</div>` : '';
  return `<div class="opta-text glass">${titleHtml}<div class="opta-text-body">${escapeHtml(content)}</div></div>`;
}

function renderSectionHeader(number: string, title: string): string {
  return `<div class="opta-section-header">
    <span class="opta-section-number">${escapeHtml(number)}</span>
    <span class="opta-section-title">${escapeHtml(title)}</span>
    <div class="opta-section-line"></div>
  </div>`;
}

function renderSection(section: ReportSection): string {
  switch (section.type) {
    case 'stats-grid':
      return renderStatsGrid(section.items);
    case 'key-value':
      return renderKeyValue(section.pairs);
    case 'table':
      return renderTable(section.headers, section.rows);
    case 'timeline':
      return renderTimeline(section.events);
    case 'file-changes':
      return renderFileChanges(section.created, section.modified, section.deleted);
    case 'card-grid':
      return renderCardGrid(section.cards);
    case 'list':
      return renderList(section.title, section.items, section.style ?? 'bullet');
    case 'text-block':
      return renderTextBlock(section.title, section.content);
    case 'divider':
      return '<div class="opta-divider"></div>';
    case 'section-header':
      return renderSectionHeader(section.number, section.title);
  }
}

// ── Main renderer ──────────────────────────────────────────────────

/**
 * Render a complete HTML page from typed sections.
 *
 * Usage:
 * ```ts
 * const html = renderGlassReport({
 *   title: 'Session Report',
 *   badge: 'Autonomous Session',
 *   subtitle: 'Completed 42 tool calls in 3m 12s',
 *   sections: [ ... ],
 * });
 * ```
 */
export function renderGlassReport(options: ReportOptions): string {
  const badgeHtml = options.badge
    ? `<div class="opta-badge">${escapeHtml(options.badge)}</div>`
    : '';
  const subtitleHtml = options.subtitle
    ? `<p class="opta-subtitle">${escapeHtml(options.subtitle)}</p>`
    : '';

  const body = options.sections.map((s) =>
    `<div class="opta-section">${renderSection(s)}</div>`
  ).join('\n');

  const footer = options.footer ?? `Generated ${new Date().toLocaleString()}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(options.title)} — Opta</title>
<style>${OPTA_GLASS_CSS}</style>
</head>
<body>
<div class="opta-container">
  <div class="opta-hero">
    ${badgeHtml}
    <h1 class="opta-title">${escapeHtml(options.title)}</h1>
    ${subtitleHtml}
  </div>
  ${body}
  <div class="opta-footer">
    <span class="opta-footer-brand">Opta CLI</span> &middot; ${escapeHtml(footer)}
  </div>
</div>
</body>
</html>`;
}

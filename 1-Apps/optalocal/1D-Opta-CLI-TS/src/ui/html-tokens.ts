/**
 * Opta Glass Design System — HTML/CSS tokens.
 *
 * Single source of truth for the obsidian glass aesthetic used in all
 * browser-rendered reports (session summaries, benchmarks, plans).
 *
 * Color palette matches src/ui/theme.ts (terminal) and the /gu command spec.
 */

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Inline CSS block for all Opta glass reports.
 * Includes: reset, noise overlay, ambient glow, glass panels, typography,
 * stat cards, tables, timelines, file-change lists, neon dividers.
 */
export const OPTA_GLASS_CSS = /* css */ `
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&display=swap');

  :root {
    --void: #09090b;
    --surface: #18181b;
    --elevated: #27272a;
    --border: #3f3f46;
    --text-primary: #fafafa;
    --text-secondary: #a1a1aa;
    --text-muted: #52525b;
    --primary: #8b5cf6;
    --primary-glow: #a855f7;
    --neon-blue: #3b82f6;
    --neon-green: #22c55e;
    --neon-amber: #f59e0b;
    --neon-red: #ef4444;
    --neon-cyan: #06b6d4;
    --neon-rose: #f43f5e;
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    background: var(--void);
    color: var(--text-primary);
    font-family: 'Sora', -apple-system, BlinkMacSystemFont, sans-serif;
    line-height: 1.6;
    min-height: 100vh;
    overflow-x: hidden;
  }

  /* Noise overlay */
  body::before {
    content: '';
    position: fixed;
    inset: 0;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E");
    pointer-events: none;
    z-index: 0;
  }

  /* Ambient glow */
  body::after {
    content: '';
    position: fixed;
    top: -200px;
    left: 50%;
    transform: translateX(-50%);
    width: 800px;
    height: 600px;
    background: radial-gradient(ellipse, rgba(139,92,246,0.08) 0%, transparent 70%);
    pointer-events: none;
    z-index: 0;
  }

  .opta-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 40px 32px 80px;
    position: relative;
    z-index: 1;
  }

  /* ── Hero ── */
  .opta-hero { text-align: center; margin-bottom: 48px; }

  .opta-badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 6px 16px;
    background: rgba(139,92,246,0.1);
    border: 1px solid rgba(139,92,246,0.3);
    border-radius: 100px;
    font-size: 12px;
    font-weight: 500;
    color: var(--primary-glow);
    letter-spacing: 1.5px;
    text-transform: uppercase;
    margin-bottom: 20px;
    animation: breathe 4s ease-in-out infinite;
  }

  @keyframes breathe {
    0%, 100% { box-shadow: 0 0 20px rgba(139,92,246,0.1); }
    50% { box-shadow: 0 0 30px rgba(139,92,246,0.2); }
  }

  .opta-title {
    font-size: 40px;
    font-weight: 700;
    background: linear-gradient(135deg, #fafafa 0%, #a78bfa 50%, #818cf8 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    margin-bottom: 12px;
    letter-spacing: -0.5px;
  }

  .opta-subtitle {
    font-size: 16px;
    color: var(--text-secondary);
    max-width: 600px;
    margin: 0 auto;
    font-weight: 300;
  }

  /* ── Glass panels ── */
  .glass {
    background: rgba(255,255,255,0.02);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 16px;
    backdrop-filter: blur(12px);
    position: relative;
    overflow: hidden;
  }

  .glass::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
  }

  .glass-subtle {
    background: rgba(255,255,255,0.015);
    border: 1px solid rgba(255,255,255,0.04);
    border-radius: 12px;
    backdrop-filter: blur(8px);
  }

  /* ── Section headers ── */
  .opta-section { margin-bottom: 40px; }

  .opta-section-header {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 20px;
  }

  .opta-section-number {
    font-size: 11px;
    font-weight: 600;
    color: var(--primary);
    background: rgba(139,92,246,0.1);
    border: 1px solid rgba(139,92,246,0.2);
    padding: 4px 10px;
    border-radius: 6px;
    letter-spacing: 1px;
  }

  .opta-section-title {
    font-size: 22px;
    font-weight: 600;
    background: linear-gradient(135deg, #fafafa, #a78bfa);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .opta-section-line {
    flex: 1;
    height: 1px;
    background: linear-gradient(90deg, rgba(139,92,246,0.4), transparent);
  }

  /* ── Stats grid ── */
  .opta-stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 12px;
    margin-bottom: 24px;
  }

  .opta-stat {
    padding: 16px;
    text-align: center;
  }

  .opta-stat-value {
    font-size: 26px;
    font-weight: 700;
    background: linear-gradient(135deg, #fafafa, var(--primary));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    margin-bottom: 2px;
  }

  .opta-stat-label {
    font-size: 10px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  /* ── Key-value pairs ── */
  .opta-kv { padding: 20px; }

  .opta-kv-row {
    display: flex;
    justify-content: space-between;
    padding: 8px 0;
    border-bottom: 1px solid rgba(255,255,255,0.03);
    font-size: 13px;
  }

  .opta-kv-row:last-child { border-bottom: none; }
  .opta-kv-key { color: var(--text-muted); }
  .opta-kv-val { color: var(--text-primary); font-weight: 500; }

  /* ── Table ── */
  .opta-table-wrap { padding: 4px 16px; overflow-x: auto; }

  .opta-table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0 4px;
  }

  .opta-table th {
    text-align: left;
    font-size: 11px;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 1px;
    padding: 8px 16px;
  }

  .opta-table td {
    font-size: 13px;
    padding: 10px 16px;
    background: rgba(255,255,255,0.015);
    color: var(--text-secondary);
  }

  .opta-table tr td:first-child { border-radius: 8px 0 0 8px; }
  .opta-table tr td:last-child { border-radius: 0 8px 8px 0; }
  .opta-table tbody tr:hover td { background: rgba(255,255,255,0.03); }

  /* ── Timeline ── */
  .opta-timeline { padding: 20px 24px; }

  .opta-tl-event {
    display: flex;
    gap: 16px;
    padding: 10px 0;
    border-bottom: 1px solid rgba(255,255,255,0.03);
    font-size: 13px;
  }

  .opta-tl-event:last-child { border-bottom: none; }

  .opta-tl-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    margin-top: 6px;
    flex-shrink: 0;
  }

  .opta-tl-label { color: var(--text-primary); font-weight: 500; }
  .opta-tl-detail { color: var(--text-muted); font-size: 12px; margin-top: 2px; }
  .opta-tl-time {
    font-family: 'SF Mono', 'Fira Code', monospace;
    font-size: 11px;
    color: var(--text-muted);
    white-space: nowrap;
    min-width: 64px;
  }

  /* ── File changes ── */
  .opta-files { padding: 20px 24px; }

  .opta-files-group { margin-bottom: 16px; }
  .opta-files-group:last-child { margin-bottom: 0; }

  .opta-files-label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    margin-bottom: 8px;
  }

  .opta-files-label.created { color: var(--neon-green); }
  .opta-files-label.modified { color: var(--neon-amber); }
  .opta-files-label.deleted { color: var(--neon-red); }

  .opta-file-item {
    font-family: 'SF Mono', 'Fira Code', monospace;
    font-size: 12px;
    color: var(--text-secondary);
    padding: 3px 0;
  }

  .opta-file-none {
    font-size: 12px;
    color: var(--text-muted);
    font-style: italic;
  }

  /* ── List ── */
  .opta-list { padding: 20px 24px; }

  .opta-list-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 12px;
  }

  .opta-list-item {
    font-size: 13px;
    color: var(--text-secondary);
    padding: 4px 0 4px 18px;
    position: relative;
    line-height: 1.5;
  }

  .opta-list-item::before {
    content: '\\203A';
    position: absolute;
    left: 0;
    color: var(--primary);
    font-weight: 700;
  }

  .opta-list-item.check::before { content: '\\2713'; color: var(--neon-green); }
  .opta-list-item.numbered::before { content: attr(data-n) '.'; color: var(--primary); font-weight: 600; }

  /* ── Text block ── */
  .opta-text { padding: 20px 24px; }

  .opta-text-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 8px;
  }

  .opta-text-body {
    font-size: 13px;
    color: var(--text-secondary);
    line-height: 1.7;
    white-space: pre-wrap;
  }

  /* ── Card grid ── */
  .opta-cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 16px;
  }

  .opta-card {
    padding: 20px;
    transition: transform 0.2s ease;
  }

  .opta-card:hover { transform: translateY(-1px); }

  .opta-card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 8px;
    gap: 10px;
  }

  .opta-card-title {
    font-size: 15px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .opta-card-status {
    display: inline-flex;
    padding: 3px 10px;
    border-radius: 100px;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.5px;
    white-space: nowrap;
  }

  .opta-card-status.green { background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.3); color: var(--neon-green); }
  .opta-card-status.amber { background: rgba(245,158,11,0.1); border: 1px solid rgba(245,158,11,0.3); color: var(--neon-amber); }
  .opta-card-status.red { background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); color: var(--neon-red); }
  .opta-card-status.blue { background: rgba(59,130,246,0.1); border: 1px solid rgba(59,130,246,0.3); color: var(--neon-blue); }
  .opta-card-status.violet { background: rgba(139,92,246,0.1); border: 1px solid rgba(139,92,246,0.3); color: var(--primary); }

  .opta-card-desc {
    font-size: 13px;
    color: var(--text-secondary);
    line-height: 1.5;
    margin-bottom: 10px;
  }

  .opta-card-tags { display: flex; flex-wrap: wrap; gap: 6px; }

  .opta-card-tag {
    font-size: 11px;
    padding: 3px 10px;
    border-radius: 6px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.06);
    color: var(--text-secondary);
  }

  /* ── Neon divider ── */
  .opta-divider {
    height: 1px;
    background: linear-gradient(90deg, transparent, var(--primary), transparent);
    margin: 36px 0;
    box-shadow: 0 0 8px rgba(139,92,246,0.3);
    opacity: 0.5;
  }

  /* ── Footer ── */
  .opta-footer {
    text-align: center;
    padding: 32px 0;
    border-top: 1px solid rgba(255,255,255,0.04);
    margin-top: 48px;
    font-size: 12px;
    color: var(--text-muted);
  }

  .opta-footer-brand { font-weight: 600; color: var(--primary); }

  /* ── Color utilities ── */
  .c-violet { color: var(--primary); }
  .c-green { color: var(--neon-green); }
  .c-amber { color: var(--neon-amber); }
  .c-blue { color: var(--neon-blue); }
  .c-red { color: var(--neon-red); }
  .c-cyan { color: var(--neon-cyan); }

  @media (max-width: 768px) {
    .opta-container { padding: 24px 16px; }
    .opta-title { font-size: 28px; }
    .opta-stats { grid-template-columns: repeat(3, 1fr); }
    .opta-cards { grid-template-columns: 1fr; }
  }
`;

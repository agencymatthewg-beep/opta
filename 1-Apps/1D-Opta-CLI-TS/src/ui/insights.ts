/**
 * CLI insight rendering — chalk-formatted ★ Insight blocks for non-TUI mode.
 */

import chalk from 'chalk';
import type { Insight, InsightCategory } from '../core/insights.js';

const CATEGORY_COLORS: Record<InsightCategory, (s: string) => string> = {
  perf: chalk.cyan,
  context: chalk.yellow,
  tool: chalk.magenta,
  connection: chalk.red,
  summary: chalk.green,
};

const CATEGORY_ICONS: Record<InsightCategory, string> = {
  perf: '\u26A1',      // ⚡
  context: '\u25CB',    // ○
  tool: '\u25B6',       // ▶
  connection: '\u25C6', // ◆
  summary: '\u2605',    // ★
};

export function formatInsight(insight: Insight): string {
  const colorFn = CATEGORY_COLORS[insight.category];
  const icon = CATEGORY_ICONS[insight.category];
  return chalk.dim(`  ${colorFn(icon)} ${colorFn(insight.text)}`);
}

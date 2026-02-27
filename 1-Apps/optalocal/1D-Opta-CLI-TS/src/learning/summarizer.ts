import type { LearningLedgerEntry } from './types.js';

export interface LedgerSummaryOptions {
  from?: string | Date;
  to?: string | Date;
}

function parseDate(value?: string | Date): number | undefined {
  if (value === undefined) return undefined;
  const millis = new Date(value).getTime();
  return Number.isNaN(millis) ? undefined : millis;
}

function dateKey(ts: string): string {
  return new Date(ts).toISOString().slice(0, 10);
}

export function summarizeLedgerByDate(
  entries: LearningLedgerEntry[],
  options: LedgerSummaryOptions = {},
): string {
  const fromMs = parseDate(options.from);
  const toMs = parseDate(options.to);

  const filtered = entries
    .filter((entry) => {
      const ts = new Date(entry.ts).getTime();
      if (fromMs !== undefined && ts < fromMs) return false;
      if (toMs !== undefined && ts > toMs) return false;
      return true;
    })
    .sort((a, b) => b.ts.localeCompare(a.ts));

  const lines: string[] = ['# Learning Ledger Summary', ''];
  if (filtered.length === 0) {
    lines.push('_No entries found._');
    return `${lines.join('\n')}\n`;
  }

  const grouped = new Map<string, LearningLedgerEntry[]>();
  for (const entry of filtered) {
    const key = dateKey(entry.ts);
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(entry);
  }

  const sortedDates = Array.from(grouped.keys()).sort((a, b) =>
    b.localeCompare(a),
  );
  for (const day of sortedDates) {
    lines.push(`## ${day}`, '');
    for (const entry of grouped.get(day) ?? []) {
      lines.push(`- **${entry.kind}** ${entry.topic}`);
      lines.push(`  ${entry.content}`);
      if (entry.tags.length > 0) {
        lines.push(`  Tags: ${entry.tags.join(', ')}`);
      }
      if (entry.evidence.length > 0) {
        const refs = entry.evidence
          .map((item) => `[${item.label}](${item.uri})`)
          .join(', ');
        lines.push(`  Evidence: ${refs}`);
      }
    }
    lines.push('');
  }

  return `${lines.join('\n').trimEnd()}\n`;
}

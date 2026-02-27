import chalk from 'chalk';

export function formatUnifiedDiff(diff: string): string {
  const lines = diff.split('\n');
  const out: string[] = [];

  for (const line of lines) {
    if (line.startsWith('---') || line.startsWith('+++')) {
      out.push(chalk.bold(line));
    } else if (line.startsWith('@@')) {
      out.push(chalk.cyan(line));
    } else if (line.startsWith('+')) {
      out.push(chalk.green(line));
    } else if (line.startsWith('-')) {
      out.push(chalk.red(line));
    } else {
      out.push(chalk.dim(line));
    }
  }

  return out.join('\n');
}

export function formatInlineDiff(oldText: string, newText: string): string {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const out: string[] = [];

  let i = 0, j = 0;

  while (i < oldLines.length || j < newLines.length) {
    const oldLine = oldLines[i];
    const newLine = newLines[j];

    if (oldLine === newLine) {
      out.push(chalk.dim('  ') + (oldLine ?? ''));
      i++; j++;
    } else if (oldLine !== undefined && !newLines.includes(oldLine)) {
      out.push(chalk.red('- ') + chalk.red(oldLine));
      i++;
    } else if (newLine !== undefined && !oldLines.includes(newLine)) {
      out.push(chalk.green('+ ') + chalk.green(newLine));
      j++;
    } else {
      if (oldLine !== undefined) {
        out.push(chalk.red('- ') + chalk.red(oldLine));
        i++;
      }
      if (newLine !== undefined) {
        out.push(chalk.green('+ ') + chalk.green(newLine));
        j++;
      }
    }
  }

  return out.join('\n');
}

export function formatDiffStat(stat: string): string {
  const lines = stat.trim().split('\n');
  const out: string[] = [];

  for (const line of lines) {
    const colored = line
      .replace(/(\++)/g, chalk.green('$1'))
      .replace(/(-+)/g, chalk.red('$1'));
    out.push('  ' + colored);
  }

  return out.join('\n');
}

/**
 * Formats a unified diff with color, truncated to `maxLines`.
 * Includes a file path header and a "... N more lines" footer when truncated.
 */
export function formatTruncatedDiff(
  diff: string,
  filePath: string,
  maxLines = 20,
): string {
  const lines = diff.split('\n').filter((l) => l.length > 0);
  const out: string[] = [];

  out.push(chalk.bold.underline(filePath));

  const displayLines = lines.slice(0, maxLines);
  for (const line of displayLines) {
    if (line.startsWith('---') || line.startsWith('+++')) {
      out.push(chalk.bold(line));
    } else if (line.startsWith('@@')) {
      out.push(chalk.cyan(line));
    } else if (line.startsWith('+')) {
      out.push(chalk.green(line));
    } else if (line.startsWith('-')) {
      out.push(chalk.red(line));
    } else {
      out.push(chalk.dim(line));
    }
  }

  const remaining = lines.length - maxLines;
  if (remaining > 0) {
    out.push(chalk.dim(`  ... ${remaining} more line${remaining === 1 ? '' : 's'}`));
  }

  return out.join('\n');
}

/**
 * Formats a compact +/- stat string from addition/deletion counts.
 * Example: "+12 -3"
 */
export function formatPatchStat(additions: number, deletions: number): string {
  const parts: string[] = [];
  if (additions > 0) parts.push(chalk.green(`+${additions}`));
  if (deletions > 0) parts.push(chalk.red(`-${deletions}`));
  if (parts.length === 0) return chalk.dim('(no changes)');
  return parts.join(' ');
}

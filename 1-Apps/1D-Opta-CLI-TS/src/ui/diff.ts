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

import chalk from 'chalk';
import { getTheme } from './theme.js';

const TOOL_ICONS: Record<string, string> = {
  read_file: '📄',
  write_file: '✏️',
  edit_file: '🔧',
  list_dir: '📁',
  search_files: '🔍',
  find_files: '🔎',
  run_command: '⚡',
  ask_user: '💬',
};

export function formatToolCall(name: string, args: Record<string, unknown>): string {
  const icon = TOOL_ICONS[name] || '🔧';
  const theme = getTheme();
  const parts: string[] = [];
  const toStr = (v: unknown, fallback = ''): string => {
    if (v === null || v === undefined) return fallback;
    if (typeof v === 'string') return v;
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v as number | boolean | bigint);
  };

  parts.push(chalk.dim('  ┌─') + ` ${icon} ${theme.primary.bold(name)}`);

  switch (name) {
    case 'read_file':
      parts.push(chalk.dim('  │ ') + theme.info(toStr(args.path)));
      if (args.offset || args.limit) {
        parts.push(
          chalk.dim('  │ ') +
            chalk.dim(
              `lines ${toStr(args.offset, '1')}-${String(((args.offset as number) ?? 0) + ((args.limit as number) ?? 0))}`
            )
        );
      }
      break;

    case 'write_file': {
      const content = toStr(args.content);
      const lineCount = content.split('\n').length;
      parts.push(
        chalk.dim('  │ ') + theme.info(toStr(args.path)) + chalk.dim(` (${lineCount} lines)`)
      );
      break;
    }

    case 'edit_file':
      parts.push(chalk.dim('  │ ') + theme.info(toStr(args.path)));
      if (args.old_text && args.new_text) {
        const oldText = toStr(args.old_text);
        const newText = toStr(args.new_text);
        const oldLines = oldText.split('\n');
        const newLines = newText.split('\n');
        parts.push(
          chalk.dim('  │ ') +
            theme.error(`- ${oldLines.length} line${oldLines.length > 1 ? 's' : ''}`) +
            chalk.dim(' → ') +
            theme.success(`+ ${newLines.length} line${newLines.length > 1 ? 's' : ''}`)
        );
        // Show compact inline diff preview (max 6 lines)
        const previewLimit = 3;
        for (let li = 0; li < Math.min(oldLines.length, previewLimit); li++) {
          parts.push(chalk.dim('  │ ') + theme.error('- ' + oldLines[li]!.slice(0, 60)));
        }
        if (oldLines.length > previewLimit) {
          parts.push(chalk.dim('  │   ...'));
        }
        for (let li = 0; li < Math.min(newLines.length, previewLimit); li++) {
          parts.push(chalk.dim('  │ ') + theme.success('+ ' + newLines[li]!.slice(0, 60)));
        }
        if (newLines.length > previewLimit) {
          parts.push(chalk.dim('  │   ...'));
        }
      }
      break;

    case 'run_command':
      parts.push(chalk.dim('  │ ') + theme.warning(`$ ${toStr(args.command)}`));
      break;

    case 'search_files':
      parts.push(chalk.dim('  │ ') + theme.warning(`/${toStr(args.pattern)}/`));
      if (args.path) parts.push(chalk.dim('  │ ') + chalk.dim(`in ${toStr(args.path)}`));
      break;

    case 'list_dir':
      parts.push(chalk.dim('  │ ') + theme.info(toStr(args.path, '.')));
      break;

    case 'ask_user':
      parts.push(chalk.dim('  │ ') + chalk.italic(toStr(args.question).slice(0, 60)));
      break;

    default:
      for (const [k, v] of Object.entries(args)) {
        const val = toStr(v).slice(0, 50);
        parts.push(chalk.dim('  │ ') + chalk.dim(`${k}: `) + val);
      }
  }

  parts.push(chalk.dim('  └─'));
  return parts.join('\n');
}

export function formatToolResult(name: string, result: string, maxLen = 300): string {
  const trimmed =
    result.length > maxLen
      ? result.slice(0, maxLen) + chalk.dim(`... (${result.length} chars total)`)
      : result;

  if (name === 'run_command') {
    return (
      chalk.dim('  ') +
      trimmed
        .split('\n')
        .map((l) => chalk.dim('  │ ') + l)
        .join('\n')
    );
  }

  return (
    chalk.dim('  ') +
    trimmed
      .split('\n')
      .slice(0, 10)
      .map((l) => chalk.dim('  │ ') + l)
      .join('\n')
  );
}

import chalk from 'chalk';

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
  const parts: string[] = [];

  parts.push(chalk.dim('  ┌─') + ` ${icon} ${chalk.bold(name)}`);

  switch (name) {
    case 'read_file':
      parts.push(chalk.dim('  │ ') + chalk.cyan(String(args.path)));
      if (args.offset || args.limit) {
        parts.push(chalk.dim('  │ ') + chalk.dim(`lines ${args.offset ?? 1}-${(args.offset as number ?? 0) + (args.limit as number ?? 0)}`));
      }
      break;

    case 'write_file': {
      const content = String(args.content ?? '');
      const lineCount = content.split('\n').length;
      parts.push(chalk.dim('  │ ') + chalk.cyan(String(args.path)) + chalk.dim(` (${lineCount} lines)`));
      break;
    }

    case 'edit_file':
      parts.push(chalk.dim('  │ ') + chalk.cyan(String(args.path)));
      if (args.old_text && args.new_text) {
        const oldLines = String(args.old_text).split('\n').length;
        const newLines = String(args.new_text).split('\n').length;
        parts.push(chalk.dim('  │ ') + chalk.red(`- ${oldLines} line${oldLines > 1 ? 's' : ''}`) +
          chalk.dim(' → ') + chalk.green(`+ ${newLines} line${newLines > 1 ? 's' : ''}`));
      }
      break;

    case 'run_command':
      parts.push(chalk.dim('  │ ') + chalk.yellow(`$ ${String(args.command)}`));
      break;

    case 'search_files':
      parts.push(chalk.dim('  │ ') + chalk.yellow(`/${String(args.pattern)}/`));
      if (args.path) parts.push(chalk.dim('  │ ') + chalk.dim(`in ${args.path}`));
      break;

    case 'list_dir':
      parts.push(chalk.dim('  │ ') + chalk.cyan(String(args.path || '.')));
      break;

    case 'ask_user':
      parts.push(chalk.dim('  │ ') + chalk.italic(String(args.question ?? '').slice(0, 60)));
      break;

    default:
      for (const [k, v] of Object.entries(args)) {
        const val = String(v).slice(0, 50);
        parts.push(chalk.dim('  │ ') + chalk.dim(`${k}: `) + val);
      }
  }

  parts.push(chalk.dim('  └─'));
  return parts.join('\n');
}

export function formatToolResult(name: string, result: string, maxLen = 300): string {
  const trimmed = result.length > maxLen
    ? result.slice(0, maxLen) + chalk.dim(`... (${result.length} chars total)`)
    : result;

  if (name === 'run_command') {
    return chalk.dim('  ') + trimmed.split('\n').map(l => chalk.dim('  │ ') + l).join('\n');
  }

  return chalk.dim('  ') + trimmed.split('\n').slice(0, 10).map(l => chalk.dim('  │ ') + l).join('\n');
}

import chalk from 'chalk';
import {
  listSessions,
  deleteSession,
  exportSession,
  searchSessions,
} from '../memory/store.js';
import { EXIT } from '../core/errors.js';

interface SessionsOptions {
  json?: boolean;
}

export async function sessions(
  action?: string,
  id?: string,
  opts?: SessionsOptions
): Promise<void> {
  // Default: list sessions
  if (!action || action === 'list') {
    await listSessionsFormatted(opts?.json);
    return;
  }

  switch (action) {
    case 'resume':
      if (!id) {
        console.error(chalk.red('✗') + ' Session ID required\n');
        console.log(chalk.dim('Usage: opta sessions resume <id>'));
        process.exit(EXIT.MISUSE);
      }
      // Delegate to chat --resume
      const { startChat } = await import('./chat.js');
      await startChat({ resume: id });
      break;

    case 'delete':
    case 'rm':
      if (!id) {
        console.error(chalk.red('✗') + ' Session ID required\n');
        console.log(chalk.dim('Usage: opta sessions delete <id>'));
        process.exit(EXIT.MISUSE);
      }
      await deleteSession(id);
      console.log(chalk.green('✓') + ` Deleted session ${id}`);
      break;

    case 'search':
    case 'find':
      if (!id) {
        console.error(chalk.red('✗') + ' Search query required\n');
        console.log(chalk.dim('Usage: opta sessions search <query>'));
        process.exit(EXIT.MISUSE);
      }
      await searchSessionsFormatted(id, opts?.json);
      break;

    case 'export':
      if (!id) {
        console.error(chalk.red('✗') + ' Session ID required\n');
        console.log(chalk.dim('Usage: opta sessions export <id>'));
        process.exit(EXIT.MISUSE);
      }
      try {
        const json = await exportSession(id);
        console.log(json);
      } catch {
        console.error(chalk.red('✗') + ` Session not found: ${id}`);
        process.exit(EXIT.NOT_FOUND);
      }
      break;

    default:
      console.error(chalk.red('✗') + ` Unknown action: ${action}\n`);
      console.log(chalk.dim('Available actions: list, resume, delete, export, search'));
      process.exit(EXIT.MISUSE);
  }
}

async function listSessionsFormatted(json?: boolean): Promise<void> {
  const items = await listSessions();

  if (items.length === 0) {
    console.log(chalk.dim('No sessions found. Start one with ') + chalk.cyan('opta chat'));
    return;
  }

  if (json) {
    console.log(JSON.stringify(items, null, 2));
    return;
  }

  // Table header
  console.log(
    chalk.bold('  ID        Title                          Model           Date         Messages')
  );

  for (const s of items) {
    const shortId = s.id.slice(0, 8).padEnd(8);
    const title = s.title.slice(0, 30).padEnd(30);
    const model = s.model.slice(0, 15).padEnd(15);
    const date = formatRelativeDate(s.created).padEnd(12);
    const count = String(s.messageCount).padStart(4);

    console.log(`  ${shortId}  ${title} ${model} ${date} ${count}`);
  }
}

async function searchSessionsFormatted(query: string, json?: boolean): Promise<void> {
  const matches = await searchSessions(query);

  if (matches.length === 0) {
    console.log(chalk.dim(`No sessions matching "${query}"`));
    return;
  }

  if (json) {
    console.log(JSON.stringify(matches, null, 2));
    return;
  }

  console.log(chalk.dim(`  Found ${matches.length} session${matches.length === 1 ? '' : 's'} matching "${query}":\n`));

  console.log(
    chalk.bold('  ID        Title                          Model           Date         Messages')
  );

  for (const s of matches) {
    const shortId = s.id.slice(0, 8).padEnd(8);
    const title = s.title.slice(0, 30).padEnd(30);
    const model = s.model.slice(0, 15).padEnd(15);
    const date = formatRelativeDate(s.created).padEnd(12);
    const count = String(s.messageCount).padStart(4);

    console.log(`  ${shortId}  ${title} ${model} ${date} ${count}`);
  }

  if (matches.length === 1) {
    console.log(chalk.dim(`\n  Resume with: opta sessions resume ${matches[0]!.id}`));
  }
}

function formatRelativeDate(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffMs = now - then;

  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;

  return new Date(iso).toLocaleDateString();
}

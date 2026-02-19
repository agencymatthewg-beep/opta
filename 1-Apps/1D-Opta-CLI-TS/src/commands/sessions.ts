import chalk from 'chalk';
import {
  listSessions,
  deleteSession,
  exportSession,
  searchSessions,
} from '../memory/store.js';
import { EXIT, ExitError } from '../core/errors.js';

interface SessionsOptions {
  json?: boolean;
  model?: string;
  since?: string;
  tag?: string;
  limit?: string;
}

export async function sessions(
  action?: string,
  id?: string,
  opts?: SessionsOptions
): Promise<void> {
  // Default: list sessions
  if (!action || action === 'list') {
    await listSessionsFormatted(opts);
    return;
  }

  switch (action) {
    case 'resume':
      if (!id) {
        console.error(chalk.red('✗') + ' Session ID required\n');
        console.log(chalk.dim('Usage: opta sessions resume <id>'));
        throw new ExitError(EXIT.MISUSE);
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
        throw new ExitError(EXIT.MISUSE);
      }
      await deleteSession(id);
      console.log(chalk.green('✓') + ` Deleted session ${id}`);
      break;

    case 'search':
    case 'find':
      if (!id) {
        console.error(chalk.red('✗') + ' Search query required\n');
        console.log(chalk.dim('Usage: opta sessions search <query>'));
        throw new ExitError(EXIT.MISUSE);
      }
      await searchSessionsFormatted(id, opts?.json);
      break;

    case 'export':
      if (!id) {
        console.error(chalk.red('✗') + ' Session ID required\n');
        console.log(chalk.dim('Usage: opta sessions export <id>'));
        throw new ExitError(EXIT.MISUSE);
      }
      try {
        const json = await exportSession(id);
        console.log(json);
      } catch {
        console.error(chalk.red('✗') + ` Session not found: ${id}`);
        throw new ExitError(EXIT.NOT_FOUND);
      }
      break;

    default:
      console.error(chalk.red('✗') + ` Unknown action: ${action}\n`);
      console.log(chalk.dim('Available actions: list, resume, delete, export, search'));
      throw new ExitError(EXIT.MISUSE);
  }
}

async function listSessionsFormatted(opts?: SessionsOptions): Promise<void> {
  let items = await listSessions();

  // Apply filters
  if (opts?.model) {
    const modelFilter = opts.model.toLowerCase();
    items = items.filter(s => s.model.toLowerCase().includes(modelFilter));
  }
  if (opts?.tag) {
    items = items.filter(s => s.tags?.includes(opts.tag!));
  }
  if (opts?.since) {
    const sinceDate = parseSinceDate(opts.since);
    items = items.filter(s => new Date(s.created) >= sinceDate);
  }

  const limit = opts?.limit ? parseInt(opts.limit, 10) : 20;
  items = items.slice(0, limit);

  if (items.length === 0) {
    console.log(chalk.dim('No sessions found. Start one with ') + chalk.cyan('opta chat'));
    return;
  }

  if (opts?.json) {
    console.log(JSON.stringify(items, null, 2));
    return;
  }

  // Table header
  console.log(
    chalk.bold('  ID        Title                          Model           Date         Messages')
  );

  for (const s of items) {
    const shortId = s.id.slice(0, 8).padEnd(8);
    const titleStr = s.title.slice(0, 30).padEnd(30);
    const model = s.model.slice(0, 15).padEnd(15);
    const date = formatRelativeDate(s.created).padEnd(12);
    const count = String(s.messageCount).padStart(4);
    const tags = s.tags?.length ? chalk.dim(` [${s.tags.join(', ')}]`) : '';

    console.log(`  ${shortId}  ${titleStr} ${model} ${date} ${count}${tags}`);
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

/**
 * Parse a date filter string. Supports:
 * - ISO dates: "2025-01-15"
 * - Relative: "7d" (7 days ago), "2w" (2 weeks ago), "1m" (1 month ago)
 */
function parseSinceDate(input: string): Date {
  const relativeMatch = input.match(/^(\d+)([dwm])$/);
  if (relativeMatch) {
    const amount = parseInt(relativeMatch[1]!, 10);
    const unit = relativeMatch[2]!;
    const now = new Date();
    switch (unit) {
      case 'd':
        now.setDate(now.getDate() - amount);
        break;
      case 'w':
        now.setDate(now.getDate() - amount * 7);
        break;
      case 'm':
        now.setMonth(now.getMonth() - amount);
        break;
    }
    return now;
  }
  // Assume ISO date string
  const parsed = new Date(input);
  if (isNaN(parsed.getTime())) {
    throw new Error(`Invalid date format: "${input}". Use ISO (2025-01-15) or relative (7d, 2w, 1m).`);
  }
  return parsed;
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

import chalk from 'chalk';
import {
  listSessions,
  deleteSession,
  exportSession,
  searchSessions,
  type SessionSummary,
} from '../memory/store.js';
import {
  applySessionPrune,
  getRetentionPolicy,
  listPinnedSessions,
  pinSession,
  planSessionPrune,
  setRetentionPolicy,
  unpinSession,
  type SessionRetentionPolicy,
} from '../memory/retention.js';
import { EXIT, ExitError } from '../core/errors.js';

interface SessionsOptions {
  json?: boolean;
  model?: string;
  since?: string;
  tag?: string;
  limit?: string;
  preservePinned?: boolean | string;
  dryRun?: boolean | string;
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

    case 'pin':
      if (!id) {
        console.error(chalk.red('✗') + ' Session ID required\n');
        console.log(chalk.dim('Usage: opta sessions pin <id>'));
        throw new ExitError(EXIT.MISUSE);
      }
      await pinSessionFormatted(id, opts?.json);
      break;

    case 'unpin':
      if (!id) {
        console.error(chalk.red('✗') + ' Session ID required\n');
        console.log(chalk.dim('Usage: opta sessions unpin <id>'));
        throw new ExitError(EXIT.MISUSE);
      }
      await unpinSessionFormatted(id, opts?.json);
      break;

    case 'pins':
      await listPinsFormatted(opts?.json);
      break;

    case 'retention-get':
      await retentionGetFormatted(opts?.json);
      break;

    case 'retention-set':
      if (!id) {
        console.error(chalk.red('✗') + ' Retention days required\n');
        console.log(chalk.dim('Usage: opta sessions retention-set <days> [--preserve-pinned=true|false]'));
        throw new ExitError(EXIT.MISUSE);
      }
      await retentionSetFormatted(id, opts);
      break;

    case 'prune':
      await pruneSessionsFormatted(opts);
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
      console.log(
        chalk.dim(
          'Available actions: list, resume, delete, export, search, pin, unpin, pins, retention-get, retention-set, prune'
        )
      );
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
    if (opts?.json) {
      console.log(JSON.stringify([], null, 2));
      return;
    }
    console.log(chalk.dim('No sessions found. Start one with ') + chalk.cyan('opta'));
    return;
  }

  if (opts?.json) {
    console.log(JSON.stringify(items, null, 2));
    return;
  }

  printSessionTable(items);
}

async function searchSessionsFormatted(query: string, json?: boolean): Promise<void> {
  const matches = await searchSessions(query);

  if (matches.length === 0) {
    if (json) {
      console.log(JSON.stringify([], null, 2));
      return;
    }
    console.log(chalk.dim(`No sessions matching "${query}"`));
    return;
  }

  if (json) {
    console.log(JSON.stringify(matches, null, 2));
    return;
  }

  console.log(chalk.dim(`  Found ${matches.length} session${matches.length === 1 ? '' : 's'} matching "${query}":\n`));
  printSessionTable(matches);

  if (matches.length === 1) {
    console.log(chalk.dim(`\n  Resume with: opta sessions resume ${matches[0]!.id}`));
  }
}

async function pinSessionFormatted(id: string, json?: boolean): Promise<void> {
  try {
    const result = await pinSession(id);
    if (json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    if (result.alreadyPinned) {
      console.log(chalk.yellow('!') + ` Session ${id} is already pinned`);
      return;
    }
    console.log(chalk.green('✓') + ` Pinned session ${id}`);
  } catch (err) {
    handleNotFoundError(err, id);
  }
}

async function unpinSessionFormatted(id: string, json?: boolean): Promise<void> {
  try {
    const result = await unpinSession(id);
    if (json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    if (result.alreadyPinned) {
      console.log(chalk.green('✓') + ` Unpinned session ${id}`);
      return;
    }
    console.log(chalk.yellow('!') + ` Session ${id} was not pinned`);
  } catch (err) {
    handleNotFoundError(err, id);
  }
}

async function listPinsFormatted(json?: boolean): Promise<void> {
  const pinned = await listPinnedSessions();
  if (json) {
    console.log(JSON.stringify(pinned, null, 2));
    return;
  }
  if (pinned.length === 0) {
    console.log(chalk.dim('No pinned sessions.'));
    return;
  }
  console.log(chalk.dim(`Pinned sessions (${pinned.length}):\n`));
  printSessionTable(pinned);
}

async function retentionGetFormatted(json?: boolean): Promise<void> {
  const policy = await getRetentionPolicy();
  if (json) {
    console.log(JSON.stringify(policy, null, 2));
    return;
  }
  console.log(chalk.bold('Session retention policy'));
  console.log(`  days: ${policy.days}`);
  console.log(`  preservePinned: ${policy.preservePinned}`);
}

async function retentionSetFormatted(daysInput: string, opts?: SessionsOptions): Promise<void> {
  const days = parseRetentionDays(daysInput);
  const preservePinned = parseBooleanFlag(opts?.preservePinned, '--preserve-pinned');
  const policy = await setRetentionPolicy({
    days,
    ...(preservePinned === undefined ? {} : { preservePinned }),
  });

  if (opts?.json) {
    console.log(JSON.stringify(policy, null, 2));
    return;
  }
  console.log(chalk.green('✓') + ' Updated session retention policy');
  console.log(`  days: ${policy.days}`);
  console.log(`  preservePinned: ${policy.preservePinned}`);
}

interface PruneReport {
  dryRun: boolean;
  policy: SessionRetentionPolicy;
  cutoff: string;
  scanned: number;
  preservedPinned: number;
  candidateCount: number;
  candidateIds: string[];
  keptCount: number;
  prunedCount: number;
  prunedIds: string[];
}

async function pruneSessionsFormatted(opts?: SessionsOptions): Promise<void> {
  const dryRun = parseBooleanFlag(opts?.dryRun, '--dry-run') ?? false;

  let report: PruneReport;
  if (dryRun) {
    const plan = await planSessionPrune();
    report = {
      dryRun: true,
      policy: plan.policy,
      cutoff: plan.cutoff,
      scanned: plan.scanned,
      preservedPinned: plan.preservedPinned,
      candidateCount: plan.candidates.length,
      candidateIds: plan.candidates.map((session) => session.id),
      keptCount: plan.kept.length,
      prunedCount: 0,
      prunedIds: [],
    };
  } else {
    const result = await applySessionPrune();
    report = {
      dryRun: false,
      policy: result.policy,
      cutoff: result.cutoff,
      scanned: result.scanned,
      preservedPinned: result.preservedPinned,
      candidateCount: result.candidates.length,
      candidateIds: result.candidates.map((session) => session.id),
      keptCount: result.kept.length,
      prunedCount: result.pruned.length,
      prunedIds: result.pruned.map((session) => session.id),
    };
  }

  if (opts?.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  const heading = report.dryRun ? 'Session prune plan (dry-run)' : 'Session prune complete';
  console.log(chalk.bold(heading));
  console.log(`  cutoff: ${report.cutoff}`);
  console.log(`  policy.days: ${report.policy.days}`);
  console.log(`  policy.preservePinned: ${report.policy.preservePinned}`);
  console.log(`  scanned: ${report.scanned}`);
  console.log(`  preservedPinned: ${report.preservedPinned}`);
  console.log(`  candidates: ${report.candidateCount}`);
  console.log(`  pruned: ${report.prunedCount}`);
  if (report.candidateIds.length > 0) {
    console.log(chalk.dim(`  candidateIds: ${report.candidateIds.join(', ')}`));
  }
}

function printSessionTable(items: SessionSummary[]): void {
  console.log(
    chalk.bold('  ID        Title                          Model           Date         Messages')
  );

  for (const session of items) {
    const shortId = session.id.slice(0, 8).padEnd(8);
    const title = session.title.slice(0, 30).padEnd(30);
    const model = session.model.slice(0, 15).padEnd(15);
    const date = formatRelativeDate(session.created).padEnd(12);
    const count = String(session.messageCount).padStart(4);
    const tags = session.tags?.length ? chalk.dim(` [${session.tags.join(', ')}]`) : '';
    console.log(`  ${shortId}  ${title} ${model} ${date} ${count}${tags}`);
  }
}

function handleNotFoundError(err: unknown, id: string): never {
  if (isSessionNotFound(err)) {
    console.error(chalk.red('✗') + ` Session not found: ${id}`);
    throw new ExitError(EXIT.NOT_FOUND);
  }
  throw err;
}

function isSessionNotFound(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /session not found/i.test(message) || /ENOENT/i.test(message);
}

function parseRetentionDays(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    console.error(chalk.red('✗') + ` Invalid retention days: ${value}`);
    throw new ExitError(EXIT.MISUSE);
  }
  return parsed;
}

function parseBooleanFlag(
  value: string | boolean | undefined,
  flagName: string
): boolean | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'boolean') return value;

  const normalized = value.trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;

  console.error(chalk.red('✗') + ` Invalid value for ${flagName}: ${value}`);
  throw new ExitError(EXIT.MISUSE);
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

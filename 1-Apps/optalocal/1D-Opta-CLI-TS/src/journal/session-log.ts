import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, isAbsolute } from 'node:path';
import { hostname } from 'node:os';
import { execa } from 'execa';
import type { Session } from '../memory/store.js';

export interface SessionLogOptions {
  cwd?: string;
  logsDir?: string;
  user?: string;
  device?: string;
  timezone?: string;
  now?: Date;
}

export interface SessionLogResult {
  path: string;
  fileName: string;
}

interface FileChanges {
  created: Set<string>;
  modified: Set<string>;
  deleted: Set<string>;
}

interface DateTimeParts {
  date: string;
  time: string;
  compactTime: string;
}

const DEFAULT_LOGS_DIR = '12-Session-Logs';

function safeEnvUser(): string {
  return process.env['USER'] ?? process.env['USERNAME'] ?? 'unknown';
}

function safeDeviceName(): string {
  const raw = process.env['OPTA_DEVICE'] ?? hostname() ?? 'device';
  return raw.split('.')[0] ?? raw;
}

function toSessionText(input: Session['messages'][number]['content']): string {
  if (typeof input === 'string') return input;
  if (!Array.isArray(input)) return '';

  return input
    .map((part) => {
      if (part && typeof part === 'object' && 'type' in part && part.type === 'text' && 'text' in part) {
        const text = part.text;
        return typeof text === 'string' ? text : '';
      }
      return '';
    })
    .filter(Boolean)
    .join('\n');
}

function slugify(raw: string, fallback: string, maxLength = 48): string {
  const normalized = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

  if (!normalized) return fallback;
  return normalized.slice(0, maxLength).replace(/-+$/g, '') || fallback;
}

export function buildSessionLogFileName(
  parts: DateTimeParts,
  device: string,
  summary: string,
): string {
  const safeDevice = slugify(device, 'device', 24);
  const safeSummary = slugify(summary, 'session', 56);
  return `${parts.date}-${parts.compactTime}-${safeDevice}-${safeSummary}.md`;
}

function formatDuration(startIso: string | undefined, end: Date): string {
  const startMs = startIso ? Date.parse(startIso) : NaN;
  const endMs = end.getTime();
  const totalSeconds = Number.isFinite(startMs) ? Math.max(0, Math.round((endMs - startMs) / 1000)) : 0;

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function localDateTimeParts(date: Date): DateTimeParts {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');

  return {
    date: `${year}-${month}-${day}`,
    time: `${hour}:${minute}`,
    compactTime: `${hour}${minute}`,
  };
}

function zonedDateTimeParts(date: Date, timezone?: string): DateTimeParts {
  if (!timezone || timezone === 'local') {
    return localDateTimeParts(date);
  }

  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

    const mapped = Object.fromEntries(
      formatter
        .formatToParts(date)
        .filter((part) => part.type !== 'literal')
        .map((part) => [part.type, part.value]),
    ) as Record<string, string>;

    const year = mapped['year'];
    const month = mapped['month'];
    const day = mapped['day'];
    const hour = mapped['hour'];
    const minute = mapped['minute'];

    if (!year || !month || !day || !hour || !minute) {
      return localDateTimeParts(date);
    }

    return {
      date: `${year}-${month}-${day}`,
      time: `${hour}:${minute}`,
      compactTime: `${hour}${minute}`,
    };
  } catch {
    return localDateTimeParts(date);
  }
}

async function detectRepoRoot(cwd: string): Promise<string> {
  const result = await execa('git', ['rev-parse', '--show-toplevel'], {
    cwd,
    reject: false,
  });

  if (result.exitCode === 0 && result.stdout.trim()) {
    return result.stdout.trim();
  }

  return cwd;
}

async function resolveLogsDir(baseCwd: string, configuredDir?: string): Promise<string> {
  const root = await detectRepoRoot(baseCwd);
  const dir = configuredDir?.trim() || DEFAULT_LOGS_DIR;
  return isAbsolute(dir) ? dir : join(root, dir);
}

export function parseGitStatusPorcelain(output: string): FileChanges {
  const created = new Set<string>();
  const modified = new Set<string>();
  const deleted = new Set<string>();

  for (const line of output.split('\n')) {
    if (!line.trim()) continue;
    const status = line.slice(0, 2);
    if (status.length < 2) continue;

    let file = line.slice(3).trim();
    if (!file) continue;

    if (status.includes('R') || status.includes('C')) {
      const renamedTo = file.split(' -> ').pop();
      if (renamedTo) file = renamedTo.trim();
    }

    if (status === '??' || status.includes('A')) {
      created.add(file);
      continue;
    }

    if (status.includes('D')) {
      deleted.add(file);
      continue;
    }

    modified.add(file);
  }

  return { created, modified, deleted };
}

async function collectGitChanges(cwd: string): Promise<FileChanges> {
  const result = await execa('git', ['status', '--porcelain'], {
    cwd,
    reject: false,
  });

  if (result.exitCode !== 0) {
    return { created: new Set(), modified: new Set(), deleted: new Set() };
  }

  return parseGitStatusPorcelain(result.stdout);
}

async function collectCheckpointPaths(cwd: string, sessionId: string): Promise<string[]> {
  const indexPath = join(cwd, '.opta', 'checkpoints', sessionId, 'index.json');

  try {
    const raw = await readFile(indexPath, 'utf-8');
    const parsed = JSON.parse(raw) as {
      checkpoints?: Array<{ path?: unknown }>;
    };

    return (parsed.checkpoints ?? [])
      .map((checkpoint) => checkpoint.path)
      .filter((path): path is string => typeof path === 'string' && path.trim().length > 0);
  } catch {
    return [];
  }
}

function mergeCheckpointPaths(changes: FileChanges, checkpointPaths: string[]): void {
  for (const path of checkpointPaths) {
    if (changes.created.has(path) || changes.modified.has(path) || changes.deleted.has(path)) continue;
    changes.modified.add(path);
  }
}

function markdownList(items: string[]): string {
  if (items.length === 0) return '- (none)';
  return items.map((item) => `- ${item}`).join('\n');
}

function extractIssues(session: Session): string[] {
  const issues: string[] = [];
  const issueRegex = /\b(error|failed|failure|exception|timeout|denied|invalid)\b/i;

  for (const message of session.messages ?? []) {
    const text = toSessionText(message.content).trim();
    if (!text) continue;
    if (!issueRegex.test(text)) continue;

    const compact = text.replace(/\s+/g, ' ').slice(0, 160);
    issues.push(compact);
    if (issues.length >= 5) break;
  }

  return issues;
}

function extractDecisions(session: Session): string[] {
  const decisions: string[] = [];
  const decisionRegex = /\b(decision|decided|choose|selected|plan|approach)\b/i;

  for (const message of session.messages ?? []) {
    if (message.role !== 'assistant') continue;
    const text = toSessionText(message.content).trim();
    if (!text) continue;
    if (!decisionRegex.test(text)) continue;

    const compact = text.replace(/\s+/g, ' ').slice(0, 160);
    decisions.push(compact);
    if (decisions.length >= 5) break;
  }

  return decisions;
}

function extractNextSteps(session: Session): string[] {
  const assistantMessages = (session.messages ?? []).filter((message) => message.role === 'assistant');
  const lastAssistant = assistantMessages[assistantMessages.length - 1];
  const text = lastAssistant ? toSessionText(lastAssistant.content).trim() : '';

  if (!text) {
    return ['Continue from the latest session context.'];
  }

  const compact = text.replace(/\s+/g, ' ');
  const sentence = compact.split(/(?<=[.!?])\s+/)[0] ?? compact;
  return [sentence.slice(0, 180)];
}

function renderSessionLogMarkdown(params: {
  session: Session;
  dateTime: DateTimeParts;
  user: string;
  device: string;
  duration: string;
  changes: FileChanges;
  checkpointCount: number;
}): string {
  const { session, dateTime, user, device, duration, changes, checkpointCount } = params;

  const userMessageCount = (session.messages ?? []).filter((message) => message.role === 'user').length;
  const assistantMessageCount = (session.messages ?? []).filter((message) => message.role === 'assistant').length;
  const issues = extractIssues(session);
  const decisions = extractDecisions(session);
  const nextSteps = extractNextSteps(session);

  const created = [...changes.created].sort();
  const modified = [...changes.modified].sort();
  const deleted = [...changes.deleted].sort();

  const tagLine = Array.isArray(session.tags) && session.tags.length > 0 ? session.tags.join(', ') : '(none)';

  return `---
date: ${dateTime.date}
time: ${dateTime.time}
device: ${device}
user: ${user}
model: ${session.model || 'unknown'}
duration: ${duration}
---

## Summary
- Session: ${session.id}
- Title: ${session.title || '(untitled)'}
- Messages: user=${userMessageCount}, assistant=${assistantMessageCount}
- Tool calls: ${session.toolCallCount ?? 0}

## Files Changed
### Created
${markdownList(created)}

### Modified
${markdownList(modified)}

### Deleted
${markdownList(deleted)}

## Status Changes
- Created: ${session.created || '(unknown)'}
- Updated: ${session.updated || '(unknown)'}
- Compacted: ${session.compacted ? 'yes' : 'no'}
- Checkpoints: ${checkpointCount}

## Decisions Made
${markdownList(decisions)}

## Issues Encountered
${markdownList(issues)}

## Next Steps
${markdownList(nextSteps)}

## Notes
- CWD: ${session.cwd || process.cwd()}
- Tags: ${tagLine}
`;
}

async function writeUniqueFile(dir: string, fileName: string, content: string): Promise<string> {
  const baseName = fileName.replace(/\.md$/, '');

  for (let attempt = 0; attempt < 50; attempt++) {
    const suffix = attempt === 0 ? '' : `-${attempt + 1}`;
    const candidate = join(dir, `${baseName}${suffix}.md`);

    try {
      await writeFile(candidate, content, { encoding: 'utf-8', flag: 'wx' });
      return candidate;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'EEXIST') continue;
      throw err;
    }
  }

  throw new Error(`Unable to create unique session log file for ${fileName}`);
}

export async function writeSessionLog(
  session: Session,
  options: SessionLogOptions = {},
): Promise<SessionLogResult> {
  const now = options.now ?? new Date();
  const timezone = options.timezone ?? 'local';
  const dateTime = zonedDateTimeParts(now, timezone);
  const user = options.user?.trim() || safeEnvUser();
  const device = options.device?.trim() || safeDeviceName();
  const baseCwd = options.cwd ?? session.cwd ?? process.cwd();
  const logsDir = await resolveLogsDir(baseCwd, options.logsDir);

  await mkdir(logsDir, { recursive: true });

  const summarySource = session.title || session.id || 'session';
  const fileName = buildSessionLogFileName(dateTime, device, summarySource);
  const changes = await collectGitChanges(baseCwd);
  const checkpointPaths = await collectCheckpointPaths(baseCwd, session.id);
  mergeCheckpointPaths(changes, checkpointPaths);

  const duration = formatDuration(session.created, now);
  const markdown = renderSessionLogMarkdown({
    session,
    dateTime,
    user,
    device,
    duration,
    changes,
    checkpointCount: checkpointPaths.length,
  });

  const path = await writeUniqueFile(logsDir, fileName, markdown);

  return {
    path,
    fileName: path.split('/').pop() ?? fileName,
  };
}

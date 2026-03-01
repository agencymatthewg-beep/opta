import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import { execa } from 'execa';

export interface UpdateStep {
  target: string;
  component: string;
  step: string;
  status: string;
  message: string;
}

export interface UpdateLogInput {
  summary: string;
  commandInputs: Record<string, unknown>;
  steps: UpdateStep[];
  cwd?: string;
  logsDir?: string;
  timezone?: string;
  author?: string;
  rangeStart?: number;
  rangeEnd?: number;
  slug?: string;
  versionBefore?: string;
  versionAfter?: string;
  commit?: string;
  promoted?: boolean;
  category?: string;
  now?: Date;
}

export interface UpdateLogResult {
  id: number;
  path: string;
  fileName: string;
}

interface DateTimeParts {
  date: string;
  time: string;
}

const DEFAULT_LOGS_DIR = 'updates';

function safeAuthor(): string {
  return process.env['USER'] ?? process.env['USERNAME'] ?? 'unknown';
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
        .map((part) => [part.type, part.value])
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

function slugify(raw: string, fallback = 'update', maxLength = 60): string {
  const normalized = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

  if (!normalized) return fallback;
  return normalized.slice(0, maxLength).replace(/-+$/g, '') || fallback;
}

export function buildUpdateLogFileName(id: number, date: string, slug: string): string {
  const padded = String(id).padStart(3, '0');
  const safeSlug = slugify(slug, 'update');
  return `${padded}_${date}_${safeSlug}.md`;
}

function parseExistingUpdateIds(files: string[]): number[] {
  const ids: number[] = [];

  for (const file of files) {
    const match = file.match(/^(\d{3})_\d{4}-\d{2}-\d{2}_.+\.md$/);
    if (!match) continue;

    const id = Number.parseInt(match[1]!, 10);
    if (Number.isFinite(id)) ids.push(id);
  }

  return ids;
}

export async function allocateNextUpdateId(
  dir: string,
  rangeStart = 1,
  rangeEnd = 999
): Promise<number> {
  await mkdir(dir, { recursive: true });

  const files = await readdir(dir).catch(() => [] as string[]);
  const ids = parseExistingUpdateIds(files).filter((id) => id >= rangeStart && id <= rangeEnd);
  const currentMax = ids.length > 0 ? Math.max(...ids) : rangeStart - 1;
  const next = currentMax + 1;

  if (next > rangeEnd) {
    throw new Error(`Update ID range exhausted (${rangeStart}-${rangeEnd})`);
  }

  return next;
}

async function resolveVersion(baseCwd: string): Promise<string> {
  const packagePath = join(baseCwd, 'package.json');

  try {
    const raw = await readFile(packagePath, 'utf-8');
    const parsed = JSON.parse(raw) as { version?: unknown };
    return typeof parsed.version === 'string' ? parsed.version : 'unknown';
  } catch {
    return 'unknown';
  }
}

async function resolveCommit(baseCwd: string): Promise<string> {
  const result = await execa('git', ['rev-parse', '--short', 'HEAD'], {
    cwd: baseCwd,
    reject: false,
  });

  if (result.exitCode === 0 && result.stdout.trim()) {
    return result.stdout.trim();
  }

  return 'unknown';
}

function stringifyCommandInputs(commandInputs: Record<string, unknown>): string {
  const keys = Object.keys(commandInputs).sort();
  if (keys.length === 0) return '- (none)';

  return keys
    .map((key) => {
      const value = commandInputs[key];
      if (value === undefined) return `- \`${key}\`: (unset)`;
      if (typeof value === 'object') return `- \`${key}\`: \`${JSON.stringify(value)}\``;
      return `- \`${key}\`: \`${String(value as string | number | boolean | symbol | bigint)}\``;
    })
    .join('\n');
}

function summarizeSteps(steps: UpdateStep[]): { ok: number; skip: number; fail: number } {
  let ok = 0;
  let skip = 0;
  let fail = 0;

  for (const step of steps) {
    if (step.status === 'ok') ok++;
    else if (step.status === 'skip') skip++;
    else if (step.status === 'fail') fail++;
  }

  return { ok, skip, fail };
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\n+/g, ' ').trim();
}

function renderStepTable(steps: UpdateStep[]): string {
  if (steps.length === 0) return '- (no steps recorded)';

  const lines = [
    '| Target | Component | Step | Status | Message |',
    '| --- | --- | --- | --- | --- |',
  ];

  for (const step of steps) {
    lines.push(
      `| ${escapeCell(step.target)} | ${escapeCell(step.component)} | ${escapeCell(step.step)} | ${escapeCell(step.status)} | ${escapeCell(step.message)} |`
    );
  }

  return lines.join('\n');
}

function renderUpdateLogMarkdown(params: {
  id: number;
  dateTime: DateTimeParts;
  author: string;
  versionBefore: string;
  versionAfter: string;
  commit: string;
  promoted: boolean;
  category: string;
  summary: string;
  commandInputs: Record<string, unknown>;
  steps: UpdateStep[];
}): string {
  const {
    id,
    dateTime,
    author,
    versionBefore,
    versionAfter,
    commit,
    promoted,
    category,
    summary,
    commandInputs,
    steps,
  } = params;

  const counts = summarizeSteps(steps);

  return `---
id: ${String(id).padStart(3, '0')}
date: ${dateTime.date}
time: ${dateTime.time}
author: ${author}
version_before: ${versionBefore}
version_after: ${versionAfter}
commit: ${commit}
promoted: ${promoted}
category: ${category}
---

## Summary
- ${summary}
- Steps: total=${steps.length}, ok=${counts.ok}, skip=${counts.skip}, fail=${counts.fail}

## Command Inputs
${stringifyCommandInputs(commandInputs)}

## Step Results
${renderStepTable(steps)}
`;
}

export async function writeUpdateLog(input: UpdateLogInput): Promise<UpdateLogResult> {
  const now = input.now ?? new Date();
  const timezone = input.timezone ?? 'local';
  const dateTime = zonedDateTimeParts(now, timezone);
  const rangeStart = input.rangeStart ?? 1;
  const rangeEnd = input.rangeEnd ?? 999;
  const baseCwd = input.cwd ?? process.cwd();
  const repoRoot = await detectRepoRoot(baseCwd);
  const logsDir = await resolveLogsDir(baseCwd, input.logsDir);
  const author = input.author?.trim() || safeAuthor();
  const promoted = input.promoted ?? rangeStart >= 200;
  const category = input.category ?? (promoted ? 'promotion' : 'development');

  await mkdir(logsDir, { recursive: true });

  const versionBefore = input.versionBefore ?? (await resolveVersion(repoRoot));
  const versionAfter = input.versionAfter ?? (await resolveVersion(repoRoot));
  const commit = input.commit ?? (await resolveCommit(repoRoot));

  for (let attempt = 0; attempt < 60; attempt++) {
    const id = await allocateNextUpdateId(logsDir, rangeStart, rangeEnd);
    const slugSource = input.slug || input.summary;
    const fileName = buildUpdateLogFileName(id, dateTime.date, slugSource);
    const path = join(logsDir, fileName);

    const markdown = renderUpdateLogMarkdown({
      id,
      dateTime,
      author,
      versionBefore,
      versionAfter,
      commit,
      promoted,
      category,
      summary: input.summary,
      commandInputs: input.commandInputs,
      steps: input.steps,
    });

    try {
      await writeFile(path, markdown, { encoding: 'utf-8', flag: 'wx' });
      return { id, path, fileName };
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'EEXIST') continue;
      throw err;
    }
  }

  throw new Error('Unable to allocate update log ID after multiple attempts');
}

import { readFile, writeFile, readdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve, relative } from 'node:path';
import { realpathSync } from 'node:fs';
import chalk from 'chalk';
import { debug } from '../debug.js';
import { errorMessage } from '../../utils/errors.js';
import type { OptaConfig } from '../config.js';
import { ProcessManager, type ProcessStatus } from '../background.js';
import { DEFAULT_IGNORE_DIRS } from '../../utils/ignore.js';
import { shellArgs } from '../../platform/index.js';
import { resetSharedBrowserRuntimeDaemonForTests } from '../../browser/runtime-daemon.js';
import { appendLedgerEntry, learningLedgerPath, readLedgerEntries } from '../../learning/ledger.js';
import { retrieveTopLedgerEntries } from '../../learning/retrieval.js';
import { summarizeLedgerByDate } from '../../learning/summarizer.js';
import type { CaptureLevel, LearningEntryKind, LearningLedgerEntry } from '../../learning/types.js';
import { checkResearchProviderHealth } from '../../research/health.js';
import { routeResearchQuery } from '../../research/router.js';
import type { ResearchProviderId, ResearchQueryIntent } from '../../research/types.js';

// --- Error Recovery Hints ---

/**
 * Map common error codes/messages to actionable recovery hints.
 * Returns a user-friendly message with a concrete next step.
 * Includes dim slash command suggestions for in-REPL recovery.
 */
export function enrichError(error: unknown): string {
  const message = errorMessage(error);
  const code = (error as NodeJS.ErrnoException).code;

  // Network: connection refused
  if (
    code === 'ECONNREFUSED' ||
    message.includes('ECONNREFUSED') ||
    message.includes('fetch failed')
  ) {
    return (
      `${message}\n  Hint: LMX unreachable \u2014 check connection with /status or run opta doctor` +
      chalk.dim('\n  Try: /status or /serve status')
    );
  }

  // Network: timeout
  if (
    code === 'ETIMEDOUT' ||
    message.includes('ETIMEDOUT') ||
    message.includes('AbortError') ||
    message.includes('timed out')
  ) {
    return (
      `${message}\n  Hint: Request timed out \u2014 LMX may be overloaded. Try: opta status` +
      chalk.dim('\n  Try: /status')
    );
  }

  // Network: DNS resolution failure
  if (code === 'ENOTFOUND' || message.includes('ENOTFOUND')) {
    return (
      `${message}\n  Hint: Host not found \u2014 check connection.host in config: opta config list` +
      chalk.dim('\n  Try: /config search connection')
    );
  }

  // File: permission denied
  if (code === 'EACCES' || message.includes('EACCES') || message.includes('permission denied')) {
    return (
      `${message}\n  Hint: Permission denied \u2014 check file permissions or run with appropriate access` +
      chalk.dim('\n  Try: /permissions to review tool access levels')
    );
  }

  // File: not found
  if (code === 'ENOENT' || message.includes('ENOENT') || message.includes('no such file')) {
    // Try to extract the path from the error message
    const pathMatch = message.match(/'([^']+)'/);
    const parentDir = pathMatch?.[1]?.split('/').slice(0, -1).join('/');
    const hint = parentDir
      ? `Hint: File not found \u2014 verify the path exists: ls ${parentDir}`
      : 'Hint: File not found \u2014 verify the path exists';
    return `${message}\n  ${hint}` + chalk.dim('\n  Try: /diff to see recent changes');
  }

  // File: directory not empty
  if (code === 'ENOTEMPTY' || message.includes('ENOTEMPTY')) {
    return `${message}\n  Hint: Directory not empty \u2014 remove contents first or use recursive delete`;
  }

  // File: path is a directory
  if (code === 'EISDIR' || message.includes('EISDIR')) {
    return `${message}\n  Hint: Path is a directory, not a file \u2014 check the target path`;
  }

  // Process: command not found
  if (
    message.includes('command not found') ||
    (message.includes('not found') && message.includes('sh:'))
  ) {
    return (
      `${message}\n  Hint: Command not found \u2014 check spelling or install the missing tool` +
      chalk.dim('\n  Try: /doctor for diagnostics')
    );
  }

  // Path traversal
  if (message.includes('Path traversal blocked')) {
    return `${message}\n  Hint: Tool can only access files within the working directory`;
  }

  // Unknown errors get a generic diagnostic suggestion
  return message + chalk.dim('\n  Try: /doctor for diagnostics');
}

const RESEARCH_INTENTS: ResearchQueryIntent[] = ['general', 'news', 'academic', 'coding'];
const RESEARCH_INTENT_SET = new Set<ResearchQueryIntent>(RESEARCH_INTENTS);
const RESEARCH_PROVIDER_IDS: ResearchProviderId[] = ['tavily', 'gemini', 'exa', 'brave', 'groq'];
const RESEARCH_PROVIDER_SET = new Set<ResearchProviderId>(RESEARCH_PROVIDER_IDS);

const LEARNING_KINDS: LearningEntryKind[] = [
  'plan',
  'problem',
  'solution',
  'reflection',
  'research',
];
const LEARNING_KIND_SET = new Set<LearningEntryKind>(LEARNING_KINDS);

const CAPTURE_LEVELS: CaptureLevel[] = ['exhaustive', 'balanced', 'lean'];
const CAPTURE_LEVEL_SET = new Set<CaptureLevel>(CAPTURE_LEVELS);

function toPositiveInt(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}


function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter((item) => item.length > 0);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function toSafeString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return fallback;
}

function getStringArg(args: Record<string, unknown>, key: string, fallback = ''): string {
  return toSafeString(args[key], fallback);
}

function getOptionalStringArg(args: Record<string, unknown>, key: string): string | undefined {
  const value = args[key];
  if (value === undefined || value === null) return undefined;
  const normalized = toSafeString(value).trim();
  return normalized.length > 0 ? normalized : undefined;
}

function parseArgsJson(
  argsJson: string
): { args: Record<string, unknown> } | { parsedType: string } {
  const parsed: unknown = JSON.parse(argsJson);
  if (isRecord(parsed)) {
    return { args: parsed };
  }
  return { parsedType: typeof parsed };
}

function parseResearchIntent(value: unknown): ResearchQueryIntent {
  const raw = toSafeString(value, 'general').trim().toLowerCase() as ResearchQueryIntent;
  if (RESEARCH_INTENT_SET.has(raw)) return raw;
  return 'general';
}

function parseProviderOrder(value: unknown): ResearchProviderId[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const parsed = value
    .map((item) => String(item).trim().toLowerCase() as ResearchProviderId)
    .filter((item) => RESEARCH_PROVIDER_SET.has(item));
  if (parsed.length === 0) return undefined;
  return Array.from(new Set(parsed));
}

function parseLearningKind(value: unknown): LearningEntryKind {
  const raw = toSafeString(value, 'reflection').trim().toLowerCase() as LearningEntryKind;
  if (LEARNING_KIND_SET.has(raw)) return raw;
  return 'reflection';
}

function parseCaptureLevel(value: unknown, fallback: CaptureLevel): CaptureLevel {
  const raw = toSafeString(value, fallback).trim().toLowerCase() as CaptureLevel;
  if (CAPTURE_LEVEL_SET.has(raw)) return raw;
  return fallback;
}

function parseLearningEvidence(value: unknown): LearningLedgerEntry['evidence'] {
  if (!Array.isArray(value)) return [];
  const evidence: LearningLedgerEntry['evidence'] = [];
  for (const item of value) {
    if (!isRecord(item)) continue;
    const label = toSafeString(item['label']).trim();
    const uri = toSafeString(item['uri']).trim();
    if (!label || !uri) continue;
    evidence.push({ label, uri });
  }
  return evidence;
}

function compactText(value: string, maxChars: number): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, maxChars)}...`;
}


export async function resetBrowserRuntimeForTests(): Promise<void> {
  await resetSharedBrowserRuntimeDaemonForTests();
}

// --- Tool Executors ---

export async function executeTool(name: string, argsJson: string): Promise<string> {
  let args: Record<string, unknown>;
  try {
    const parsed = parseArgsJson(argsJson);
    if ('parsedType' in parsed) {
      return `Error: Invalid JSON arguments: expected object, received ${parsed.parsedType}`;
    }
    args = parsed.args;
  } catch (err) {
    return `Error: Invalid JSON arguments: ${argsJson} - ${errorMessage(err)}`;
  }

  debug(`Executing tool: ${name}(${JSON.stringify(args)})`);

  try {
    switch (name) {
      case 'read_file':
        return await execReadFile(args);
      case 'write_file':
        return await execWriteFile(args);
      case 'edit_file':
        return await execEditFile(args);
      case 'list_dir':
        return await execListDir(args);
      case 'search_files':
        return await execSearchFiles(args);
      case 'find_files':
        return await execFindFiles(args);
      case 'run_command':
        return await execRunCommand(args);
      case 'ask_user':
        return await execAskUser(args);
      case 'read_project_docs':
        return await execReadProjectDocs(args);
      case 'web_search':
        return await execWebSearch(args);
      case 'web_fetch':
        return await execWebFetch(args);
      case 'research_query':
        return await execResearchQuery(args);
      case 'research_health':
        return await execResearchHealth();
      case 'learning_log':
        return await execLearningLog(args);
      case 'learning_summary':
        return await execLearningSummary(args);
      case 'learning_retrieve':
        return await execLearningRetrieve(args);
      case 'delete_file':
        return await execDeleteFile(args);
      case 'multi_edit':
        return await execMultiEdit(args);
      case 'save_memory':
        return await execSaveMemory(args);
      case 'bg_start':
        return await execBgStart(args);
      case 'bg_status':
        return execBgStatus(args);
      case 'bg_output':
        return execBgOutput(args);
      case 'bg_kill':
        return await execBgKill(args);
      case 'browser_open': {
        const { loadConfig } = await import('../config.js');
        const runtimeConfig = await loadConfig();
        if (!runtimeConfig.browser?.enabled) {
          return JSON.stringify({ ok: false, code: 'BROWSER_DISABLED', message: 'Browser automation is not enabled (browser.enabled = false).' });
        }
        const sessionId = args['session_id'] ? String(args['session_id']) : undefined;
        const useAttach = runtimeConfig.browser.attach?.enabled ?? false;
        const mode = useAttach ? 'attach' : (runtimeConfig.browser.mode ?? 'isolated');
        const wsEndpoint = String(runtimeConfig.browser.attach?.wsEndpoint ?? '').trim();
        if (mode === 'attach' && !wsEndpoint) {
          return JSON.stringify({ ok: false, code: 'OPEN_SESSION_FAILED', message: 'Attach mode requires ws_endpoint — set browser.attach.wsEndpoint in config.' });
        }
        try {
          const { getSharedBrowserRuntimeDaemon } = await import('../../browser/runtime-daemon.js');
          const daemon = await getSharedBrowserRuntimeDaemon({ cwd: process.cwd() });
          const result = await daemon.openSession({
            sessionId,
            mode: mode as 'isolated' | 'attach',
            wsEndpoint: mode === 'attach' ? wsEndpoint : undefined,
          });
          if (!result.ok) {
            return JSON.stringify({ ok: false, code: 'OPEN_SESSION_FAILED', message: result.error?.message ?? 'Failed to open browser session.' });
          }
          return JSON.stringify({ ok: true, sessionId: result.data?.id });
        } catch (err) {
          return JSON.stringify({ ok: false, code: 'OPEN_SESSION_FAILED', message: errorMessage(err) });
        }
      }
      default:
        return `Error: Unknown tool "${name}"`;
    }
  } catch (err) {
    return `Error: ${enrichError(err)}`;
  }
}

// --- Path Traversal Guard ---

export function assertWithinCwd(resolvedPath: string): void {
  // Use realpathSync on cwd to resolve symlinks (e.g., macOS /var -> /private/var).
  // For the target path, try realpathSync first; if it doesn't exist yet, walk up
  // to the nearest existing ancestor and check from there.
  const cwd = realpathSync(process.cwd());
  let normalized: string;
  try {
    normalized = realpathSync(resolvedPath);
  } catch {
    // Path doesn't exist yet (e.g., write_file to new location).
    // Resolve without symlink expansion but normalize cwd-relative.
    normalized = resolve(cwd, resolvedPath);
  }
  if (!normalized.startsWith(cwd + '/') && normalized !== cwd) {
    throw new Error(
      `Path traversal blocked: "${normalized}" is outside working directory "${cwd}"`
    );
  }
}

// --- Individual Tool Implementations ---

async function execReadFile(args: Record<string, unknown>): Promise<string> {
  const path = resolve(getStringArg(args, 'path'));
  assertWithinCwd(path);
  const offset = Number(args['offset'] ?? 1);
  const limit = Number(args['limit'] ?? 0);

  const content = await readFile(path, 'utf-8');
  const lines = content.split('\n');

  const start = Math.max(0, offset - 1);
  const end = limit > 0 ? start + limit : lines.length;
  const slice = lines.slice(start, end);

  return slice.map((line, i) => `${start + i + 1}\t${line}`).join('\n');
}

async function execWriteFile(args: Record<string, unknown>): Promise<string> {
  const path = resolve(getStringArg(args, 'path'));
  assertWithinCwd(path);
  const content = getStringArg(args, 'content');

  const { mkdir } = await import('node:fs/promises');
  const pathModule = await import('node:path');
  await mkdir(pathModule.dirname(path), { recursive: true });
  await writeFile(path, content, 'utf-8');

  return `File written: ${relative(process.cwd(), path)} (${content.length} bytes)`;
}

async function execEditFile(args: Record<string, unknown>): Promise<string> {
  const path = resolve(getStringArg(args, 'path'));
  assertWithinCwd(path);
  const oldText = getStringArg(args, 'old_text');
  const newText = getStringArg(args, 'new_text');

  const content = await readFile(path, 'utf-8');

  const occurrences = content.split(oldText).length - 1;
  if (occurrences === 0) {
    return `Error: old_text not found in ${relative(process.cwd(), path)}`;
  }
  if (occurrences > 1) {
    return `Error: old_text appears ${occurrences} times in ${relative(process.cwd(), path)} — must be unique`;
  }

  const updated = content.replace(oldText, newText);
  await writeFile(path, updated, 'utf-8');

  return `File edited: ${relative(process.cwd(), path)}`;
}

async function execListDir(args: Record<string, unknown>): Promise<string> {
  const path = resolve(getStringArg(args, 'path', '.'));
  assertWithinCwd(path);
  const recursive = Boolean(args['recursive']);

  if (recursive) {
    const { default: fg } = await import('fast-glob');
    const files = await fg('**/*', {
      cwd: path,
      dot: false,
      onlyFiles: false,
      ignore: [...DEFAULT_IGNORE_DIRS],
    });
    return files.sort().join('\n') || '(empty directory)';
  }

  const entries = await readdir(path, { withFileTypes: true });
  return (
    entries
      .map((e) => (e.isDirectory() ? `${e.name}/` : e.name))
      .sort()
      .join('\n') || '(empty directory)'
  );
}

async function execSearchFiles(args: Record<string, unknown>): Promise<string> {
  const pattern = getStringArg(args, 'pattern');
  const searchPath = resolve(getStringArg(args, 'path', '.'));
  const glob = getOptionalStringArg(args, 'glob');

  // Try ripgrep first
  try {
    const { execa } = await import('execa');
    const rgArgs = ['-n', '--max-count', '50', '--color', 'never'];
    if (glob) rgArgs.push('--glob', glob);
    rgArgs.push(pattern, searchPath);

    const result = await execa('rg', rgArgs, { reject: false, timeout: 10000 });
    if (result.stdout) {
      // Make paths relative
      return result.stdout
        .split('\n')
        .map((line) => {
          const rel = relative(process.cwd(), line.split(':')[0] ?? '');
          const rest = line.substring((line.split(':')[0] ?? '').length);
          return rel + rest;
        })
        .join('\n');
    }
    if (result.exitCode === 1) return 'No matches found.';
  } catch (err) {
    debug(`ripgrep not available, falling back to basic search: ${errorMessage(err)}`);
  }

  // Fallback: fast-glob + readFile
  const { default: fg } = await import('fast-glob');
  const files = await fg(glob ?? '**/*', {
    cwd: searchPath,
    dot: false,
    ignore: [...DEFAULT_IGNORE_DIRS],
  });

  const results: string[] = [];
  const regex = new RegExp(pattern);

  for (const file of files.slice(0, 100)) {
    try {
      const fullPath = resolve(searchPath, file);
      const content = await readFile(fullPath, 'utf-8');
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line !== undefined && regex.test(line)) {
          results.push(`${file}:${i + 1}:${line}`);
          if (results.length >= 50) break;
        }
      }
    } catch {
      // Skip unreadable files
    }
    if (results.length >= 50) break;
  }

  return results.length > 0 ? results.join('\n') : 'No matches found.';
}

async function execFindFiles(args: Record<string, unknown>): Promise<string> {
  const pattern = getStringArg(args, 'pattern');
  const searchPath = resolve(getStringArg(args, 'path', '.'));

  const { default: fg } = await import('fast-glob');
  const files = await fg(pattern, {
    cwd: searchPath,
    dot: false,
    ignore: [...DEFAULT_IGNORE_DIRS],
  });

  return files.length > 0 ? files.sort().join('\n') : 'No files found.';
}

async function execRunCommand(args: Record<string, unknown>): Promise<string> {
  const command = getStringArg(args, 'command');
  const timeout = Number(args['timeout'] ?? 30000);

  const { execa } = await import('execa');
  const [shell, shellFlag] = shellArgs();
  const result = await execa(shell, [shellFlag, command], {
    reject: false,
    timeout,
    cwd: process.cwd(),
  });

  let output = '';
  if (result.stdout) output += result.stdout;
  if (result.stderr) output += (output ? '\n' : '') + `[stderr] ${result.stderr}`;
  output += `\n[exit code: ${result.exitCode}]`;

  return output;
}

async function execAskUser(args: Record<string, unknown>): Promise<string> {
  const question = getStringArg(args, 'question', 'What would you like to do?');

  const { input } = await import('@inquirer/prompts');
  const answer = await input({ message: question });

  return answer;
}

async function execReadProjectDocs(args: Record<string, unknown>): Promise<string> {
  const file = getStringArg(args, 'file');
  const { readProjectDoc } = await import('../../context/opis.js');
  return readProjectDoc(process.cwd(), file);
}

async function execWebSearch(args: Record<string, unknown>): Promise<string> {
  const query = getStringArg(args, 'query');
  const maxResults = Number(args['max_results'] ?? 5);

  let searxngUrl: string;
  try {
    const { loadConfig } = await import('../config.js');
    const config = await loadConfig();
    searxngUrl = config.search.searxngUrl;
  } catch {
    return 'Error: Could not load config for search URL. Run: opta config set search.searxngUrl <url>';
  }

  if (!searxngUrl) {
    return 'Error: No SearXNG URL configured. Run: opta config set search.searxngUrl <url>';
  }

  const url = `${searxngUrl}/search?q=${encodeURIComponent(query)}&format=json`;

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) return `Error: Search returned ${response.status}`;

    const data = (await response.json()) as {
      results?: Array<{ title: string; url: string; content: string }>;
    };
    const results = (data.results ?? []).slice(0, maxResults);

    if (results.length === 0) return 'No results found.';

    return results
      .map((r, i) => `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.content.slice(0, 200)}`)
      .join('\n\n');
  } catch (err) {
    return `Error: Search failed — ${errorMessage(err)}`;
  }
}

async function execWebFetch(args: Record<string, unknown>): Promise<string> {
  const url = getStringArg(args, 'url');
  const maxChars = Number(args['max_chars'] ?? 10000);

  // Security: only allow http:// and https:// URLs
  if (!/^https?:\/\//i.test(url)) {
    return `Error: Only http:// and https:// URLs are allowed (got "${url}")`;
  }

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: { 'User-Agent': 'Opta-CLI/0.1 (web-fetch)' },
    });
    if (!response.ok) return `Error: Fetch returned ${response.status}`;

    let html = await response.text();

    // Extract content from <main>, <article>, or <body> if present
    const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
    const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);

    if (mainMatch?.[1] !== undefined) {
      html = mainMatch[1];
    } else if (articleMatch?.[1] !== undefined) {
      html = articleMatch[1];
    } else if (bodyMatch?.[1] !== undefined) {
      html = bodyMatch[1];
    }

    // Simple HTML-to-text: strip tags, decode entities, collapse whitespace
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();

    return text.slice(0, maxChars);
  } catch (err) {
    return `Error: Fetch failed — ${errorMessage(err)}`;
  }
}

async function execResearchQuery(args: Record<string, unknown>): Promise<string> {
  const query = getStringArg(args, 'query').trim();
  if (!query) return 'Error: query is required';

  const intent = parseResearchIntent(args['intent']);
  const maxResults = toPositiveInt(args['max_results'], 5);
  const providerOrder = parseProviderOrder(args['provider_order']);

  const { loadConfig } = await import('../config.js');
  const config = await loadConfig();

  const result = await routeResearchQuery({ query, intent, maxResults }, { config, providerOrder });

  if (!result.ok) {
    return JSON.stringify({
      ok: false,
      code: result.error.code,
      message: result.error.message,
      attempts: result.attempts.map((attempt) => ({
        provider: attempt.provider,
        code: attempt.error.code,
      })),
    });
  }

  return JSON.stringify({
    ok: true,
    provider: result.provider,
    answer: compactText(result.result.answer, 1200),
    citations: result.result.citations.slice(0, maxResults).map((citation) => ({
      url: citation.url,
      title: citation.title ?? '',
      source: citation.source ?? '',
    })),
    attempts: result.attempts.map((attempt) => ({
      provider: attempt.provider,
      code: attempt.error.code,
    })),
  });
}

async function execResearchHealth(): Promise<string> {
  const { loadConfig } = await import('../config.js');
  const config = await loadConfig();
  const summary = await checkResearchProviderHealth({ config });

  const checks = [...summary.checks]
    .sort((a, b) => a.provider.localeCompare(b.provider))
    .map((check) => ({
      provider: check.provider,
      status: check.status,
      latency_ms: check.latencyMs,
      error_code: check.error?.code ?? null,
    }));

  return JSON.stringify({
    ok: summary.ok,
    checks,
  });
}


async function execLearningLog(args: Record<string, unknown>): Promise<string> {
  const topic = getStringArg(args, 'topic').trim();
  const content = getStringArg(args, 'content').trim();
  if (!topic) return 'Error: topic is required';
  if (!content) return 'Error: content is required';

  let defaultCaptureLevel: CaptureLevel = 'balanced';
  try {
    const { loadConfig } = await import('../config.js');
    const config = await loadConfig();
    defaultCaptureLevel = config.learning.captureLevel;
  } catch {
    // Fallback to deterministic local default.
  }

  const id = getStringArg(args, 'id').trim() || `learn-${Date.now()}-${randomUUID().slice(0, 8)}`;

  const tsInput = getOptionalStringArg(args, 'ts');
  const tsDate = tsInput ? new Date(tsInput) : new Date();
  if (Number.isNaN(tsDate.getTime())) {
    return 'Error: ts must be a valid date/time';
  }
  const ts = tsDate.toISOString();

  const entry: LearningLedgerEntry = {
    id,
    ts,
    kind: parseLearningKind(args['kind']),
    captureLevel: parseCaptureLevel(args['capture_level'], defaultCaptureLevel),
    topic,
    content,
    tags: Array.from(new Set(toStringArray(args['tags']))),
    evidence: parseLearningEvidence(args['evidence']),
    metadata: isRecord(args['metadata']) ? args['metadata'] : {},
  };

  await appendLedgerEntry(entry);

  return JSON.stringify({
    ok: true,
    id: entry.id,
    ts: entry.ts,
    kind: entry.kind,
    capture_level: entry.captureLevel,
    topic: entry.topic,
    ledger_path: learningLedgerPath(process.cwd()),
  });
}

async function execLearningSummary(args: Record<string, unknown>): Promise<string> {
  const entries = await readLedgerEntries();
  const summary = summarizeLedgerByDate(entries, {
    from: getOptionalStringArg(args, 'from'),
    to: getOptionalStringArg(args, 'to'),
  });

  const maxChars = toPositiveInt(args['max_chars'], 4000);
  if (summary.length <= maxChars) {
    return summary;
  }

  const truncated = summary.slice(0, maxChars).trimEnd();
  return `${truncated}\n...[truncated]`;
}

async function execLearningRetrieve(args: Record<string, unknown>): Promise<string> {
  const query = getStringArg(args, 'query').trim();
  if (!query) return 'Error: query is required';

  const limit = toPositiveInt(args['limit'], 5);
  const entries = await readLedgerEntries();
  const ranked = retrieveTopLedgerEntries(query, entries, limit).filter((item) => item.score > 0);

  return JSON.stringify({
    ok: true,
    query,
    count: ranked.length,
    results: ranked.map((item) => ({
      id: item.entry.id,
      ts: item.entry.ts,
      kind: item.entry.kind,
      topic: item.entry.topic,
      score: Number(item.score.toFixed(4)),
      content: compactText(item.entry.content, 240),
    })),
  });
}

async function execDeleteFile(args: Record<string, unknown>): Promise<string> {
  const filePath = resolve(getStringArg(args, 'path'));
  assertWithinCwd(filePath);
  const { unlink } = await import('node:fs/promises');
  await unlink(filePath);
  return `File deleted: ${relative(process.cwd(), filePath)}`;
}

async function execMultiEdit(args: Record<string, unknown>): Promise<string> {
  const editsRaw = args['edits'];
  const edits = Array.isArray(editsRaw)
    ? editsRaw.filter(
        (edit): edit is { path: string; old_text: string; new_text: string } =>
          isRecord(edit) &&
          typeof edit['path'] === 'string' &&
          typeof edit['old_text'] === 'string' &&
          typeof edit['new_text'] === 'string'
      )
    : [];

  if (edits.length === 0) return 'Error: No edits provided';
  if (edits.length > 20) return `Error: Too many edits (${edits.length}). Maximum 20 per call.`;

  // Group edits by file path, preserving original indices for error reporting
  const fileGroups = new Map<
    string,
    Array<{ index: number; old_text: string; new_text: string }>
  >();
  for (const [index, edit] of edits.entries()) {
    const filePath = resolve(edit.path);
    assertWithinCwd(filePath);
    const group = fileGroups.get(filePath) ?? [];
    group.push({ index, old_text: edit.old_text, new_text: edit.new_text });
    fileGroups.set(filePath, group);
  }

  let appliedCount = 0;
  const failures: string[] = [];
  const fileSummaries: string[] = [];

  for (const [filePath, group] of fileGroups) {
    let content: string;
    try {
      content = await readFile(filePath, 'utf-8');
    } catch (err) {
      // All edits for this file fail
      for (const edit of group) {
        failures.push(
          `edit #${edit.index + 1} in ${relative(process.cwd(), filePath)}: ${errorMessage(err)}`
        );
      }
      continue;
    }

    let fileApplied = 0;
    for (const edit of group) {
      const occurrences = content.split(edit.old_text).length - 1;
      if (occurrences === 0) {
        failures.push(
          `edit #${edit.index + 1} in ${relative(process.cwd(), filePath)}: old_text not found`
        );
        continue;
      }
      if (occurrences > 1) {
        failures.push(
          `edit #${edit.index + 1} in ${relative(process.cwd(), filePath)}: old_text appears ${occurrences} times (must be unique)`
        );
        continue;
      }
      content = content.replace(edit.old_text, edit.new_text);
      fileApplied++;
    }

    if (fileApplied > 0) {
      await writeFile(filePath, content, 'utf-8');
      fileSummaries.push(
        `${relative(process.cwd(), filePath)} (${fileApplied} edit${fileApplied > 1 ? 's' : ''})`
      );
      appliedCount += fileApplied;
    }
  }

  const total = edits.length;
  let result = `Applied ${appliedCount}/${total} edits across ${fileGroups.size} file${fileGroups.size > 1 ? 's' : ''}: ${fileSummaries.join(', ')}`;

  if (failures.length > 0) {
    result += `\nFailed: ${failures.join('; ')}`;
  }

  return result;
}

async function execSaveMemory(args: Record<string, unknown>): Promise<string> {
  const content = getStringArg(args, 'content');
  const category = getStringArg(args, 'category', 'note');
  const timestamp = new Date().toISOString().split('T')[0];

  const memoryPath = resolve(process.cwd(), '.opta', 'memory.md');

  const { mkdir } = await import('node:fs/promises');
  const pathModule = await import('node:path');
  await mkdir(pathModule.dirname(memoryPath), { recursive: true });

  let existing = '';
  try {
    existing = await readFile(memoryPath, 'utf-8');
  } catch {
    existing = '# Project Memory\n\n';
  }

  const entry = `\n## [${category}] ${timestamp}\n\n${content}\n`;
  await writeFile(memoryPath, existing + entry, 'utf-8');

  return `Memory saved to .opta/memory.md (${category})`;
}

// --- Background Process Management ---

let _processManager: ProcessManager | null = null;

function getProcessManager(): ProcessManager {
  if (!_processManager) {
    // Use defaults; config-driven values set via initProcessManager()
    _processManager = new ProcessManager({
      maxConcurrent: 5,
      defaultTimeout: 300_000,
      maxBufferSize: 1_048_576,
    });
  }
  return _processManager;
}

export function initProcessManager(config: OptaConfig): void {
  _processManager = new ProcessManager({
    maxConcurrent: config.background.maxConcurrent,
    defaultTimeout: config.background.defaultTimeout,
    maxBufferSize: config.background.maxBufferSize,
  });
}

export async function shutdownProcessManager(): Promise<void> {
  if (_processManager) {
    await _processManager.cleanup();
    _processManager = null;
  }
}

export function forceKillAllProcesses(): void {
  if (_processManager) {
    _processManager.killAll();
    _processManager = null;
  }
}

async function execBgStart(args: Record<string, unknown>): Promise<string> {
  const command = getStringArg(args, 'command');
  const timeout = args['timeout'] !== undefined ? Number(args['timeout']) : undefined;
  const label = getOptionalStringArg(args, 'label');

  const pm = getProcessManager();
  const handle = await pm.start(command, { timeout, label });
  return `Process started: id=${handle.id} pid=${handle.pid} cmd="${command}"`;
}

function ensureSingleProcessStatus(status: ProcessStatus | ProcessStatus[]): ProcessStatus {
  if (Array.isArray(status)) {
    throw new Error('Expected a single process status but received a list');
  }
  return status;
}

function parseBgStreamArg(value: unknown): 'stdout' | 'stderr' | 'both' | undefined {
  if (value === undefined) return undefined;
  return value === 'stdout' || value === 'stderr' || value === 'both' ? value : undefined;
}

function execBgStatus(args: Record<string, unknown>): string {
  const id = getOptionalStringArg(args, 'id');
  const pm = getProcessManager();

  if (!id) {
    const all = pm.status();
    if (!Array.isArray(all)) throw new Error('Expected process list from background manager');
    if (all.length === 0) return 'No background processes.';
    return all
      .map(
        (s) =>
          `id=${s.id} state=${s.state} pid=${s.pid} runtime=${(s.runtimeMs / 1000).toFixed(1)}s${s.label ? ` label="${s.label}"` : ''} cmd="${s.command}"`
      )
      .join('\n');
  }

  const s = ensureSingleProcessStatus(pm.status(id));
  return `id=${s.id} state=${s.state} pid=${s.pid} exit=${s.exitCode ?? 'n/a'} runtime=${(s.runtimeMs / 1000).toFixed(1)}s${s.label ? ` label="${s.label}"` : ''} cmd="${s.command}"`;
}

function execBgOutput(args: Record<string, unknown>): string {
  const id = getStringArg(args, 'id');
  const lines = args['lines'] !== undefined ? Number(args['lines']) : undefined;
  const stream = parseBgStreamArg(args['stream']);
  const sinceLastRead =
    args['since_last_read'] !== undefined ? Boolean(args['since_last_read']) : true;

  const pm = getProcessManager();
  const output = pm.output(id, { lines, stream, sinceLastRead });

  let result = '';
  if (output.stdout) result += `[stdout]\n${output.stdout}\n`;
  if (output.stderr) result += `[stderr]\n${output.stderr}\n`;
  if (!output.stdout && !output.stderr) result = '(no new output)';
  if (output.truncated) result += '[truncated]\n';

  return result;
}

async function execBgKill(args: Record<string, unknown>): Promise<string> {
  const id = getStringArg(args, 'id');
  const signal = (getOptionalStringArg(args, 'signal') as NodeJS.Signals | undefined) ?? 'SIGTERM';

  const pm = getProcessManager();
  const s = ensureSingleProcessStatus(pm.status(id));
  const killed = await pm.kill(id, signal);

  if (!killed) {
    return `Process ${id} is already ${s.state} (not running).`;
  }

  return `Process ${id} killed (was running for ${(s.runtimeMs / 1000).toFixed(1)}s)`;
}

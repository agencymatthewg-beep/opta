import { readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { realpathSync } from 'node:fs';
import { debug } from '../debug.js';
import type { OptaConfig } from '../config.js';
import { ProcessManager, type ProcessStatus } from '../background.js';

// --- Tool Executors ---

export async function executeTool(
  name: string,
  argsJson: string
): Promise<string> {
  let args: Record<string, unknown>;
  try {
    args = JSON.parse(argsJson);
  } catch {
    return `Error: Invalid JSON arguments: ${argsJson}`;
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
      case 'delete_file':
        return await execDeleteFile(args);
      case 'multi_edit':
        return await execMultiEdit(args);
      case 'save_memory':
        return await execSaveMemory(args);
      case 'bg_start':
        return await execBgStart(args);
      case 'bg_status':
        return await execBgStatus(args);
      case 'bg_output':
        return await execBgOutput(args);
      case 'bg_kill':
        return await execBgKill(args);
      default:
        return `Error: Unknown tool "${name}"`;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return `Error: ${message}`;
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
    throw new Error(`Path traversal blocked: "${normalized}" is outside working directory "${cwd}"`);
  }
}

// --- Individual Tool Implementations ---

async function execReadFile(args: Record<string, unknown>): Promise<string> {
  const path = resolve(String(args['path'] ?? ''));
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
  const path = resolve(String(args['path'] ?? ''));
  assertWithinCwd(path);
  const content = String(args['content'] ?? '');

  const { mkdir } = await import('node:fs/promises');
  const { dirname } = await import('node:path');
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, 'utf-8');

  return `File written: ${relative(process.cwd(), path)} (${content.length} bytes)`;
}

async function execEditFile(args: Record<string, unknown>): Promise<string> {
  const path = resolve(String(args['path'] ?? ''));
  assertWithinCwd(path);
  const oldText = String(args['old_text'] ?? '');
  const newText = String(args['new_text'] ?? '');

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
  const path = resolve(String(args['path'] ?? '.'));
  assertWithinCwd(path);
  const recursive = Boolean(args['recursive']);

  if (recursive) {
    const { default: fg } = await import('fast-glob');
    const files = await fg('**/*', {
      cwd: path,
      dot: false,
      onlyFiles: false,
      ignore: ['node_modules', '.git', 'dist', 'coverage'],
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
  const pattern = String(args['pattern'] ?? '');
  const searchPath = resolve(String(args['path'] ?? '.'));
  const glob = args['glob'] ? String(args['glob']) : undefined;

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
  } catch {
    debug('ripgrep not available, falling back to basic search');
  }

  // Fallback: fast-glob + readFile
  const { default: fg } = await import('fast-glob');
  const files = await fg(glob ?? '**/*', {
    cwd: searchPath,
    dot: false,
    ignore: ['node_modules', '.git', 'dist'],
  });

  const results: string[] = [];
  const regex = new RegExp(pattern);

  for (const file of files.slice(0, 100)) {
    try {
      const fullPath = resolve(searchPath, file);
      const content = await readFile(fullPath, 'utf-8');
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (regex.test(lines[i]!)) {
          results.push(`${file}:${i + 1}:${lines[i]}`);
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
  const pattern = String(args['pattern'] ?? '');
  const searchPath = resolve(String(args['path'] ?? '.'));

  const { default: fg } = await import('fast-glob');
  const files = await fg(pattern, {
    cwd: searchPath,
    dot: false,
    ignore: ['node_modules', '.git', 'dist', 'coverage'],
  });

  return files.length > 0 ? files.sort().join('\n') : 'No files found.';
}

async function execRunCommand(args: Record<string, unknown>): Promise<string> {
  const command = String(args['command'] ?? '');
  const timeout = Number(args['timeout'] ?? 30000);

  const { execa } = await import('execa');
  const result = await execa('sh', ['-c', command], {
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
  const question = String(args['question'] ?? 'What would you like to do?');

  const { input } = await import('@inquirer/prompts');
  const answer = await input({ message: question });

  return answer;
}

async function execReadProjectDocs(args: Record<string, unknown>): Promise<string> {
  const file = String(args['file'] ?? '');
  const { readProjectDoc } = await import('../../context/opis.js');
  return readProjectDoc(process.cwd(), file);
}

async function execWebSearch(args: Record<string, unknown>): Promise<string> {
  const query = String(args['query'] ?? '');
  const maxResults = Number(args['max_results'] ?? 5);

  let searxngUrl = 'http://192.168.188.10:8888';
  try {
    const { loadConfig } = await import('../config.js');
    const config = await loadConfig();
    searxngUrl = config.search?.searxngUrl ?? searxngUrl;
  } catch {
    // Use default
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
      .map(
        (r, i) =>
          `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.content?.slice(0, 200) ?? ''}`
      )
      .join('\n\n');
  } catch (err) {
    return `Error: Search failed — ${err instanceof Error ? err.message : String(err)}`;
  }
}

async function execWebFetch(args: Record<string, unknown>): Promise<string> {
  const url = String(args['url'] ?? '');
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

    if (mainMatch) {
      html = mainMatch[1]!;
    } else if (articleMatch) {
      html = articleMatch[1]!;
    } else if (bodyMatch) {
      html = bodyMatch[1]!;
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
    return `Error: Fetch failed — ${err instanceof Error ? err.message : String(err)}`;
  }
}

async function execDeleteFile(args: Record<string, unknown>): Promise<string> {
  const filePath = resolve(String(args['path'] ?? ''));
  assertWithinCwd(filePath);
  const { unlink } = await import('node:fs/promises');
  await unlink(filePath);
  return `File deleted: ${relative(process.cwd(), filePath)}`;
}

async function execMultiEdit(args: Record<string, unknown>): Promise<string> {
  const edits = args['edits'] as Array<{ path: string; old_text: string; new_text: string }> ?? [];

  if (edits.length === 0) return 'Error: No edits provided';
  if (edits.length > 20) return `Error: Too many edits (${edits.length}). Maximum 20 per call.`;

  // Group edits by file path, preserving original indices for error reporting
  const fileGroups = new Map<string, Array<{ index: number; old_text: string; new_text: string }>>();
  for (let i = 0; i < edits.length; i++) {
    const edit = edits[i]!;
    const filePath = resolve(String(edit.path ?? ''));
    const group = fileGroups.get(filePath) ?? [];
    group.push({ index: i, old_text: edit.old_text, new_text: edit.new_text });
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
        failures.push(`edit #${edit.index + 1} in ${relative(process.cwd(), filePath)}: ${err instanceof Error ? err.message : String(err)}`);
      }
      continue;
    }

    let fileApplied = 0;
    for (const edit of group) {
      const occurrences = content.split(edit.old_text).length - 1;
      if (occurrences === 0) {
        failures.push(`edit #${edit.index + 1} in ${relative(process.cwd(), filePath)}: old_text not found`);
        continue;
      }
      if (occurrences > 1) {
        failures.push(`edit #${edit.index + 1} in ${relative(process.cwd(), filePath)}: old_text appears ${occurrences} times (must be unique)`);
        continue;
      }
      content = content.replace(edit.old_text, edit.new_text);
      fileApplied++;
    }

    if (fileApplied > 0) {
      await writeFile(filePath, content, 'utf-8');
      fileSummaries.push(`${relative(process.cwd(), filePath)} (${fileApplied} edit${fileApplied > 1 ? 's' : ''})`);
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
  const content = String(args['content'] ?? '');
  const category = String(args['category'] ?? 'note');
  const timestamp = new Date().toISOString().split('T')[0];

  const memoryPath = resolve(process.cwd(), '.opta', 'memory.md');

  const { mkdir } = await import('node:fs/promises');
  const { dirname } = await import('node:path');
  await mkdir(dirname(memoryPath), { recursive: true });

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
    _processManager.killAll().catch(() => {});
    _processManager = null;
  }
}

async function execBgStart(args: Record<string, unknown>): Promise<string> {
  const command = String(args['command'] ?? '');
  const timeout = args['timeout'] !== undefined ? Number(args['timeout']) : undefined;
  const label = args['label'] ? String(args['label']) : undefined;

  const pm = getProcessManager();
  const handle = await pm.start(command, { timeout, label });
  return `Process started: id=${handle.id} pid=${handle.pid} cmd="${command}"`;
}

function execBgStatus(args: Record<string, unknown>): string {
  const id = args['id'] ? String(args['id']) : undefined;
  const pm = getProcessManager();

  if (!id) {
    const all = pm.status() as ProcessStatus[];
    if (all.length === 0) return 'No background processes.';
    return all
      .map(
        (s) =>
          `id=${s.id} state=${s.state} pid=${s.pid} runtime=${(s.runtimeMs / 1000).toFixed(1)}s${s.label ? ` label="${s.label}"` : ''} cmd="${s.command}"`
      )
      .join('\n');
  }

  const s = pm.status(id) as ProcessStatus;
  return `id=${s.id} state=${s.state} pid=${s.pid} exit=${s.exitCode ?? 'n/a'} runtime=${(s.runtimeMs / 1000).toFixed(1)}s${s.label ? ` label="${s.label}"` : ''} cmd="${s.command}"`;
}

function execBgOutput(args: Record<string, unknown>): string {
  const id = String(args['id'] ?? '');
  const lines = args['lines'] !== undefined ? Number(args['lines']) : undefined;
  const stream = args['stream'] as 'stdout' | 'stderr' | 'both' | undefined;
  const sinceLastRead = args['since_last_read'] !== undefined ? Boolean(args['since_last_read']) : true;

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
  const id = String(args['id'] ?? '');
  const signal = (args['signal'] as NodeJS.Signals) ?? 'SIGTERM';

  const pm = getProcessManager();
  const s = pm.status(id) as ProcessStatus;
  const killed = await pm.kill(id, signal);

  if (!killed) {
    return `Process ${id} is already ${s.state} (not running).`;
  }

  return `Process ${id} killed (was running for ${(s.runtimeMs / 1000).toFixed(1)}s)`;
}

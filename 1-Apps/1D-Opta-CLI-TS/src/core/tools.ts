import { readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { debug } from './debug.js';
import type { OptaConfig } from './config.js';
import { isCI } from '../ui/output.js';

// --- Tool Schemas (OpenAI function-call format) ---

export const TOOL_SCHEMAS = [
  {
    type: 'function' as const,
    function: {
      name: 'read_file',
      description: 'Read file contents. Returns line-numbered text.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path (relative to cwd)' },
          offset: { type: 'number', description: 'Start line (1-based, optional)' },
          limit: { type: 'number', description: 'Max lines to read (optional)' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'write_file',
      description: 'Create or overwrite a file with the given content.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path (relative to cwd)' },
          content: { type: 'string', description: 'File content to write' },
        },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'edit_file',
      description:
        'Replace an exact string in a file. old_text must appear exactly once in the file.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path (relative to cwd)' },
          old_text: { type: 'string', description: 'Exact text to find and replace' },
          new_text: { type: 'string', description: 'Replacement text' },
        },
        required: ['path', 'old_text', 'new_text'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'list_dir',
      description: 'List directory contents. Defaults to current working directory.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Directory path (relative to cwd)' },
          recursive: { type: 'boolean', description: 'List recursively (default: false)' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'search_files',
      description:
        'Search file contents with regex. Uses ripgrep if available, otherwise falls back to basic search.',
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'Regex pattern to search for' },
          path: { type: 'string', description: 'Directory to search in (default: cwd)' },
          glob: { type: 'string', description: 'File glob filter (e.g. "*.ts")' },
        },
        required: ['pattern'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'find_files',
      description: 'Find files by glob pattern.',
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'Glob pattern (e.g. "src/**/*.ts")' },
          path: { type: 'string', description: 'Base directory (default: cwd)' },
        },
        required: ['pattern'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'run_command',
      description: 'Execute a shell command and return stdout, stderr, and exit code.',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'Shell command to execute' },
          timeout: {
            type: 'number',
            description: 'Timeout in milliseconds (default: 30000)',
          },
        },
        required: ['command'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'ask_user',
      description: 'Ask the user a clarifying question and wait for their answer.',
      parameters: {
        type: 'object',
        properties: {
          question: { type: 'string', description: 'Question to ask the user' },
        },
        required: ['question'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'read_project_docs',
      description: 'Read an OPIS project document. Available: APP.md, ARCHITECTURE.md, GUARDRAILS.md, DECISIONS.md, ECOSYSTEM.md, KNOWLEDGE.md, WORKFLOWS.md, ROADMAP.md, INDEX.md, CLAUDE.md',
      parameters: {
        type: 'object',
        properties: {
          file: { type: 'string', description: 'Document filename (e.g., ARCHITECTURE.md)' },
        },
        required: ['file'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'web_search',
      description: 'Search the web for documentation, error messages, APIs, or current information.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
          max_results: { type: 'number', description: 'Max results (default: 5)' },
        },
        required: ['query'],
      },
    },
  },
];

// --- Permission Resolution ---

const MODE_PERMISSIONS: Record<string, Record<string, 'allow' | 'ask' | 'deny'>> = {
  safe: {},
  auto: { edit_file: 'allow', write_file: 'allow' },
  plan: { edit_file: 'deny', write_file: 'deny', run_command: 'deny' },
  dangerous: { edit_file: 'allow', write_file: 'allow', run_command: 'allow' },
  ci: { edit_file: 'deny', write_file: 'deny', run_command: 'deny', ask_user: 'deny' },
};

const DEFAULT_TOOL_PERMISSIONS: Record<string, string> = {
  read_file: 'allow',
  list_dir: 'allow',
  search_files: 'allow',
  find_files: 'allow',
  edit_file: 'ask',
  write_file: 'ask',
  run_command: 'ask',
  ask_user: 'allow',
  read_project_docs: 'allow',
  web_search: 'allow',
};

export function resolvePermission(
  toolName: string,
  config: OptaConfig
): 'allow' | 'ask' | 'deny' {
  // Per-tool config overrides take highest precedence
  const configPerm = config.permissions[toolName];
  const defaultPerm = DEFAULT_TOOL_PERMISSIONS[toolName];

  // If the user explicitly set a per-tool override different from defaults, use it
  if (configPerm && configPerm !== defaultPerm) {
    return configPerm as 'allow' | 'ask' | 'deny';
  }

  // Mode-level permissions (mode handles CI via the 'ci' mode)
  const mode = config.defaultMode ?? 'safe';
  const modePerm = MODE_PERMISSIONS[mode]?.[toolName];
  if (modePerm) return modePerm;

  // Fall back to config permission or default
  const permission = configPerm ?? defaultPerm ?? 'ask';
  return permission as 'allow' | 'ask' | 'deny';
}

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
      default:
        return `Error: Unknown tool "${name}"`;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return `Error: ${message}`;
  }
}

// --- Individual Tool Implementations ---

async function execReadFile(args: Record<string, unknown>): Promise<string> {
  const path = resolve(String(args['path'] ?? ''));
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
  const content = String(args['content'] ?? '');

  const { mkdir } = await import('node:fs/promises');
  const { dirname } = await import('node:path');
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, 'utf-8');

  return `File written: ${relative(process.cwd(), path)} (${content.length} bytes)`;
}

async function execEditFile(args: Record<string, unknown>): Promise<string> {
  const path = resolve(String(args['path'] ?? ''));
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
  const { readProjectDoc } = await import('../context/opis.js');
  return readProjectDoc(process.cwd(), file);
}

async function execWebSearch(args: Record<string, unknown>): Promise<string> {
  const query = String(args['query'] ?? '');
  const maxResults = Number(args['max_results'] ?? 5);

  let searxngUrl = 'http://192.168.188.10:8888';
  try {
    const { loadConfig } = await import('./config.js');
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

// --- Utility ---

export function getToolNames(): string[] {
  return TOOL_SCHEMAS.map((t) => t.function.name);
}

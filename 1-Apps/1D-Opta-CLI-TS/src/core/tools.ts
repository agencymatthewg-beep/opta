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
  {
    type: 'function' as const,
    function: {
      name: 'web_fetch',
      description: 'Fetch a URL and extract readable text content (HTML → markdown). Use for reading documentation, API references, or web pages.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'HTTP or HTTPS URL to fetch' },
          max_chars: { type: 'number', description: 'Maximum characters to return (default: 10000)' },
        },
        required: ['url'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'delete_file',
      description: 'Delete a file from the filesystem.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path (relative to cwd)' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'multi_edit',
      description: 'Apply multiple edits across one or more files in a single operation. More efficient than calling edit_file repeatedly. Each edit replaces old_text with new_text. Max 20 edits per call.',
      parameters: {
        type: 'object',
        properties: {
          edits: {
            type: 'array',
            description: 'Array of edit operations (max 20)',
            items: {
              type: 'object',
              properties: {
                path: { type: 'string', description: 'File path (relative to cwd)' },
                old_text: { type: 'string', description: 'Exact text to find' },
                new_text: { type: 'string', description: 'Replacement text' },
              },
              required: ['path', 'old_text', 'new_text'],
            },
          },
        },
        required: ['edits'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'save_memory',
      description: 'Save a piece of knowledge to the project memory file (.opta/memory.md) for cross-session persistence.',
      parameters: {
        type: 'object',
        properties: {
          content: { type: 'string', description: 'Knowledge to persist (decisions, patterns, lessons)' },
          category: { type: 'string', description: 'Category: decision, pattern, lesson, note' },
        },
        required: ['content'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'bg_start',
      description: 'Start a shell command in the background. Returns a process ID for tracking. Use for long-running commands (tests, builds, dev servers).',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'Shell command to execute' },
          timeout: {
            type: 'number',
            description: 'Timeout in ms (default: 300000 = 5 min, 0 = no timeout)',
          },
          label: {
            type: 'string',
            description: 'Human-readable label (e.g. "test suite", "dev server")',
          },
        },
        required: ['command'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'bg_status',
      description: 'Check the status of one or all background processes. Returns state, PID, runtime, exit code.',
      parameters: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Process ID from bg_start. Omit to list all processes.',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'bg_output',
      description: 'Get stdout/stderr from a background process. Defaults to new output since last read.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Process ID from bg_start' },
          lines: {
            type: 'number',
            description: 'Number of lines to return from the end (default: 50)',
          },
          stream: {
            type: 'string',
            enum: ['stdout', 'stderr', 'both'],
            description: 'Which output stream (default: both)',
          },
          since_last_read: {
            type: 'boolean',
            description: 'Only return output since last bg_output call (default: true)',
          },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'bg_kill',
      description: 'Terminate a background process. Sends SIGTERM, then SIGKILL after 5s if still running.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Process ID to kill' },
          signal: {
            type: 'string',
            enum: ['SIGTERM', 'SIGKILL', 'SIGINT'],
            description: 'Signal to send (default: SIGTERM)',
          },
        },
        required: ['id'],
      },
    },
  },
  // --- LSP Tools ---
  {
    type: 'function' as const,
    function: {
      name: 'lsp_definition',
      description: 'Go to the definition of a symbol. Returns file path and line number.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path (relative to cwd)' },
          line: { type: 'number', description: 'Line number (1-based)' },
          character: { type: 'number', description: 'Column number (0-based)' },
        },
        required: ['path', 'line', 'character'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'lsp_references',
      description: 'Find all references to a symbol across the workspace.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path (relative to cwd)' },
          line: { type: 'number', description: 'Line number (1-based)' },
          character: { type: 'number', description: 'Column number (0-based)' },
          include_declaration: { type: 'boolean', description: 'Include the declaration itself (default: true)' },
        },
        required: ['path', 'line', 'character'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'lsp_hover',
      description: 'Get type information and documentation for a symbol at a position.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path (relative to cwd)' },
          line: { type: 'number', description: 'Line number (1-based)' },
          character: { type: 'number', description: 'Column number (0-based)' },
        },
        required: ['path', 'line', 'character'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'lsp_symbols',
      description: 'Search for symbols (functions, classes, variables) across the workspace by name.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Symbol name or partial name to search for' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'lsp_document_symbols',
      description: 'List all symbols (functions, classes, interfaces) defined in a file.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path (relative to cwd)' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'lsp_rename',
      description: 'Rename a symbol across all files in the workspace. Returns a list of edits to apply.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path (relative to cwd)' },
          line: { type: 'number', description: 'Line number (1-based)' },
          character: { type: 'number', description: 'Column number (0-based)' },
          new_name: { type: 'string', description: 'New name for the symbol' },
        },
        required: ['path', 'line', 'character', 'new_name'],
      },
    },
  },
];

// --- Sub-Agent Tool Schemas (conditionally included by registry) ---

export const SUB_AGENT_TOOL_SCHEMAS = [
  {
    type: 'function' as const,
    function: {
      name: 'spawn_agent',
      description: 'Spawn a sub-agent to perform a focused task independently. The sub-agent has its own context window and returns a result summary. Use for: parallel investigation, focused code search, isolated analysis. Do NOT use for trivial tasks a single tool call can handle.',
      parameters: {
        type: 'object',
        properties: {
          task: {
            type: 'string',
            description: 'Clear task description for the sub-agent. Be specific about what files to look at and what to report back.',
          },
          scope: {
            type: 'string',
            description: 'Optional: directory or file path to focus on (relative to cwd)',
          },
          max_tool_calls: {
            type: 'number',
            description: 'Max tool calls the sub-agent can make (default: 15)',
          },
          mode: {
            type: 'string',
            enum: ['plan', 'auto'],
            description: 'Permission mode for sub-agent. "plan" = read-only, "auto" = can edit files.',
          },
        },
        required: ['task'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'delegate_task',
      description: 'Break a complex task into sub-tasks and run them sequentially. Each sub-task spawns a sub-agent. Results are aggregated into a single report. Use for multi-step investigations or when exploring multiple areas of the codebase.',
      parameters: {
        type: 'object',
        properties: {
          plan: {
            type: 'string',
            description: 'High-level description of the overall goal',
          },
          subtasks: {
            type: 'array',
            description: 'Ordered list of sub-tasks to execute',
            items: {
              type: 'object',
              properties: {
                task: { type: 'string', description: 'Task description' },
                scope: { type: 'string', description: 'Focus directory/file' },
                depends_on: { type: 'number', description: 'Index of prerequisite sub-task (0-based)' },
              },
              required: ['task'],
            },
          },
        },
        required: ['plan', 'subtasks'],
      },
    },
  },
];

// --- Permission Resolution ---

const MODE_PERMISSIONS: Record<string, Record<string, 'allow' | 'ask' | 'deny'>> = {
  safe: {},
  auto: { edit_file: 'allow', write_file: 'allow', delete_file: 'allow', multi_edit: 'allow', bg_start: 'allow', bg_kill: 'allow', spawn_agent: 'allow', delegate_task: 'allow' },
  plan: { edit_file: 'deny', write_file: 'deny', delete_file: 'deny', multi_edit: 'deny', run_command: 'deny', bg_start: 'deny', bg_kill: 'deny', spawn_agent: 'deny', delegate_task: 'deny' },
  dangerous: { edit_file: 'allow', write_file: 'allow', delete_file: 'allow', multi_edit: 'allow', run_command: 'allow', bg_start: 'allow', bg_kill: 'allow', spawn_agent: 'allow', delegate_task: 'allow' },
  ci: { edit_file: 'deny', write_file: 'deny', delete_file: 'deny', multi_edit: 'deny', run_command: 'deny', ask_user: 'deny', bg_start: 'deny', bg_kill: 'deny', spawn_agent: 'deny', delegate_task: 'deny' },
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
  web_fetch: 'allow',
  delete_file: 'ask',
  multi_edit: 'ask',
  save_memory: 'allow',
  bg_start: 'ask',
  bg_status: 'allow',
  bg_output: 'allow',
  bg_kill: 'ask',
  spawn_agent: 'ask',
  delegate_task: 'ask',
  lsp_definition: 'allow',
  lsp_references: 'allow',
  lsp_hover: 'allow',
  lsp_symbols: 'allow',
  lsp_document_symbols: 'allow',
  lsp_rename: 'ask',
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

  // Custom tools (custom__*) execute shell commands, so they inherit
  // run_command's mode-level permissions when no explicit override exists.
  if (toolName.startsWith('custom__')) {
    const customModePerm = MODE_PERMISSIONS[mode]?.['run_command'];
    if (customModePerm) return customModePerm;
    // Default: same as run_command ('ask')
    return (configPerm ?? 'ask') as 'allow' | 'ask' | 'deny';
  }

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

import { ProcessManager, type ProcessStatus } from './background.js';

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

// --- Utility ---

export function getToolNames(): string[] {
  return TOOL_SCHEMAS.map((t) => t.function.name);
}

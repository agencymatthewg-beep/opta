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
      name: 'research_query',
      description: 'Run a routed research query across configured providers and return a concise result.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Research query text' },
          intent: {
            type: 'string',
            enum: ['general', 'news', 'academic', 'coding'],
            description: 'Research intent (default: general)',
          },
          max_results: { type: 'number', description: 'Maximum citations/results to include (default: 5)' },
          provider_order: {
            type: 'array',
            description: 'Optional provider preference order',
            items: { type: 'string' },
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'research_health',
      description: 'Check health status for configured research providers.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'learning_log',
      description: 'Append a structured learning entry to the project learning ledger.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Optional explicit entry ID' },
          ts: { type: 'string', description: 'Optional ISO timestamp' },
          kind: {
            type: 'string',
            enum: ['plan', 'problem', 'solution', 'reflection', 'research'],
            description: 'Learning entry type',
          },
          capture_level: {
            type: 'string',
            enum: ['exhaustive', 'balanced', 'lean'],
            description: 'Capture depth',
          },
          topic: { type: 'string', description: 'Short topic/title' },
          content: { type: 'string', description: 'Learning content/body' },
          tags: {
            type: 'array',
            description: 'Optional tags',
            items: { type: 'string' },
          },
          evidence: {
            type: 'array',
            description: 'Optional supporting evidence links',
            items: {
              type: 'object',
              properties: {
                label: { type: 'string', description: 'Human-readable evidence label' },
                uri: { type: 'string', description: 'Evidence URI/path' },
              },
              required: ['label', 'uri'],
            },
          },
          metadata: {
            type: 'object',
            description: 'Optional metadata object',
            additionalProperties: true,
          },
        },
        required: ['topic', 'content'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'learning_summary',
      description: 'Build a chronological markdown summary from the learning ledger.',
      parameters: {
        type: 'object',
        properties: {
          from: { type: 'string', description: 'Optional ISO date/time lower bound' },
          to: { type: 'string', description: 'Optional ISO date/time upper bound' },
          max_chars: { type: 'number', description: 'Maximum summary characters to return (default: 4000)' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'learning_retrieve',
      description: 'Retrieve top relevant learning entries for a query.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Retrieval query text' },
          limit: { type: 'number', description: 'Maximum results (default: 5)' },
        },
        required: ['query'],
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

// --- Utility ---

export function getToolNames(): string[] {
  return TOOL_SCHEMAS.map((t) => t.function.name);
}

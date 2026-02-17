/**
 * Simple TTL cache for read-only tool results.
 *
 * Caches deterministic tool results (read_file, search_files, etc.)
 * to avoid redundant filesystem/network operations in multi-turn
 * conversations where the model re-reads the same files.
 */

/** Tools whose results are safe to cache (read-only, deterministic). */
export const CACHEABLE_TOOLS = new Set([
  'read_file',
  'list_dir',
  'search_files',
  'find_files',
  'read_project_docs',
  'lsp_definition',
  'lsp_references',
  'lsp_hover',
  'lsp_symbols',
  'lsp_document_symbols',
  'git_status',
  'git_diff',
  'git_log',
]);

/** Tools that modify state — any call to these flushes the entire cache. */
const WRITE_TOOLS = new Set([
  'edit_file',
  'write_file',
  'multi_edit',
  'delete_file',
  'run_command',
  'git_commit',
  'lsp_rename',
]);

export class ToolResultCache {
  private cache = new Map<string, { result: string; expiry: number }>();

  constructor(private ttlMs: number = 30_000) {}

  /** Build a cache key from tool name and arguments JSON. */
  static key(name: string, argsJson: string): string {
    return `${name}:${argsJson}`;
  }

  /** Get a cached result, or undefined if expired/missing. */
  get(key: string): string | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return undefined;
    }
    return entry.result;
  }

  /** Store a result in the cache. */
  set(key: string, result: string): void {
    this.cache.set(key, { result, expiry: Date.now() + this.ttlMs });
  }

  /** Check if a tool name is cacheable. */
  isCacheable(toolName: string): boolean {
    return CACHEABLE_TOOLS.has(toolName);
  }

  /** Check if a tool name is a write operation that should flush the cache. */
  isWriteTool(toolName: string): boolean {
    return WRITE_TOOLS.has(toolName);
  }

  /** Flush all cached entries (called after write operations). */
  flush(): void {
    this.cache.clear();
  }

  /** Number of entries currently cached. */
  get size(): number {
    return this.cache.size;
  }
}

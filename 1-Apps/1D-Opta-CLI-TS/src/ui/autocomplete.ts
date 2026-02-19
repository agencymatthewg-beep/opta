import fg from 'fast-glob';
import { DEFAULT_IGNORE_GLOBS } from '../utils/ignore.js';

export function fuzzyMatch(query: string, target: string): boolean {
  return target.toLowerCase().includes(query.toLowerCase());
}

export function getCompletions(query: string, files: string[], limit = 15): string[] {
  return files
    .filter(f => fuzzyMatch(query, f))
    .sort((a, b) => {
      const aBase = a.split('/').pop()!.toLowerCase();
      const bBase = b.split('/').pop()!.toLowerCase();
      const q = query.toLowerCase();
      // Prioritize basename-starts-with matches
      const aStart = aBase.startsWith(q) ? 0 : 1;
      const bStart = bBase.startsWith(q) ? 0 : 1;
      if (aStart !== bStart) return aStart - bStart;
      // Then by path length (shorter = more relevant)
      return a.length - b.length;
    })
    .slice(0, limit);
}

export async function getProjectFiles(cwd: string): Promise<string[]> {
  return fg(['**/*'], {
    cwd,
    ignore: [...DEFAULT_IGNORE_GLOBS],
    onlyFiles: true,
    dot: false,
  });
}

/**
 * Get slash command completions for TAB completion in the REPL.
 * Returns matching slash commands (with leading /) for a partial input.
 */
export function getSlashCompletions(partial: string): string[] {
  // Lazy-import the command registry to avoid circular deps at module level.
  // getAllCommands is synchronous so we can use a cached reference.
  if (!_slashCommandsCache) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      // Dynamic import is async, so we populate the cache on first call
      // and return empty on the very first invocation (edge case).
      _populateSlashCache();
      // Return empty on first call while cache is loading
      if (!_slashCommandsCache) return [];
    } catch {
      return [];
    }
  }

  const q = partial.startsWith('/') ? partial.slice(1).toLowerCase() : partial.toLowerCase();

  return _slashCommandsCache
    .filter(entry => entry.startsWith(q))
    .map(name => `/${name}`)
    .slice(0, 10);
}

/** Cached list of slash command names + aliases (lowercase). */
let _slashCommandsCache: string[] | null = null;

/** Eagerly populate the slash command cache. Safe to call multiple times. */
function _populateSlashCache(): void {
  // The slash command registry uses static imports and is available synchronously
  // once its module has been loaded. Since chat.ts already imports it, by the time
  // TAB completion runs in the REPL the module is warm.
  try {
    // Use a sync require-like trick: the module is already in the ESM cache
    // because chat.ts imported it. We rely on the caller having awaited the
    // async version at least once before calling getSlashCompletions.
    // This is handled by initSlashCompletionCache() below.
  } catch {
    // Fallback: cache stays null, completions return empty
  }
}

/**
 * Initialize the slash command completion cache. Must be called once
 * (asynchronously) before getSlashCompletions will return results.
 * Typically called during chat startup.
 */
export async function initSlashCompletionCache(): Promise<void> {
  try {
    const { getAllCommands } = await import('../commands/slash/index.js');
    const cmds = getAllCommands();
    const names: string[] = [];
    for (const cmd of cmds) {
      names.push(cmd.command);
      if (cmd.aliases) {
        for (const alias of cmd.aliases) {
          names.push(alias);
        }
      }
    }
    _slashCommandsCache = [...new Set(names)].sort();
  } catch {
    _slashCommandsCache = [];
  }
}

/**
 * REPL-level completer function suitable for use with readline.
 * Handles slash command completion and @file completion.
 */
export function replCompleter(
  line: string,
  callback: (err: null | Error, result: [string[], string]) => void,
): void {
  if (line.startsWith('/')) {
    const completions = getSlashCompletions(line);
    callback(null, [completions.length > 0 ? completions : [line], line]);
    return;
  }

  // @file completion
  const atMatch = line.match(/@(\S*)$/);
  if (atMatch) {
    const partial = atMatch[1] ?? '';
    getProjectFiles(process.cwd())
      .then(files => {
        const matches = getCompletions(partial, files, 10).map(f => line.slice(0, -atMatch[0].length) + `@${f}`);
        callback(null, [matches.length > 0 ? matches : [line], line]);
      })
      .catch(() => {
        callback(null, [[], line]);
      });
    return;
  }

  // No completions
  callback(null, [[], line]);
}

/**
 * Canonical set of directories to ignore in file operations.
 * Used by tool executors, autocomplete, and TUI file pickers.
 */
export const DEFAULT_IGNORE_DIRS = [
  'node_modules',
  '.git',
  'dist',
  'coverage',
  '.next',
] as const;

/** Glob-format ignore patterns including file patterns. */
export const DEFAULT_IGNORE_GLOBS = [
  ...DEFAULT_IGNORE_DIRS.map(d => `${d}/**`),
  '*.lock',
] as const;

/**
 * Convert directory names to glob ignore patterns.
 */
export function toGlobIgnore(dirs: readonly string[]): string[] {
  return dirs.map(d => `${d}/**`);
}

import { isAbsolute, relative } from 'node:path';

interface PathOps {
  relative(from: string, to: string): string;
  isAbsolute(path: string): boolean;
}

/**
 * Returns true when targetPath is the same as basePath or a descendant of it.
 *
 * Works across POSIX and Windows path semantics. Callers should normalize
 * symlinks first when that matters (for example via realpathSync).
 */
export function isPathWithinBase(
  targetPath: string,
  basePath: string,
  pathOps: PathOps = { relative, isAbsolute }
): boolean {
  const rel = pathOps.relative(basePath, targetPath);
  if (rel === '' || rel === '.') return true;
  return !rel.startsWith('..') && !pathOps.isAbsolute(rel);
}

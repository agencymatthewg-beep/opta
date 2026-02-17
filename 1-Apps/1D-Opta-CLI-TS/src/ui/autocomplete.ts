import fg from 'fast-glob';

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
    ignore: ['node_modules/**', 'dist/**', '.git/**', '.next/**', '*.lock'],
    onlyFiles: true,
    dot: false,
  });
}

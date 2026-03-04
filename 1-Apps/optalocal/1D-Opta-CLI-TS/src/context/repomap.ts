import { execa } from 'execa';
import { readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';

const EXTENSION_MAP: Record<string, 'ts' | 'js' | 'py' | 'swift'> = {
  '.ts': 'ts',
  '.tsx': 'ts',
  '.js': 'js',
  '.jsx': 'js',
  '.mjs': 'js',
  '.py': 'py',
  '.swift': 'swift',
};

const TEST_FILE_PATTERNS = [
  /\.test\.[jt]sx?$/,
  /\.spec\.[jt]sx?$/,
  /__tests__\//,
  /\/test_[^/]+\.py$/,
  /\/[^/]+_test\.py$/,
  /^test_[^/]+\.py$/,
  /^[^/]+_test\.py$/,
];

function isTestFile(relativePath: string): boolean {
  return TEST_FILE_PATTERNS.some((pattern) => pattern.test(relativePath));
}

function getLanguage(filePath: string): 'ts' | 'js' | 'py' | 'swift' | null {
  const ext = extname(filePath).toLowerCase();
  return EXTENSION_MAP[ext] ?? null;
}

function extractTsExports(content: string): string[] {
  const symbols: string[] = [];
  const namedExport = /export\s+(?:async\s+)?(?:function|class|const|let|type|interface|enum)\s+(\w+)/g;
  const defaultExport = /export\s+default\s+(?:class|function)\s+(\w+)/g;

  let match: RegExpExecArray | null;
  match = namedExport.exec(content);
  while (match !== null) {
    if (match[1]) symbols.push(match[1]);
    match = namedExport.exec(content);
  }

  match = defaultExport.exec(content);
  while (match !== null) {
    if (match[1]) symbols.push(match[1]);
    match = defaultExport.exec(content);
  }
  return symbols;
}

function extractPyExports(content: string): string[] {
  const symbols: string[] = [];
  const defPattern = /^(?:def|class|async\s+def)\s+(\w+)/gm;
  const constPattern = /^([A-Z][A-Z_0-9]+)\s*=/gm;

  let match: RegExpExecArray | null;
  match = defPattern.exec(content);
  while (match !== null) {
    if (match[1]) symbols.push(match[1]);
    match = defPattern.exec(content);
  }

  match = constPattern.exec(content);
  while (match !== null) {
    if (match[1]) symbols.push(match[1]);
    match = constPattern.exec(content);
  }
  return symbols;
}

function extractSwiftExports(content: string): string[] {
  const symbols: string[] = [];
  const pattern = /^(?:public\s+|open\s+)?(?:func|class|struct|enum|protocol|actor)\s+(\w+)/gm;
  let match: RegExpExecArray | null;
  match = pattern.exec(content);
  while (match !== null) {
    if (match[1]) symbols.push(match[1]);
    match = pattern.exec(content);
  }
  return symbols;
}

function extractExports(content: string, language: 'ts' | 'js' | 'py' | 'swift'): string[] {
  switch (language) {
    case 'ts':
    case 'js':
      return extractTsExports(content);
    case 'py':
      return extractPyExports(content);
    case 'swift':
      return extractSwiftExports(content);
  }
}

export interface RepoMapEntry {
  path: string;
  exports: string[];
}

export interface RepoMap {
  entries: RepoMapEntry[];
  truncated: boolean;
  fileCount: number;
}

/** Max files to include in the repo map before truncation. */
const MAX_FILES = 200;

/**
 * Builds a fast, lightweight repository map using git ls-files to respect ignores natively.
 */
export async function buildRepoMap(cwd: string): Promise<RepoMap> {
  let trackedFiles: string[] = [];
  
  try {
    const result = await execa('git', ['ls-files'], { cwd, reject: false });
    if (result.exitCode === 0 && result.stdout) {
      trackedFiles = result.stdout.split('\n').filter(Boolean);
    }
  } catch {
    // Fallback if not a git repo or git not installed
    return { entries: [], truncated: false, fileCount: 0 };
  }

  // Filter for supported source files and exclude tests
  const sourceFiles = trackedFiles.filter(f => {
    const lang = getLanguage(f);
    return lang !== null && !isTestFile(f);
  });

  const totalCount = sourceFiles.length;
  const truncated = totalCount > MAX_FILES;
  const filesToProcess = sourceFiles.slice(0, MAX_FILES);

  const entries: RepoMapEntry[] = [];

  // Read files in parallel batches to be blazing fast
  const BATCH_SIZE = 50;
  for (let i = 0; i < filesToProcess.length; i += BATCH_SIZE) {
    const batch = filesToProcess.slice(i, i + BATCH_SIZE);
    
    await Promise.all(batch.map(async (filePath) => {
      const language = getLanguage(filePath);
      if (!language) return;

      try {
        const absolutePath = join(cwd, filePath);
        const content = await readFile(absolutePath, 'utf-8');
        const exports = extractExports(content, language);

        if (exports.length > 0) {
          entries.push({
            path: filePath,
            exports,
          });
        }
      } catch {
        // Skip unreadable files
      }
    }));
  }

  // Sort entries alphabetically by path for consistent output
  entries.sort((a, b) => a.path.localeCompare(b.path));

  return {
    entries,
    truncated,
    fileCount: totalCount,
  };
}

/**
 * Formats the RepoMap into a hierarchical tree string.
 * This is highly token-efficient and easy for LLMs to understand.
 */
export function formatRepoMapTree(map: RepoMap): string {
  const tree: Record<string, any> = {};

  // Build tree structure
  for (const entry of map.entries) {
    const parts = entry.path.split('/');
    let current = tree;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!part) continue;
      if (i === parts.length - 1) {
        current[part] = entry.exports;
      } else {
        current[part] = current[part] || {};
        current = current[part];
      }
    }
  }

  let output = '';

  function printTree(node: Record<string, any>, prefix: string = '') {
    const keys = Object.keys(node).sort();
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      if (!key) continue;
      
      const isLast = i === keys.length - 1;
      const connector = isLast ? '└── ' : '├── ';
      const childPrefix = prefix + (isLast ? '    ' : '│   ');
      
      const value = node[key];
      
      if (Array.isArray(value)) {
        // It's a file with exports
        const symbols = value.length > 0 ? ` (symbols: ${value.join(', ')})` : '';
        output += `${prefix}${connector}${key}${symbols}\n`;
      } else {
        // It's a directory
        output += `${prefix}${connector}${key}/\n`;
        printTree(value, childPrefix);
      }
    }
  }

  printTree(tree);

  if (map.truncated) {
    const remaining = map.fileCount - map.entries.length;
    output += `\n... and ${remaining} more files truncated (${map.fileCount} total source files in repo)\n`;
  }

  return output.trim();
}
import { readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import fg from 'fast-glob';

// --- Types ---

export interface ExportEntry {
  path: string; // Relative file path
  exports: string[]; // Symbol names
}

export interface ExportMap {
  entries: ExportEntry[];
  truncated: boolean;
  fileCount: number; // Total files found (before truncation)
}

// --- Constants ---

/** Max files to include in the export map before truncation. */
const MAX_FILES = 100;

/** Source file extensions to scan, mapped to language group. */
const EXTENSION_MAP: Record<string, 'ts' | 'js' | 'py' | 'swift'> = {
  '.ts': 'ts',
  '.tsx': 'ts',
  '.js': 'js',
  '.jsx': 'js',
  '.mjs': 'js',
  '.py': 'py',
  '.swift': 'swift',
};

/** Directories to ignore during file discovery. */
const IGNORED_DIRS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  'coverage',
  'DerivedData',
  '.build',
  '__pycache__',
  '.venv',
  'venv',
];

/** Patterns for test files to skip. */
const TEST_FILE_PATTERNS = [
  /\.test\.[jt]sx?$/,
  /\.spec\.[jt]sx?$/,
  /__tests__\//,
  /\/test_[^/]+\.py$/,
  /\/[^/]+_test\.py$/,
  // Also match at root level (no leading slash)
  /^test_[^/]+\.py$/,
  /^[^/]+_test\.py$/,
];

// --- Regex Patterns ---

/**
 * Extract exported symbols from TypeScript/JavaScript source.
 *
 * Matches:
 *   export (async )?(function|class|const|let|type|interface|enum) NAME
 *   export default (class|function) NAME
 */
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

/**
 * Extract top-level definitions from Python source.
 *
 * Matches:
 *   def NAME / class NAME / async def NAME (at line start)
 *   UPPER_CASE_NAME = ... (top-level constant assignments)
 */
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

/**
 * Extract top-level declarations from Swift source.
 *
 * Matches:
 *   (public |open )?(func|class|struct|enum|protocol|actor) NAME
 *   at line start only
 */
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

// --- Helpers ---

/**
 * Check if a relative path matches any test file pattern.
 */
function isTestFile(relativePath: string): boolean {
  return TEST_FILE_PATTERNS.some((pattern) => pattern.test(relativePath));
}

/**
 * Determine the language group for a file based on its extension.
 */
function getLanguage(filePath: string): 'ts' | 'js' | 'py' | 'swift' | null {
  const ext = extname(filePath).toLowerCase();
  return EXTENSION_MAP[ext] ?? null;
}

/**
 * Extract exports from file content based on language.
 */
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

// --- Public API ---

/**
 * Scan a project directory for source files and extract their top-level exports/declarations.
 *
 * Uses fast-glob for discovery, regex patterns for extraction.
 * Caps output at 100 files; sets `truncated=true` if more exist.
 */
export async function scanExports(cwd: string): Promise<ExportMap> {
  // Build glob patterns for all supported extensions
  const extensions = Object.keys(EXTENSION_MAP).map((ext) => ext.slice(1)); // remove leading dot
  const globPattern = `**/*.{${extensions.join(',')}}`;

  // Build ignore patterns from IGNORED_DIRS
  const ignore = IGNORED_DIRS.map((dir) => `**/${dir}/**`);

  // Find all source files
  const files = await fg(globPattern, {
    cwd,
    ignore,
    absolute: false,
    onlyFiles: true,
    dot: false,
  });

  // Filter out test files
  const sourceFiles = files.filter((f) => !isTestFile(f));

  // Sort for deterministic output
  sourceFiles.sort();

  const totalCount = sourceFiles.length;
  const truncated = totalCount > MAX_FILES;
  const filesToProcess = sourceFiles.slice(0, MAX_FILES);

  // Extract exports from each file
  const entries: ExportEntry[] = [];

  for (const filePath of filesToProcess) {
    const language = getLanguage(filePath);
    if (!language) continue;

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
      // Skip files that can't be read
      continue;
    }
  }

  return {
    entries,
    truncated,
    fileCount: totalCount,
  };
}

/**
 * Format an ExportMap as a compact text representation for system prompts.
 *
 * Output format (one line per file):
 *   path: symbol1, symbol2, symbol3
 *
 * If truncated, appends:
 *   ... and N more files (M total)
 */
export function formatExportMap(map: ExportMap): string {
  const lines = map.entries.map(
    (entry) => `${entry.path}: ${entry.exports.join(', ')}`,
  );

  if (map.truncated) {
    const remaining = map.fileCount - map.entries.length;
    lines.push(`... and ${remaining} more files (${map.fileCount} total)`);
  }

  return lines.join('\n');
}

/**
 * LSP Protocol Helpers
 *
 * Pure functions for converting between LSP types and human-readable formats.
 * No I/O, no side effects.
 */

import { relative } from 'node:path';

// --- Types ---

export interface Position {
  line: number;
  character: number;
}

export interface Range {
  start: Position;
  end: Position;
}

export interface Location {
  uri: string;
  range: Range;
}

export interface SymbolInformation {
  name: string;
  kind: number;
  location: Location;
  containerName?: string;
}

export interface DocumentSymbol {
  name: string;
  kind: number;
  range: Range;
  selectionRange: Range;
  children?: DocumentSymbol[];
}

export interface TextEdit {
  range: Range;
  newText: string;
}

export interface WorkspaceEdit {
  changes?: Record<string, TextEdit[]>;
}

// --- Symbol Kind Names ---

const SYMBOL_KIND_NAMES: Record<number, string> = {
  1: 'File',
  2: 'Module',
  3: 'Namespace',
  4: 'Package',
  5: 'Class',
  6: 'Method',
  7: 'Property',
  8: 'Field',
  9: 'Constructor',
  10: 'Enum',
  11: 'Interface',
  12: 'Function',
  13: 'Variable',
  14: 'Constant',
  15: 'String',
  16: 'Number',
  17: 'Boolean',
  18: 'Array',
  19: 'Object',
  20: 'Key',
  21: 'Null',
  22: 'EnumMember',
  23: 'Struct',
  24: 'Event',
  25: 'Operator',
  26: 'TypeParameter',
};

function symbolKindName(kind: number): string {
  return SYMBOL_KIND_NAMES[kind] ?? `Kind(${kind})`;
}

// --- URI Conversion ---

export function filePathToUri(filePath: string): string {
  // Encode path components (spaces, brackets, etc.) but not slashes
  const encoded = filePath
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/');
  return `file://${encoded}`;
}

export function uriToFilePath(uri: string): string {
  // Strip file:// prefix and decode
  const path = uri.replace(/^file:\/\//, '');
  return decodeURIComponent(path);
}

// --- Position Conversion ---

export function toPosition(line: number, character: number): Position {
  return {
    line: Math.max(0, line - 1),
    character,
  };
}

// --- Formatting ---

export function formatLocation(loc: Location, cwd: string): string {
  const filePath = uriToFilePath(loc.uri);
  const rel = relative(cwd, filePath);
  const line = loc.range.start.line + 1; // 0-based -> 1-based
  const char = loc.range.start.character;
  return `${rel}:${line}:${char}`;
}

export function formatLocations(
  locs: Location[] | null | undefined,
  cwd: string
): string {
  if (!locs || locs.length === 0) return 'No results found.';
  return locs.map((loc) => formatLocation(loc, cwd)).join('\n');
}

export function formatHoverContent(hover: unknown): string {
  if (!hover) return 'No hover information.';

  const h = hover as Record<string, unknown>;
  const contents = h['contents'];

  if (!contents) return 'No hover information.';

  // String content
  if (typeof contents === 'string') return contents;

  // MarkupContent: { kind, value }
  if (
    typeof contents === 'object' &&
    !Array.isArray(contents) &&
    'value' in (contents as Record<string, unknown>)
  ) {
    const c = contents as Record<string, unknown>;
    // MarkedString with language: { language, value }
    if ('language' in c && typeof c['language'] === 'string') {
      return `\`\`\`${c['language']}\n${c['value']}\n\`\`\``;
    }
    return String(c['value']);
  }

  // Array of MarkedStrings
  if (Array.isArray(contents)) {
    return contents
      .map((item) => {
        if (typeof item === 'string') return item;
        if (typeof item === 'object' && item && 'language' in item) {
          return `\`\`\`${item.language}\n${item.value}\n\`\`\``;
        }
        if (typeof item === 'object' && item && 'value' in item) {
          return String(item.value);
        }
        return String(item);
      })
      .join('\n\n');
  }

  return String(contents);
}

export function formatSymbolInformation(
  symbols: SymbolInformation[],
  cwd: string
): string {
  if (!symbols || symbols.length === 0) return 'No symbols found.';

  return symbols
    .map((sym) => {
      const filePath = uriToFilePath(sym.location.uri);
      const rel = relative(cwd, filePath);
      const line = sym.location.range.start.line + 1;
      const kind = symbolKindName(sym.kind);
      return `${sym.name} (${kind}) — ${rel}:${line}`;
    })
    .join('\n');
}

export function formatDocumentSymbols(
  symbols: DocumentSymbol[],
  indent: number = 0
): string {
  if (!symbols || symbols.length === 0) {
    return indent === 0 ? 'No symbols found.' : '';
  }

  const lines: string[] = [];
  const prefix = '  '.repeat(indent);

  for (const sym of symbols) {
    const kind = symbolKindName(sym.kind);
    const line = sym.range.start.line + 1;
    lines.push(`${prefix}${sym.name} (${kind}) — line ${line}`);
    if (sym.children && sym.children.length > 0) {
      const childText = formatDocumentSymbols(sym.children, indent + 1);
      if (childText) lines.push(childText);
    }
  }

  return lines.join('\n');
}

export function formatWorkspaceEdit(
  edit: WorkspaceEdit | null | undefined,
  cwd: string
): string {
  if (!edit || !edit.changes) return 'No changes.';

  const entries = Object.entries(edit.changes);
  if (entries.length === 0) return 'No changes.';

  const lines: string[] = [];

  for (const [uri, edits] of entries) {
    const filePath = uriToFilePath(uri);
    const rel = relative(cwd, filePath);
    lines.push(`${rel}:`);
    for (const e of edits) {
      const line = e.range.start.line + 1;
      const char = e.range.start.character;
      lines.push(`  line ${line}:${char} -> "${e.newText}"`);
    }
  }

  return lines.join('\n');
}

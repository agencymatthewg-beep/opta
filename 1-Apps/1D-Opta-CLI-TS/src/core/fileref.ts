import { readFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import chalk from 'chalk';

export interface FileRef {
  original: string;  // @src/core/agent.ts
  path: string;      // resolved absolute path
  content: string;   // file contents
  lines: number;     // line count
}

export interface LineRange {
  path: string;
  startLine: number | null;
  endLine: number | null;
}

export function parseLineRange(ref: string): LineRange {
  const match = ref.match(/^(.+?):(\d+)(?:-(\d+))?$/);
  if (!match) return { path: ref, startLine: null, endLine: null };
  return {
    path: match[1]!,
    startLine: parseInt(match[2]!, 10),
    endLine: match[3] ? parseInt(match[3], 10) : parseInt(match[2]!, 10),
  };
}

export function extractFileRefParts(ref: string): { original: string; path: string; startLine: number | null; endLine: number | null } {
  const withoutAt = ref.startsWith('@') ? ref.slice(1) : ref;
  const range = parseLineRange(withoutAt);
  return { original: ref, ...range };
}

export async function resolveFileRefs(message: string): Promise<{ cleanMessage: string; refs: FileRef[] }> {
  // Match @path patterns (not @mentions which start with uppercase or are emails)
  const pattern = /@((?:\.{1,2}\/|[a-z_])[^\s,;:!?'")\]}>]+)/g;
  const refs: FileRef[] = [];
  const matches = [...message.matchAll(pattern)];

  const cleanMessage = message;

  for (const match of matches) {
    const refPath = match[1]!;
    const fullPath = resolve(process.cwd(), refPath);

    try {
      const content = await readFile(fullPath, 'utf-8');
      const lines = content.split('\n').length;
      refs.push({
        original: match[0],
        path: fullPath,
        content,
        lines,
      });
      console.log(chalk.dim(`  attached: ${relative(process.cwd(), fullPath)} (${lines} lines)`));
    } catch {
      // File doesn't exist — leave the @reference as-is
    }
  }

  return { cleanMessage, refs };
}

export function buildContextWithRefs(message: string, refs: FileRef[]): string {
  if (refs.length === 0) return message;

  let context = '';
  for (const ref of refs) {
    context += `\n\n<file path="${ref.path}">\n${ref.content}\n</file>\n`;
  }

  return message + context;
}

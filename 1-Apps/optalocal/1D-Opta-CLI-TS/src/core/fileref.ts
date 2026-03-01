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
  const matches = [...message.matchAll(pattern)];
  const cleanMessage = message;
  const resolvedRefs = await Promise.all(
    matches.map(async (match): Promise<FileRef | null> => {
      const refPath = match[1]!;
      const fullPath = resolve(process.cwd(), refPath);

      try {
        const content = await readFile(fullPath, 'utf-8');
        const lines = content.split('\n').length;
        return {
          original: match[0],
          path: fullPath,
          content,
          lines,
        };
      } catch {
        // File doesn't exist — leave the @reference as-is
        return null;
      }
    }),
  );

  const refs = resolvedRefs.filter((ref): ref is FileRef => ref !== null);
  for (const ref of refs) {
    console.log(chalk.dim(`  attached: ${relative(process.cwd(), ref.path)} (${ref.lines} lines)`));
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

// --- Image Reference Support ---

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp']);

export interface ImageRef {
  original: string;  // @screenshot.png
  path: string;      // resolved absolute path
  base64: string;    // base64-encoded content
  mimeType: string;  // image/png, image/jpeg, etc.
  name: string;      // filename
}

function getImageMimeType(ext: string): string {
  const mimes: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
  };
  return mimes[ext.toLowerCase()] ?? 'application/octet-stream';
}

/**
 * Check if a path refers to an image file (by extension).
 */
export function isImagePath(path: string): boolean {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  return IMAGE_EXTENSIONS.has(ext);
}

/**
 * Resolve @image references in a message — reads image files as base64.
 *
 * Returns the clean message (with @image refs removed) and an array of
 * ImageRef objects containing the base64 data.
 */
export async function resolveImageRefs(message: string): Promise<{ cleanMessage: string; images: ImageRef[] }> {
  const pattern = /@((?:\.{1,2}\/|[a-z_])[^\s,;:!?'")\]}>]+)/g;
  const matches = [...message.matchAll(pattern)];
  let cleanMessage = message;
  const resolvedImages = await Promise.all(
    matches.map(async (match, idx): Promise<{ index: number; image: ImageRef; bytes: number } | null> => {
      const refPath = match[1]!;
      if (!isImagePath(refPath)) return null;

      const fullPath = resolve(process.cwd(), refPath);
      const ext = refPath.split('.').pop()?.toLowerCase() ?? '';

      try {
        const data = await readFile(fullPath);
        const base64 = data.toString('base64');
        const mimeType = getImageMimeType(ext);
        const name = refPath.split('/').pop() ?? refPath;

        return {
          index: idx,
          image: {
            original: match[0],
            path: fullPath,
            base64,
            mimeType,
            name,
          },
          bytes: data.length,
        };
      } catch {
        // File doesn't exist — leave the @reference as-is
        return null;
      }
    }),
  );

  const orderedImages = resolvedImages
    .filter((entry): entry is { index: number; image: ImageRef; bytes: number } => entry !== null)
    .sort((a, b) => a.index - b.index);
  const images = orderedImages.map((entry) => entry.image);

  for (const entry of orderedImages) {
    cleanMessage = cleanMessage.replace(entry.image.original, '').trim();
    console.log(
      chalk.dim(
        `  attached image: ${relative(process.cwd(), entry.image.path)} (${(entry.bytes / 1024).toFixed(1)} KB)`,
      ),
    );
  }

  return { cleanMessage, images };
}

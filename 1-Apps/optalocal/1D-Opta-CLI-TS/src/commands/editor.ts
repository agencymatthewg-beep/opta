import { writeFileSync, readFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { nanoid } from 'nanoid';
import { isWindows } from '../platform/index.js';

export function getEditorCommand(): string {
  const fallbackEditor = isWindows ? 'notepad' : 'vi';
  return process.env.VISUAL || process.env.EDITOR || fallbackEditor;
}

export function editText(initial = ''): string | null {
  const tmpFile = join(tmpdir(), `opta-${nanoid(6)}.md`);
  writeFileSync(tmpFile, initial, 'utf-8');

  const editor = getEditorCommand();
  try {
    execFileSync(editor, [tmpFile], { stdio: 'inherit' });
    const result = readFileSync(tmpFile, 'utf-8');
    unlinkSync(tmpFile);
    return result.trim() || null;
  } catch {
    try {
      unlinkSync(tmpFile);
    } catch {
      /* ignore */
    }
    return null;
  }
}

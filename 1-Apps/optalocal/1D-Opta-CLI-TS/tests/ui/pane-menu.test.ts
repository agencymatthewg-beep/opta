import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

describe('pane-menu', () => {
  it('does not emit raw ANSI clear-screen control sequences', () => {
    const sourcePath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../src/ui/pane-menu.ts');
    const source = fs.readFileSync(sourcePath, 'utf8');
    expect(source).not.toContain('\u001b[2J\u001b[H');
    expect(source).toContain('cursorTo');
    expect(source).toContain('clearScreenDown');
  });
});

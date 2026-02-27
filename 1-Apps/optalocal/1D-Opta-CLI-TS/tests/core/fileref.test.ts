import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveFileRefs, resolveImageRefs } from '../../src/core/fileref.js';

describe('fileref', () => {
  let workdir = '';
  let originalCwd = '';

  beforeEach(async () => {
    originalCwd = process.cwd();
    workdir = await mkdtemp(join(tmpdir(), 'opta-fileref-'));
    process.chdir(workdir);
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    process.chdir(originalCwd);
    if (workdir) {
      await rm(workdir, { recursive: true, force: true });
    }
  });

  it('resolves multiple file references in order', async () => {
    await writeFile(join(workdir, 'a.ts'), 'const a = 1;\nconst b = 2;\n', 'utf8');
    await writeFile(join(workdir, 'b.ts'), 'export const c = 3;\n', 'utf8');

    const result = await resolveFileRefs('check @a.ts and @b.ts');

    expect(result.cleanMessage).toBe('check @a.ts and @b.ts');
    expect(result.refs).toHaveLength(2);
    expect(result.refs[0]?.original).toBe('@a.ts');
    expect(result.refs[1]?.original).toBe('@b.ts');
    expect(result.refs[0]?.lines).toBe(3);
    expect(result.refs[1]?.lines).toBe(2);
  });

  it('resolves image references and removes tags from clean message', async () => {
    await writeFile(join(workdir, 'img-a.png'), Buffer.from([1, 2, 3, 4]));
    await writeFile(join(workdir, 'img-b.jpg'), Buffer.from([5, 6, 7, 8]));

    const result = await resolveImageRefs('analyze @img-a.png and @img-b.jpg now');

    expect(result.images).toHaveLength(2);
    expect(result.images[0]?.original).toBe('@img-a.png');
    expect(result.images[1]?.original).toBe('@img-b.jpg');
    expect(result.cleanMessage).not.toContain('@img-a.png');
    expect(result.cleanMessage).not.toContain('@img-b.jpg');
  });
});

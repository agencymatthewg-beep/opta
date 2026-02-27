import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  allocateNextUpdateId,
  buildUpdateLogFileName,
  writeUpdateLog,
} from '../../src/journal/update-log.js';

const tempDirs: string[] = [];

async function createTempDir(prefix: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('update-log helpers', () => {
  it('builds numbered update filenames with zero padding', () => {
    const file = buildUpdateLogFileName(203, '2026-02-23', 'Studio Sync: CLI+LMX');
    expect(file).toBe('203_2026-02-23_studio-sync-cli-lmx.md');
  });

  it('allocates next id within 200-series range', async () => {
    const dir = await createTempDir('opta-update-id-');
    await writeFile(join(dir, '199_2026-02-23_ignore.md'), 'x', 'utf-8');
    await writeFile(join(dir, '200_2026-02-23_first.md'), 'x', 'utf-8');
    await writeFile(join(dir, '205_2026-02-23_latest.md'), 'x', 'utf-8');

    const id = await allocateNextUpdateId(dir, 200, 299);
    expect(id).toBe(206);
  });
});

describe('writeUpdateLog', () => {
  it('writes sequential 200-series update logs with required frontmatter', async () => {
    const baseDir = await createTempDir('opta-update-log-');

    const first = await writeUpdateLog({
      summary: 'Promotion sync for CLI and LMX',
      commandInputs: { target: 'both', dryRun: false },
      steps: [{ target: 'local', component: 'cli', step: 'git', status: 'ok', message: 'git sync complete' }],
      cwd: baseDir,
      logsDir: 'updates',
      rangeStart: 200,
      rangeEnd: 299,
      author: 'tester',
      timezone: 'UTC',
      now: new Date('2026-02-23T15:00:00.000Z'),
      promoted: true,
      category: 'sync',
    });

    const second = await writeUpdateLog({
      summary: 'Second promotion sync',
      commandInputs: { target: 'remote' },
      steps: [{ target: 'remote', component: 'lmx', step: 'build', status: 'skip', message: 'skipped' }],
      cwd: baseDir,
      logsDir: 'updates',
      rangeStart: 200,
      rangeEnd: 299,
      author: 'tester',
      timezone: 'UTC',
      now: new Date('2026-02-23T15:05:00.000Z'),
      promoted: true,
      category: 'sync',
    });

    expect(first.id).toBe(200);
    expect(second.id).toBe(201);

    const content = await readFile(first.path, 'utf-8');
    expect(content).toContain('id: 200');
    expect(content).toContain('date: 2026-02-23');
    expect(content).toContain('author: tester');
    expect(content).toContain('version_before:');
    expect(content).toContain('version_after:');
    expect(content).toContain('commit:');
    expect(content).toContain('promoted: true');
    expect(content).toContain('category: sync');
    expect(content).toContain('## Summary');
    expect(content).toContain('## Command Inputs');
    expect(content).toContain('## Step Results');
  });
});

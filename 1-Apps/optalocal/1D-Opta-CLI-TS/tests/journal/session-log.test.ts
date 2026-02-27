import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execa } from 'execa';
import { afterEach, describe, expect, it } from 'vitest';
import {
  buildSessionLogFileName,
  parseGitStatusPorcelain,
  writeSessionLog,
} from '../../src/journal/session-log.js';
import type { Session } from '../../src/memory/store.js';

const tempDirs: string[] = [];

async function createTempDir(prefix: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

function buildSession(overrides: Partial<Session> = {}): Session {
  const now = '2026-02-23T14:00:00.000Z';
  return {
    id: 'sess_abc123',
    created: now,
    updated: now,
    model: 'test-model',
    cwd: process.cwd(),
    title: 'Implement YJS Logs',
    tags: [],
    messages: [
      { role: 'user', content: 'Please add journaling support.' },
      { role: 'assistant', content: 'Decision: add separate journal modules and wire command hooks.' },
    ],
    toolCallCount: 3,
    compacted: false,
    ...overrides,
  };
}

describe('session-log helpers', () => {
  it('builds YJS-style session log file names', () => {
    const file = buildSessionLogFileName(
      { date: '2026-02-23', time: '14:30', compactTime: '1430' },
      'Studio-Mac',
      'Implement YJS Session Logs',
    );

    expect(file).toBe('2026-02-23-1430-studio-mac-implement-yjs-session-logs.md');
  });

  it('parses git porcelain output into created/modified/deleted buckets', () => {
    const parsed = parseGitStatusPorcelain([
      '?? new-file.ts',
      ' M src/existing.ts',
      ' D src/old.ts',
    ].join('\n'));

    expect([...parsed.created]).toEqual(['new-file.ts']);
    expect([...parsed.modified]).toEqual(['src/existing.ts']);
    expect([...parsed.deleted]).toEqual(['src/old.ts']);
  });
});

describe('writeSessionLog', () => {
  it('creates a markdown session log with required sections and checkpoint files', async () => {
    const repoDir = await createTempDir('opta-session-log-');
    await execa('git', ['init'], { cwd: repoDir });

    await writeFile(join(repoDir, 'new-file.ts'), 'console.log("x");\n', 'utf-8');

    const checkpointDir = join(repoDir, '.opta', 'checkpoints', 'sess_abc123');
    await mkdir(checkpointDir, { recursive: true });
    await writeFile(
      join(checkpointDir, 'index.json'),
      JSON.stringify({
        session: 'sess_abc123',
        checkpoints: [{ n: 1, tool: 'edit_file', path: 'src/from-checkpoint.ts', timestamp: '2026-02-23T14:10:00.000Z' }],
      }),
      'utf-8',
    );

    const session = buildSession({ cwd: repoDir, id: 'sess_abc123' });

    const written = await writeSessionLog(session, {
      cwd: repoDir,
      user: 'tester',
      device: 'devbox',
      timezone: 'UTC',
      now: new Date('2026-02-23T14:30:00.000Z'),
    });

    expect(written.path).toContain(join(repoDir, '12-Session-Logs'));

    const content = await readFile(written.path, 'utf-8');
    expect(content).toContain('date: 2026-02-23');
    expect(content).toContain('time:');
    expect(content).toContain('device: devbox');
    expect(content).toContain('user: tester');
    expect(content).toContain('model: test-model');
    expect(content).toContain('duration:');
    expect(content).toContain('## Summary');
    expect(content).toContain('## Files Changed');
    expect(content).toContain('### Created');
    expect(content).toContain('- new-file.ts');
    expect(content).toContain('### Modified');
    expect(content).toContain('- src/from-checkpoint.ts');
    expect(content).toContain('## Status Changes');
    expect(content).toContain('## Decisions Made');
    expect(content).toContain('## Issues Encountered');
    expect(content).toContain('## Next Steps');
    expect(content).toContain('## Notes');
  });
});

import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  BROWSER_RUNTIME_SESSION_STORE_RELATIVE_PATH,
  browserRuntimeSessionStorePath,
  BrowserSessionStore,
  type BrowserRuntimeSessionRecord,
  type BrowserRuntimeSessionStoreData,
} from '../../src/browser/session-store.js';

let testDir = '';

beforeEach(async () => {
  testDir = await mkdtemp(join(tmpdir(), 'opta-session-store-test-'));
});

afterEach(async () => {
  if (testDir) {
    await rm(testDir, { recursive: true, force: true });
    testDir = '';
  }
});

function makeRecord(overrides: Partial<BrowserRuntimeSessionRecord> = {}): BrowserRuntimeSessionRecord {
  return {
    sessionId: overrides.sessionId ?? 'session-1',
    mode: overrides.mode ?? 'isolated',
    status: overrides.status ?? 'open',
    runtime: overrides.runtime ?? 'playwright',
    createdAt: overrides.createdAt ?? '2026-02-23T10:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-02-23T10:01:00.000Z',
    currentUrl: overrides.currentUrl,
    wsEndpoint: overrides.wsEndpoint,
    lastError: overrides.lastError,
    recoveredAt: overrides.recoveredAt,
  };
}

function makeStoreData(
  sessions: BrowserRuntimeSessionRecord[] = [],
  updatedAt = '2026-02-23T10:00:00.000Z',
): BrowserRuntimeSessionStoreData {
  return {
    schemaVersion: 1,
    updatedAt,
    sessions,
  };
}

const fixedNow = new Date('2026-02-23T12:00:00.000Z');

function createStore(cwd?: string): BrowserSessionStore {
  return new BrowserSessionStore({
    cwd: cwd ?? testDir,
    now: () => fixedNow,
  });
}

describe('BROWSER_RUNTIME_SESSION_STORE_RELATIVE_PATH', () => {
  it('contains expected path segments', () => {
    expect(BROWSER_RUNTIME_SESSION_STORE_RELATIVE_PATH).toContain('.opta');
    expect(BROWSER_RUNTIME_SESSION_STORE_RELATIVE_PATH).toContain('browser');
    expect(BROWSER_RUNTIME_SESSION_STORE_RELATIVE_PATH).toContain('runtime-sessions.json');
  });
});

describe('browserRuntimeSessionStorePath', () => {
  it('joins cwd with relative path', () => {
    const result = browserRuntimeSessionStorePath('/my/project');
    expect(result).toBe(join('/my/project', BROWSER_RUNTIME_SESSION_STORE_RELATIVE_PATH));
  });
});

describe('BrowserSessionStore', () => {
  describe('constructor and path', () => {
    it('resolves path relative to cwd', () => {
      const store = createStore('/test/dir');
      expect(store.path).toBe(browserRuntimeSessionStorePath('/test/dir'));
    });

    it('defaults cwd to process.cwd()', () => {
      const store = new BrowserSessionStore();
      expect(store.path).toBe(browserRuntimeSessionStorePath(process.cwd()));
    });
  });

  describe('read', () => {
    it('returns empty data when file does not exist', async () => {
      const store = createStore();
      const data = await store.read();
      expect(data.schemaVersion).toBe(1);
      expect(data.sessions).toEqual([]);
    });

    it('reads and parses valid JSON file', async () => {
      const store = createStore();
      const records = [makeRecord({ sessionId: 's1' }), makeRecord({ sessionId: 's2' })];
      const storeData = makeStoreData(records, '2026-02-23T11:00:00.000Z');

      const dir = join(testDir, '.opta', 'browser');
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, 'runtime-sessions.json'), JSON.stringify(storeData), 'utf-8');

      const data = await store.read();
      expect(data.sessions).toHaveLength(2);
      expect(data.sessions[0]!.sessionId).toBe('s1');
      expect(data.sessions[1]!.sessionId).toBe('s2');
      expect(data.updatedAt).toBe('2026-02-23T11:00:00.000Z');
    });

    it('returns empty data for malformed JSON', async () => {
      const store = createStore();
      const dir = join(testDir, '.opta', 'browser');
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, 'runtime-sessions.json'), '{not valid json', 'utf-8');

      const data = await store.read();
      expect(data.sessions).toEqual([]);
      expect(data.schemaVersion).toBe(1);
    });

    it('sanitizes data with invalid session records', async () => {
      const store = createStore();
      const dir = join(testDir, '.opta', 'browser');
      await mkdir(dir, { recursive: true });
      const invalidData = {
        schemaVersion: 1,
        updatedAt: '2026-02-23T10:00:00.000Z',
        sessions: [
          makeRecord({ sessionId: 'valid' }),
          { sessionId: 'missing-fields' }, // missing mode, status, runtime, etc.
          null,
          42,
          makeRecord({ sessionId: 'also-valid', mode: 'attach', status: 'closed', runtime: 'unavailable' }),
        ],
      };
      await writeFile(join(dir, 'runtime-sessions.json'), JSON.stringify(invalidData), 'utf-8');

      const data = await store.read();
      expect(data.sessions).toHaveLength(2);
      expect(data.sessions[0]!.sessionId).toBe('valid');
      expect(data.sessions[1]!.sessionId).toBe('also-valid');
    });

    it('returns empty sessions for null/array/primitive root', async () => {
      const store = createStore();
      const dir = join(testDir, '.opta', 'browser');
      await mkdir(dir, { recursive: true });

      await writeFile(join(dir, 'runtime-sessions.json'), 'null', 'utf-8');
      let data = await store.read();
      expect(data.sessions).toEqual([]);

      await writeFile(join(dir, 'runtime-sessions.json'), '[1,2,3]', 'utf-8');
      data = await store.read();
      expect(data.sessions).toEqual([]);

      await writeFile(join(dir, 'runtime-sessions.json'), '"string"', 'utf-8');
      data = await store.read();
      expect(data.sessions).toEqual([]);
    });

    it('uses epoch timestamp when updatedAt is not a string', async () => {
      const store = createStore();
      const dir = join(testDir, '.opta', 'browser');
      await mkdir(dir, { recursive: true });
      await writeFile(
        join(dir, 'runtime-sessions.json'),
        JSON.stringify({ schemaVersion: 1, updatedAt: 42, sessions: [] }),
        'utf-8',
      );

      const data = await store.read();
      expect(data.updatedAt).toBe(new Date(0).toISOString());
    });

    it('throws for non-ENOENT fs errors', async () => {
      const store = createStore();
      // Create a directory where the file should be to cause a read error
      await mkdir(store.path, { recursive: true });
      await expect(store.read()).rejects.toThrow('Failed to read browser runtime session store');
    });
  });

  describe('write', () => {
    it('creates directories and writes valid JSON', async () => {
      const store = createStore();
      const records = [makeRecord({ sessionId: 'ws1' })];
      await store.write(makeStoreData(records));

      const raw = await readFile(store.path, 'utf-8');
      const parsed = JSON.parse(raw) as BrowserRuntimeSessionStoreData;
      expect(parsed.schemaVersion).toBe(1);
      expect(parsed.sessions).toHaveLength(1);
      expect(parsed.sessions[0]!.sessionId).toBe('ws1');
      expect(parsed.updatedAt).toBe(fixedNow.toISOString());
    });

    it('overwrites existing file', async () => {
      const store = createStore();
      await store.write(makeStoreData([makeRecord({ sessionId: 'first' })]));
      await store.write(makeStoreData([makeRecord({ sessionId: 'second' })]));

      const raw = await readFile(store.path, 'utf-8');
      const parsed = JSON.parse(raw) as BrowserRuntimeSessionStoreData;
      expect(parsed.sessions).toHaveLength(1);
      expect(parsed.sessions[0]!.sessionId).toBe('second');
    });

    it('sanitizes input data before writing', async () => {
      const store = createStore();
      // Pass invalid sessions — should be filtered out
      const data = {
        schemaVersion: 1 as const,
        updatedAt: '2026-02-23T10:00:00.000Z',
        sessions: [
          makeRecord({ sessionId: 'valid' }),
          { sessionId: 'bad', mode: 'invalid' } as unknown as BrowserRuntimeSessionRecord,
        ],
      };
      await store.write(data);

      const raw = await readFile(store.path, 'utf-8');
      const parsed = JSON.parse(raw) as BrowserRuntimeSessionStoreData;
      expect(parsed.sessions).toHaveLength(1);
      expect(parsed.sessions[0]!.sessionId).toBe('valid');
    });

    it('updates the updatedAt field using now()', async () => {
      const store = createStore();
      await store.write(makeStoreData([], '2020-01-01T00:00:00.000Z'));

      const raw = await readFile(store.path, 'utf-8');
      const parsed = JSON.parse(raw) as BrowserRuntimeSessionStoreData;
      expect(parsed.updatedAt).toBe(fixedNow.toISOString());
    });
  });

  describe('list', () => {
    it('returns empty array when store does not exist', async () => {
      const store = createStore();
      const sessions = await store.list();
      expect(sessions).toEqual([]);
    });

    it('returns copy of sessions', async () => {
      const store = createStore();
      const records = [
        makeRecord({ sessionId: 'a' }),
        makeRecord({ sessionId: 'b' }),
      ];
      await store.write(makeStoreData(records));

      const sessions = await store.list();
      expect(sessions).toHaveLength(2);
      expect(sessions[0]!.sessionId).toBe('a');
      expect(sessions[1]!.sessionId).toBe('b');

      // Verify it's a copy (mutating returned array does not affect next read)
      sessions.pop();
      const sessions2 = await store.list();
      expect(sessions2).toHaveLength(2);
    });
  });

  describe('replaceSessions', () => {
    it('replaces all sessions', async () => {
      const store = createStore();
      await store.write(makeStoreData([
        makeRecord({ sessionId: 'old-1' }),
        makeRecord({ sessionId: 'old-2' }),
      ]));

      await store.replaceSessions([
        makeRecord({ sessionId: 'new-1' }),
      ]);

      const sessions = await store.list();
      expect(sessions).toHaveLength(1);
      expect(sessions[0]!.sessionId).toBe('new-1');
    });

    it('writes empty sessions array', async () => {
      const store = createStore();
      await store.write(makeStoreData([makeRecord({ sessionId: 'existing' })]));
      await store.replaceSessions([]);

      const sessions = await store.list();
      expect(sessions).toEqual([]);
    });

    it('uses now() for updatedAt', async () => {
      const store = createStore();
      await store.replaceSessions([makeRecord()]);

      const data = await store.read();
      expect(data.updatedAt).toBe(fixedNow.toISOString());
    });
  });

  describe('sanitizeData edge cases', () => {
    it('filters records with invalid mode', async () => {
      const store = createStore();
      const dir = join(testDir, '.opta', 'browser');
      await mkdir(dir, { recursive: true });
      const data = {
        schemaVersion: 1,
        updatedAt: '2026-02-23T10:00:00.000Z',
        sessions: [
          { ...makeRecord(), mode: 'invalid-mode' },
          makeRecord({ sessionId: 'valid', mode: 'attach' }),
        ],
      };
      await writeFile(join(dir, 'runtime-sessions.json'), JSON.stringify(data), 'utf-8');

      const result = await store.read();
      expect(result.sessions).toHaveLength(1);
      expect(result.sessions[0]!.sessionId).toBe('valid');
    });

    it('filters records with invalid status', async () => {
      const store = createStore();
      const dir = join(testDir, '.opta', 'browser');
      await mkdir(dir, { recursive: true });
      const data = {
        schemaVersion: 1,
        updatedAt: '2026-02-23T10:00:00.000Z',
        sessions: [
          { ...makeRecord(), status: 'pending' },
          makeRecord({ sessionId: 'ok', status: 'closed' }),
        ],
      };
      await writeFile(join(dir, 'runtime-sessions.json'), JSON.stringify(data), 'utf-8');

      const result = await store.read();
      expect(result.sessions).toHaveLength(1);
      expect(result.sessions[0]!.sessionId).toBe('ok');
    });

    it('filters records with invalid runtime', async () => {
      const store = createStore();
      const dir = join(testDir, '.opta', 'browser');
      await mkdir(dir, { recursive: true });
      const data = {
        schemaVersion: 1,
        updatedAt: '2026-02-23T10:00:00.000Z',
        sessions: [
          { ...makeRecord(), runtime: 'puppeteer' },
          makeRecord({ sessionId: 'ok', runtime: 'unavailable' }),
        ],
      };
      await writeFile(join(dir, 'runtime-sessions.json'), JSON.stringify(data), 'utf-8');

      const result = await store.read();
      expect(result.sessions).toHaveLength(1);
      expect(result.sessions[0]!.sessionId).toBe('ok');
    });

    it('filters records missing createdAt or updatedAt', async () => {
      const store = createStore();
      const dir = join(testDir, '.opta', 'browser');
      await mkdir(dir, { recursive: true });
      const validBase = {
        sessionId: 'x',
        mode: 'isolated',
        status: 'open',
        runtime: 'playwright',
      };
      const data = {
        schemaVersion: 1,
        updatedAt: '2026-02-23T10:00:00.000Z',
        sessions: [
          { ...validBase, sessionId: 'no-created', updatedAt: '2026-02-23T10:00:00.000Z' },
          { ...validBase, sessionId: 'no-updated', createdAt: '2026-02-23T10:00:00.000Z' },
          { ...validBase, sessionId: 'valid', createdAt: '2026-02-23T10:00:00.000Z', updatedAt: '2026-02-23T10:01:00.000Z' },
        ],
      };
      await writeFile(join(dir, 'runtime-sessions.json'), JSON.stringify(data), 'utf-8');

      const result = await store.read();
      expect(result.sessions).toHaveLength(1);
      expect(result.sessions[0]!.sessionId).toBe('valid');
    });

    it('handles non-array sessions field gracefully', async () => {
      const store = createStore();
      const dir = join(testDir, '.opta', 'browser');
      await mkdir(dir, { recursive: true });
      const data = {
        schemaVersion: 1,
        updatedAt: '2026-02-23T10:00:00.000Z',
        sessions: 'not-an-array',
      };
      await writeFile(join(dir, 'runtime-sessions.json'), JSON.stringify(data), 'utf-8');

      const result = await store.read();
      expect(result.sessions).toEqual([]);
    });
  });
});

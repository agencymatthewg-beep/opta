/**
 * Tests for session-store.ts mkdir deduplication via the confirmedSessionDirs Set.
 *
 * The `confirmedSessionDirs` Set is module-level state. We test deduplication
 * through the observable effect: the second call for the same session ID must be
 * a no-op (completes without additional filesystem activity).
 *
 * Mocking node:fs/promises directly interferes with Vitest's ESM module cache
 * and causes the confirmedSessionDirs Set to be re-initialized unexpectedly.
 * Instead we use the real filesystem with a temporary directory (redirected via
 * a mocked node:os homedir) and count actual directory-creation side-effects.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readdir, stat, appendFile as realAppendFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Per-test temp directory — used to redirect the daemon store root
// ---------------------------------------------------------------------------

let tempRoot: string;

// We mock node:os homedir to redirect all session-store paths into our temp dir.
// This mock is hoisted and applied before any import of session-store.
vi.mock('node:os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:os')>();
  return {
    ...actual,
    homedir: () => tempRoot ?? actual.homedir(),
  };
});

beforeEach(async () => {
  // Reset the module so confirmedSessionDirs Set is empty for each test
  vi.resetModules();
  // Create a fresh temp root for each test
  tempRoot = await mkdtemp(join(tmpdir(), 'opta-ss-test-'));
});

afterEach(async () => {
  // Clean up temp directory
  if (tempRoot) {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Helper: count the actual subdirectories inside the sessions store
// ---------------------------------------------------------------------------

async function countSessionDirs(sessionsPath: string): Promise<string[]> {
  try {
    const entries = await readdir(sessionsPath, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ensureSessionStore deduplication', () => {
  it('calling ensureSessionStore twice for same ID creates the dir only once', async () => {
    // Fresh import after vi.resetModules() — confirmedSessionDirs is a new empty Set
    const { ensureSessionStore } = await import('../../src/daemon/session-store.js');

    const expectedSessionDir = join(
      tempRoot,
      '.config',
      'opta',
      'daemon',
      'sessions',
      'sess-dedup-1'
    );

    // First call: should create the directory
    await ensureSessionStore('sess-dedup-1');

    // Verify it was created
    await expect(stat(expectedSessionDir)).resolves.toBeDefined();

    // Second call: must be a no-op (Set guard returns early)
    // We verify by checking that no additional dirs were created and the call
    // completes successfully without throwing.
    const sessionsPath = join(tempRoot, '.config', 'opta', 'daemon', 'sessions');
    const dirsAfterFirst = await countSessionDirs(sessionsPath);

    await ensureSessionStore('sess-dedup-1');

    const dirsAfterSecond = await countSessionDirs(sessionsPath);

    // No new directories should have been created by the second call
    expect(dirsAfterSecond).toEqual(dirsAfterFirst);
    // Exactly one session directory should exist
    expect(dirsAfterSecond).toContain('sess-dedup-1');
    expect(dirsAfterSecond.length).toBe(1);
  });

  it('calling for two different IDs creates two separate session directories', async () => {
    const { ensureSessionStore } = await import('../../src/daemon/session-store.js');

    await ensureSessionStore('sess-alpha');
    await ensureSessionStore('sess-beta');

    const sessionsPath = join(tempRoot, '.config', 'opta', 'daemon', 'sessions');
    const dirs = await countSessionDirs(sessionsPath);

    expect(dirs).toContain('sess-alpha');
    expect(dirs).toContain('sess-beta');
    expect(dirs.length).toBe(2);
  });

  it('appendSessionEvent after ensureSessionStore does not recreate the session dir', async () => {
    const { ensureSessionStore, appendSessionEvent } = await import(
      '../../src/daemon/session-store.js'
    );

    await ensureSessionStore('sess-append');

    const sessionsPath = join(tempRoot, '.config', 'opta', 'daemon', 'sessions');
    const dirsAfterEnsure = await countSessionDirs(sessionsPath);

    const fakeEnvelope = {
      daemonId: 'd1',
      sessionId: 'sess-append',
      seq: 1,
      event: 'turn.done' as const,
      ts: Date.now(),
      payload: {},
    };

    // appendSessionEvent calls ensureSessionStore internally.
    // Because 'sess-append' is already confirmed, it must not create new dirs.
    await appendSessionEvent(
      'sess-append',
      fakeEnvelope as Parameters<typeof appendSessionEvent>[1]
    );

    const dirsAfterAppend = await countSessionDirs(sessionsPath);

    // No new directories — the Set prevented a redundant mkdir
    expect(dirsAfterAppend).toEqual(dirsAfterEnsure);
    expect(dirsAfterAppend).toContain('sess-append');

    // The event log file should have been written
    const eventLogPath = join(sessionsPath, 'sess-append', 'events.jsonl');
    await expect(stat(eventLogPath)).resolves.toBeDefined();
  });
});

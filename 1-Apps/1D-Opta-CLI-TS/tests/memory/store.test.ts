import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  createSession,
  loadSession,
  saveSession,
  listSessions,
  deleteSession,
  exportSession,
  generateTitle,
} from '../../src/memory/store.js';
import type { Session } from '../../src/memory/store.js';

// Override sessions dir for testing
const TEST_SESSIONS_DIR = join(tmpdir(), `opta-test-sessions-${Date.now()}`);

// We need to mock the homedir to redirect session storage to temp dir
import { vi } from 'vitest';
vi.mock('node:os', async () => {
  const actual = await vi.importActual<typeof import('node:os')>('node:os');
  return {
    ...actual,
    homedir: () => join(TEST_SESSIONS_DIR, 'home'),
  };
});

beforeEach(async () => {
  await mkdir(join(TEST_SESSIONS_DIR, 'home', '.config', 'opta', 'sessions'), {
    recursive: true,
  });
});

afterEach(async () => {
  await rm(TEST_SESSIONS_DIR, { recursive: true, force: true });
});

describe('session store', () => {
  describe('createSession', () => {
    it('creates a session with correct defaults', async () => {
      const session = await createSession('test-model');
      expect(session.id).toBeTruthy();
      expect(session.id.length).toBe(12);
      expect(session.model).toBe('test-model');
      expect(session.title).toBe('');
      expect(session.messages).toEqual([]);
      expect(session.toolCallCount).toBe(0);
      expect(session.compacted).toBe(false);
      expect(session.created).toBeTruthy();
      expect(session.updated).toBeTruthy();
      expect(session.cwd).toBeTruthy();
    });

    it('persists session to disk', async () => {
      const session = await createSession('test-model');
      const loaded = await loadSession(session.id);
      expect(loaded.id).toBe(session.id);
      expect(loaded.model).toBe('test-model');
    });
  });

  describe('saveSession / loadSession', () => {
    it('round-trips session data', async () => {
      const session = await createSession('test-model');
      session.title = 'Test title';
      session.messages = [
        { role: 'system', content: 'You are a helper' },
        { role: 'user', content: 'Hello' },
      ];
      session.toolCallCount = 5;

      await saveSession(session);
      const loaded = await loadSession(session.id);

      expect(loaded.title).toBe('Test title');
      expect(loaded.messages).toHaveLength(2);
      expect(loaded.toolCallCount).toBe(5);
    });

    it('updates the updated timestamp on save', async () => {
      const session = await createSession('test-model');
      const firstUpdated = session.updated;

      // Small delay to ensure timestamp differs
      await new Promise((r) => setTimeout(r, 10));
      await saveSession(session);

      const loaded = await loadSession(session.id);
      expect(loaded.updated).not.toBe(firstUpdated);
    });
  });

  describe('listSessions', () => {
    it('returns empty array when no sessions exist', async () => {
      // Clear any sessions created by other tests
      const dir = join(TEST_SESSIONS_DIR, 'home', '.config', 'opta', 'sessions');
      const files = await readdir(dir);
      for (const f of files) {
        await rm(join(dir, f));
      }

      const items = await listSessions();
      expect(items).toEqual([]);
    });

    it('lists multiple sessions sorted by created date (newest first)', async () => {
      const s1 = await createSession('model-a');
      s1.title = 'First session';
      await saveSession(s1);

      await new Promise((r) => setTimeout(r, 10));

      const s2 = await createSession('model-b');
      s2.title = 'Second session';
      await saveSession(s2);

      const items = await listSessions();
      expect(items.length).toBeGreaterThanOrEqual(2);
      // Newest first
      const idx1 = items.findIndex((i) => i.id === s1.id);
      const idx2 = items.findIndex((i) => i.id === s2.id);
      expect(idx2).toBeLessThan(idx1);
    });

    it('includes message count (excluding system messages)', async () => {
      const session = await createSession('test-model');
      session.messages = [
        { role: 'system', content: 'system prompt' },
        { role: 'user', content: 'hello' },
        { role: 'assistant', content: 'hi there' },
      ];
      await saveSession(session);

      const items = await listSessions();
      const found = items.find((i) => i.id === session.id);
      expect(found?.messageCount).toBe(2); // user + assistant, not system
    });
  });

  describe('deleteSession', () => {
    it('removes session file', async () => {
      const session = await createSession('test-model');
      await deleteSession(session.id);

      await expect(loadSession(session.id)).rejects.toThrow();
    });

    it('does not throw for non-existent session', async () => {
      await expect(deleteSession('nonexistent')).resolves.not.toThrow();
    });
  });

  describe('exportSession', () => {
    it('returns valid JSON string', async () => {
      const session = await createSession('test-model');
      session.title = 'Export test';
      await saveSession(session);

      const json = await exportSession(session.id);
      const parsed = JSON.parse(json);
      expect(parsed.id).toBe(session.id);
      expect(parsed.title).toBe('Export test');
    });

    it('throws for non-existent session', async () => {
      await expect(exportSession('nonexistent')).rejects.toThrow();
    });
  });

  describe('generateTitle', () => {
    it('truncates to 60 chars', () => {
      const long = 'a'.repeat(100);
      expect(generateTitle(long).length).toBe(60);
    });

    it('trims whitespace', () => {
      expect(generateTitle('  hello  ')).toBe('hello');
    });

    it('replaces newlines with spaces', () => {
      expect(generateTitle('line one\nline two')).toBe('line one line two');
    });

    it('handles short messages', () => {
      expect(generateTitle('fix bug')).toBe('fix bug');
    });
  });
});

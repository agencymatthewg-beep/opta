import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdir, rm, readFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { AgentMessage } from '../../src/core/agent.js';
import type { RecoveryCheckpoint } from '../../src/memory/recovery.js';

// ---------------------------------------------------------------------------
// Use a real temp directory so we can verify actual file I/O.
// The recovery module writes to the relative path ".opta/recovery" from CWD,
// so we change process.cwd() to the temp directory before the module is
// imported, then restore it afterwards.
// ---------------------------------------------------------------------------

const TEST_BASE = join(tmpdir(), `opta-test-recovery-${Date.now()}`);
const TEST_RECOVERY_DIR = join(TEST_BASE, '.opta', 'recovery');

// Change CWD to TEST_BASE so the relative RECOVERY_DIR resolves there.
const originalCwd = process.cwd();
vi.spyOn(process, 'cwd').mockReturnValue(TEST_BASE);

// Import the module AFTER the spy so the module-level path constant
// picks up the mocked CWD. However, RECOVERY_DIR is a string literal
// '.opta/recovery' so it is always relative — mkdir/writeFile/unlink
// in Node resolve relative paths against the real process.cwd() at
// call-time, not at module-load-time. The spy ensures that if the
// module ever calls process.cwd() it returns TEST_BASE, but since the
// module uses a literal path we just need to ensure the real CWD is
// TEST_BASE when the file operations run.
// We achieve this by actually changing the real CWD with chdir, but
// only inside beforeEach/afterEach.

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function makeMessages(count: number): AgentMessage[] {
  return Array.from({ length: count }, (_, i) => ({
    role: i % 2 === 0 ? ('user' as const) : ('assistant' as const),
    content: `message ${i}`,
  }));
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function readCheckpoint(sessionId: string): Promise<RecoveryCheckpoint> {
  const data = await readFile(join(TEST_RECOVERY_DIR, `${sessionId}.json`), 'utf8');
  return JSON.parse(data) as RecoveryCheckpoint;
}

// ---------------------------------------------------------------------------
// setup / teardown
// ---------------------------------------------------------------------------

beforeEach(async () => {
  await mkdir(TEST_RECOVERY_DIR, { recursive: true });
  // Change real CWD so '.opta/recovery' in the module resolves to TEST_BASE
  process.chdir(TEST_BASE);
});

afterEach(async () => {
  process.chdir(originalCwd);
  await rm(TEST_BASE, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// tests
// ---------------------------------------------------------------------------

describe('recovery module', () => {
  describe('writeRecoveryCheckpoint', () => {
    it('creates a file with the correct JSON shape', async () => {
      const { writeRecoveryCheckpoint } = await import('../../src/memory/recovery.js');

      const sessionId = 'test-session-001';
      const messages = makeMessages(4);
      const toolCallCount = 10;

      await writeRecoveryCheckpoint(sessionId, messages, toolCallCount);

      const checkpoint = await readCheckpoint(sessionId);

      expect(checkpoint.sessionId).toBe(sessionId);
      expect(checkpoint.toolCallCount).toBe(toolCallCount);
      expect(checkpoint.messageCount).toBe(messages.length);
      expect(checkpoint.messages).toHaveLength(messages.length);

      // savedAt must be a valid ISO8601 string
      const parsed = new Date(checkpoint.savedAt);
      expect(Number.isNaN(parsed.getTime())).toBe(false);
      expect(parsed.toISOString()).toBe(checkpoint.savedAt);
    });

    it('messages array in checkpoint matches input messages', async () => {
      const { writeRecoveryCheckpoint } = await import('../../src/memory/recovery.js');

      const sessionId = 'test-session-002';
      const messages = makeMessages(6);

      await writeRecoveryCheckpoint(sessionId, messages, 20);

      const checkpoint = await readCheckpoint(sessionId);
      expect(checkpoint.messages).toEqual(messages);
    });

    it('overwrites an existing checkpoint (idempotent per session)', async () => {
      const { writeRecoveryCheckpoint } = await import('../../src/memory/recovery.js');

      const sessionId = 'test-session-003';

      await writeRecoveryCheckpoint(sessionId, makeMessages(2), 10);
      const first = await readCheckpoint(sessionId);

      await writeRecoveryCheckpoint(sessionId, makeMessages(6), 20);
      const second = await readCheckpoint(sessionId);

      expect(second.toolCallCount).toBe(20);
      expect(second.messageCount).toBe(6);
      // savedAt of second write must be >= first write
      expect(new Date(second.savedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(first.savedAt).getTime(),
      );
    });

    it('creates the recovery directory if it does not exist', async () => {
      const { writeRecoveryCheckpoint } = await import('../../src/memory/recovery.js');

      // Remove the directory that beforeEach created
      await rm(TEST_RECOVERY_DIR, { recursive: true, force: true });

      const sessionId = 'test-session-004';
      await writeRecoveryCheckpoint(sessionId, makeMessages(2), 10);

      const exists = await fileExists(join(TEST_RECOVERY_DIR, `${sessionId}.json`));
      expect(exists).toBe(true);
    });
  });

  describe('deleteRecoveryCheckpoint', () => {
    it('removes an existing recovery file', async () => {
      const { writeRecoveryCheckpoint, deleteRecoveryCheckpoint } = await import(
        '../../src/memory/recovery.js'
      );

      const sessionId = 'test-session-005';
      await writeRecoveryCheckpoint(sessionId, makeMessages(2), 10);

      const existsBefore = await fileExists(join(TEST_RECOVERY_DIR, `${sessionId}.json`));
      expect(existsBefore).toBe(true);

      await deleteRecoveryCheckpoint(sessionId);

      const existsAfter = await fileExists(join(TEST_RECOVERY_DIR, `${sessionId}.json`));
      expect(existsAfter).toBe(false);
    });

    it('does not throw when the file does not exist', async () => {
      const { deleteRecoveryCheckpoint } = await import('../../src/memory/recovery.js');
      await expect(deleteRecoveryCheckpoint('nonexistent-session')).resolves.not.toThrow();
    });
  });
});

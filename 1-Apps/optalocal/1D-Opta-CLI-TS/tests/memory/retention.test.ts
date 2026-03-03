import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { getSessionsDir } from '../../src/platform/paths.js';
import {
  createSession,
  listSessions,
  loadSession,
  saveSession,
} from '../../src/memory/store.js';
import {
  PIN_TAG,
  applySessionPrune,
  getRetentionPolicy,
  listPinnedSessions,
  pinSession,
  planSessionPrune,
  setRetentionPolicy,
  unpinSession,
} from '../../src/memory/retention.js';

const TEST_ROOT = join(tmpdir(), `opta-test-retention-${Date.now()}`);

vi.mock('node:os', async () => {
  const actual = await vi.importActual<typeof import('node:os')>('node:os');
  return {
    ...actual,
    homedir: () => join(TEST_ROOT, 'home'),
  };
});

async function setSessionCreatedAt(id: string, createdAtIso: string): Promise<void> {
  const session = await loadSession(id);
  session.created = createdAtIso;
  await saveSession(session);
}

beforeEach(async () => {
  await mkdir(join(TEST_ROOT, 'home', '.config', 'opta', 'sessions'), {
    recursive: true,
  });
});

afterEach(async () => {
  await rm(TEST_ROOT, { recursive: true, force: true });
});

describe('memory retention', () => {
  it('returns default retention policy when policy file is missing', async () => {
    await expect(getRetentionPolicy()).resolves.toEqual({
      days: 30,
      preservePinned: true,
    });
  });

  it('persists retention policy to retention-policy.json', async () => {
    const policy = await setRetentionPolicy({
      days: 14,
      preservePinned: false,
    });

    expect(policy).toEqual({ days: 14, preservePinned: false });
    await expect(getRetentionPolicy()).resolves.toEqual({
      days: 14,
      preservePinned: false,
    });

    const policyPath = join(getSessionsDir(), 'retention-policy.json');
    const raw = await readFile(policyPath, 'utf-8');
    expect(JSON.parse(raw)).toEqual({
      days: 14,
      preservePinned: false,
    });
  });

  it('pins and unpins sessions via the pinned tag', async () => {
    const session = await createSession('test-model');

    const pinned = await pinSession(session.id);
    expect(pinned).toMatchObject({
      id: session.id,
      pinned: true,
      alreadyPinned: false,
    });
    expect(pinned.tags).toContain(PIN_TAG);

    const pinnedList = await listPinnedSessions();
    expect(pinnedList.map((entry) => entry.id)).toContain(session.id);

    const unpinned = await unpinSession(session.id);
    expect(unpinned).toMatchObject({
      id: session.id,
      pinned: false,
      alreadyPinned: true,
    });
    expect(unpinned.tags).not.toContain(PIN_TAG);

    const afterUnpin = await listPinnedSessions();
    expect(afterUnpin.map((entry) => entry.id)).not.toContain(session.id);
  });

  it('plans and applies prune while preserving pinned sessions when configured', async () => {
    await setRetentionPolicy({ days: 30, preservePinned: true });

    const now = new Date('2026-03-03T12:00:00.000Z');
    const staleIso = new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000).toISOString();
    const freshIso = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();

    const staleUnpinned = await createSession('test-model');
    await setSessionCreatedAt(staleUnpinned.id, staleIso);

    const stalePinned = await createSession('test-model');
    await setSessionCreatedAt(stalePinned.id, staleIso);
    await pinSession(stalePinned.id);

    const fresh = await createSession('test-model');
    await setSessionCreatedAt(fresh.id, freshIso);

    const plan = await planSessionPrune({ now: () => now });
    expect(plan.policy).toEqual({ days: 30, preservePinned: true });
    expect(plan.scanned).toBe(3);
    expect(plan.preservedPinned).toBe(1);
    expect(plan.candidates.map((entry) => entry.id)).toEqual([staleUnpinned.id]);
    expect(plan.kept.map((entry) => entry.id).sort()).toEqual([fresh.id, stalePinned.id].sort());

    const applied = await applySessionPrune({ now: () => now });
    expect(applied.pruned.map((entry) => entry.id)).toEqual([staleUnpinned.id]);

    const remaining = await listSessions();
    expect(remaining.map((entry) => entry.id).sort()).toEqual([fresh.id, stalePinned.id].sort());
  });
});

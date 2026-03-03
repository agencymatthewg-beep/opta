import { beforeEach, describe, expect, it, vi } from 'vitest';

const listSessionsMock = vi.fn();
const deleteSessionMock = vi.fn();
const exportSessionMock = vi.fn();
const searchSessionsMock = vi.fn();
const pinSessionMock = vi.fn();
const unpinSessionMock = vi.fn();
const listPinnedSessionsMock = vi.fn();
const getRetentionPolicyMock = vi.fn();
const setRetentionPolicyMock = vi.fn();
const planSessionPruneMock = vi.fn();
const applySessionPruneMock = vi.fn();

vi.mock('../../src/memory/store.js', () => ({
  listSessions: listSessionsMock,
  deleteSession: deleteSessionMock,
  exportSession: exportSessionMock,
  searchSessions: searchSessionsMock,
}));

vi.mock('../../src/memory/retention.js', () => ({
  pinSession: pinSessionMock,
  unpinSession: unpinSessionMock,
  listPinnedSessions: listPinnedSessionsMock,
  getRetentionPolicy: getRetentionPolicyMock,
  setRetentionPolicy: setRetentionPolicyMock,
  planSessionPrune: planSessionPruneMock,
  applySessionPrune: applySessionPruneMock,
}));

let stdout: string[] = [];
let stderr: string[] = [];

beforeEach(() => {
  stdout = [];
  stderr = [];
  listSessionsMock.mockReset();
  deleteSessionMock.mockReset();
  exportSessionMock.mockReset();
  searchSessionsMock.mockReset();
  pinSessionMock.mockReset();
  unpinSessionMock.mockReset();
  listPinnedSessionsMock.mockReset();
  getRetentionPolicyMock.mockReset();
  setRetentionPolicyMock.mockReset();
  planSessionPruneMock.mockReset();
  applySessionPruneMock.mockReset();

  vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
    stdout.push(args.map(String).join(' '));
  });
  vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    stderr.push(args.map(String).join(' '));
  });
});

describe('sessions command', () => {
  it('returns an empty JSON array for list --json when there are no sessions', async () => {
    listSessionsMock.mockResolvedValueOnce([]);

    const { sessions } = await import('../../src/commands/sessions.js');
    await sessions('list', undefined, { json: true });

    const payload = JSON.parse(stdout.join('\n'));
    expect(payload).toEqual([]);
    expect(stderr).toHaveLength(0);
  });

  it('returns an empty JSON array for search --json when no sessions match', async () => {
    searchSessionsMock.mockResolvedValueOnce([]);

    const { sessions } = await import('../../src/commands/sessions.js');
    await sessions('search', 'missing query', { json: true });

    const payload = JSON.parse(stdout.join('\n'));
    expect(payload).toEqual([]);
    expect(stderr).toHaveLength(0);
  });

  it('keeps human-readable list output when not using --json', async () => {
    listSessionsMock.mockResolvedValueOnce([]);

    const { sessions } = await import('../../src/commands/sessions.js');
    await sessions('list');

    expect(stdout.join('\n')).toContain('No sessions found');
    expect(stderr).toHaveLength(0);
  });

  it('pins a session and returns JSON output', async () => {
    pinSessionMock.mockResolvedValueOnce({
      id: 'sess-pin-1',
      pinned: true,
      alreadyPinned: false,
      tags: ['pinned'],
    });

    const { sessions } = await import('../../src/commands/sessions.js');
    await sessions('pin', 'sess-pin-1', { json: true });

    expect(pinSessionMock).toHaveBeenCalledWith('sess-pin-1');
    expect(JSON.parse(stdout.join('\n'))).toEqual({
      id: 'sess-pin-1',
      pinned: true,
      alreadyPinned: false,
      tags: ['pinned'],
    });
    expect(stderr).toHaveLength(0);
  });

  it('gets retention policy as JSON', async () => {
    getRetentionPolicyMock.mockResolvedValueOnce({
      days: 30,
      preservePinned: true,
    });

    const { sessions } = await import('../../src/commands/sessions.js');
    await sessions('retention-get', undefined, { json: true });

    expect(getRetentionPolicyMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(stdout.join('\n'))).toEqual({
      days: 30,
      preservePinned: true,
    });
    expect(stderr).toHaveLength(0);
  });

  it('sets retention policy with explicit preserve-pinned value', async () => {
    setRetentionPolicyMock.mockResolvedValueOnce({
      days: 14,
      preservePinned: false,
    });

    const { sessions } = await import('../../src/commands/sessions.js');
    await sessions('retention-set', '14', { json: true, preservePinned: 'false' });

    expect(setRetentionPolicyMock).toHaveBeenCalledWith({
      days: 14,
      preservePinned: false,
    });
    expect(JSON.parse(stdout.join('\n'))).toEqual({
      days: 14,
      preservePinned: false,
    });
    expect(stderr).toHaveLength(0);
  });

  it('returns prune dry-run report as JSON', async () => {
    planSessionPruneMock.mockResolvedValueOnce({
      policy: { days: 30, preservePinned: true },
      scanned: 3,
      cutoff: '2026-01-01T00:00:00.000Z',
      preservedPinned: 1,
      candidates: [
        {
          id: 'sess-old',
          title: 'Old Session',
          tags: [],
          model: 'gpt',
          created: '2025-01-01T00:00:00.000Z',
          messageCount: 3,
          toolCallCount: 0,
        },
      ],
      kept: [
        {
          id: 'sess-pinned',
          title: 'Pinned',
          tags: ['pinned'],
          model: 'gpt',
          created: '2025-01-01T00:00:00.000Z',
          messageCount: 4,
          toolCallCount: 1,
        },
      ],
    });

    const { sessions } = await import('../../src/commands/sessions.js');
    await sessions('prune', undefined, { json: true, dryRun: true });

    expect(planSessionPruneMock).toHaveBeenCalledTimes(1);
    expect(applySessionPruneMock).not.toHaveBeenCalled();
    expect(JSON.parse(stdout.join('\n'))).toEqual({
      dryRun: true,
      policy: { days: 30, preservePinned: true },
      cutoff: '2026-01-01T00:00:00.000Z',
      scanned: 3,
      preservedPinned: 1,
      candidateCount: 1,
      candidateIds: ['sess-old'],
      keptCount: 1,
      prunedCount: 0,
      prunedIds: [],
    });
    expect(stderr).toHaveLength(0);
  });
});

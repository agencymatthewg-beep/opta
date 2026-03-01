import { beforeEach, describe, expect, it, vi } from 'vitest';

const listSessionsMock = vi.fn();
const deleteSessionMock = vi.fn();
const exportSessionMock = vi.fn();
const searchSessionsMock = vi.fn();

vi.mock('../../src/memory/store.js', () => ({
  listSessions: listSessionsMock,
  deleteSession: deleteSessionMock,
  exportSession: exportSessionMock,
  searchSessions: searchSessionsMock,
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
});

import { mkdtemp, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import {
  loadEndpointProfile,
  prioritizeHostsByProfile,
  rankHostsByProfile,
  recordEndpointProbeOutcome,
  type EndpointScore,
} from '../../src/lmx/endpoint-profile.js';

describe('lmx endpoint profile', () => {
  it('ranks recently successful hosts ahead of stale primary', () => {
    const nowMs = Date.parse('2026-03-02T00:00:00.000Z');
    const profile: EndpointScore[] = [
      {
        host: 'mono512',
        success: 1,
        failure: 4,
        lastSeenAt: '2026-02-20T00:00:00.000Z',
      },
      {
        host: '192.168.188.11',
        success: 10,
        failure: 1,
        lastSeenAt: '2026-03-01T23:55:00.000Z',
      },
    ];

    const ranked = rankHostsByProfile(['mono512', '192.168.188.11'], profile, nowMs);
    expect(ranked).toEqual(['192.168.188.11', 'mono512']);
  });

  it('records probe outcomes and persists counters', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'opta-endpoint-profile-'));
    const profilePath = join(dir, 'lmx-endpoints.json');
    const now = new Date('2026-03-02T00:01:00.000Z');

    await recordEndpointProbeOutcome('mono512', true, profilePath, now);
    await recordEndpointProbeOutcome('mono512', false, profilePath, now);
    await recordEndpointProbeOutcome('192.168.188.11', true, profilePath, now);

    const loaded = await loadEndpointProfile(profilePath);
    const mono = loaded.find((entry) => entry.host === 'mono512');
    expect(mono).toBeDefined();
    expect(mono?.success).toBe(1);
    expect(mono?.failure).toBe(1);

    const ranked = await prioritizeHostsByProfile(['mono512', '192.168.188.11'], profilePath);
    expect(ranked[0]).toBe('192.168.188.11');

    const raw = JSON.parse(await readFile(profilePath, 'utf-8')) as {
      version: number;
      endpoints: EndpointScore[];
    };
    expect(raw.version).toBe(1);
    expect(raw.endpoints).toHaveLength(2);
  });
});


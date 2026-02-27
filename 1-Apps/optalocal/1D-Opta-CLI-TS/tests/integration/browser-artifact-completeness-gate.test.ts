import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NativeSessionManager } from '../../src/browser/native-session-manager.js';
import { validateBrowserSessionArtifactCompleteness } from '../../src/browser/quality-gates.js';

let testDir = '';

afterEach(async () => {
  if (testDir) {
    await rm(testDir, { recursive: true, force: true });
    testDir = '';
  }
});

describe('browser artifact completeness gate', () => {
  it('validates completeness for an end-to-end browser session artifact fixture', async () => {
    testDir = await mkdtemp(join(tmpdir(), 'opta-browser-artifact-gate-'));

    const page = {
      goto: vi.fn(async () => undefined),
      click: vi.fn(async () => undefined),
      fill: vi.fn(async () => undefined),
      content: vi.fn(async () => '<html><body>gate-fixture</body></html>'),
      screenshot: vi.fn(async () => Buffer.from([0x89, 0x50, 0x4e, 0x47])),
      url: vi.fn(() => 'https://example.com/dashboard'),
    };

    const context = {
      newPage: vi.fn(async () => page),
      pages: vi.fn(() => []),
      close: vi.fn(async () => undefined),
    };

    const browser = {
      newContext: vi.fn(async () => context),
      contexts: vi.fn(() => []),
      close: vi.fn(async () => undefined),
    };

    const manager = new NativeSessionManager({
      cwd: testDir,
      idFactory: () => 'sess-gate-integration-001',
      now: () => new Date('2026-02-23T12:00:00.000Z'),
      loadPlaywright: async () => ({
        chromium: {
          launch: vi.fn(async () => browser),
          connectOverCDP: vi.fn(async () => browser),
        },
      }),
    });

    const opened = await manager.openSession({
      runId: 'run-gate-integration-001',
      mode: 'isolated',
    });
    expect(opened.ok).toBe(true);

    const navigated = await manager.navigate('sess-gate-integration-001', {
      url: 'https://example.com/dashboard',
    });
    expect(navigated.ok).toBe(true);

    const snapshot = await manager.snapshot('sess-gate-integration-001');
    expect(snapshot.ok).toBe(true);

    const screenshot = await manager.screenshot('sess-gate-integration-001', {
      type: 'png',
    });
    expect(screenshot.ok).toBe(true);

    const closed = await manager.closeSession('sess-gate-integration-001');
    expect(closed.ok).toBe(true);

    const result = await validateBrowserSessionArtifactCompleteness(testDir, 'sess-gate-integration-001');

    expect(result.ok).toBe(true);
    expect(result.missingFiles).toEqual([]);
    expect(result.issues).toEqual([]);
    expect(result.counts).toEqual({
      metadataActions: 5,
      metadataArtifacts: 2,
      stepEntries: 5,
      recordingEntries: 5,
      visualDiffEntries: 5,
      stepArtifactRefs: 2,
      recordingArtifactRefs: 2,
      visualDiffArtifactRefs: 2,
    });
  });
});

import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NativeSessionManager } from '../../src/browser/native-session-manager.js';
import type {
  BrowserSessionRecordingIndex,
  BrowserSessionStepRecord,
  BrowserVisualDiffManifestEntry,
  BrowserVisualDiffResultEntry,
} from '../../src/browser/types.js';

let testDir = '';

afterEach(async () => {
  if (testDir) {
    await rm(testDir, { recursive: true, force: true });
    testDir = '';
  }
});

function readSteps(raw: string): BrowserSessionStepRecord[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as BrowserSessionStepRecord);
}

function readVisualManifest(raw: string): BrowserVisualDiffManifestEntry[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as BrowserVisualDiffManifestEntry);
}

function readVisualResults(raw: string): BrowserVisualDiffResultEntry[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as BrowserVisualDiffResultEntry);
}

describe('NativeSessionManager', () => {
  it('opens in isolated mode by default and returns descriptive unavailable errors', async () => {
    testDir = await mkdtemp(join(tmpdir(), 'opta-browser-session-'));

    const manager = new NativeSessionManager({
      cwd: testDir,
      idFactory: () => 'sess-001',
      now: () => new Date('2026-02-22T12:00:00.000Z'),
      loadPlaywright: async () => null,
    });

    const opened = await manager.openSession();
    expect(opened.ok).toBe(false);
    expect(opened.error?.code).toBe('PLAYWRIGHT_UNAVAILABLE');
    expect(opened.error?.message).toContain('Install "playwright"');
    expect(opened.data?.mode).toBe('isolated');

    const sessionDir = join(testDir, '.opta', 'browser', 'sess-001');
    await expect(access(sessionDir)).resolves.toBeUndefined();

    const metadataPath = join(sessionDir, 'metadata.json');
    const metadata = JSON.parse(await readFile(metadataPath, 'utf-8'));
    expect(metadata.sessionId).toBe('sess-001');
    expect(metadata.runId).toBe('sess-001');
    expect(metadata.mode).toBe('isolated');

    const nav = await manager.navigate('sess-001', { url: 'https://example.com' });
    expect(nav.ok).toBe(false);
    expect(nav.error?.code).toBe('PLAYWRIGHT_UNAVAILABLE');

    const clicked = await manager.click('sess-001', { selector: '#submit' });
    expect(clicked.ok).toBe(false);
    expect(clicked.error?.code).toBe('PLAYWRIGHT_UNAVAILABLE');

    const typed = await manager.type('sess-001', { selector: '#email', text: 'test@example.com' });
    expect(typed.ok).toBe(false);
    expect(typed.error?.code).toBe('PLAYWRIGHT_UNAVAILABLE');

    const snap = await manager.snapshot('sess-001');
    expect(snap.ok).toBe(false);
    expect(snap.error?.code).toBe('PLAYWRIGHT_UNAVAILABLE');

    const shot = await manager.screenshot('sess-001');
    expect(shot.ok).toBe(false);
    expect(shot.error?.code).toBe('PLAYWRIGHT_UNAVAILABLE');

    const closed = await manager.closeSession('sess-001');
    expect(closed.ok).toBe(true);
    expect(closed.data?.status).toBe('closed');

    const stepsPath = join(sessionDir, 'steps.jsonl');
    const steps = readSteps(await readFile(stepsPath, 'utf-8'));
    expect(steps).toHaveLength(7);
    expect(steps.map((step) => step.sequence)).toEqual([1, 2, 3, 4, 5, 6, 7]);

    const firstStep = steps[0];
    expect(firstStep).toBeDefined();
    expect(firstStep!.sessionId).toBe('sess-001');
    expect(firstStep!.runId).toBe('sess-001');
    expect(firstStep!.actionType).toBe('openSession');
    expect(firstStep!.ok).toBe(false);
    expect(firstStep!.error?.code).toBe('PLAYWRIGHT_UNAVAILABLE');
    expect(firstStep!.artifactIds).toEqual([]);
    expect(firstStep!.artifactPaths).toEqual([]);

    const lastStep = steps.at(-1);
    expect(lastStep).toBeDefined();
    expect(lastStep!.actionType).toBe('closeSession');
    expect(lastStep!.ok).toBe(true);

    const recordingsPath = join(sessionDir, 'recordings.json');
    const recordings = JSON.parse(await readFile(recordingsPath, 'utf-8')) as BrowserSessionRecordingIndex;
    expect(recordings.sessionId).toBe('sess-001');
    expect(recordings.runId).toBe('sess-001');
    expect(recordings.recordings).toHaveLength(7);
    expect(recordings.recordings.map((entry) => entry.sequence)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(recordings.recordings[0]?.artifactIds).toEqual([]);
    expect(recordings.recordings[0]?.artifactPaths).toEqual([]);

    const visualManifestPath = join(sessionDir, 'visual-diff-manifest.jsonl');
    const visualManifest = readVisualManifest(await readFile(visualManifestPath, 'utf-8'));
    expect(visualManifest).toHaveLength(7);
    expect(visualManifest[0]?.sequence).toBe(1);
    expect(visualManifest[0]?.status).toBe('pending');
    expect(visualManifest[0]?.runId).toBe('sess-001');

    const visualResultsPath = join(sessionDir, 'visual-diff-results.jsonl');
    const visualResults = readVisualResults(await readFile(visualResultsPath, 'utf-8'));
    expect(visualResults).toHaveLength(6);
    expect(visualResults[0]?.index).toBe(0);
    expect(visualResults[0]?.fromSequence).toBe(1);
    expect(visualResults[0]?.toSequence).toBe(2);
    expect(visualResults.every((entry) => entry.status === 'missing')).toBe(true);
    expect(visualResults.every((entry) => entry.severity === 'high')).toBe(true);
    expect(visualResults.every((entry) => entry.regressionSignal === 'regression')).toBe(true);
    expect(visualResults.every((entry) => entry.regressionScore === 1)).toBe(true);
  });

  it('returns session-not-found errors for unknown sessions', async () => {
    testDir = await mkdtemp(join(tmpdir(), 'opta-browser-session-'));
    const manager = new NativeSessionManager({ cwd: testDir, loadPlaywright: async () => null });

    const nav = await manager.navigate('missing', { url: 'https://example.com' });
    expect(nav.ok).toBe(false);
    expect(nav.error?.code).toBe('SESSION_NOT_FOUND');

    const clicked = await manager.click('missing', { selector: '#submit' });
    expect(clicked.error?.code).toBe('SESSION_NOT_FOUND');

    const typed = await manager.type('missing', { selector: '#email', text: 'a' });
    expect(typed.error?.code).toBe('SESSION_NOT_FOUND');

    const snap = await manager.snapshot('missing');
    expect(snap.error?.code).toBe('SESSION_NOT_FOUND');

    const shot = await manager.screenshot('missing');
    expect(shot.error?.code).toBe('SESSION_NOT_FOUND');

    const closed = await manager.closeSession('missing');
    expect(closed.ok).toBe(false);
    expect(closed.error?.code).toBe('SESSION_NOT_FOUND');
  });

  it('uses persistent context in isolated mode when profileDir is provided', async () => {
    testDir = await mkdtemp(join(tmpdir(), 'opta-browser-session-'));

    const page = {
      goto: vi.fn(async () => undefined),
      click: vi.fn(async () => undefined),
      fill: vi.fn(async () => undefined),
      content: vi.fn(async () => '<html><body>ok</body></html>'),
      screenshot: vi.fn(async () => Buffer.from([0x89, 0x50, 0x4e, 0x47])),
      url: vi.fn(() => 'https://example.com'),
    };

    const context = {
      newPage: vi.fn(async () => page),
      pages: vi.fn(() => []),
      close: vi.fn(async () => undefined),
    };

    const launchPersistentContext = vi.fn(async () => context);
    const launch = vi.fn(async () => {
      throw new Error('launch should not be used when profileDir is provided');
    });

    const manager = new NativeSessionManager({
      cwd: testDir,
      idFactory: () => 'sess-profile-001',
      now: () => new Date('2026-02-22T12:00:00.000Z'),
      loadPlaywright: async () => ({
        chromium: {
          launch,
          launchPersistentContext,
          connectOverCDP: vi.fn(async () => {
            throw new Error('attach path should not be used in this test');
          }),
        },
      }),
    });

    const profileDir = join(testDir, '.opta', 'browser', 'profiles', 'sess-profile-001');
    const opened = await manager.openSession({
      mode: 'isolated',
      profileDir,
    });

    expect(opened.ok).toBe(true);
    expect(opened.data?.runtime).toBe('playwright');
    expect(opened.data?.profileDir).toBe(profileDir);
    expect(launchPersistentContext).toHaveBeenCalledWith(profileDir, { headless: true });
    expect(launch).not.toHaveBeenCalled();

    const closed = await manager.closeSession('sess-profile-001');
    expect(closed.ok).toBe(true);
    expect(context.close).toHaveBeenCalledTimes(1);
  });

  it('supports attach mode and executes actions when a runtime is injected', async () => {
    testDir = await mkdtemp(join(tmpdir(), 'opta-browser-session-'));

    const page = {
      goto: vi.fn(async () => undefined),
      click: vi.fn(async () => undefined),
      fill: vi.fn(async () => undefined),
      content: vi.fn(async () => '<html><body>ok</body></html>'),
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
      idFactory: () => 'sess-attach-001',
      now: () => new Date('2026-02-22T12:00:00.000Z'),
      loadPlaywright: async () => ({
        chromium: {
          launch: vi.fn(async () => browser),
          connectOverCDP: vi.fn(async () => browser),
        },
      }),
    });

    const opened = await manager.openSession({
      runId: 'run-attach-001',
      mode: 'attach',
      wsEndpoint: 'ws://127.0.0.1:9222/devtools/browser/mock',
    });

    expect(opened.ok).toBe(true);
    expect(opened.data?.mode).toBe('attach');
    expect(opened.data?.runId).toBe('run-attach-001');
    expect(opened.data?.runtime).toBe('playwright');

    const nav = await manager.navigate('sess-attach-001', { url: 'https://example.com/dashboard' });
    expect(nav.ok).toBe(true);

    const clickResult = await manager.click('sess-attach-001', { selector: 'button#save' });
    expect(clickResult.ok).toBe(true);

    const typeResult = await manager.type('sess-attach-001', {
      selector: 'input#name',
      text: 'Opta',
    });
    expect(typeResult.ok).toBe(true);

    const snap = await manager.snapshot('sess-attach-001');
    expect(snap.ok).toBe(true);
    expect(snap.data?.html).toContain('<body>ok</body>');

    const shot = await manager.screenshot('sess-attach-001');
    expect(shot.ok).toBe(true);
    expect(shot.data?.artifact.kind).toBe('screenshot');
    const shot2 = await manager.screenshot('sess-attach-001');
    expect(shot2.ok).toBe(true);
    expect(shot2.data?.artifact.kind).toBe('screenshot');

    const metadataPath = join(testDir, '.opta', 'browser', 'sess-attach-001', 'metadata.json');
    const metadata = JSON.parse(await readFile(metadataPath, 'utf-8'));
    expect(metadata.mode).toBe('attach');
    expect(metadata.runId).toBe('run-attach-001');
    expect(metadata.artifacts).toHaveLength(3);

    expect(page.goto).toHaveBeenCalledWith('https://example.com/dashboard', {
      timeout: 30000,
      waitUntil: 'domcontentloaded',
    });
    expect(page.click).toHaveBeenCalledWith('button#save', { timeout: 10000 });
    expect(page.fill).toHaveBeenCalledWith('input#name', 'Opta', { timeout: 10000 });

    const closed = await manager.closeSession('sess-attach-001');
    expect(closed.ok).toBe(true);
    expect(browser.close).toHaveBeenCalledTimes(1);

    const stepsPath = join(testDir, '.opta', 'browser', 'sess-attach-001', 'steps.jsonl');
    const steps = readSteps(await readFile(stepsPath, 'utf-8'));
    expect(steps).toHaveLength(8);
    expect(steps.map((step) => step.sequence)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);

    const snapshotStep = steps.find((step) => step.actionType === 'snapshot');
    expect(snapshotStep).toBeDefined();
    expect(snapshotStep!.ok).toBe(true);
    expect(snapshotStep!.artifactIds).toHaveLength(1);
    expect(snapshotStep!.artifactPaths).toHaveLength(1);
    expect(snapshotStep!.artifactPaths[0]).toContain('0001-snapshot.html');

    const screenshotSteps = steps.filter((step) => step.actionType === 'screenshot');
    expect(screenshotSteps).toHaveLength(2);
    expect(screenshotSteps[0]!.ok).toBe(true);
    expect(screenshotSteps[0]!.runId).toBe('run-attach-001');
    expect(screenshotSteps[0]!.artifactIds).toHaveLength(1);
    expect(screenshotSteps[0]!.artifactPaths).toHaveLength(1);
    expect(screenshotSteps[0]!.artifactPaths[0]).toContain('0002-screenshot.png');
    expect(screenshotSteps[1]!.artifactPaths[0]).toContain('0003-screenshot.png');

    const recordingsPath = join(testDir, '.opta', 'browser', 'sess-attach-001', 'recordings.json');
    const recordings = JSON.parse(await readFile(recordingsPath, 'utf-8')) as BrowserSessionRecordingIndex;
    expect(recordings.recordings).toHaveLength(8);
    const screenshotRecordings = recordings.recordings.filter((record) => record.actionType === 'screenshot');
    expect(screenshotRecordings).toHaveLength(2);
    expect(screenshotRecordings[0]!.runId).toBe('run-attach-001');
    expect(screenshotRecordings[0]!.artifactPaths[0]).toContain('0002-screenshot.png');
    expect(screenshotRecordings[1]!.artifactPaths[0]).toContain('0003-screenshot.png');

    const visualManifestPath = join(testDir, '.opta', 'browser', 'sess-attach-001', 'visual-diff-manifest.jsonl');
    const visualManifest = readVisualManifest(await readFile(visualManifestPath, 'utf-8'));
    expect(visualManifest).toHaveLength(8);
    expect(visualManifest.every((entry) => entry.status === 'pending')).toBe(true);
    const screenshotManifestEntry = visualManifest.find((entry) => entry.actionType === 'screenshot');
    expect(screenshotManifestEntry).toBeDefined();
    expect(screenshotManifestEntry!.runId).toBe('run-attach-001');
    expect(screenshotManifestEntry!.artifactPaths[0]).toContain('0002-screenshot.png');

    const visualResultsPath = join(testDir, '.opta', 'browser', 'sess-attach-001', 'visual-diff-results.jsonl');
    const visualResults = readVisualResults(await readFile(visualResultsPath, 'utf-8'));
    expect(visualResults).toHaveLength(7);
    const screenshotDiff = visualResults.find((entry) =>
      entry.fromActionType === 'screenshot' && entry.toActionType === 'screenshot'
    );
    expect(screenshotDiff).toBeDefined();
    expect(screenshotDiff!.status).toBe('unchanged');
    expect(screenshotDiff!.changedByteRatio).toBe(0);
    expect(screenshotDiff!.perceptualDiffScore).toBe(0);
    expect(screenshotDiff!.severity).toBe('low');
    expect(screenshotDiff!.regressionScore).toBe(0);
    expect(screenshotDiff!.regressionSignal).toBe('none');
    expect(screenshotDiff!.fromScreenshotPath).toContain('0002-screenshot.png');
    expect(screenshotDiff!.toScreenshotPath).toContain('0003-screenshot.png');
  });
});

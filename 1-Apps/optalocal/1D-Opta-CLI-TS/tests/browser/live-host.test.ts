import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/core/config.js';

describe('browser live host security and screen controls', () => {
  const baseConfig = structuredClone(DEFAULT_CONFIG);
  let startBrowserLiveHost: typeof import('../../src/browser/live-host.js').startBrowserLiveHost;
  let stopBrowserLiveHost: typeof import('../../src/browser/live-host.js').stopBrowserLiveHost;
  let capturePeekabooScreenPngMock: ReturnType<typeof vi.fn>;
  let isPeekabooAvailableMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();
    capturePeekabooScreenPngMock = vi.fn().mockResolvedValue(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    isPeekabooAvailableMock = vi.fn().mockResolvedValue(true);

    vi.doMock('../../src/browser/runtime-daemon.js', () => ({
      getSharedBrowserRuntimeDaemon: vi.fn(async () => ({
        start: vi.fn(async () => {}),
        health: vi.fn(() => ({
          running: true,
          paused: false,
          killed: false,
          sessionCount: 1,
          maxSessions: 5,
          sessions: [
            {
              sessionId: 'sess-live-001',
              status: 'open',
              runtime: 'playwright',
              currentUrl: 'https://example.com',
              updatedAt: '2026-02-28T00:00:00.000Z',
            },
          ],
          profilePrune: { enabled: false, inFlight: false },
        })),
        screenshot: vi.fn(async () => ({
          ok: true,
          data: {
            artifact: {
              absolutePath: '/tmp/does-not-matter.jpg',
              mimeType: 'image/jpeg',
            },
          },
        })),
      })),
    }));
    vi.doMock('../../src/browser/peekaboo.js', () => ({
      isPeekabooAvailable: isPeekabooAvailableMock,
      capturePeekabooScreenPng: capturePeekabooScreenPngMock,
      peekabooClickLabel: vi.fn(async () => {}),
      peekabooTypeText: vi.fn(async () => {}),
      peekabooPressKey: vi.fn(async () => {}),
    }));

    const liveHost = await import('../../src/browser/live-host.js');
    startBrowserLiveHost = liveHost.startBrowserLiveHost;
    stopBrowserLiveHost = liveHost.stopBrowserLiveHost;
  });

  afterEach(async () => {
    try {
      await stopBrowserLiveHost?.();
    } catch {
      // no-op
    }
    vi.restoreAllMocks();
  });

  it('rejects non-loopback host binding', async () => {
    await expect(startBrowserLiveHost({
      config: structuredClone(baseConfig),
      host: '0.0.0.0',
      requiredPortCount: 6,
      maxSessionSlots: 5,
    })).rejects.toThrow('loopback only');
  });

  it('requires auth token for screen frame and actions', async () => {
    const config = structuredClone(baseConfig);
    config.computerControl.foreground.enabled = true;
    config.computerControl.foreground.allowScreenActions = true;

    const started = await startBrowserLiveHost({
      config,
      requiredPortCount: 6,
      maxSessionSlots: 5,
      portRangeStart: 56_100,
      portRangeEnd: 56_300,
      includePeekabooScreen: true,
    });
    expect(started.controlPort).toBeDefined();
    const controlBase = `http://${started.host}:${started.controlPort}`;

    const screenHtml = await (await fetch(`${controlBase}/screen`)).text();
    const tokenMatch = screenHtml.match(/const screenToken = "([^"]+)"/);
    expect(tokenMatch?.[1]).toBeTruthy();
    const token = tokenMatch?.[1] ?? '';

    const noTokenFrame = await fetch(`${controlBase}/api/screen/frame`);
    expect(noTokenFrame.status).toBe(401);

    const withTokenFrame = await fetch(`${controlBase}/api/screen/frame?token=${encodeURIComponent(token)}`);
    expect(withTokenFrame.status).toBe(200);
    expect(withTokenFrame.headers.get('content-type')).toBe('image/png');

    const badContentType = await fetch(`${controlBase}/api/screen/key?token=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: '{}',
    });
    expect(badContentType.status).toBe(415);

    const emptyKey = await fetch(`${controlBase}/api/screen/key?token=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ key: '' }),
    });
    expect(emptyKey.status).toBe(422);

    const slotPort = started.slots[0]?.port;
    expect(slotPort).toBeDefined();
    const slotBase = `http://${started.host}:${slotPort}`;
    const slotStatusNoToken = await fetch(`${slotBase}/api/status`);
    expect(slotStatusNoToken.status).toBe(401);
    const slotStatusWithToken = await fetch(`${slotBase}/api/status?token=${encodeURIComponent(token)}`);
    expect(slotStatusWithToken.status).toBe(200);
  });

  it('blocks screen actions when foreground control is disabled', async () => {
    const started = await startBrowserLiveHost({
      config: structuredClone(baseConfig),
      requiredPortCount: 6,
      maxSessionSlots: 5,
      portRangeStart: 56_350,
      portRangeEnd: 56_550,
      includePeekabooScreen: true,
    });
    const controlBase = `http://${started.host}:${started.controlPort}`;
    const screenHtml = await (await fetch(`${controlBase}/screen`)).text();
    const tokenMatch = screenHtml.match(/const screenToken = "([^"]+)"/);
    const token = tokenMatch?.[1] ?? '';

    const blockedAction = await fetch(`${controlBase}/api/screen/key?token=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ key: 'enter' }),
    });
    expect(blockedAction.status).toBe(403);
  });

  it('fails fast when screen mode is enabled without peekaboo', async () => {
    isPeekabooAvailableMock.mockResolvedValueOnce(false);
    await expect(startBrowserLiveHost({
      config: structuredClone(baseConfig),
      includePeekabooScreen: true,
      requiredPortCount: 6,
      maxSessionSlots: 5,
    })).rejects.toThrow('Peekaboo is required');
  });

  it('fails when background hosting is disabled in config', async () => {
    const config = structuredClone(baseConfig);
    config.computerControl.background.enabled = false;
    await expect(startBrowserLiveHost({
      config,
      requiredPortCount: 6,
      maxSessionSlots: 5,
    })).rejects.toThrow('Background computer control is disabled');
  });

  it('fails when requested slots exceed configured background maximum', async () => {
    const config = structuredClone(baseConfig);
    config.computerControl.background.maxHostedBrowserSessions = 3;
    await expect(startBrowserLiveHost({
      config,
      requiredPortCount: 6,
      maxSessionSlots: 5,
    })).rejects.toThrow('exceeds computerControl.background.maxHostedBrowserSessions');
  });

  it('fails when screen streaming is disabled in background config', async () => {
    const config = structuredClone(baseConfig);
    config.computerControl.background.allowScreenStreaming = false;
    await expect(startBrowserLiveHost({
      config,
      includePeekabooScreen: true,
      requiredPortCount: 6,
      maxSessionSlots: 5,
    })).rejects.toThrow('Screen streaming is disabled');
  });
});

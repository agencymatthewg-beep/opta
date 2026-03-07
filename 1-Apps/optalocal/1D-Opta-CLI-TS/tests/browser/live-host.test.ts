import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/core/config.js';

describe('browser live host security and screen controls', () => {
  const baseConfig = structuredClone(DEFAULT_CONFIG);
  let startBrowserLiveHost: typeof import('../../src/browser/live-host.js').startBrowserLiveHost;
  let stopBrowserLiveHost: typeof import('../../src/browser/live-host.js').stopBrowserLiveHost;
  let capturePeekabooScreenPngMock: ReturnType<typeof vi.fn>;
  let isPeekabooAvailableMock: ReturnType<typeof vi.fn>;
  let peekabooClickLabelMock: ReturnType<typeof vi.fn>;
  let peekabooTypeTextMock: ReturnType<typeof vi.fn>;
  let peekabooPressKeyMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();
    capturePeekabooScreenPngMock = vi.fn().mockResolvedValue(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    isPeekabooAvailableMock = vi.fn().mockResolvedValue(true);
    peekabooClickLabelMock = vi.fn(async () => {});
    peekabooTypeTextMock = vi.fn(async () => {});
    peekabooPressKeyMock = vi.fn(async () => {});

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
      peekabooClickLabel: peekabooClickLabelMock,
      peekabooTypeText: peekabooTypeTextMock,
      peekabooPressKey: peekabooPressKeyMock,
      redactPeekabooSensitiveText: (value: string) => value
        .replace(/(token\s*[:=]\s*)([^\s,;]+)/gi, '$1[REDACTED]')
        .replace(/(bearer\s+)([A-Za-z0-9._~+/=-]+)/gi, '$1[REDACTED]'),
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
    const disabledConfig = structuredClone(baseConfig);
    disabledConfig.computerControl.foreground.enabled = false;
    disabledConfig.computerControl.foreground.allowScreenActions = false;
    const started = await startBrowserLiveHost({
      config: disabledConfig,
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

  it('targets browser app when foreground control is enabled', async () => {
    const config = structuredClone(baseConfig);
    config.computerControl.foreground.enabled = true;
    config.computerControl.foreground.allowScreenActions = true;

    const started = await startBrowserLiveHost({
      config,
      requiredPortCount: 6,
      maxSessionSlots: 5,
      portRangeStart: 56_600,
      portRangeEnd: 56_800,
      includePeekabooScreen: true,
    });
    const screenHtml = await (await fetch(`http://${started.host}:${started.controlPort}/screen`)).text();
    const token = screenHtml.match(/const screenToken = "([^"]+)"/)?.[1] ?? '';

    await fetch(`http://${started.host}:${started.controlPort}/api/screen/frame?token=${encodeURIComponent(token)}`);
    expect(capturePeekabooScreenPngMock).toHaveBeenCalledWith('Chromium');
  });

  it('captures full screen when foreground control is disabled', async () => {
    const disabledFgConfig = structuredClone(baseConfig);
    disabledFgConfig.computerControl.foreground.enabled = false;
    disabledFgConfig.computerControl.foreground.allowScreenActions = false;
    const started = await startBrowserLiveHost({
      config: disabledFgConfig,
      requiredPortCount: 6,
      maxSessionSlots: 5,
      portRangeStart: 56_850,
      portRangeEnd: 57_050,
      includePeekabooScreen: true,
    });
    const screenHtml = await (await fetch(`http://${started.host}:${started.controlPort}/screen`)).text();
    const token = screenHtml.match(/const screenToken = "([^"]+)"/)?.[1] ?? '';

    await fetch(`http://${started.host}:${started.controlPort}/api/screen/frame?token=${encodeURIComponent(token)}`);
    expect(capturePeekabooScreenPngMock).toHaveBeenCalledWith(undefined);
  });

  it('records queue telemetry for overlapping screen actions', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const config = structuredClone(baseConfig);
    config.computerControl.foreground.enabled = true;
    config.computerControl.foreground.allowScreenActions = true;

    let releaseFirst = () => {};
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    let callCount = 0;
    peekabooTypeTextMock.mockImplementation(async () => {
      callCount += 1;
      if (callCount === 1) {
        await firstGate;
      }
    });

    const started = await startBrowserLiveHost({
      config,
      requiredPortCount: 6,
      maxSessionSlots: 5,
      portRangeStart: 57_100,
      portRangeEnd: 57_300,
      includePeekabooScreen: true,
    });
    const controlBase = `http://${started.host}:${started.controlPort}`;
    const token = (await (await fetch(`${controlBase}/screen`)).text()).match(/const screenToken = "([^"]+)"/)?.[1] ?? '';

    const reqOne = fetch(`${controlBase}/api/screen/type?token=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: 'first' }),
    });
    await new Promise((resolve) => setTimeout(resolve, 10));
    const reqTwo = fetch(`${controlBase}/api/screen/type?token=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: 'second' }),
    });

    await new Promise((resolve) => setTimeout(resolve, 25));
    releaseFirst();

    const [respOne, respTwo] = await Promise.all([reqOne, reqTwo]);
    expect(respOne.status).toBe(200);
    expect(respTwo.status).toBe(200);

    const status = await (await fetch(`${controlBase}/api/status`)).json() as {
      peekabooMetrics: {
        queueDepth: number;
        maxQueueDepth: number;
        actionRequests: { type: number };
        jobsCompleted: number;
      };
    };
    expect(status.peekabooMetrics.queueDepth).toBe(0);
    expect(status.peekabooMetrics.maxQueueDepth).toBeGreaterThanOrEqual(2);
    expect(status.peekabooMetrics.actionRequests.type).toBe(2);
    expect(status.peekabooMetrics.jobsCompleted).toBeGreaterThanOrEqual(2);

    const combinedLogs = [...infoSpy.mock.calls, ...warnSpy.mock.calls]
      .map((call) => call.map((part) => String(part)).join(' '))
      .join('\n');
    expect(combinedLogs).toContain('peekaboo.queue.enqueued');
    expect(combinedLogs).toContain('peekaboo.queue.completed');
  });

  it('redacts sensitive values in screen action failure telemetry', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    peekabooPressKeyMock.mockRejectedValueOnce(
      Object.assign(new Error('Peekaboo action failed'), {
        stdout: 'token=live-secret',
        stderr: 'Authorization: Bearer opta_sk_super_secret',
        exitCode: 1,
      }),
    );

    const config = structuredClone(baseConfig);
    config.computerControl.foreground.enabled = true;
    config.computerControl.foreground.allowScreenActions = true;
    const started = await startBrowserLiveHost({
      config,
      requiredPortCount: 6,
      maxSessionSlots: 5,
      portRangeStart: 57_350,
      portRangeEnd: 57_550,
      includePeekabooScreen: true,
    });
    const controlBase = `http://${started.host}:${started.controlPort}`;
    const token = (await (await fetch(`${controlBase}/screen`)).text()).match(/const screenToken = "([^"]+)"/)?.[1] ?? '';

    const failedResponse = await fetch(`${controlBase}/api/screen/key?token=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ key: 'enter' }),
    });
    expect(failedResponse.status).toBe(500);
    const failedBody = await failedResponse.json() as { error: string };
    expect(failedBody.error).toContain('Peekaboo action failed');

    const status = await (await fetch(`${controlBase}/api/status`)).json() as {
      peekabooMetrics: {
        jobsFailed: number;
        actionFailures: { key: number };
      };
    };
    expect(status.peekabooMetrics.jobsFailed).toBeGreaterThanOrEqual(1);
    expect(status.peekabooMetrics.actionFailures.key).toBe(1);

    const combinedLogs = [...infoSpy.mock.calls, ...errorSpy.mock.calls]
      .map((call) => call.map((part) => String(part)).join(' '))
      .join('\n');
    expect(combinedLogs).toContain('peekaboo.screen_action.failed');
    expect(combinedLogs).toContain('peekaboo.queue.failed');
    expect(combinedLogs).not.toContain('live-secret');
    expect(combinedLogs).not.toContain('opta_sk_super_secret');
  });
});

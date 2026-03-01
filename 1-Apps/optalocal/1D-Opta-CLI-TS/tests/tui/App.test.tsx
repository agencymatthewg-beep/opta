import { EventEmitter } from 'node:events';
import { afterEach, describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { render as inkRender } from 'ink';

vi.mock('../../src/tui/keybindings.js', async () => {
  const actual = await vi.importActual<typeof import('../../src/tui/keybindings.js')>('../../src/tui/keybindings.js');
  return {
    ...actual,
    loadKeybindings: vi.fn(async () => ({})),
  };
});

vi.mock('../../src/tui/OptaMenuOverlay.js', async () => {
  const ReactModule = await import('react');
  const { Box, Text, useInput } = await import('ink');
  const { useState } = ReactModule;

  function OptaMenuOverlay(props: {
    onClose: () => void;
    onOpenModelPicker: () => void;
    onOpenCommandBrowser: () => void;
    onOpenHelpBrowser: () => void;
    onOpenActionHistory: () => void;
    onOpenBrowserControl: () => void;
    onRunCommand: (command: string) => void;
  }) {
    const items = [
      { label: 'Status Check', run: () => props.onRunCommand('/status') },
      { label: 'Model Manager', run: props.onOpenModelPicker },
      { label: 'Command Browser', run: props.onOpenCommandBrowser },
      { label: 'Help Browser', run: props.onOpenHelpBrowser },
      { label: 'Action History', run: props.onOpenActionHistory },
      { label: 'Browser Control', run: props.onOpenBrowserControl },
    ] as const;
    const [selectedIndex, setSelectedIndex] = useState(0);

    useInput((_input, key) => {
      if (key.upArrow) {
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
        return;
      }
      if (key.downArrow) {
        setSelectedIndex((prev) => Math.min(prev + 1, items.length - 1));
        return;
      }
      if (key.return) {
        items[selectedIndex]?.run();
        return;
      }
      if (key.escape) {
        props.onClose();
      }
    });

    return (
      <Box flexDirection="column">
        <Text>Operations</Text>
        {items.map((item, index) => (
          <Text key={item.label}>
            {index === selectedIndex ? '▶ ' : '  '}
            {item.label}
          </Text>
        ))}
      </Box>
    );
  }

  return { OptaMenuOverlay };
}, { virtual: true });

import { App, computeMessageAreaHeight } from '../../src/tui/App.js';
import { createTuiEmitter } from '../../src/tui/adapter.js';
import { DEFAULT_CONFIG } from '../../src/core/config.js';
import { loadKeybindings } from '../../src/tui/keybindings.js';

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 50));
const ARROW_DOWN = '\u001B[B';
function expectCenteredLine(frame: string, marker: string): void {
  const line = frame.split('\n').find((entry) => entry.includes(marker));
  expect(line, `expected frame to include line with "${marker}"`).toBeDefined();
  const markerIndex = line!.indexOf(marker);
  expect(markerIndex).toBeGreaterThan(0);
}

async function moveMenuDown(
  stdin: { write: (input: string) => void },
  steps: number,
): Promise<void> {
  for (let index = 0; index < steps; index += 1) {
    stdin.write(ARROW_DOWN);
    await flush();
  }
}

describe('App component', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('computes message area height without overflowing tiny terminals', () => {
    expect(computeMessageAreaHeight(30, false)).toBe(17);
    expect(computeMessageAreaHeight(8, false)).toBe(0);
    expect(computeMessageAreaHeight(3, true)).toBe(0);
  });

  it('should render without crashing', () => {
    const { lastFrame } = render(<App model="test-model" sessionId="abc123" />);
    expect(lastFrame()).toBeDefined();
    expect(lastFrame()).toContain('test-model');
  });

  it('should show model name', () => {
    const { lastFrame } = render(<App model="Qwen2.5-72B" sessionId="abc123" />);
    expect(lastFrame()).toContain('Qwen2.5-72B');
  });

  it('opens command browser from "/" submit and closes with Escape', async () => {
    const { lastFrame, stdin } = render(
      <App model="test-model" sessionId="abc123" />,
      { stdout: { columns: 140, rows: 46 } as NodeJS.WriteStream },
    );

    await flush();
    stdin.write('/');
    stdin.write('\r');
    await flush();
    expect(lastFrame()).toContain('/cost');

    stdin.write('\x1B'); // Escape
    await flush();
    expect(lastFrame()).not.toContain('/cost');
  });

  it('preflights browser trigger prompts and submits with active session context', async () => {
    const configModule = await import('../../src/core/config.js');
    const triggerSessionModule = await import('../../src/browser/trigger-session.js');
    const config = structuredClone(DEFAULT_CONFIG);
    config.browser.enabled = true;
    config.browser.runtime.enabled = true;

    vi.spyOn(configModule, 'loadConfig').mockResolvedValue(config);
    vi.spyOn(triggerSessionModule, 'ensureBrowserSessionForTriggeredPrompt').mockResolvedValue({
      triggered: true,
      ok: true,
      sessionId: 'sess-visible-123',
      reused: false,
      mode: 'isolated',
      message: 'Started visible Opta Browser session sess-visible-123.',
    });

    const onSubmit = vi.fn();
    const emitter = createTuiEmitter();
    const { stdin, lastFrame } = render(
      <App model="test-model" sessionId="abc123" emitter={emitter} onSubmit={onSubmit} />,
      { stdout: { columns: 140, rows: 46 } as NodeJS.WriteStream },
    );

    await flush();
    const prompt = 'Use Browser to inspect checkout flow';
    for (const ch of prompt) stdin.write(ch);
    stdin.write('\r');
    await flush();

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const outboundPrompt = String(onSubmit.mock.calls[0]?.[0] ?? '');
    expect(outboundPrompt).toContain('Use Browser to inspect checkout flow');
    expect(outboundPrompt).toContain('browser session_id "sess-visible-123"');
    expect(lastFrame()).toContain('started active Opta Browser session sess-visible-123');
  });

  it('resolves stacked triggers to review mode and includes trigger router context', async () => {
    const configModule = await import('../../src/core/config.js');
    const triggerSessionModule = await import('../../src/browser/trigger-session.js');
    const config = structuredClone(DEFAULT_CONFIG);
    config.browser.enabled = true;
    config.browser.runtime.enabled = true;

    vi.spyOn(configModule, 'loadConfig').mockResolvedValue(config);
    vi.spyOn(triggerSessionModule, 'ensureBrowserSessionForTriggeredPrompt').mockResolvedValue({
      triggered: true,
      ok: true,
      sessionId: 'sess-review-456',
      reused: true,
      mode: 'isolated',
      message: 'Reusing active Opta Browser session sess-review-456.',
    });

    const onSubmit = vi.fn();
    const onModeChange = vi.fn();
    const emitter = createTuiEmitter();
    const { stdin } = render(
      <App
        model="test-model"
        sessionId="abc123"
        emitter={emitter}
        onSubmit={onSubmit}
        onModeChange={onModeChange}
      />,
      { stdout: { columns: 140, rows: 46 } as NodeJS.WriteStream },
    );

    await flush();
    const prompt = 'Please review browser checkout security';
    for (const ch of prompt) stdin.write(ch);
    stdin.write('\r');
    await flush();

    expect(onModeChange).toHaveBeenCalledWith('review');
    expect(onSubmit).toHaveBeenCalledTimes(1);
    const outboundPrompt = String(onSubmit.mock.calls[0]?.[0] ?? '');
    expect(outboundPrompt).toContain('Trigger router resolved mode "review"');
    expect(outboundPrompt).toContain('Matched triggers: review, browser');
    expect(outboundPrompt).toContain('browser session_id "sess-review-456"');
  });

  it('locks input editor while overlay is active', async () => {
    const marker = 'zqv-lock-check';
    const { lastFrame, stdin } = render(
      <App model="test-model" sessionId="abc123" />,
      { stdout: { columns: 140, rows: 52 } as NodeJS.WriteStream },
    );

    await flush();
    stdin.write('/');
    stdin.write('\r');
    await flush();
    expect(lastFrame()).toContain('/cost');

    // While overlay is open, typed keys should stay in overlay filter only.
    for (const ch of marker) stdin.write(ch);
    await flush();

    // Close overlay, then submit. If input had captured marker, it would now post as a message.
    stdin.write('\x1B');
    await flush();
    stdin.write('\r');
    await flush();

    expect(lastFrame()).not.toContain(marker);
  });

  it('toggles runtime safe-mode with keybinding', async () => {
    const { lastFrame, stdin } = render(
      <App model="test-model" sessionId="abc123" />,
      { stdout: { columns: 120, rows: 30 } as NodeJS.WriteStream },
    );

    await flush();
    expect(lastFrame()).not.toContain('SAFE');

    stdin.write('\x0E'); // Ctrl+N
    await flush();
    expect(lastFrame()).toContain('SAFE');
    expect(lastFrame()).toContain('pending=0 (high=0, med=0, low=0)');
  });

  it('opens settings with Ctrl+S and keeps settings active on repeated Ctrl+S', async () => {
    const { lastFrame, stdin } = render(<App model="test-model" sessionId="abc123" />);
    await flush();

    stdin.write('\x13'); // Ctrl+S
    await flush();
    expect(lastFrame()).toContain('Settings');

    stdin.write('\x13'); // Ctrl+S while settings open => stays in settings
    await flush();
    expect(lastFrame()).toContain('Settings');
  });

  it('opens Opta menu with configured keybinding and does not hardcode Ctrl+S', async () => {
    vi.mocked(loadKeybindings).mockResolvedValueOnce({
      openOptaMenu: { key: 'ctrl+u', description: 'Open Opta menu' },
    });
    const { lastFrame, stdin } = render(<App model="test-model" sessionId="abc123" />);
    await flush();
    await flush();

    stdin.write('\x13'); // Ctrl+S is settings shortcut now
    await flush();
    expect(lastFrame()).toContain('Settings');

    stdin.write('\x1B'); // Escape settings
    await flush();
    stdin.write('\x15'); // Ctrl+U should open menu
    await flush();
    expect(lastFrame()).toContain('Status Check');
  });

  it('opens action history with Ctrl+E', async () => {
    const { lastFrame, stdin } = render(<App model="test-model" sessionId="abc123" />);
    await flush();

    stdin.write('\x05'); // Ctrl+E
    await flush();
    expect(lastFrame()).toContain('Recent Approvals');
    expect(lastFrame()).toContain('Search:');
    expect(lastFrame()).not.toContain('Browser Control Workspace');
  });

  it('switches from Opta menu to action history in a single Ctrl+E press', async () => {
    vi.mocked(loadKeybindings).mockResolvedValueOnce({
      openOptaMenu: { key: 'ctrl+s', description: 'Open Opta menu' },
    });
    const { lastFrame, stdin } = render(<App model="test-model" sessionId="abc123" />);
    await flush();

    stdin.write('\x13'); // Ctrl+S opens Opta menu in this test config
    await flush();
    expect(lastFrame()).toContain('Status Check');

    stdin.write('\x05'); // Ctrl+E should switch directly to Action History
    await flush();
    expect(lastFrame()).toContain('Recent Approvals');
    expect(lastFrame()).not.toContain('Status Check');
  });

  it('switches from Opta menu to slash command browser in a single Ctrl+K press', async () => {
    vi.mocked(loadKeybindings).mockResolvedValueOnce({
      openOptaMenu: { key: 'ctrl+s', description: 'Open Opta menu' },
    });
    const { lastFrame, stdin } = render(<App model="test-model" sessionId="abc123" />);
    await flush();

    stdin.write('\x13'); // Ctrl+S opens Opta menu in this test config
    await flush();
    expect(lastFrame()).toContain('Status Check');

    stdin.write('\x0B'); // Ctrl+K opens slash command browser
    await flush();
    expect(lastFrame()).toContain('/cost');
    expect(lastFrame()).toContain('INFO');
    expect(lastFrame()).not.toContain('Status Check');
  });

  it('opens model picker with Ctrl+G', async () => {
    const { lastFrame, stdin } = render(
      <App model="test-model" sessionId="abc123" />,
      { stdout: { columns: 140, rows: 46 } as NodeJS.WriteStream },
    );
    await flush();

    stdin.write('\x07'); // Ctrl+G
    await flush();
    expect(lastFrame()).toContain('Model Picker');
  });

  it('cycles mode and toggles bypass/follow shortcuts', async () => {
    const { lastFrame, stdin } = render(
      <App model="test-model" sessionId="abc123" />,
      { stdout: { columns: 140, rows: 46 } as NodeJS.WriteStream },
    );
    await flush();

    stdin.write('\x1B[Z'); // Shift+Tab
    await flush();
    expect(lastFrame()).toContain('[Plan]');

    stdin.write('\x19'); // Ctrl+Y
    await flush();
    expect(lastFrame()).toContain('BYPASS');

    stdin.write('\x06'); // Ctrl+F
    await flush();
    expect(lastFrame()).toContain('Auto follow toggled');
  });

  it('opens Opta menu during active thinking/streaming turn', async () => {
    vi.mocked(loadKeybindings).mockResolvedValueOnce({
      openOptaMenu: { key: 'ctrl+s', description: 'Open Opta menu' },
    });
    const emitter = createTuiEmitter();
    const { lastFrame, stdin } = render(
      <App model="test-model" sessionId="abc123" emitter={emitter} onSubmit={() => {}} />,
      { stdout: { columns: 140, rows: 46 } as NodeJS.WriteStream },
    );
    await flush();

    emitter.emit('turn:start');
    await flush();

    stdin.write('\x13'); // Ctrl+S opens Opta menu in this test config
    await flush();

    expect(lastFrame()).toContain('Operations');
    expect(lastFrame()).toContain('Status Check');
    expectCenteredLine(lastFrame(), 'Status Check');
  });

  it('opens Action History during active thinking/streaming turn', async () => {
    const emitter = createTuiEmitter();
    const { lastFrame, stdin } = render(
      <App model="test-model" sessionId="abc123" emitter={emitter} onSubmit={() => {}} />,
      { stdout: { columns: 140, rows: 46 } as NodeJS.WriteStream },
    );
    await flush();

    emitter.emit('turn:start');
    await flush();

    stdin.write('\x05'); // Ctrl+E
    await flush();

    expect(lastFrame()).toContain('Recent Approvals');
    expect(lastFrame()).toContain('Search:');
    expectCenteredLine(lastFrame(), 'Recent Approvals');
    expect(lastFrame()).not.toContain('Browser Control Workspace');
  });

  it('opens slash command browser during active thinking/streaming turn', async () => {
    const emitter = createTuiEmitter();
    const { lastFrame, stdin } = render(
      <App model="test-model" sessionId="abc123" emitter={emitter} onSubmit={() => {}} />,
      { stdout: { columns: 140, rows: 46 } as NodeJS.WriteStream },
    );
    await flush();

    emitter.emit('turn:start');
    await flush();

    stdin.write('\x0B'); // Ctrl+K
    await flush();

    expect(lastFrame()).toContain('/cost');
    expect(lastFrame()).toContain('INFO');
    expectCenteredLine(lastFrame(), '/cost');
  });

  it('streams live thinking into sidebar pane', async () => {
    const emitter = createTuiEmitter();
    const { lastFrame, stdin } = render(
      <App model="test-model" sessionId="abc123" emitter={emitter} onSubmit={() => {}} />,
      { stdout: { columns: 140, rows: 46 } as NodeJS.WriteStream },
    );
    await flush();

    stdin.write('\x02'); // Ctrl+B, open sidebar
    await flush();

    emitter.emit('turn:start');
    await flush();
    emitter.emit('thinking', 'Validating sidebar thinking pane rendering under load.');
    await flush();

    expect(lastFrame()).toContain('Live Thinking');
    expect(lastFrame()).toContain('Validating sidebar');
    expect(lastFrame()).toContain('Ctrl+T expand');
  });

  it('wires browser runtime controls into action history overlay', async () => {
    const configModule = await import('../../src/core/config.js');
    const controlSurface = await import('../../src/browser/control-surface.js');
    const approvalLog = await import('../../src/browser/approval-log.js');
    const profileStore = await import('../../src/browser/profile-store.js');

    vi.spyOn(configModule, 'loadConfig').mockResolvedValue(structuredClone(DEFAULT_CONFIG));
    vi.spyOn(approvalLog, 'readRecentBrowserApprovalEvents').mockResolvedValue([]);
    vi.spyOn(profileStore, 'listBrowserProfileDirs').mockResolvedValue([]);
    const health = {
      running: false,
      paused: false,
      killed: false,
      maxSessions: 3,
      sessionCount: 0,
      recoveredSessionIds: [],
      profilePrune: {
        enabled: true,
        intervalMs: 3_600_000,
        inFlight: false,
        lastRunAt: '2026-02-23T20:06:00.000Z',
        lastReason: 'startup' as const,
        lastStatus: 'success' as const,
        lastListedCount: 0,
        lastKeptCount: 0,
        lastPrunedCount: 0,
      },
      sessions: [],
    };
    const runSpy = vi.spyOn(controlSurface, 'runBrowserControlAction').mockResolvedValue({
      ok: true,
      action: 'status',
      message: 'Browser runtime status retrieved.',
      health,
    });

    const { stdin } = render(<App model="test-model" sessionId="abc123" />);
    await flush();

    stdin.write('\x05'); // Ctrl+E opens Action History
    await flush();
    stdin.write('1'); // runtime status
    await flush();

    expect(runSpy).toHaveBeenCalledWith('status', expect.any(Object));
  });

  it('supports non-modal browser pause/kill shortcuts from always-on rail', async () => {
    const configModule = await import('../../src/core/config.js');
    const controlSurface = await import('../../src/browser/control-surface.js');
    const approvalLog = await import('../../src/browser/approval-log.js');
    const profileStore = await import('../../src/browser/profile-store.js');

    vi.spyOn(configModule, 'loadConfig').mockResolvedValue(structuredClone(DEFAULT_CONFIG));
    vi.spyOn(approvalLog, 'readRecentBrowserApprovalEvents').mockResolvedValue([]);
    vi.spyOn(profileStore, 'listBrowserProfileDirs').mockResolvedValue([]);
    const health = {
      running: true,
      paused: false,
      killed: false,
      maxSessions: 3,
      sessionCount: 1,
      recoveredSessionIds: [],
      profilePrune: {
        enabled: false,
        inFlight: false,
      },
      sessions: [],
    };
    const runSpy = vi.spyOn(controlSurface, 'runBrowserControlAction').mockImplementation(async (action) => ({
      ok: true,
      action,
      message: `Browser runtime ${action}`,
      health: action === 'kill' ? { ...health, killed: true } : health,
    }));

    const { stdin } = render(<App model="test-model" sessionId="abc123" />);
    await flush();

    stdin.write('\x10'); // Ctrl+P
    await flush();
    stdin.write('\x18'); // Ctrl+X
    await flush();

    expect(runSpy).toHaveBeenCalledWith('pause', expect.any(Object));
    expect(runSpy).toHaveBeenCalledWith('kill', expect.any(Object));
  });

  it('opens browser control workspace from Opta menu', async () => {
    vi.mocked(loadKeybindings).mockResolvedValueOnce({
      openOptaMenu: { key: 'ctrl+s', description: 'Open Opta menu' },
    });
    const { lastFrame, stdin } = render(
      <App model="test-model" sessionId="abc123" />,
      { stdout: { columns: 140, rows: 46 } as NodeJS.WriteStream },
    );
    await flush();

    stdin.write('\x13'); // Ctrl+S opens Opta menu in this test config
    await flush();
    await moveMenuDown(stdin, 7); // Browser Control
    stdin.write('\r');
    await flush();

    expect(lastFrame()).toContain('policy: retentionDays=30 maxPersistedProfiles=200');
    expect(lastFrame()).toContain('Pending Approvals');
    expect(lastFrame()).toContain('running=');
    expect(lastFrame()).not.toContain('Browser Manager Rail');
  });

  it('runs browser runtime controls and replay scrub from browser control workspace', async () => {
    vi.mocked(loadKeybindings).mockResolvedValueOnce({
      openOptaMenu: { key: 'ctrl+s', description: 'Open Opta menu' },
    });
    const configModule = await import('../../src/core/config.js');
    const controlSurface = await import('../../src/browser/control-surface.js');
    const approvalLog = await import('../../src/browser/approval-log.js');
    const profileStore = await import('../../src/browser/profile-store.js');
    const replay = await import('../../src/browser/replay.js');

    vi.spyOn(configModule, 'loadConfig').mockResolvedValue(structuredClone(DEFAULT_CONFIG));
    vi.spyOn(approvalLog, 'readRecentBrowserApprovalEvents').mockResolvedValue([
      {
        timestamp: '2026-02-23T20:00:00.000Z',
        tool: 'browser_click',
        sessionId: 'sess-001',
        decision: 'approved',
      },
    ]);
    const replayMetadata = {
      schemaVersion: 1,
      sessionId: 'sess-001',
      mode: 'isolated',
      status: 'closed',
      runtime: 'playwright',
      createdAt: '2026-02-23T20:00:00.000Z',
      updatedAt: '2026-02-23T20:00:10.000Z',
      artifacts: [],
      actions: [],
    } as const;
    const replaySteps = [
      {
        sequence: 1,
        sessionId: 'sess-001',
        actionId: 'a-1',
        actionType: 'screenshot',
        timestamp: '2026-02-23T20:00:01.000Z',
        ok: true,
        artifactIds: ['art-1'],
        artifactPaths: ['/tmp/replay-step-1.png'],
      },
      {
        sequence: 2,
        sessionId: 'sess-001',
        actionId: 'a-2',
        actionType: 'screenshot',
        timestamp: '2026-02-23T20:00:02.000Z',
        ok: false,
        artifactIds: ['art-2'],
        artifactPaths: ['/tmp/replay-step-2.png'],
      },
      {
        sequence: 3,
        sessionId: 'sess-001',
        actionId: 'a-3',
        actionType: 'screenshot',
        timestamp: '2026-02-23T20:00:03.000Z',
        ok: true,
        artifactIds: ['art-3'],
        artifactPaths: ['/tmp/replay-step-3.png'],
      },
    ] as const;
    const readReplaySpy = vi.spyOn(replay, 'readBrowserReplay').mockResolvedValue(replayMetadata);
    const readReplayStepsSpy = vi.spyOn(replay, 'readBrowserReplaySteps').mockResolvedValue(replaySteps);
    vi.spyOn(replay, 'readBrowserReplayStepArtifactPreview').mockImplementation(async (_cwd, _sessionId, step) => {
      if (step.sequence === 2) {
        return {
          sequence: 2,
          artifacts: [
            {
              path: '/tmp/replay-step-2.html',
              mimeType: 'text/html',
              sizeBytes: 68,
              htmlSnippet: '<html><body>step 2</body></html>',
            },
          ],
        };
      }
      return {
        sequence: step.sequence,
        artifacts: [
          {
            path: step.sequence === 1 ? '/tmp/replay-step-1.png' : '/tmp/replay-step-3.png',
            mimeType: 'image/png',
            sizeBytes: step.sequence === 1 ? 1024 : 2048,
          },
        ],
      };
    });
    vi.spyOn(replay, 'deriveBrowserReplayVisualDiffPairs').mockResolvedValue([
      {
        index: 0,
        fromSequence: 1,
        fromActionType: 'screenshot',
        toSequence: 2,
        toActionType: 'screenshot',
        fromScreenshotPath: '/tmp/replay-step-1.png',
        toScreenshotPath: '/tmp/replay-step-2.png',
        status: 'changed',
        changedByteRatio: 0.42,
        perceptualDiffScore: 0.4,
        severity: 'high',
        regressionScore: 0.75,
        regressionSignal: 'regression' as const,
      },
      {
        index: 1,
        fromSequence: 2,
        fromActionType: 'screenshot',
        toSequence: 3,
        toActionType: 'screenshot',
        fromScreenshotPath: '/tmp/replay-step-2.png',
        toScreenshotPath: '/tmp/replay-step-3.png',
        status: 'unchanged',
        changedByteRatio: 0,
        perceptualDiffScore: 0,
        severity: 'low',
        regressionScore: 0,
        regressionSignal: 'none' as const,
      },
    ]);
    const baseProfileEntry = {
      sessionId: 'sess-001',
      absolutePath: '/tmp/.opta/browser/profiles/sess-001',
      relativePath: '.opta/browser/profiles/sess-001',
      modifiedAt: '2026-02-23T20:05:00.000Z',
      modifiedMs: Date.parse('2026-02-23T20:05:00.000Z'),
    } as const;
    let persistedProfiles = [baseProfileEntry];
    vi.spyOn(profileStore, 'listBrowserProfileDirs').mockImplementation(async () => persistedProfiles);
    const pruneSpy = vi.spyOn(profileStore, 'pruneBrowserProfileDirs').mockImplementation(async (options) => {
      const policy = profileStore.resolveBrowserProfileRetentionPolicy(options.policy);
      const listed = [...persistedProfiles];
      const pruned = [...persistedProfiles];
      persistedProfiles = [];
      return {
        rootDir: '/tmp/.opta/browser/profiles',
        policy,
        listed,
        kept: [],
        pruned,
      };
    });

    const health = {
      running: false,
      paused: false,
      killed: false,
      maxSessions: 3,
      sessionCount: 0,
      recoveredSessionIds: [],
      profilePrune: {
        enabled: true,
        intervalMs: 3_600_000,
        inFlight: false,
        lastRunAt: '2026-02-23T20:06:00.000Z',
        lastReason: 'startup' as const,
        lastStatus: 'success' as const,
        lastListedCount: 1,
        lastKeptCount: 1,
        lastPrunedCount: 0,
      },
      sessions: [],
    };
    const messages: Record<string, string> = {
      status: 'Browser runtime status retrieved.',
      pause: 'Browser runtime paused.',
      resume: 'Browser runtime resumed.',
      stop: 'Browser runtime already stopped.',
      kill: 'Browser runtime killed.',
    };
    const runSpy = vi.spyOn(controlSurface, 'runBrowserControlAction').mockImplementation(async (action) => ({
      ok: true,
      action,
      message: messages[action],
      health,
    }));

    const { lastFrame, stdin } = render(
      <App model="test-model" sessionId="abc123" />,
      { stdout: { columns: 140, rows: 52 } as NodeJS.WriteStream },
    );
    await flush();

    stdin.write('\x13'); // Ctrl+S opens Opta menu in this test config
    await flush();
    await moveMenuDown(stdin, 7); // Browser Control
    stdin.write('\r');
    await flush();

    expect(runSpy).toHaveBeenCalledWith('status', expect.any(Object));
    expect(lastFrame()).toContain('browser_click');
    expect(lastFrame()).toContain('policy: retentionDays=30 maxPersistedProfiles=200');
    expect(lastFrame()).toContain('persisted=1');
    expect(lastFrame()).toContain('press x to prune with policy');
    expect(lastFrame()).toContain('auto-prune every 1h');

    stdin.write('2'); // pause
    await flush();
    expect(runSpy).toHaveBeenCalledWith('pause', expect.any(Object));
    expect(lastFrame()).toContain('Browser runtime paused.');

    stdin.write('\r'); // load replay for selected session
    await flush();
    expect(readReplaySpy).toHaveBeenCalledWith(expect.any(String), 'sess-001');
    expect(readReplayStepsSpy).toHaveBeenCalledWith(expect.any(String), 'sess-001');
    expect(lastFrame()).toContain('Loaded 3 replay steps for sess-001.');

    stdin.write('j'); // scrub from step 1 -> step 2
    await flush();
    await flush();
    expect(lastFrame()).toContain('Selected step #2 screenshot.');

    stdin.write('n'); // move to next diff pair
    await flush();
    expect(lastFrame()).toContain('Selected diff #2: #2 -> #3 unchanged.');

    stdin.write('x'); // prune persisted profiles using current policy
    await flush();
    await flush();
    expect(pruneSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        policy: expect.objectContaining({
          retentionDays: 30,
          maxPersistedProfiles: 200,
        }),
      }),
    );
    expect(lastFrame()).toContain('Browser profiles prune · 1 pruned');
  });

  it('shows pending browser approval queue with risk and age metadata', async () => {
    vi.mocked(loadKeybindings).mockResolvedValueOnce({
      openOptaMenu: { key: 'ctrl+s', description: 'Open Opta menu' },
    });
    const emitter = createTuiEmitter();
    const { lastFrame, stdin } = render(
      <App model="test-model" sessionId="abc123" emitter={emitter} onSubmit={() => {}} />,
      { stdout: { columns: 140, rows: 46 } as NodeJS.WriteStream },
    );
    await flush();

    stdin.write('\x13'); // Ctrl+S opens Opta menu in this test config
    await flush();
    await moveMenuDown(stdin, 7); // Browser Control
    stdin.write('\r');
    await flush();

    emitter.emit('permission:request', {
      id: 'perm-queue-001',
      toolName: 'browser_click',
      args: {
        session_id: 'sess-001',
        selector: 'button[data-action="delete-account"]',
      },
    });
    await flush();

    expect(lastFrame()).toContain('Pending Approvals');
    expect(lastFrame()).toContain('browser_click');
    expect(lastFrame()).toContain('high');
    expect(lastFrame()).toContain('delete');
    expect(lastFrame()).toContain('0s');
  });

  it('blocks submit when model is not loaded', async () => {
    const emitter = createTuiEmitter();
    const onSubmit = vi.fn();
    const { lastFrame, stdin } = render(
      <App
        model="test-model"
        sessionId="abc123"
        emitter={emitter}
        onSubmit={onSubmit}
        requireLoadedModel={true}
        initialModelLoaded={false}
      />
    );

    await flush();
    stdin.write('hello');
    stdin.write('\r');
    await flush();

    expect(onSubmit).not.toHaveBeenCalled();
    expect(lastFrame()).toContain('No Model Loaded');
  });

  it('marks transport failures as unavailable and blocks submit while model is required', async () => {
    const emitter = createTuiEmitter();
    const onSubmit = vi.fn();
    const { lastFrame, stdin } = render(
      <App
        model="test-model"
        sessionId="abc123"
        emitter={emitter}
        onSubmit={onSubmit}
        requireLoadedModel={true}
        initialModelLoaded={true}
      />,
      { stdout: { columns: 120, rows: 42 } as NodeJS.WriteStream },
    );

    await flush();
    emitter.emit('error', 'connect ECONNREFUSED 127.0.0.1:1234');
    await flush();
    expect(lastFrame()).toContain('✗ test-model');

    stdin.write('hello');
    stdin.write('\r');
    await flush();

    expect(onSubmit).not.toHaveBeenCalled();
    expect(lastFrame()).toContain('No Model Loaded');
  });

  it('uses structured error codes before message matching fallback', async () => {
    const emitter = createTuiEmitter();
    const onSubmit = vi.fn();
    const { lastFrame, stdin } = render(
      <App
        model="test-model"
        sessionId="abc123"
        emitter={emitter}
        onSubmit={onSubmit}
        requireLoadedModel={true}
        initialModelLoaded={true}
      />,
      { stdout: { columns: 120, rows: 42 } as NodeJS.WriteStream },
    );

    await flush();
    emitter.emit('error', { code: 'lmx-timeout', message: 'upstream unavailable' });
    await flush();
    expect(lastFrame()).toContain('✗ test-model');

    stdin.write('hello');
    stdin.write('\r');
    await flush();

    expect(onSubmit).not.toHaveBeenCalled();
    expect(lastFrame()).toContain('No Model Loaded');
  });

  it('keeps legacy prefixed string error parsing fallback', async () => {
    const emitter = createTuiEmitter();
    const onSubmit = vi.fn();
    const { lastFrame, stdin } = render(
      <App
        model="test-model"
        sessionId="abc123"
        emitter={emitter}
        onSubmit={onSubmit}
        requireLoadedModel={true}
        initialModelLoaded={true}
      />,
      { stdout: { columns: 120, rows: 42 } as NodeJS.WriteStream },
    );

    await flush();
    emitter.emit('error', '[lmx-timeout] upstream unavailable');
    await flush();
    expect(lastFrame()).toContain('✗ test-model');

    stdin.write('hello');
    stdin.write('\r');
    await flush();

    expect(onSubmit).not.toHaveBeenCalled();
    expect(lastFrame()).toContain('No Model Loaded');
  });

  it('restores submit readiness after connection recovers', async () => {
    const emitter = createTuiEmitter();
    const onSubmit = vi.fn();
    const { stdin } = render(
      <App
        model="test-model"
        sessionId="abc123"
        emitter={emitter}
        onSubmit={onSubmit}
        requireLoadedModel={true}
        initialModelLoaded={true}
      />,
    );

    await flush();
    emitter.emit('error', 'connect ECONNREFUSED 127.0.0.1:1234');
    await flush();
    emitter.emit('connection:status', 'connected');
    await flush();

    stdin.write('hello');
    stdin.write('\r');
    await flush();

    expect(onSubmit).toHaveBeenCalledWith('hello');
  });

  it('blocks timeout-style turn errors until reconnect emits connected', async () => {
    const emitter = createTuiEmitter();
    const onSubmit = vi.fn();
    const { lastFrame, stdin } = render(
      <App
        model="test-model"
        sessionId="abc123"
        emitter={emitter}
        onSubmit={onSubmit}
        requireLoadedModel={true}
        initialModelLoaded={true}
      />,
      { stdout: { columns: 120, rows: 42 } as NodeJS.WriteStream },
    );

    await flush();
    emitter.emit('error', 'Turn error: request timed out while waiting for upstream (connection_error).');
    await flush();
    expect(lastFrame()).toContain('✗ test-model');

    stdin.write('first');
    stdin.write('\r');
    await flush();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(lastFrame()).toContain('No Model Loaded');

    emitter.emit('connection:status', 'reconnecting');
    await flush();
    stdin.write('second');
    stdin.write('\r');
    await flush();
    expect(onSubmit).not.toHaveBeenCalled();

    emitter.emit('connection:status', 'connected');
    await flush();
    stdin.write('third');
    stdin.write('\r');
    await flush();
    expect(onSubmit).toHaveBeenCalledWith('third');
  });

  it('allows slash commands when model is not loaded', async () => {
    const emitter = createTuiEmitter();
    const onSlashCommand = vi.fn().mockResolvedValue({
      result: 'handled',
      output: '',
    });
    const { stdin } = render(
      <App
        model="test-model"
        sessionId="abc123"
        emitter={emitter}
        onSlashCommand={onSlashCommand}
        requireLoadedModel={true}
        initialModelLoaded={false}
      />
    );

    await flush();
    stdin.write('/status');
    stdin.write('\r');
    await flush();

    expect(onSlashCommand).toHaveBeenCalledWith('/status');
  });

  it('runs recommended status action from Opta menu without closing the menu', async () => {
    vi.mocked(loadKeybindings).mockResolvedValueOnce({
      openOptaMenu: { key: 'ctrl+s', description: 'Open Opta menu' },
    });
    const onSlashCommand = vi.fn().mockResolvedValue({
      result: 'handled',
      output: 'ok',
    });
    const { stdin, lastFrame } = render(
      <App model="test-model" sessionId="abc123" onSlashCommand={onSlashCommand} />,
    );
    await flush();

    stdin.write('\x13'); // Ctrl+S opens Opta menu in this test config
    await flush();
    stdin.write('\r');
    await flush();

    expect(onSlashCommand).toHaveBeenCalledWith('/status');
    expect(lastFrame()).toContain('Operations');
    expect(lastFrame()).toContain('Status Check');
  });

  it('cancels active turn with Escape', async () => {
    const emitter = createTuiEmitter();
    const onCancelTurn = vi.fn();
    const { stdin } = render(
      <App
        model="test-model"
        sessionId="abc123"
        emitter={emitter}
        onSubmit={() => {}}
        onCancelTurn={onCancelTurn}
      />
    );
    await flush();
    emitter.emit('turn:start');
    await flush();

    stdin.write('\x1B'); // Escape
    await flush();
    expect(onCancelTurn).toHaveBeenCalledTimes(1);
  });

  it('preserves spaces when streamed token chunks end with whitespace', async () => {
    const emitter = createTuiEmitter();
    const { lastFrame } = render(
      <App model="test-model" sessionId="abc123" emitter={emitter} onSubmit={() => {}} />,
      { stdout: { columns: 120, rows: 42 } as NodeJS.WriteStream },
    );
    await flush();

    emitter.emit('turn:start');
    emitter.emit('token', 'my ');
    emitter.emit('token', 'connection ');
    emitter.emit('token', 'works');
    emitter.emit('turn:end', {
      tokens: 3,
      promptTokens: 0,
      completionTokens: 3,
      toolCalls: 0,
      elapsed: 0.8,
      speed: 3.7,
      firstTokenLatencyMs: 12,
    });
    await flush();

    expect(lastFrame()).toContain('my connection works');
  });
});

// ---------------------------------------------------------------------------
// P0-03 Alternate buffer lifecycle
// ---------------------------------------------------------------------------
// Ink represents "full-screen TUI mode" via cursor-hide (\x1b[?25l) on render
// and cursor-show (\x1b[?25h) on unmount — not the ?1049 alternate-buffer code.
// These tests use ink's render() directly (not ink-testing-library) so that
// debug:false mode is active and ANSI sequences are written to the stdout mock.
// ---------------------------------------------------------------------------

class CapturingStdout extends EventEmitter {
  columns = 120;
  rows = 40;
  isTTY = true;
  writes: string[] = [];
  write(data: string): boolean {
    this.writes.push(data);
    return true;
  }
  raw(): string {
    return this.writes.join('');
  }
}

describe('P0-03 Alternate buffer lifecycle', () => {
  it('hides cursor on render — TUI enters full-screen mode', async () => {
    const cap = new CapturingStdout();
    const inst = inkRender(
      <App model="test-model" sessionId="p0-03-a" />,
      {
        stdout: cap as unknown as NodeJS.WriteStream,
        stderr: cap as unknown as NodeJS.WriteStream,
        exitOnCtrlC: false,
        patchConsole: false,
        debug: false,
      },
    );
    await flush();
    // \x1b[?25l = hide cursor — signals TUI has taken over the terminal
    expect(cap.raw()).toContain('\x1b[?25l');
    inst.unmount();
    await flush();
  });

  it('restores cursor on unmount — TUI exits full-screen cleanly', async () => {
    const cap = new CapturingStdout();
    const inst = inkRender(
      <App model="test-model" sessionId="p0-03-b" />,
      {
        stdout: cap as unknown as NodeJS.WriteStream,
        stderr: cap as unknown as NodeJS.WriteStream,
        exitOnCtrlC: false,
        patchConsole: false,
        debug: false,
      },
    );
    await flush();
    inst.unmount();
    await flush();
    // \x1b[?25h = show cursor — signals TUI released terminal control cleanly
    expect(cap.raw()).toContain('\x1b[?25h');
  });
});

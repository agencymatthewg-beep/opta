import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const BASE_CONFIG = {
  connection: { host: '127.0.0.1', fallbackHosts: ['localhost'], port: 11434 },
  model: { default: 'test-model' },
  tui: { default: false },
};

const BASE_SESSION = {
  id: 'session_12345678',
  model: 'test-model',
  title: undefined,
  messages: [] as Array<{ role: string; content: string }>,
  toolCallCount: 0,
  created: new Date().toISOString(),
};

describe('startChat startup handling', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetModules();
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
    vi.restoreAllMocks();
  });

  async function loadStartChatWithMocks(params: {
    firstRun?: boolean;
    inputError?: Error;
    diskPreflightError?: Error;
  }) {
    const loadConfig = vi.fn().mockResolvedValue(BASE_CONFIG);
    const buildSystemPrompt = vi.fn().mockResolvedValue('system prompt');
    const agentLoop = vi.fn();
    const isFirstRun = vi.fn().mockResolvedValue(params.firstRun ?? false);
    const runOnboarding = vi.fn().mockResolvedValue(undefined);
    const createSession = vi.fn().mockResolvedValue({ ...BASE_SESSION });
    const saveSession = vi.fn().mockResolvedValue(undefined);
    const runConnectionDiagnostics = vi.fn().mockResolvedValue([]);
    const formatDiagnostics = vi.fn().mockReturnValue('[diagnostics]');
    const stopConnectionMonitor = vi.fn();
    const startConnectionMonitor = vi.fn().mockReturnValue(stopConnectionMonitor);
    const input = vi.fn().mockRejectedValue(params.inputError ?? new Error('cancelled'));
    const writeSessionLog = vi.fn().mockResolvedValue({
      path: '/tmp/12-Session-Logs/2026-02-23-1430-device-session.md',
      fileName: '2026-02-23-1430-device-session.md',
    });
    const ensureDiskHeadroom = params.diskPreflightError
      ? vi.fn().mockRejectedValue(params.diskPreflightError)
      : vi.fn().mockResolvedValue({
          path: '/tmp',
          totalBytes: 1024,
          freeBytes: 1024,
          availableBytes: 1024,
        });

    vi.doMock('../../src/core/config.js', () => ({
      loadConfig,
    }));
    vi.doMock('../../src/core/agent.js', () => ({
      agentLoop,
      buildSystemPrompt,
    }));
    vi.doMock('../../src/memory/store.js', () => ({
      createSession,
      loadSession: vi.fn(),
      saveSession,
      generateTitle: vi.fn().mockReturnValue('Generated title'),
      searchSessions: vi.fn().mockResolvedValue([]),
    }));
    vi.doMock('../../src/core/diagnostics.js', () => ({
      runConnectionDiagnostics,
      formatDiagnostics,
    }));
    vi.doMock('../../src/commands/onboard.js', () => ({
      isFirstRun,
      runOnboarding,
    }));
    vi.doMock('../../src/ui/input.js', async () => {
      const actual = await vi.importActual<typeof import('../../src/ui/input.js')>('../../src/ui/input.js');
      return {
        ...actual,
        startConnectionMonitor,
      };
    });
    vi.doMock('@inquirer/prompts', () => ({
      input,
    }));
    vi.doMock('../../src/journal/session-log.js', () => ({
      writeSessionLog,
    }));
    vi.doMock('../../src/utils/disk.js', () => ({
      ensureDiskHeadroom,
      diskHeadroomMbToBytes: (mb: number) => mb * 1024 * 1024,
      isStorageRelatedError: (err: unknown) => {
        const code = (err as { code?: string } | null)?.code;
        if (typeof code === 'string' && code.toUpperCase() === 'ENOSPC') return true;
        if (err instanceof Error) return err.message.toLowerCase().includes('no space');
        return false;
      },
    }));
    vi.doMock('../../src/providers/manager.js', () => ({
      probeProvider: vi.fn().mockResolvedValue({ name: 'lmx' }),
      getProvider: vi.fn(),
      resetProviderCache: vi.fn(),
    }));

    const { startChat } = await import('../../src/commands/chat.js');

    return {
      startChat,
      loadConfig,
      buildSystemPrompt,
      isFirstRun,
      runOnboarding,
      createSession,
      saveSession,
      runConnectionDiagnostics,
      startConnectionMonitor,
      stopConnectionMonitor,
      input,
      writeSessionLog,
      ensureDiskHeadroom,
    };
  }

  async function loadStartChatTuiWithPreflight(params: {
    loadedModelIds: string[];
    preflightError?: Error;
  }) {
    const loadConfig = vi.fn().mockResolvedValue({ ...BASE_CONFIG, tui: { default: true } });
    const buildSystemPrompt = vi.fn().mockResolvedValue('system prompt');
    const createSession = vi.fn().mockResolvedValue({ ...BASE_SESSION });
    const saveSession = vi.fn().mockResolvedValue(undefined);
    const runConnectionDiagnostics = vi.fn().mockResolvedValue([]);
    const formatDiagnostics = vi.fn().mockReturnValue('[diagnostics]');
    const writeSessionLog = vi.fn().mockResolvedValue({
      path: '/tmp/12-Session-Logs/2026-02-23-1430-device-session.md',
      fileName: '2026-02-23-1430-device-session.md',
    });
    const renderTUI = vi.fn().mockResolvedValue(undefined);
    const emitter = {
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
    };
    const closeSocket = vi.fn();
    let wsHandlers:
      | {
          onOpen?: () => void;
          onClose?: () => void;
          onError?: (err: unknown) => void;
          onEvent?: (event: { event: string; seq: number; payload: unknown }) => void;
        }
      | undefined;
    const daemon = {
      createSession: vi.fn().mockResolvedValue(undefined),
      connectWebSocket: vi.fn().mockImplementation(
        (_sessionId: string, _afterSeq: number, handlers: typeof wsHandlers) => {
          wsHandlers = handlers;
          return { close: closeSocket };
        },
      ),
      resolvePermission: vi.fn().mockResolvedValue(undefined),
      cancel: vi.fn().mockResolvedValue({ cancelled: 0 }),
      getSession: vi.fn().mockResolvedValue({ messages: [], toolCallCount: 0 }),
      submitTurn: vi.fn().mockResolvedValue({ turnId: 'turn_123' }),
    };
    const daemonConnect = vi.fn().mockResolvedValue(daemon);
    const lmxModels = params.preflightError
      ? vi.fn().mockRejectedValue(params.preflightError)
      : vi.fn().mockResolvedValue({
          models: params.loadedModelIds.map((modelId) => ({ model_id: modelId })),
        });
    const ensureDiskHeadroom = vi.fn().mockResolvedValue({
      path: '/tmp',
      totalBytes: 1024,
      freeBytes: 1024,
      availableBytes: 1024,
    });
    const LmxClient = vi.fn().mockImplementation(() => ({
      models: lmxModels,
    }));

    vi.doMock('../../src/core/config.js', () => ({
      loadConfig,
    }));
    vi.doMock('../../src/core/agent.js', () => ({
      agentLoop: vi.fn(),
      buildSystemPrompt,
    }));
    vi.doMock('../../src/memory/store.js', () => ({
      createSession,
      loadSession: vi.fn(),
      saveSession,
      generateTitle: vi.fn().mockReturnValue('Generated title'),
      searchSessions: vi.fn().mockResolvedValue([]),
    }));
    vi.doMock('../../src/core/diagnostics.js', () => ({
      runConnectionDiagnostics,
      formatDiagnostics,
    }));
    vi.doMock('../../src/commands/onboard.js', () => ({
      isFirstRun: vi.fn().mockResolvedValue(false),
      runOnboarding: vi.fn().mockResolvedValue(undefined),
    }));
    vi.doMock('../../src/lmx/client.js', () => ({
      LmxClient,
      lookupContextLimit: vi.fn().mockReturnValue(32768),
    }));
    vi.doMock('../../src/tui/render.js', () => ({
      renderTUI,
    }));
    vi.doMock('../../src/tui/adapter.js', () => ({
      createTuiEmitter: () => emitter,
    }));
    vi.doMock('../../src/daemon/client.js', () => ({
      DaemonClient: { connect: daemonConnect },
    }));
    vi.doMock('../../src/journal/session-log.js', () => ({
      writeSessionLog,
    }));
    vi.doMock('../../src/utils/disk.js', () => ({
      ensureDiskHeadroom,
      diskHeadroomMbToBytes: (mb: number) => mb * 1024 * 1024,
      isStorageRelatedError: () => false,
    }));
    vi.doMock('../../src/providers/manager.js', () => ({
      probeProvider: vi.fn().mockResolvedValue({ name: 'lmx' }),
      getProvider: vi.fn(),
      resetProviderCache: vi.fn(),
    }));

    const { startChat } = await import('../../src/commands/chat.js');

    return {
      startChat,
      renderTUI,
      daemon,
      emitter,
      lmxModels,
      wsHandlersRef: () => wsHandlers,
      writeSessionLog,
      ensureDiskHeadroom,
    };
  }

  it('runs onboarding + config reload + diagnostics for non-json startup', async () => {
    const mocks = await loadStartChatWithMocks({ firstRun: true });

    await mocks.startChat({});

    expect(mocks.loadConfig).toHaveBeenCalledTimes(2);
    expect(mocks.isFirstRun).toHaveBeenCalledTimes(1);
    expect(mocks.runOnboarding).toHaveBeenCalledTimes(1);
    expect(mocks.createSession).toHaveBeenCalledWith('test-model');
    expect(mocks.buildSystemPrompt).toHaveBeenCalledTimes(1);
    expect(mocks.runConnectionDiagnostics).toHaveBeenCalledWith('127.0.0.1', 11434);
    expect(mocks.startConnectionMonitor).toHaveBeenCalledWith('127.0.0.1', 11434, ['localhost'], undefined);
    expect(mocks.stopConnectionMonitor).toHaveBeenCalledTimes(1);
    expect(mocks.input).toHaveBeenCalledTimes(1);
    expect(mocks.saveSession).toHaveBeenCalledTimes(2);
    expect(mocks.writeSessionLog).toHaveBeenCalledTimes(1);
  });

  it('skips onboarding and startup diagnostics in json mode', async () => {
    const mocks = await loadStartChatWithMocks({ firstRun: true });

    await mocks.startChat({ format: 'json' });

    expect(mocks.loadConfig).toHaveBeenCalledTimes(1);
    expect(mocks.isFirstRun).not.toHaveBeenCalled();
    expect(mocks.runOnboarding).not.toHaveBeenCalled();
    expect(mocks.runConnectionDiagnostics).not.toHaveBeenCalled();
    expect(mocks.startConnectionMonitor).not.toHaveBeenCalled();
    expect(mocks.stopConnectionMonitor).not.toHaveBeenCalled();
    expect(mocks.saveSession).toHaveBeenCalledTimes(2);
    expect(mocks.writeSessionLog).toHaveBeenCalledTimes(1);
  });

  it('fails fast with ExitError when disk preflight reports ENOSPC', async () => {
    const preflightErr = Object.assign(new Error('no space left on device'), { code: 'ENOSPC' });
    const mocks = await loadStartChatWithMocks({
      firstRun: true,
      diskPreflightError: preflightErr,
    });

    await expect(mocks.startChat({})).rejects.toMatchObject({
      name: 'ExitError',
      exitCode: 1,
    });
    expect(mocks.ensureDiskHeadroom).toHaveBeenCalledTimes(1);
    expect(mocks.isFirstRun).not.toHaveBeenCalled();
    expect(mocks.runOnboarding).not.toHaveBeenCalled();
    expect(mocks.createSession).not.toHaveBeenCalled();
  });

  it('passes loaded startup preflight state into TUI render options', async () => {
    const mocks = await loadStartChatTuiWithPreflight({ loadedModelIds: ['test-model'] });

    await mocks.startChat({ tui: true });

    expect(mocks.lmxModels).toHaveBeenCalledTimes(1);
    expect(mocks.renderTUI).toHaveBeenCalledTimes(1);
    const renderOpts = mocks.renderTUI.mock.calls[0]?.[0];
    expect(renderOpts.model).toBe('test-model');
    expect(renderOpts.requireLoadedModel).toBe(true);
    expect(renderOpts.initialModelLoaded).toBe(true);
    expect(renderOpts.initialMessages[0].role).toBe('assistant');
    expect(renderOpts.initialMessages[0].content).toContain('Connected to test-model and ready.');
    expect(renderOpts.initialMessages[0].content).toContain('What do you want to do next?');
  });

  it('passes no-model startup preflight state into TUI render options', async () => {
    const mocks = await loadStartChatTuiWithPreflight({ loadedModelIds: [] });

    await mocks.startChat({ tui: true });

    expect(mocks.lmxModels).toHaveBeenCalledTimes(1);
    expect(mocks.renderTUI).toHaveBeenCalledTimes(1);
    const renderOpts = mocks.renderTUI.mock.calls[0]?.[0];
    expect(renderOpts.requireLoadedModel).toBe(true);
    expect(renderOpts.initialModelLoaded).toBe(false);
    expect(renderOpts.initialMessages[0].role).toBe('error');
    expect(renderOpts.initialMessages[0].content).toContain('No Model Loaded - Use Opta Menu to begin');
  });

  it('forwards structured turn.error payloads to TUI error channel', async () => {
    const mocks = await loadStartChatTuiWithPreflight({ loadedModelIds: ['test-model'] });

    await mocks.startChat({ tui: true });
    mocks.emitter.emit.mockClear();

    const handlers = mocks.wsHandlersRef();
    expect(handlers?.onEvent).toBeTypeOf('function');
    handlers?.onEvent?.({
      event: 'turn.error',
      seq: 4,
      payload: {
        message: 'LMX preflight failed',
        code: 'lmx-timeout',
      },
    });

    expect(mocks.emitter.emit).toHaveBeenCalledWith('error', {
      message: 'LMX preflight failed',
      code: 'lmx-timeout',
    });
  });

  it('keeps plain turn.error messages backward compatible when no code is provided', async () => {
    const mocks = await loadStartChatTuiWithPreflight({ loadedModelIds: ['test-model'] });

    await mocks.startChat({ tui: true });
    mocks.emitter.emit.mockClear();

    const handlers = mocks.wsHandlersRef();
    expect(handlers?.onEvent).toBeTypeOf('function');
    handlers?.onEvent?.({
      event: 'turn.error',
      seq: 4,
      payload: {
        message: 'Turn failed',
      },
    });

    expect(mocks.emitter.emit).toHaveBeenCalledWith('error', {
      message: 'Turn failed',
    });
  });
});

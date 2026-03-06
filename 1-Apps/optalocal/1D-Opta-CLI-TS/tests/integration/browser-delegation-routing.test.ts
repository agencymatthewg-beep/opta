import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

describe('agentLoop browser delegation routing', () => {
  it('delegates browser-intent tasks when autoInvoke is enabled and skips main stream loop on success', async () => {
    const buildToolRegistry = vi.fn().mockResolvedValue({
      schemas: [],
      execute: vi.fn(),
      close: vi.fn().mockResolvedValue(undefined),
    });
    const createStreamWithRetry = vi.fn();
    const delegateToBrowserSubAgent = vi.fn().mockResolvedValue({
      ok: true,
      summary: 'Delegated browser workflow completed.',
      artifactPaths: [],
      sessionId: 'sess-browser-01',
    });

    vi.doMock('../../src/core/agent-setup.js', () => ({
      getOrCreateClient: vi.fn().mockResolvedValue({
        chat: { completions: { create: vi.fn() } },
        __optaProviderName: 'lmx',
      }),
      buildSystemPrompt: vi.fn().mockResolvedValue('system prompt'),
      compactHistory: vi.fn(async (messages: unknown[]) => messages),
      maskOldObservations: vi.fn((messages: unknown[]) => messages),
      buildCapabilityManifest: vi.fn(() => ({ capabilities: [] })),
      injectCapabilityManifest: vi.fn((prompt: string) => prompt),
    }));

    vi.doMock('../../src/core/agent-streaming.js', () => ({
      createStreamWithRetry,
      collectStream: vi.fn(),
    }));

    vi.doMock('../../src/core/agent-permissions.js', () => ({
      resolveToolDecisions: vi.fn().mockResolvedValue([]),
    }));

    vi.doMock('../../src/core/agent-execution.js', () => ({
      executeToolCalls: vi.fn().mockResolvedValue({
        toolCallsDelta: 0,
        checkpointCount: 0,
      }),
    }));

    vi.doMock('../../src/core/autonomy.js', () => ({
      applyAutonomyRuntimeProfile: vi.fn((cfg: unknown) => cfg),
      buildAutonomyCycleCheckpoint: vi.fn(() => ({
        cycle: 0,
        phase: 0,
        stage: 'execute',
      })),
      buildAutonomyStageCheckpointGuidance: vi.fn(() => ''),
      buildCeoAutonomyReport: vi.fn(() => ({
        summary: 'report',
        slug: 'report',
        commandInputs: [],
        steps: [],
      })),
    }));

    vi.doMock('../../src/core/atpo.js', () => ({
      AtpoSupervisor: class {
        isEnabled = false;
        async checkThresholds() {
          return false;
        }
        async intervene() {
          return null;
        }
        onToolStart() {}
        onToolError() {}
        onToolSuccess() {}
      },
    }));

    vi.doMock('../../src/core/tools/index.js', () => ({
      initProcessManager: vi.fn(),
      shutdownProcessManager: vi.fn(),
    }));

    vi.doMock('../../src/mcp/registry.js', () => ({
      buildToolRegistry,
    }));

    vi.doMock('../../src/browser/intent-router.js', () => ({
      routeBrowserIntent: vi.fn(() => ({
        shouldRoute: true,
        confidence: 'high',
        confidenceScore: 0.95,
        reason: 'Matched explicit browser intent',
        signals: ['explicit:url'],
      })),
      buildBrowserAvailabilityInstruction: vi.fn(() => null),
    }));

    vi.doMock('../../src/browser/sub-agent-delegator.js', () => ({
      delegateToBrowserSubAgent,
    }));

    vi.doMock(
      '../../src/browser/adaptation.js',
      async (importOriginal: () => Promise<typeof import('../../src/browser/adaptation.js')>) => {
        const actual = await importOriginal();
        return {
          ...actual,
          loadBrowserRunCorpusAdaptationHint: vi.fn().mockResolvedValue({
            intent: undefined,
            policy: undefined,
          }),
        };
      },
    );

    vi.doMock('../../src/core/tool-compatibility.js', () => ({
      readToolCompatibilityEntry: vi.fn().mockResolvedValue(null),
      buildToolCompatibilityInstruction: vi.fn().mockReturnValue(null),
      recordToolCompatibilityEvent: vi.fn().mockResolvedValue(undefined),
    }));

    const { DEFAULT_CONFIG } = await import('../../src/core/config.js');
    const { agentLoop } = await import('../../src/core/agent.js');

    const config = structuredClone(DEFAULT_CONFIG);
    config.browser.enabled = true;
    config.browser.autoInvoke = true;
    config.browser.mcp.enabled = true;
    config.provider.active = 'lmx';
    config.model.default = 'mlx-community/Qwen2.5-7B-Instruct-4bit';

    const result = await agentLoop(
      'Open https://example.com and verify the dashboard.',
      config,
      {
        sessionId: 'sess-browser-01',
        silent: true,
      },
    );

    expect(delegateToBrowserSubAgent).toHaveBeenCalledOnce();
    expect(createStreamWithRetry).not.toHaveBeenCalled();
    expect(buildToolRegistry).toHaveBeenCalledOnce();
    expect(result.messages.at(-1)?.content).toBe('Delegated browser workflow completed.');
  });
});

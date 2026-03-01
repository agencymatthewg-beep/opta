import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CONFIG, type OptaConfig } from '../../src/core/config.js';
import { evaluateOperationCapability } from '../../src/daemon/operations/capability-evaluator.js';

const originalFetch = globalThis.fetch;
const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

function withRuntimePolicy(overrides: Partial<OptaConfig['policy']['runtimeEnforcement']>): OptaConfig {
  return {
    ...DEFAULT_CONFIG,
    policy: {
      ...DEFAULT_CONFIG.policy,
      runtimeEnforcement: {
        ...DEFAULT_CONFIG.policy.runtimeEnforcement,
        enabled: true,
        endpoint: 'http://127.0.0.1:3000/api/capabilities/evaluate',
        timeoutMs: 200,
        failOpen: true,
        ...overrides,
        applyTo: {
          ...DEFAULT_CONFIG.policy.runtimeEnforcement.applyTo,
          ...(overrides.applyTo ?? {}),
        },
      },
    },
  };
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  warnSpy.mockClear();
  delete process.env['OPTA_ACCOUNTS_DEVICE_ID'];
});

describe('capability evaluator runtime enforcement', () => {
  it('skips non-high-risk operations', async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const decision = await evaluateOperationCapability(withRuntimePolicy({}), {
      id: 'env.save',
      safety: 'write',
      operationInput: { name: 'foo' },
    });

    expect(decision).toEqual({ kind: 'allow' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('evaluates high-risk write operations through capability endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ allow: true }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const decision = await evaluateOperationCapability(withRuntimePolicy({}), {
      id: 'config.reset',
      safety: 'write',
      operationInput: {},
    });

    expect(decision).toEqual({ kind: 'allow' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(JSON.parse(String(request?.body))).toEqual({
      scope: 'automation.high_risk',
      context: {
        source: 'opta-cli',
        operationId: 'config.reset',
        safety: 'write',
      },
    });
  });

  it('denies when evaluator returns allow=false', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ allow: false, reason: 'Approval required', decisionId: 'dec-1' }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const decision = await evaluateOperationCapability(withRuntimePolicy({}), {
      id: 'benchmark',
      safety: 'dangerous',
      operationInput: {},
    });

    expect(decision).toEqual({
      kind: 'deny',
      code: 'capability_denied',
      message: 'Approval required',
      details: { decisionId: 'dec-1' },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(request).toBeDefined();
    expect(JSON.parse(String(request?.body))).toEqual({
      scope: 'automation.high_risk',
      context: {
        source: 'opta-cli',
        operationId: 'benchmark',
        safety: 'dangerous',
      },
    });
  });

  it('includes device id when OPTA_ACCOUNTS_DEVICE_ID is configured', async () => {
    process.env['OPTA_ACCOUNTS_DEVICE_ID'] = '4a37db5f-94f1-46f8-9e2d-269f94f26a1d';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ allow: true }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const decision = await evaluateOperationCapability(withRuntimePolicy({}), {
      id: 'benchmark',
      safety: 'dangerous',
      operationInput: {},
    });

    expect(decision).toEqual({ kind: 'allow' });
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    const payload = JSON.parse(String(request?.body));
    expect(payload).toMatchObject({
      scope: 'automation.high_risk',
      deviceId: '4a37db5f-94f1-46f8-9e2d-269f94f26a1d',
    });
  });

  it('fails open on evaluator errors when configured', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED')) as unknown as typeof fetch;

    const decision = await evaluateOperationCapability(withRuntimePolicy({ failOpen: true }), {
      id: 'benchmark',
      safety: 'dangerous',
      operationInput: {},
    });

    expect(decision).toEqual({ kind: 'allow' });
    expect(warnSpy).toHaveBeenCalled();
  });

  it('fails closed on evaluator errors when failOpen=false', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('timeout')) as unknown as typeof fetch;

    const decision = await evaluateOperationCapability(withRuntimePolicy({ failOpen: false }), {
      id: 'mcp.test',
      safety: 'dangerous',
      operationInput: { name: 'playwright' },
    });

    expect(decision).toEqual({
      kind: 'deny',
      code: 'capability_evaluator_unavailable',
      message: 'Capability evaluator unavailable and failOpen=false.',
      details: { reason: 'timeout' },
    });
  });
});

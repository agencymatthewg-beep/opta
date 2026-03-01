import { beforeEach, describe, expect, it, vi } from 'vitest';

const { executeMock, loadConfigMock } = vi.hoisted(() => ({
  executeMock: vi.fn(async () => ({ ok: true })),
  loadConfigMock: vi.fn(),
}));

vi.mock('../../src/daemon/operations/registry.js', () => ({
  getRegisteredOperation: vi.fn(() => ({
    id: 'benchmark',
    title: 'Benchmark Suite',
    description: 'Generate benchmark suite artifacts and reports.',
    safety: 'dangerous',
    inputSchema: { parse: (v: unknown) => v },
    execute: executeMock,
  })),
  listRegisteredOperations: vi.fn(() => []),
}));

vi.mock('../../src/core/config.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/core/config.js')>();
  return {
    ...actual,
    loadConfig: loadConfigMock,
  };
});

import { DEFAULT_CONFIG } from '../../src/core/config.js';
import { executeDaemonOperation } from '../../src/daemon/operations/execute.js';

beforeEach(() => {
  executeMock.mockClear();
  loadConfigMock.mockReset();
  loadConfigMock.mockResolvedValue({
    ...DEFAULT_CONFIG,
    policy: {
      ...DEFAULT_CONFIG.policy,
      runtimeEnforcement: {
        ...DEFAULT_CONFIG.policy.runtimeEnforcement,
        enabled: true,
        failOpen: false,
        endpoint: 'http://127.0.0.1:3000/api/capabilities/evaluate',
        timeoutMs: 500,
      },
    },
  });
});

describe('executeDaemonOperation capability enforcement', () => {
  it('blocks dangerous operation when evaluator denies', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ allow: false, reason: 'Denied' }),
    }) as unknown as typeof fetch;

    const result = await executeDaemonOperation({
      id: 'benchmark',
      input: {},
      confirmDangerous: true,
    });

    expect(result.statusCode).toBe(403);
    expect(result.body).toMatchObject({
      ok: false,
      id: 'benchmark',
      error: { code: 'capability_denied', message: 'Denied' },
    });
    expect(executeMock).not.toHaveBeenCalled();
  });
});

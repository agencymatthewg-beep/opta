import { describe, expect, it } from 'vitest';
import {
  OPERATION_IDS,
  OPERATION_TAXONOMY,
  OperationExecuteRequestSchema,
  OperationExecuteResponseSchema,
  OperationListResponseSchema,
  OperationSafetyClassSchema,
} from '../../src/protocol/v3/operations.js';
import { OperationIdSchema as SharedOperationIdSchema } from '../../packages/protocol-shared/src/index.js';

describe('v3 operations contract', () => {
  it('defines the canonical operation taxonomy ids', () => {
    expect(OPERATION_IDS).toEqual([
      'doctor',
      'env.list',
      'env.show',
      'env.save',
      'env.use',
      'env.delete',
      'config.get',
      'config.set',
      'config.list',
      'config.reset',
      'account.status',
      'account.logout',
      'key.create',
      'key.show',
      'key.copy',
      'version.check',
      'completions.generate',
      'daemon.start',
      'daemon.stop',
      'daemon.status',
      'daemon.logs',
      'daemon.install',
      'daemon.uninstall',
      'sessions.list',
      'sessions.search',
      'sessions.export',
      'sessions.delete',
      'diff',
      'mcp.list',
      'mcp.add',
      'mcp.add-playwright',
      'mcp.remove',
      'mcp.test',
      'embed',
      'rerank',
      'benchmark',
      'keychain.status',
      'keychain.set-anthropic',
      'keychain.set-lmx',
      'keychain.delete-anthropic',
      'keychain.delete-lmx',
    ]);
  });

  it('declares one descriptor per operation with valid safety class', () => {
    expect(OPERATION_TAXONOMY).toHaveLength(OPERATION_IDS.length);
    const seen = new Set(OPERATION_TAXONOMY.map((operation) => operation.id));
    expect([...seen].sort()).toEqual([...OPERATION_IDS].sort());
    for (const operation of OPERATION_TAXONOMY) {
      expect(() => OperationSafetyClassSchema.parse(operation.safety)).not.toThrow();
      expect(operation.title.length).toBeGreaterThan(0);
      expect(operation.description.length).toBeGreaterThan(0);
    }
  });

  it('validates typed execute requests and rejects shape mismatches', () => {
    expect(
      OperationExecuteRequestSchema.parse({
        id: 'env.list',
        input: {},
      })
    ).toMatchObject({ id: 'env.list' });

    expect(() =>
      OperationExecuteRequestSchema.parse({
        id: 'env.list',
        input: { unknown: true },
      })
    ).toThrow();

    expect(
      OperationExecuteRequestSchema.parse({
        id: 'rerank',
        input: {
          query: 'best model',
          documents: ['doc-a', 'doc-b'],
          topK: 1,
        },
      })
    ).toMatchObject({ id: 'rerank' });

    expect(() =>
      OperationExecuteRequestSchema.parse({
        id: 'rerank',
        input: {
          query: 'best model',
          documents: [],
        },
      })
    ).toThrow();

    expect(
      OperationExecuteRequestSchema.parse({
        id: 'sessions.search',
        input: {
          query: 'project alpha',
        },
      })
    ).toMatchObject({ id: 'sessions.search' });

    expect(() =>
      OperationExecuteRequestSchema.parse({
        id: 'sessions.search',
        input: {
          query: '',
        },
      })
    ).toThrow();

    expect(
      OperationExecuteRequestSchema.parse({
        id: 'diff',
        input: {},
      })
    ).toMatchObject({ id: 'diff' });

    expect(() =>
      OperationExecuteRequestSchema.parse({
        id: 'diff',
        input: { unknown: true },
      })
    ).toThrow();

    expect(
      OperationExecuteRequestSchema.parse({
        id: 'config.get',
        input: { key: 'connection.host' },
      })
    ).toMatchObject({ id: 'config.get' });

    expect(
      OperationExecuteRequestSchema.parse({
        id: 'config.set',
        input: { key: 'connection.port', value: 9999 },
      })
    ).toMatchObject({ id: 'config.set' });

    expect(
      OperationExecuteRequestSchema.parse({
        id: 'config.reset',
        input: { key: 'connection.port' },
      })
    ).toMatchObject({ id: 'config.reset' });

    expect(
      OperationExecuteRequestSchema.parse({
        id: 'completions.generate',
        input: { shell: 'zsh', install: true },
      })
    ).toMatchObject({ id: 'completions.generate' });
  });

  it('validates typed execute/list responses', () => {
    expect(
      OperationExecuteResponseSchema.parse({
        ok: true,
        id: 'doctor',
        safety: 'read',
        result: { checks: [] },
      })
    ).toMatchObject({ ok: true, id: 'doctor' });

    expect(
      OperationExecuteResponseSchema.parse({
        ok: false,
        id: 'benchmark',
        safety: 'dangerous',
        error: {
          code: 'dangerous_confirmation_required',
          message: 'confirmDangerous=true required',
        },
      })
    ).toMatchObject({ ok: false, id: 'benchmark' });

    expect(
      OperationListResponseSchema.parse({
        operations: OPERATION_TAXONOMY,
      })
    ).toMatchObject({ operations: OPERATION_TAXONOMY });
  });

  it('is exported through @opta/protocol-shared', () => {
    expect(() => SharedOperationIdSchema.parse('doctor')).not.toThrow();
    expect(() => SharedOperationIdSchema.parse('not-real')).toThrow();
  });
});

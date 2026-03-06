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
      'account.signup',
      'account.login',
      'account.keys.list',
      'account.keys.push',
      'account.keys.delete',
      'account.logout',
      'vault.pull',
      'vault.pull-keys',
      'vault.pull-rules',
      'vault.push-rules',
      'vault.status',
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
      'onboard.apply',
      'serve.status',
      'serve.start',
      'serve.stop',
      'serve.restart',
      'serve.logs',
      'browser.runtime',
      'browser.host',
      'init.run',
      'update.run',
      'apps.list',
      'apps.install',
      'apps.uninstall',
      'sessions.list',
      'sessions.get',
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
      'ceo.benchmark',
      'models.history',
      'models.aliases.list',
      'models.aliases.set',
      'models.aliases.delete',
      'models.dashboard',
      'models.predictor',
      'models.helpers',
      'models.quantize',
      'models.agents',
      'models.skills',
      'models.rag',
      'models.health',
      'models.scan',
      'models.browse.local',
      'models.browse.library',
      'keychain.status',
      'keychain.set-anthropic',
      'keychain.set-lmx',
      'keychain.set-gemini',
      'keychain.set-openai',
      'keychain.set-opencode-zen',
      'keychain.delete-anthropic',
      'keychain.delete-lmx',
      'keychain.delete-gemini',
      'keychain.delete-openai',
      'keychain.delete-opencode-zen',
      'audio.transcribe',
      'audio.tts',
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
        id: 'account.keys.push',
        input: {
          provider: 'anthropic',
          key: 'test-key',
          label: 'default',
        },
      })
    ).toMatchObject({ id: 'account.keys.push' });

    expect(() =>
      OperationExecuteRequestSchema.parse({
        id: 'account.keys.push',
        input: {
          provider: 'anthropic',
          key: '',
        },
      })
    ).toThrow();

    expect(
      OperationExecuteRequestSchema.parse({
        id: 'serve.logs',
        input: {},
      })
    ).toMatchObject({ id: 'serve.logs' });

    expect(() =>
      OperationExecuteRequestSchema.parse({
        id: 'serve.logs',
        input: { tail: 20 },
      })
    ).toThrow();

    expect(
      OperationExecuteRequestSchema.parse({
        id: 'browser.host',
        input: {
          action: 'start',
          portRangeStart: 46000,
          portRangeEnd: 47000,
          requiredPortCount: 6,
          maxSessionSlots: 5,
          includePeekabooScreen: true,
        },
      })
    ).toMatchObject({ id: 'browser.host' });

    expect(
      OperationExecuteRequestSchema.parse({
        id: 'browser.host',
        input: {
          action: 'start',
          portRangeStart: '46000',
          portRangeEnd: '47000',
        },
      })
    ).toMatchObject({ id: 'browser.host' });

    expect(() =>
      OperationExecuteRequestSchema.parse({
        id: 'browser.host',
        input: {
          action: 'invalid',
        },
      })
    ).toThrow();

    expect(() =>
      OperationExecuteRequestSchema.parse({
        id: 'browser.host',
        input: {
          action: 'start',
          portRangeStart: 'abc',
        },
      })
    ).toThrow();

    expect(
      OperationExecuteRequestSchema.parse({
        id: 'init.run',
        input: { yes: true, force: false },
      })
    ).toMatchObject({ id: 'init.run' });

    expect(
      OperationExecuteRequestSchema.parse({
        id: 'update.run',
        input: {
          target: 'local',
          dryRun: true,
        },
      })
    ).toMatchObject({ id: 'update.run' });

    expect(() =>
      OperationExecuteRequestSchema.parse({
        id: 'update.run',
        input: {
          target: 'invalid-target',
        },
      })
    ).toThrow();

    expect(
      OperationExecuteRequestSchema.parse({
        id: 'apps.list',
        input: {},
      })
    ).toMatchObject({ id: 'apps.list' });

    expect(
      OperationExecuteRequestSchema.parse({
        id: 'apps.install',
        input: { appIds: ['opta-cli'] },
      })
    ).toMatchObject({ id: 'apps.install' });

    expect(() =>
      OperationExecuteRequestSchema.parse({
        id: 'apps.install',
        input: { appIds: [] },
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

    expect(
      OperationExecuteRequestSchema.parse({
        id: 'ceo.benchmark',
        input: { filter: 'failing-test' },
      })
    ).toMatchObject({ id: 'ceo.benchmark' });

    expect(
      OperationExecuteRequestSchema.parse({
        id: 'models.aliases.set',
        input: { alias: 'mini', model: 'demo/model' },
      })
    ).toMatchObject({ id: 'models.aliases.set' });

    expect(() =>
      OperationExecuteRequestSchema.parse({
        id: 'models.aliases.set',
        input: { alias: 'mini' },
      })
    ).toThrow();

    expect(
      OperationExecuteRequestSchema.parse({
        id: 'models.scan',
        input: { full: true },
      })
    ).toMatchObject({ id: 'models.scan' });

    expect(
      OperationExecuteRequestSchema.parse({
        id: 'models.quantize',
        input: { args: 'list' },
      })
    ).toMatchObject({ id: 'models.quantize' });

    expect(
      OperationExecuteRequestSchema.parse({
        id: 'models.browse.library',
        input: { query: 'qwen', limit: 25 },
      })
    ).toMatchObject({ id: 'models.browse.library' });
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

import { describe, expect, it } from 'vitest';
import {
  applyBridgeIdentityToMutation,
  applyOperationScope,
  resolveBridgeScopeSeed,
} from '../../src/daemon/bridge-worker.js';
import { deriveBridgeAgentId } from '../../src/utils/bridge-scope.js';

describe('bridge worker scope identity', () => {
  it('injects deterministic identity headers and body.user for inference routes', () => {
    const mutation = applyBridgeIdentityToMutation(
      {
        method: 'POST',
        path: '/v1/chat/completions',
        body: { model: 'test-model', messages: [] },
      },
      'telegram:dm:peer-123'
    );

    const expected = deriveBridgeAgentId('telegram:dm:peer-123');
    expect(mutation.headers?.['X-Client-ID']).toBe(expected);
    expect(mutation.headers?.['X-Opta-Bridge-ID']).toBe(expected);
    expect((mutation.body as Record<string, unknown>)['user']).toBe(expected);
  });

  it('does not override explicit caller identity or user', () => {
    const mutation = applyBridgeIdentityToMutation(
      {
        method: 'POST',
        path: '/v1/responses',
        headers: {
          'X-Client-ID': 'caller-provided',
        },
        body: { input: 'hello', user: 'explicit-user' },
      },
      'telegram:dm:peer-123'
    );

    expect(mutation.headers?.['X-Client-ID']).toBe('caller-provided');
    expect(mutation.headers?.['X-Opta-Bridge-ID']).toBeUndefined();
    expect((mutation.body as Record<string, unknown>)['user']).toBe('explicit-user');
  });

  it('leaves unrelated endpoints untouched', () => {
    const mutation = applyBridgeIdentityToMutation(
      {
        method: 'POST',
        path: '/admin/models/load',
        body: { model_id: 'foo' },
      },
      'telegram:dm:peer-123'
    );

    expect(mutation.headers).toBeUndefined();
    expect((mutation.body as Record<string, unknown>)['user']).toBeUndefined();
  });

  it('applies scope fallback for models.skills operations', () => {
    const input = applyOperationScope(
      {
        id: 'cmd-1',
        command: 'models.skills',
        payload: { args: 'openclaw planner' },
      },
      'telegram:dm:peer-555'
    ) as Record<string, unknown>;

    expect(input['scope']).toBe('telegram:dm:peer-555');
    expect(input['args']).toBe('openclaw planner');
  });

  it('does not override explicit models.skills scope', () => {
    const input = applyOperationScope(
      {
        id: 'cmd-2',
        command: 'models.skills',
        payload: { args: 'openclaw planner', scope: 'telegram:dm:peer-explicit' },
      },
      'telegram:dm:peer-fallback'
    ) as Record<string, unknown>;

    expect(input['scope']).toBe('telegram:dm:peer-explicit');
  });

  it('uses scope -> actor -> bridgeSessionId fallback order', () => {
    expect(
      resolveBridgeScopeSeed({
        scope: 'telegram:dm:peer-scope',
        actor: 'telegram:dm:peer-actor',
        bridgeSessionId: 'bridge-session',
      })
    ).toBe('telegram:dm:peer-scope');

    expect(
      resolveBridgeScopeSeed({
        scope: '   ',
        actor: 'telegram:dm:peer-actor',
        bridgeSessionId: 'bridge-session',
      })
    ).toBe('telegram:dm:peer-actor');

    expect(
      resolveBridgeScopeSeed({
        scope: null,
        actor: null,
        bridgeSessionId: 'bridge-session',
      })
    ).toBe('bridge-session');
  });
});

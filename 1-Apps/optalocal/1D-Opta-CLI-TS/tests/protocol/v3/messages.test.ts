import { describe, expect, it } from 'vitest';
import {
  V3_VERSION,
  SessionModeSchema,
  V3EventSchema,
  ClientSubmitTurnSchema,
  PermissionDecisionSchema,
  CreateSessionRequestSchema,
  TurnErrorCodeSchema,
  BackgroundStreamSchema,
  BackgroundProcessStateSchema,
  BackgroundSignalSchema,
} from '../../../src/protocol/v3/types.js';
import { makeEnvelope } from '../../../src/protocol/v3/events.js';
import {
  SessionParamsSchema,
  PermissionParamsSchema,
  EventsQuerySchema,
  BackgroundListQuerySchema,
  BackgroundStartHttpSchema,
  BackgroundProcessParamsSchema,
  BackgroundStatusQuerySchema,
  BackgroundOutputQuerySchema,
  BackgroundKillHttpSchema,
} from '../../../src/protocol/v3/http.js';
import {
  WsHelloSchema,
  WsTurnSubmitSchema,
  WsPermissionResolveSchema,
  WsCancelSchema,
  WsInboundSchema,
} from '../../../src/protocol/v3/ws.js';

// ---------------------------------------------------------------------------
// types.ts — Zod schema validation
// ---------------------------------------------------------------------------

describe('V3_VERSION', () => {
  it('is the string "3"', () => {
    expect(V3_VERSION).toBe('3');
  });
});

describe('SessionModeSchema', () => {
  it('accepts "chat"', () => {
    expect(SessionModeSchema.parse('chat')).toBe('chat');
  });

  it('accepts "do"', () => {
    expect(SessionModeSchema.parse('do')).toBe('do');
  });

  it('rejects invalid modes', () => {
    expect(() => SessionModeSchema.parse('shell')).toThrow();
    expect(() => SessionModeSchema.parse('')).toThrow();
    expect(() => SessionModeSchema.parse(42)).toThrow();
  });
});

describe('V3EventSchema', () => {
  const ALL_EVENTS = [
    'session.snapshot',
    'turn.queued',
    'turn.start',
    'turn.token',
    'turn.thinking',
    'tool.start',
    'tool.end',
    'permission.request',
    'permission.resolved',
    'turn.progress',
    'turn.done',
    'turn.error',
    'session.updated',
    'session.cancelled',
    'background.output',
    'background.status',
  ];

  it.each(ALL_EVENTS)('accepts event "%s"', (event) => {
    expect(V3EventSchema.parse(event)).toBe(event);
  });

  it('rejects unknown events', () => {
    expect(() => V3EventSchema.parse('unknown.event')).toThrow();
    expect(() => V3EventSchema.parse('')).toThrow();
  });
});

describe('ClientSubmitTurnSchema', () => {
  const valid = {
    clientId: 'client-1',
    writerId: 'writer-1',
    content: 'Hello',
    mode: 'chat' as const,
  };

  it('parses a valid submit turn', () => {
    const result = ClientSubmitTurnSchema.parse(valid);
    expect(result.clientId).toBe('client-1');
    expect(result.writerId).toBe('writer-1');
    expect(result.content).toBe('Hello');
    expect(result.mode).toBe('chat');
    expect(result.metadata).toBeUndefined();
  });

  it('accepts optional metadata', () => {
    const result = ClientSubmitTurnSchema.parse({ ...valid, metadata: { key: 'value' } });
    expect(result.metadata).toEqual({ key: 'value' });
  });

  it('rejects empty clientId', () => {
    expect(() => ClientSubmitTurnSchema.parse({ ...valid, clientId: '' })).toThrow();
  });

  it('rejects empty writerId', () => {
    expect(() => ClientSubmitTurnSchema.parse({ ...valid, writerId: '' })).toThrow();
  });

  it('rejects empty content', () => {
    expect(() => ClientSubmitTurnSchema.parse({ ...valid, content: '' })).toThrow();
  });

  it('rejects invalid mode', () => {
    expect(() => ClientSubmitTurnSchema.parse({ ...valid, mode: 'exec' })).toThrow();
  });

  it('rejects missing required fields', () => {
    expect(() => ClientSubmitTurnSchema.parse({})).toThrow();
    expect(() => ClientSubmitTurnSchema.parse({ clientId: 'c' })).toThrow();
  });
});

describe('PermissionDecisionSchema', () => {
  it('parses allow decision', () => {
    const result = PermissionDecisionSchema.parse({
      requestId: 'req-1',
      decision: 'allow',
      decidedBy: 'user-1',
    });
    expect(result.decision).toBe('allow');
  });

  it('parses deny decision', () => {
    const result = PermissionDecisionSchema.parse({
      requestId: 'req-2',
      decision: 'deny',
      decidedBy: 'user-2',
    });
    expect(result.decision).toBe('deny');
  });

  it('rejects invalid decision value', () => {
    expect(() =>
      PermissionDecisionSchema.parse({
        requestId: 'req-3',
        decision: 'maybe',
        decidedBy: 'user-3',
      }),
    ).toThrow();
  });

  it('rejects empty requestId', () => {
    expect(() =>
      PermissionDecisionSchema.parse({
        requestId: '',
        decision: 'allow',
        decidedBy: 'user-1',
      }),
    ).toThrow();
  });

  it('rejects empty decidedBy', () => {
    expect(() =>
      PermissionDecisionSchema.parse({
        requestId: 'req-1',
        decision: 'allow',
        decidedBy: '',
      }),
    ).toThrow();
  });
});

describe('CreateSessionRequestSchema', () => {
  it('parses empty object (all optional)', () => {
    const result = CreateSessionRequestSchema.parse({});
    expect(result.sessionId).toBeUndefined();
    expect(result.model).toBeUndefined();
    expect(result.title).toBeUndefined();
    expect(result.messages).toBeUndefined();
    expect(result.metadata).toBeUndefined();
  });

  it('parses full object', () => {
    const result = CreateSessionRequestSchema.parse({
      sessionId: 'ses-1',
      model: 'llama-3',
      title: 'My Session',
      messages: [{ role: 'user', content: 'hi' }],
      metadata: { source: 'test' },
    });
    expect(result.sessionId).toBe('ses-1');
    expect(result.model).toBe('llama-3');
    expect(result.title).toBe('My Session');
    expect(result.messages).toHaveLength(1);
    expect(result.metadata).toEqual({ source: 'test' });
  });

  it('rejects non-object', () => {
    expect(() => CreateSessionRequestSchema.parse('not-an-object')).toThrow();
    expect(() => CreateSessionRequestSchema.parse(null)).toThrow();
  });
});

describe('TurnErrorCodeSchema', () => {
  const VALID_CODES = [
    'no-model-loaded',
    'lmx-ws-closed',
    'lmx-timeout',
    'lmx-connection-refused',
    'storage-full',
  ];

  it.each(VALID_CODES)('accepts "%s"', (code) => {
    expect(TurnErrorCodeSchema.parse(code)).toBe(code);
  });

  it('rejects unknown codes', () => {
    expect(() => TurnErrorCodeSchema.parse('network-error')).toThrow();
  });
});

describe('BackgroundStreamSchema', () => {
  it('accepts stdout', () => {
    expect(BackgroundStreamSchema.parse('stdout')).toBe('stdout');
  });

  it('accepts stderr', () => {
    expect(BackgroundStreamSchema.parse('stderr')).toBe('stderr');
  });

  it('rejects invalid streams', () => {
    expect(() => BackgroundStreamSchema.parse('stdin')).toThrow();
  });
});

describe('BackgroundProcessStateSchema', () => {
  const VALID_STATES = ['running', 'completed', 'failed', 'killed', 'timeout'];

  it.each(VALID_STATES)('accepts "%s"', (state) => {
    expect(BackgroundProcessStateSchema.parse(state)).toBe(state);
  });

  it('rejects invalid states', () => {
    expect(() => BackgroundProcessStateSchema.parse('paused')).toThrow();
  });
});

describe('BackgroundSignalSchema', () => {
  const VALID_SIGNALS = ['SIGTERM', 'SIGKILL', 'SIGINT'];

  it.each(VALID_SIGNALS)('accepts "%s"', (signal) => {
    expect(BackgroundSignalSchema.parse(signal)).toBe(signal);
  });

  it('rejects invalid signals', () => {
    expect(() => BackgroundSignalSchema.parse('SIGHUP')).toThrow();
  });
});

// ---------------------------------------------------------------------------
// events.ts — makeEnvelope
// ---------------------------------------------------------------------------

describe('makeEnvelope', () => {
  it('builds a valid V3 envelope with all fields', () => {
    const envelope = makeEnvelope(
      { daemonId: 'd-1', sessionId: 's-1', seq: 5, ts: '2026-01-01T00:00:00.000Z' },
      'turn.token',
      { text: 'hello' },
    );

    expect(envelope.v).toBe('3');
    expect(envelope.event).toBe('turn.token');
    expect(envelope.daemonId).toBe('d-1');
    expect(envelope.sessionId).toBe('s-1');
    expect(envelope.seq).toBe(5);
    expect(envelope.ts).toBe('2026-01-01T00:00:00.000Z');
    expect(envelope.payload).toEqual({ text: 'hello' });
  });

  it('defaults ts to current ISO string when omitted', () => {
    const before = new Date().toISOString();
    const envelope = makeEnvelope(
      { daemonId: 'd-2', seq: 1 },
      'session.snapshot',
      {},
    );
    const after = new Date().toISOString();

    expect(envelope.ts >= before).toBe(true);
    expect(envelope.ts <= after).toBe(true);
    expect(envelope.sessionId).toBeUndefined();
  });

  it('preserves complex payloads', () => {
    const payload = { nested: { array: [1, 2, 3], deep: { flag: true } } };
    const envelope = makeEnvelope(
      { daemonId: 'd-3', sessionId: 's-3', seq: 10 },
      'tool.end',
      payload,
    );
    expect(envelope.payload).toEqual(payload);
  });

  it('handles null payload', () => {
    const envelope = makeEnvelope(
      { daemonId: 'd-4', seq: 0 },
      'turn.done',
      null,
    );
    expect(envelope.payload).toBeNull();
  });

  it('handles seq = 0', () => {
    const envelope = makeEnvelope(
      { daemonId: 'd-5', seq: 0 },
      'turn.error',
      { message: 'fail' },
    );
    expect(envelope.seq).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// http.ts — HTTP schema validation
// ---------------------------------------------------------------------------

describe('SessionParamsSchema', () => {
  it('parses valid session params', () => {
    expect(SessionParamsSchema.parse({ sessionId: 'abc' })).toEqual({ sessionId: 'abc' });
  });

  it('rejects empty sessionId', () => {
    expect(() => SessionParamsSchema.parse({ sessionId: '' })).toThrow();
  });

  it('rejects missing sessionId', () => {
    expect(() => SessionParamsSchema.parse({})).toThrow();
  });
});

describe('PermissionParamsSchema', () => {
  it('parses valid params', () => {
    const result = PermissionParamsSchema.parse({ sessionId: 's1', requestId: 'r1' });
    expect(result.sessionId).toBe('s1');
    expect(result.requestId).toBe('r1');
  });

  it('rejects empty sessionId', () => {
    expect(() => PermissionParamsSchema.parse({ sessionId: '', requestId: 'r1' })).toThrow();
  });

  it('rejects empty requestId', () => {
    expect(() => PermissionParamsSchema.parse({ sessionId: 's1', requestId: '' })).toThrow();
  });
});

describe('EventsQuerySchema', () => {
  it('defaults afterSeq to 0', () => {
    const result = EventsQuerySchema.parse({});
    expect(result.afterSeq).toBe(0);
  });

  it('coerces string to number', () => {
    const result = EventsQuerySchema.parse({ afterSeq: '10' });
    expect(result.afterSeq).toBe(10);
  });

  it('rejects negative afterSeq', () => {
    expect(() => EventsQuerySchema.parse({ afterSeq: -1 })).toThrow();
  });

  it('rejects non-integer afterSeq', () => {
    expect(() => EventsQuerySchema.parse({ afterSeq: 1.5 })).toThrow();
  });
});

describe('BackgroundListQuerySchema', () => {
  it('parses empty (all optional)', () => {
    const result = BackgroundListQuerySchema.parse({});
    expect(result.sessionId).toBeUndefined();
  });

  it('parses sessionId', () => {
    const result = BackgroundListQuerySchema.parse({ sessionId: 'sess-1' });
    expect(result.sessionId).toBe('sess-1');
  });

  it('rejects empty sessionId', () => {
    expect(() => BackgroundListQuerySchema.parse({ sessionId: '' })).toThrow();
  });
});

describe('BackgroundStartHttpSchema', () => {
  const valid = { sessionId: 'sess-1', command: 'echo hello' };

  it('parses minimal valid start request', () => {
    const result = BackgroundStartHttpSchema.parse(valid);
    expect(result.sessionId).toBe('sess-1');
    expect(result.command).toBe('echo hello');
    expect(result.label).toBeUndefined();
    expect(result.cwd).toBeUndefined();
    expect(result.timeoutMs).toBeUndefined();
  });

  it('parses with all optional fields', () => {
    const result = BackgroundStartHttpSchema.parse({
      ...valid,
      label: 'my-task',
      cwd: '/tmp',
      timeoutMs: 5000,
    });
    expect(result.label).toBe('my-task');
    expect(result.cwd).toBe('/tmp');
    expect(result.timeoutMs).toBe(5000);
  });

  it('rejects empty command', () => {
    expect(() => BackgroundStartHttpSchema.parse({ sessionId: 'sess-1', command: '' })).toThrow();
  });

  it('rejects timeoutMs above 86400000', () => {
    expect(() =>
      BackgroundStartHttpSchema.parse({ ...valid, timeoutMs: 86_400_001 }),
    ).toThrow();
  });

  it('rejects negative timeoutMs', () => {
    expect(() => BackgroundStartHttpSchema.parse({ ...valid, timeoutMs: -1 })).toThrow();
  });

  it('coerces timeoutMs from string', () => {
    const result = BackgroundStartHttpSchema.parse({ ...valid, timeoutMs: '3000' });
    expect(result.timeoutMs).toBe(3000);
  });
});

describe('BackgroundProcessParamsSchema', () => {
  it('parses valid processId', () => {
    const result = BackgroundProcessParamsSchema.parse({ processId: 'p-1' });
    expect(result.processId).toBe('p-1');
  });

  it('rejects empty processId', () => {
    expect(() => BackgroundProcessParamsSchema.parse({ processId: '' })).toThrow();
  });
});

describe('BackgroundStatusQuerySchema', () => {
  it('parses empty (optional sessionId)', () => {
    const result = BackgroundStatusQuerySchema.parse({});
    expect(result.sessionId).toBeUndefined();
  });

  it('parses with sessionId', () => {
    const result = BackgroundStatusQuerySchema.parse({ sessionId: 'sess-1' });
    expect(result.sessionId).toBe('sess-1');
  });
});

describe('BackgroundOutputQuerySchema', () => {
  it('applies defaults', () => {
    const result = BackgroundOutputQuerySchema.parse({});
    expect(result.afterSeq).toBe(0);
    expect(result.limit).toBe(200);
    expect(result.stream).toBe('both');
  });

  it('coerces string values', () => {
    const result = BackgroundOutputQuerySchema.parse({ afterSeq: '5', limit: '50' });
    expect(result.afterSeq).toBe(5);
    expect(result.limit).toBe(50);
  });

  it('accepts stream filter', () => {
    expect(BackgroundOutputQuerySchema.parse({ stream: 'stdout' }).stream).toBe('stdout');
    expect(BackgroundOutputQuerySchema.parse({ stream: 'stderr' }).stream).toBe('stderr');
    expect(BackgroundOutputQuerySchema.parse({ stream: 'both' }).stream).toBe('both');
  });

  it('rejects invalid stream', () => {
    expect(() => BackgroundOutputQuerySchema.parse({ stream: 'stdin' })).toThrow();
  });

  it('rejects limit above 500', () => {
    expect(() => BackgroundOutputQuerySchema.parse({ limit: 501 })).toThrow();
  });

  it('rejects limit below 1', () => {
    expect(() => BackgroundOutputQuerySchema.parse({ limit: 0 })).toThrow();
  });
});

describe('BackgroundKillHttpSchema', () => {
  it('parses empty (optional signal)', () => {
    const result = BackgroundKillHttpSchema.parse({});
    expect(result.signal).toBeUndefined();
  });

  it('accepts SIGTERM', () => {
    const result = BackgroundKillHttpSchema.parse({ signal: 'SIGTERM' });
    expect(result.signal).toBe('SIGTERM');
  });

  it('accepts SIGKILL', () => {
    const result = BackgroundKillHttpSchema.parse({ signal: 'SIGKILL' });
    expect(result.signal).toBe('SIGKILL');
  });

  it('rejects invalid signal', () => {
    expect(() => BackgroundKillHttpSchema.parse({ signal: 'SIGHUP' })).toThrow();
  });
});

// ---------------------------------------------------------------------------
// ws.ts — WebSocket message validation
// ---------------------------------------------------------------------------

describe('WsHelloSchema', () => {
  it('parses valid hello', () => {
    const result = WsHelloSchema.parse({
      type: 'hello',
      clientId: 'c1',
      sessionId: 's1',
    });
    expect(result.type).toBe('hello');
    expect(result.afterSeq).toBeUndefined();
  });

  it('accepts optional afterSeq', () => {
    const result = WsHelloSchema.parse({
      type: 'hello',
      clientId: 'c1',
      sessionId: 's1',
      afterSeq: 5,
    });
    expect(result.afterSeq).toBe(5);
  });

  it('rejects wrong type literal', () => {
    expect(() =>
      WsHelloSchema.parse({ type: 'hi', clientId: 'c1', sessionId: 's1' }),
    ).toThrow();
  });

  it('rejects empty clientId', () => {
    expect(() =>
      WsHelloSchema.parse({ type: 'hello', clientId: '', sessionId: 's1' }),
    ).toThrow();
  });

  it('rejects negative afterSeq', () => {
    expect(() =>
      WsHelloSchema.parse({
        type: 'hello',
        clientId: 'c1',
        sessionId: 's1',
        afterSeq: -1,
      }),
    ).toThrow();
  });
});

describe('WsTurnSubmitSchema', () => {
  const valid = {
    type: 'turn.submit' as const,
    clientId: 'c1',
    writerId: 'w1',
    sessionId: 's1',
    content: 'Hello',
  };

  it('parses valid turn submit with default mode', () => {
    const result = WsTurnSubmitSchema.parse(valid);
    expect(result.type).toBe('turn.submit');
    expect(result.mode).toBe('chat');
    expect(result.metadata).toBeUndefined();
  });

  it('accepts explicit do mode', () => {
    const result = WsTurnSubmitSchema.parse({ ...valid, mode: 'do' });
    expect(result.mode).toBe('do');
  });

  it('accepts metadata', () => {
    const result = WsTurnSubmitSchema.parse({ ...valid, metadata: { tag: 'test' } });
    expect(result.metadata).toEqual({ tag: 'test' });
  });

  it('rejects empty content', () => {
    expect(() => WsTurnSubmitSchema.parse({ ...valid, content: '' })).toThrow();
  });

  it('rejects invalid mode', () => {
    expect(() => WsTurnSubmitSchema.parse({ ...valid, mode: 'exec' })).toThrow();
  });
});

describe('WsPermissionResolveSchema', () => {
  it('parses allow', () => {
    const result = WsPermissionResolveSchema.parse({
      type: 'permission.resolve',
      sessionId: 's1',
      requestId: 'r1',
      decision: 'allow',
      decidedBy: 'user-1',
    });
    expect(result.decision).toBe('allow');
  });

  it('parses deny', () => {
    const result = WsPermissionResolveSchema.parse({
      type: 'permission.resolve',
      sessionId: 's1',
      requestId: 'r1',
      decision: 'deny',
      decidedBy: 'user-1',
    });
    expect(result.decision).toBe('deny');
  });

  it('rejects invalid decision', () => {
    expect(() =>
      WsPermissionResolveSchema.parse({
        type: 'permission.resolve',
        sessionId: 's1',
        requestId: 'r1',
        decision: 'skip',
        decidedBy: 'user-1',
      }),
    ).toThrow();
  });
});

describe('WsCancelSchema', () => {
  it('parses minimal cancel', () => {
    const result = WsCancelSchema.parse({
      type: 'turn.cancel',
      sessionId: 's1',
    });
    expect(result.type).toBe('turn.cancel');
    expect(result.turnId).toBeUndefined();
    expect(result.writerId).toBeUndefined();
  });

  it('accepts optional turnId and writerId', () => {
    const result = WsCancelSchema.parse({
      type: 'turn.cancel',
      sessionId: 's1',
      turnId: 't1',
      writerId: 'w1',
    });
    expect(result.turnId).toBe('t1');
    expect(result.writerId).toBe('w1');
  });
});

describe('WsInboundSchema (discriminated union)', () => {
  it('routes hello messages', () => {
    const result = WsInboundSchema.parse({
      type: 'hello',
      clientId: 'c1',
      sessionId: 's1',
    });
    expect(result.type).toBe('hello');
  });

  it('routes turn.submit messages', () => {
    const result = WsInboundSchema.parse({
      type: 'turn.submit',
      clientId: 'c1',
      writerId: 'w1',
      sessionId: 's1',
      content: 'hi',
    });
    expect(result.type).toBe('turn.submit');
  });

  it('routes permission.resolve messages', () => {
    const result = WsInboundSchema.parse({
      type: 'permission.resolve',
      sessionId: 's1',
      requestId: 'r1',
      decision: 'allow',
      decidedBy: 'user-1',
    });
    expect(result.type).toBe('permission.resolve');
  });

  it('routes turn.cancel messages', () => {
    const result = WsInboundSchema.parse({
      type: 'turn.cancel',
      sessionId: 's1',
    });
    expect(result.type).toBe('turn.cancel');
  });

  it('rejects unknown type', () => {
    expect(() => WsInboundSchema.parse({ type: 'unknown' })).toThrow();
  });

  it('rejects missing type', () => {
    expect(() => WsInboundSchema.parse({ clientId: 'c1' })).toThrow();
  });

  it('rejects non-object', () => {
    expect(() => WsInboundSchema.parse('hello')).toThrow();
    expect(() => WsInboundSchema.parse(42)).toThrow();
    expect(() => WsInboundSchema.parse(null)).toThrow();
  });
});

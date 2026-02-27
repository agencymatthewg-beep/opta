import type { V3Envelope, V3Event } from './types.js';
import { V3_VERSION } from './types.js';

export function makeEnvelope<T extends V3Event, P>(
  base: { daemonId: string; sessionId?: string; seq: number; ts?: string },
  event: T,
  payload: P
): V3Envelope<T, P> {
  return {
    v: V3_VERSION,
    event,
    daemonId: base.daemonId,
    sessionId: base.sessionId,
    seq: base.seq,
    ts: base.ts ?? new Date().toISOString(),
    payload,
  };
}

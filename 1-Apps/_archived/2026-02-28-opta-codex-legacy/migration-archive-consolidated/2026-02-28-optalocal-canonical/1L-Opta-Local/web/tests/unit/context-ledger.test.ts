import { describe, expect, it } from 'vitest';

import { ContextLedger } from '@/lib/context/context-ledger';
import { buildContextSnapshot } from '@/lib/context/context-snapshot';

describe('ContextLedger', () => {
  it('creates deterministic append-only timeline entries', () => {
    const ledger = new ContextLedger();

    const first = ledger.append('goal', 'Ship parity coverage', 1000);
    const second = ledger.append('constraint', 'No unrelated settings changes', 2000);

    expect(first.id).toBe('ctx-000001');
    expect(second.id).toBe('ctx-000002');
    expect(ledger.timeline()).toHaveLength(2);
  });

  it('builds snapshots for goal/constraints/assumptions/facts/risks', () => {
    const ledger = new ContextLedger();
    ledger.append('goal', 'Reach full parity', 1000);
    ledger.append('constraint', 'Minimize UI noise', 1100);
    ledger.append('assumption', 'LMX endpoint contracts are stable', 1200);
    ledger.append('fact', 'Responses endpoint passed integration test', 1300);
    ledger.append('risk', 'Event streams may stall', 1400);

    const snapshot = buildContextSnapshot(ledger, 1500);
    expect(snapshot.state.goal).toBe('Reach full parity');
    expect(snapshot.state.constraints).toEqual(['Minimize UI noise']);
    expect(snapshot.state.activeAssumptions).toEqual([
      'LMX endpoint contracts are stable',
    ]);
    expect(snapshot.state.lastVerifiedFacts).toEqual([
      'Responses endpoint passed integration test',
    ]);
    expect(snapshot.state.openRisks).toEqual(['Event streams may stall']);
  });

  it('prunes old entries and records audit trail', () => {
    const ledger = new ContextLedger();
    ledger.append('goal', 'Goal A', 1000);
    ledger.append('constraint', 'Constraint B', 2000);
    ledger.append('risk', 'Risk C', 3000);

    const audit = ledger.prune(2500, 'remove stale context', 4000);
    expect(audit.removedCount).toBe(2);
    expect(audit.reason).toBe('remove stale context');
    expect(audit.removedIds).toEqual(['ctx-000001', 'ctx-000002']);
    expect(ledger.timeline()).toHaveLength(1);
    expect(ledger.auditTrail()).toHaveLength(1);
  });
});


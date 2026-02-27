export type ContextEntryKind =
  | 'goal'
  | 'constraint'
  | 'assumption'
  | 'fact'
  | 'risk'
  | 'note';

export interface ContextLedgerEntry {
  id: string;
  seq: number;
  kind: ContextEntryKind;
  value: string;
  at: number;
}

export interface ContextLedgerAudit {
  at: number;
  reason: string;
  removedCount: number;
  removedIds: string[];
}

export interface ContextLedgerState {
  goal: string | null;
  constraints: string[];
  activeAssumptions: string[];
  lastVerifiedFacts: string[];
  openRisks: string[];
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

export class ContextLedger {
  private entries: ContextLedgerEntry[] = [];
  private audits: ContextLedgerAudit[] = [];
  private nextSeq = 1;

  append(kind: ContextEntryKind, value: string, at = Date.now()): ContextLedgerEntry {
    const seq = this.nextSeq++;
    const entry: ContextLedgerEntry = {
      id: `ctx-${String(seq).padStart(6, '0')}`,
      seq,
      kind,
      value,
      at,
    };
    this.entries.push(entry);
    return entry;
  }

  timeline(): ContextLedgerEntry[] {
    return [...this.entries];
  }

  auditTrail(): ContextLedgerAudit[] {
    return [...this.audits];
  }

  snapshot(at?: number): ContextLedgerState {
    const upperBound = at ?? Number.POSITIVE_INFINITY;
    const selected = this.entries.filter((entry) => entry.at <= upperBound);

    const goals = selected.filter((entry) => entry.kind === 'goal');
    const constraints = selected
      .filter((entry) => entry.kind === 'constraint')
      .map((entry) => entry.value);
    const assumptions = selected
      .filter((entry) => entry.kind === 'assumption')
      .map((entry) => entry.value);
    const facts = selected
      .filter((entry) => entry.kind === 'fact')
      .map((entry) => entry.value);
    const risks = selected
      .filter((entry) => entry.kind === 'risk')
      .map((entry) => entry.value);

    return {
      goal: goals.length > 0 ? goals[goals.length - 1]?.value ?? null : null,
      constraints: unique(constraints),
      activeAssumptions: unique(assumptions),
      lastVerifiedFacts: unique(facts),
      openRisks: unique(risks),
    };
  }

  prune(keepFromTimestamp: number, reason: string, at = Date.now()): ContextLedgerAudit {
    const toRemove = this.entries.filter((entry) => entry.at < keepFromTimestamp);
    this.entries = this.entries.filter((entry) => entry.at >= keepFromTimestamp);
    const audit: ContextLedgerAudit = {
      at,
      reason,
      removedCount: toRemove.length,
      removedIds: toRemove.map((entry) => entry.id),
    };
    this.audits.push(audit);
    return audit;
  }
}


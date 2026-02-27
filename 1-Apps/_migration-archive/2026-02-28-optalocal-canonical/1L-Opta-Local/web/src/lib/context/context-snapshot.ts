import type { ContextLedgerState } from '@/lib/context/context-ledger';
import { ContextLedger } from '@/lib/context/context-ledger';

export interface ContextSnapshot {
  capturedAt: number;
  entryCount: number;
  state: ContextLedgerState;
}

export function buildContextSnapshot(
  ledger: ContextLedger,
  capturedAt = Date.now(),
): ContextSnapshot {
  return {
    capturedAt,
    entryCount: ledger.timeline().length,
    state: ledger.snapshot(capturedAt),
  };
}

export function serializeContextSnapshot(snapshot: ContextSnapshot): string {
  return JSON.stringify(snapshot, null, 2);
}


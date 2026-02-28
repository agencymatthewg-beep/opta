import { useMemo, useRef, useState } from 'react';

import { ContextLedger, type ContextEntryKind } from '@/lib/context/context-ledger';
import { buildContextSnapshot, type ContextSnapshot } from '@/lib/context/context-snapshot';

export interface UseContextLedgerResult {
  snapshot: ContextSnapshot;
  append: (kind: ContextEntryKind, value: string) => void;
  prune: (keepFromTimestamp: number, reason: string) => void;
}

export function useContextLedger(): UseContextLedgerResult {
  const ledgerRef = useRef<ContextLedger>(new ContextLedger());
  const [version, setVersion] = useState(0);

  const snapshot = useMemo(
    () => buildContextSnapshot(ledgerRef.current),
    [version],
  );

  const append = (kind: ContextEntryKind, value: string) => {
    ledgerRef.current.append(kind, value);
    setVersion((current) => current + 1);
  };

  const prune = (keepFromTimestamp: number, reason: string) => {
    ledgerRef.current.prune(keepFromTimestamp, reason);
    setVersion((current) => current + 1);
  };

  return {
    snapshot,
    append,
    prune,
  };
}


import { useState } from 'react';
import type { PermissionRequest } from '../adapter.js';
import type { PermissionDecision } from '../PermissionPrompt.js';

export interface UsePermissionStateReturn {
  permissionPending: (PermissionRequest & { resolve: (decision: PermissionDecision) => void }) | null;
  setPermissionPending: React.Dispatch<React.SetStateAction<(PermissionRequest & { resolve: (decision: PermissionDecision) => void }) | null>>;
  alwaysMessage: string | null;
  setAlwaysMessage: (v: string | null) => void;
}

export function usePermissionState(): UsePermissionStateReturn {
  const [permissionPending, setPermissionPending] = useState<
    (PermissionRequest & { resolve: (decision: PermissionDecision) => void }) | null
  >(null);

  const [alwaysMessage, setAlwaysMessage] = useState<string | null>(null);

  return {
    permissionPending,
    setPermissionPending,
    alwaysMessage,
    setAlwaysMessage,
  };
}

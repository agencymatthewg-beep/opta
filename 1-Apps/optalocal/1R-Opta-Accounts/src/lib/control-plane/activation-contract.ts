/**
 * Local copy of the cross-surface activation contract used by Accounts APIs.
 * Keep this aligned with 1D protocol-shared to avoid standalone deploy coupling.
 */
export type ActivationState =
  | 'runtime_unavailable'
  | 'runtime_ready'
  | 'accounts_authenticated'
  | 'pairing_pending'
  | 'pairing_claimed'
  | 'bridge_connected'
  | 'code_ready';

export type ActivationScopeStatus = 'pending' | 'satisfied' | 'insufficient';

export interface PairingBridgePayloadMetadata {
  state: ActivationState;
  expiresAt: string | null;
  recoveryAction: string | null;
  scopeStatus: ActivationScopeStatus;
}

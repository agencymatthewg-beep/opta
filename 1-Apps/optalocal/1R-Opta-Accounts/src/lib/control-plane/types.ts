import type {
  ActivationScopeStatus,
  ActivationState,
  PairingBridgePayloadMetadata,
} from './activation-contract';

export type PairingSessionStatus = 'pending' | 'claimed' | 'expired' | 'cancelled';

export interface PairingSession {
  id: string;
  userId: string;
  code: string;
  status: PairingSessionStatus;
  deviceId: string | null;
  deviceLabel: string | null;
  capabilityScopes: string[];
  createdAt: string;
  expiresAt: string;
  claimedAt: string | null;
  bridgeTokenId: string | null;
}

export type BridgeTokenStatus = 'active' | 'revoked' | 'expired';

export interface BridgeTokenClaims {
  tokenId: string;
  userId: string;
  deviceId: string;
  trustState: string | null;
  scopes: string[];
  issuedAt: string;
  expiresAt: string;
  status: BridgeTokenStatus;
}

export type DeviceCommandStatus =
  | 'queued'
  | 'delivered'
  | 'completed'
  | 'failed'
  | 'denied'
  | 'expired';

export interface DeviceCommandRequest {
  deviceId: string;
  command: string;
  payload: Record<string, unknown>;
  scope: string | null;
  idempotencyKey: string | null;
}

export interface DeviceCommandRecord {
  id: string;
  userId: string;
  deviceId: string;
  command: string;
  payload: Record<string, unknown>;
  scope: string | null;
  idempotencyKey: string | null;
  status: DeviceCommandStatus;
  createdAt: string;
  deliveredAt: string | null;
  completedAt: string | null;
  resultHash: string | null;
  result: Record<string, unknown> | null;
  error: string | null;
}

export interface DeviceCommandResult {
  status: Extract<DeviceCommandStatus, 'completed' | 'failed' | 'denied'>;
  result?: Record<string, unknown>;
  error?: string;
  resultHash?: string;
}

export interface DeviceRuntimeStatus {
  status: 'offline' | 'pairing' | 'connected' | 'degraded' | 'unauthorized';
  reason: string | null;
  lastSeenAt: string | null;
}

const FALLBACK_ACTIVATION_SEQUENCE = [
  'runtime_unavailable',
  'runtime_ready',
  'accounts_authenticated',
  'pairing_pending',
  'pairing_claimed',
  'bridge_connected',
  'code_ready',
] as const satisfies readonly ActivationState[];

function assertNever(_value: never): never {
  throw new Error('Unhandled pairing status while deriving activation metadata');
}

export function pairingScopeStatus(scopes: readonly string[]): ActivationScopeStatus {
  if (scopes.length === 0) return 'pending';
  return 'satisfied';
}

export function pairingActivationState(status: PairingSessionStatus): ActivationState {
  switch (status) {
    case 'pending':
      return 'pairing_pending';
    case 'claimed':
      return 'pairing_claimed';
    case 'expired':
    case 'cancelled':
      return 'accounts_authenticated';
    default:
      return assertNever(status);
  }
}

export function recoveryActionForActivationState(state: ActivationState): string | null {
  switch (state) {
    case 'runtime_unavailable':
      return 'start_runtime';
    case 'runtime_ready':
      return 'authenticate_accounts';
    case 'accounts_authenticated':
      return 'start_pairing_session';
    case 'pairing_pending':
      return 'claim_pairing_session';
    case 'pairing_claimed':
      return 'mint_bridge_token';
    case 'bridge_connected':
      return 'open_code_surface';
    case 'code_ready':
      return null;
    default:
      return null;
  }
}

export function buildPairingSessionMetadata(session: PairingSession): PairingBridgePayloadMetadata {
  const state = pairingActivationState(session.status);
  return {
    state,
    expiresAt: session.expiresAt,
    recoveryAction: recoveryActionForActivationState(state),
    scopeStatus: pairingScopeStatus(session.capabilityScopes),
  };
}

export function buildBridgeTokenMetadata(claims: BridgeTokenClaims): PairingBridgePayloadMetadata {
  const state: ActivationState = claims.status === 'active' ? 'bridge_connected' : 'pairing_claimed';
  const scopeStatus: ActivationScopeStatus =
    claims.status === 'active'
      ? pairingScopeStatus(claims.scopes)
      : 'insufficient';

  return {
    state,
    expiresAt: claims.expiresAt,
    recoveryAction: recoveryActionForActivationState(state),
    scopeStatus,
  };
}

/**
 * Narrow compile-time guard so contract drift is surfaced in this app too.
 * No runtime behavior change; referenced by tests for alignment safety.
 */
export function activationSequenceSnapshot(): readonly ActivationState[] {
  return FALLBACK_ACTIVATION_SEQUENCE;
}

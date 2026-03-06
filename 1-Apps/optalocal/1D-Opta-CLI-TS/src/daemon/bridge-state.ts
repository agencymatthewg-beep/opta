import { randomUUID } from 'node:crypto';
import type { ActivationState } from '../protocol/v3/types.js';

export type BridgeLifecycleStatus =
  | 'offline'
  | 'pairing'
  | 'connected'
  | 'degraded'
  | 'unauthorized';

export interface BridgeConnectionState {
  status: BridgeLifecycleStatus;
  activationState: ActivationState;
  deviceId: string | null;
  sessionId: string | null;
  bridgeTokenPresent: boolean;
  connectedAt: string | null;
  updatedAt: string;
  lastError: string | null;
}

type InternalBridgeState = Omit<BridgeConnectionState, 'activationState'> & {
  connectionId: string | null;
  bridgeToken: string | null;
};

let bridgeState: InternalBridgeState = {
  status: 'offline',
  deviceId: null,
  sessionId: null,
  bridgeTokenPresent: false,
  connectedAt: null,
  updatedAt: new Date().toISOString(),
  lastError: null,
  connectionId: null,
  bridgeToken: null,
};

function bridgeStatusToActivationState(status: BridgeLifecycleStatus): ActivationState {
  switch (status) {
    case 'pairing':
      return 'pairing_pending';
    case 'connected':
      return 'bridge_connected';
    case 'degraded':
      return 'pairing_claimed';
    case 'unauthorized':
      return 'accounts_authenticated';
    case 'offline':
    default:
      return 'runtime_ready';
  }
}

function touch(next: Partial<InternalBridgeState>): InternalBridgeState {
  bridgeState = {
    ...bridgeState,
    ...next,
    updatedAt: new Date().toISOString(),
  };
  return bridgeState;
}

export function getBridgeState(): BridgeConnectionState {
  const { connectionId: _connectionId, bridgeToken: _bridgeToken, ...publicState } = bridgeState;
  return {
    ...publicState,
    activationState: bridgeStatusToActivationState(publicState.status),
  };
}

export interface BridgeWorkerSnapshot {
  status: BridgeLifecycleStatus;
  connectionId: string;
  deviceId: string;
  sessionId: string | null;
  bridgeToken: string | null;
}

export function getBridgeWorkerSnapshot(): BridgeWorkerSnapshot | null {
  if (!bridgeState.connectionId || !bridgeState.deviceId) return null;
  return {
    status: bridgeState.status,
    connectionId: bridgeState.connectionId,
    deviceId: bridgeState.deviceId,
    sessionId: bridgeState.sessionId,
    bridgeToken: bridgeState.bridgeToken,
  };
}

export function connectBridge(input: {
  deviceId: string;
  sessionId?: string;
  bridgeToken?: string;
  force?: boolean;
}): BridgeConnectionState {
  const token = input.bridgeToken?.trim() ? input.bridgeToken.trim() : null;
  if (bridgeState.status === 'connected' && !input.force && bridgeState.deviceId === input.deviceId) {
    if (token) {
      touch({
        bridgeToken: token,
        bridgeTokenPresent: true,
        lastError: null,
      });
    }
    return getBridgeState();
  }

  touch({
    status: 'pairing',
    deviceId: input.deviceId,
    sessionId: input.sessionId ?? null,
    bridgeTokenPresent: Boolean(token),
    bridgeToken: token,
    lastError: null,
  });

  touch({
    status: 'connected',
    connectedAt: new Date().toISOString(),
    connectionId: randomUUID(),
  });
  return getBridgeState();
}

export function disconnectBridge(reason?: string): BridgeConnectionState {
  touch({
    status: 'offline',
    deviceId: null,
    sessionId: null,
    bridgeTokenPresent: false,
    bridgeToken: null,
    connectedAt: null,
    connectionId: null,
    lastError: reason ?? null,
  });
  return getBridgeState();
}

export function markBridgeDegraded(reason: string): BridgeConnectionState {
  if (bridgeState.status === 'offline') return getBridgeState();
  touch({
    status: 'degraded',
    lastError: reason,
  });
  return getBridgeState();
}

export function markBridgeConnected(): BridgeConnectionState {
  if (bridgeState.status === 'offline') return getBridgeState();
  touch({
    status: 'connected',
    lastError: null,
  });
  return getBridgeState();
}

export function markBridgeUnauthorized(reason: string): BridgeConnectionState {
  if (bridgeState.status === 'offline') return getBridgeState();
  touch({
    status: 'unauthorized',
    lastError: reason,
  });
  return getBridgeState();
}

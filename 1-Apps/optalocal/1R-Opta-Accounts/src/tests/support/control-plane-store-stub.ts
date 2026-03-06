import type {
  BridgeTokenClaims,
  DeviceCommandRecord,
  DeviceCommandRequest,
  DeviceCommandResult,
  PairingSession,
} from '../../lib/control-plane/types.ts';
import {
  claimPairingSession as claimPairingSessionInMemory,
  createBridgeToken as createBridgeTokenInMemory,
  createDeviceCommand as createDeviceCommandInMemory,
  createPairingSession as createPairingSessionInMemory,
  getDeviceCommand as getDeviceCommandInMemory,
  getPairingSession as getPairingSessionInMemory,
  listDeviceCommandsForDelivery as listDeviceCommandsForDeliveryInMemory,
  resolveBridgeTokenClaimsFromSecret as resolveBridgeTokenClaimsFromSecretInMemory,
  revokeBridgeToken as revokeBridgeTokenInMemory,
  storeDeviceCommandResult as storeDeviceCommandResultInMemory,
} from '../../lib/control-plane/store.ts';
import { getBridgeClaimsOverride } from './route-mocks.ts';

export function resetInMemoryControlPlaneStore(): void {
  (globalThis as Record<string, unknown>).__OPTA_ACCOUNTS_CONTROL_PLANE_STORE__ = undefined;
  (globalThis as Record<string, unknown>).__OPTA_ACCOUNTS_CONTROL_PLANE_SUPABASE__ = undefined;
}

export async function createPairingSession(input: {
  userId: string;
  deviceId?: string | null;
  deviceLabel?: string | null;
  capabilityScopes?: string[];
  ttlSeconds?: number;
}): Promise<PairingSession> {
  return createPairingSessionInMemory(input, { supabase: null });
}

export async function getPairingSession(id: string): Promise<PairingSession | null> {
  return getPairingSessionInMemory(id, { supabase: null });
}

export async function claimPairingSession(input: {
  id: string;
  userId: string;
  deviceId?: string | null;
  deviceLabel?: string | null;
  bridgeTokenId?: string | null;
}): Promise<PairingSession | null> {
  return claimPairingSessionInMemory(input, { supabase: null });
}

export async function createBridgeToken(input: {
  userId: string;
  deviceId: string;
  trustState?: string | null;
  scopes: string[];
  ttlSeconds?: number;
}): Promise<{ token: string; claims: BridgeTokenClaims }> {
  return createBridgeTokenInMemory(input, { supabase: null });
}

export async function revokeBridgeToken(tokenId: string): Promise<BridgeTokenClaims | null> {
  return revokeBridgeTokenInMemory(tokenId, { supabase: null });
}

export async function resolveBridgeTokenClaimsFromSecret(
  token: string,
): Promise<BridgeTokenClaims | null> {
  const override = getBridgeClaimsOverride(token);
  if (override !== undefined) return override;
  return resolveBridgeTokenClaimsFromSecretInMemory(token, { supabase: null });
}

export async function createDeviceCommand(input: {
  userId: string;
  request: DeviceCommandRequest;
}): Promise<DeviceCommandRecord> {
  return createDeviceCommandInMemory(input, { supabase: null });
}

export async function getDeviceCommand(id: string): Promise<DeviceCommandRecord | null> {
  return getDeviceCommandInMemory(id, { supabase: null });
}

export async function listDeviceCommandsForDelivery(input: {
  deviceId: string;
  limit?: number;
}): Promise<DeviceCommandRecord[]> {
  return listDeviceCommandsForDeliveryInMemory(input, { supabase: null });
}

export async function storeDeviceCommandResult(input: {
  id: string;
  deviceId: string;
  result: DeviceCommandResult;
}): Promise<DeviceCommandRecord | null> {
  return storeDeviceCommandResultInMemory(input, { supabase: null });
}

import type { BridgeTokenClaims } from '../../lib/control-plane/types.ts';

export type MockAuthzResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

export type MockDeviceRecord = {
  id: string;
  userId: string;
  trustState: string;
  deviceLabel?: string | null;
};

export type MockSyncFileRecord = {
  id: string;
  userId: string;
  filename: string;
  content: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type RouteMockState = {
  currentUserId: string | null;
  authzResult: MockAuthzResult;
  devices: Map<string, MockDeviceRecord>;
  auditEvents: Array<Record<string, unknown>>;
  bridgeClaimsOverrides: Map<string, BridgeTokenClaims | null>;
  syncFiles: Map<string, MockSyncFileRecord>;
};

const state: RouteMockState = {
  currentUserId: null,
  authzResult: { ok: true },
  devices: new Map<string, MockDeviceRecord>(),
  auditEvents: [],
  bridgeClaimsOverrides: new Map<string, BridgeTokenClaims | null>(),
  syncFiles: new Map<string, MockSyncFileRecord>(),
};

function syncFileKey(userId: string, filename: string): string {
  return `${userId}:${filename}`;
}

export function resetRouteMockState(): void {
  state.currentUserId = null;
  state.authzResult = { ok: true };
  state.devices.clear();
  state.auditEvents.length = 0;
  state.bridgeClaimsOverrides.clear();
  state.syncFiles.clear();
}

export function upsertMockSyncFile(record: MockSyncFileRecord): void {
  state.syncFiles.set(syncFileKey(record.userId, record.filename), record);
}

export function findMockSyncFile(userId: string, filename: string): MockSyncFileRecord | null {
  return state.syncFiles.get(syncFileKey(userId, filename)) ?? null;
}

export function listMockSyncFiles(userId: string): MockSyncFileRecord[] {
  const results: MockSyncFileRecord[] = [];
  for (const record of state.syncFiles.values()) {
    if (record.userId === userId) results.push(record);
  }
  return results;
}

export function setMockUser(userId: string | null): void {
  state.currentUserId = userId;
}

export function getMockUser(): string | null {
  return state.currentUserId;
}

export function setMockAuthzResult(result: MockAuthzResult): void {
  state.authzResult = result;
}

export function getMockAuthzResult(): MockAuthzResult {
  return state.authzResult;
}

export function upsertMockDevice(device: MockDeviceRecord): void {
  state.devices.set(device.id, device);
}

export function findMockDevice(id: string, userId: string): MockDeviceRecord | null {
  const found = state.devices.get(id);
  if (!found || found.userId !== userId) return null;
  return found;
}

export function recordAuditEvent(event: Record<string, unknown>): void {
  state.auditEvents.push(event);
}

export function getRecordedAuditEvents(): Array<Record<string, unknown>> {
  return [...state.auditEvents];
}

export function setBridgeClaimsOverride(
  token: string,
  claims: BridgeTokenClaims | null | undefined,
): void {
  if (claims === undefined) {
    state.bridgeClaimsOverrides.delete(token);
    return;
  }
  state.bridgeClaimsOverrides.set(token, claims);
}

export function getBridgeClaimsOverride(token: string): BridgeTokenClaims | null | undefined {
  return state.bridgeClaimsOverrides.get(token);
}

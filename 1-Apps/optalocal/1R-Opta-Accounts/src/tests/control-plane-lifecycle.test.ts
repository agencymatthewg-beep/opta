import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
  claimPairingSession,
  createBridgeToken,
  createDeviceCommand,
  createPairingSession,
  getDeviceCommand,
  getPairingSession,
  listDeviceCommandsForDelivery,
  resolveBridgeTokenClaimsFromSecret,
  revokeBridgeToken,
  storeDeviceCommandResult,
} from '../lib/control-plane/store.ts';

function resetInMemoryControlPlane() {
  (globalThis as Record<string, unknown>).__OPTA_ACCOUNTS_CONTROL_PLANE_STORE__ = undefined;
  (globalThis as Record<string, unknown>).__OPTA_ACCOUNTS_CONTROL_PLANE_SUPABASE__ = undefined;
}

test.beforeEach(() => {
  resetInMemoryControlPlane();
});

test('pairing lifecycle transitions pending -> claimed', async () => {
  const inMemory = { supabase: null };
  const userId = randomUUID();
  const created = await createPairingSession({
    userId,
    deviceLabel: 'LMX Primary',
    capabilityScopes: ['device.commands.consume'],
    ttlSeconds: 300,
  }, inMemory);

  assert.equal(created.status, 'pending');

  const fetched = await getPairingSession(created.id, inMemory);
  assert.ok(fetched);
  assert.equal(fetched.status, 'pending');

  const claimed = await claimPairingSession({
    id: created.id,
    userId,
    deviceId: randomUUID(),
    deviceLabel: 'LMX Primary Claimed',
  }, inMemory);

  assert.ok(claimed);
  assert.equal(claimed.status, 'claimed');
  assert.ok(claimed.claimedAt);
});

test('bridge token lifecycle transitions active -> revoked and enforces expiry', async () => {
  const inMemory = { supabase: null };
  const userId = randomUUID();
  const deviceId = randomUUID();
  const minted = await createBridgeToken({
    userId,
    deviceId,
    scopes: ['device.commands.consume'],
    ttlSeconds: 60,
  }, inMemory);

  const activeClaims = await resolveBridgeTokenClaimsFromSecret(minted.token, inMemory);
  assert.ok(activeClaims);
  assert.equal(activeClaims.status, 'active');

  const revoked = await revokeBridgeToken(activeClaims.tokenId, inMemory);
  assert.ok(revoked);
  assert.equal(revoked.status, 'revoked');

  const revokedResolution = await resolveBridgeTokenClaimsFromSecret(minted.token, inMemory);
  assert.equal(revokedResolution, null);

  const fresh = await createBridgeToken({
    userId,
    deviceId,
    scopes: ['device.commands.consume'],
    ttlSeconds: 60,
  }, inMemory);

  const originalNow = Date.now;
  const futureMs = new Date(fresh.claims.expiresAt).getTime() + 1_000;
  Date.now = () => futureMs;
  try {
    const expiredResolution = await resolveBridgeTokenClaimsFromSecret(fresh.token, inMemory);
    assert.equal(expiredResolution, null);
  } finally {
    Date.now = originalNow;
  }
});

test('device command lifecycle transitions queued -> delivered -> completed', async () => {
  const inMemory = { supabase: null };
  const userId = randomUUID();
  const deviceId = randomUUID();
  const idempotencyKey = randomUUID();

  const first = await createDeviceCommand({
    userId,
    request: {
      deviceId,
      command: 'lmx.http.request',
      payload: { path: '/admin/status', method: 'POST' },
      scope: 'device.commands.consume',
      idempotencyKey,
    },
  }, inMemory);

  const deduped = await createDeviceCommand({
    userId,
    request: {
      deviceId,
      command: 'lmx.http.request',
      payload: { path: '/admin/status', method: 'POST' },
      scope: 'device.commands.consume',
      idempotencyKey,
    },
  }, inMemory);

  assert.equal(deduped.id, first.id);
  assert.equal(deduped.status, 'queued');

  const deliveryBatch = await listDeviceCommandsForDelivery({ deviceId, limit: 10 }, inMemory);
  assert.equal(deliveryBatch.length, 1);
  assert.ok(deliveryBatch[0]);
  assert.equal(deliveryBatch[0].id, first.id);

  const delivered = await getDeviceCommand(first.id, inMemory);
  assert.ok(delivered);
  assert.equal(delivered.status, 'delivered');

  const completed = await storeDeviceCommandResult({
    id: first.id,
    deviceId,
    result: {
      status: 'completed',
      result: { ok: true, commandId: first.id },
      resultHash: 'sha256:test',
    },
  }, inMemory);

  assert.ok(completed);
  assert.equal(completed.status, 'completed');
  assert.equal(completed.resultHash, 'sha256:test');
});

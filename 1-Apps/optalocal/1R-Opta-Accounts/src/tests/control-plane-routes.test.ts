import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { revokeBridgeToken } from '../lib/control-plane/store.ts';
import { installRouteModuleHooks } from './support/route-module-hooks.ts';
import {
  getRecordedAuditEvents,
  resetRouteMockState,
  setMockUser,
  upsertMockDevice,
} from './support/route-mocks.ts';
import { resetInMemoryControlPlaneStore } from './support/control-plane-store-stub.ts';

installRouteModuleHooks();

const pairingSessionsRoute = await import('../app/api/pairing/sessions/route.ts');
const pairingSessionGetRoute = await import('../app/api/pairing/sessions/[id]/route.ts');
const pairingSessionClaimRoute = await import('../app/api/pairing/sessions/[id]/claim/route.ts');
const bridgeTokensRoute = await import('../app/api/bridge/tokens/route.ts');
const deviceCommandsRoute = await import('../app/api/device-commands/route.ts');
const deviceCommandRoute = await import('../app/api/device-commands/[id]/route.ts');
const deviceCommandStreamRoute = await import('../app/api/device-commands/stream/route.ts');
const deviceCommandResultRoute = await import('../app/api/device-commands/[id]/result/route.ts');

test.beforeEach(() => {
  resetRouteMockState();
  resetInMemoryControlPlaneStore();
});

test('pairing session routes cover create -> claim lifecycle and metadata contract', async () => {
  const userId = randomUUID();
  const deviceId = randomUUID();
  setMockUser(userId);

  const createResponse = await pairingSessionsRoute.POST(
    new Request('http://localhost:3002/api/pairing/sessions', {
      method: 'POST',
      body: JSON.stringify({
        deviceId,
        deviceLabel: 'LMX Node A',
        capabilityScopes: ['device.commands.consume'],
        ttlSeconds: 300,
      }),
      headers: { 'content-type': 'application/json' },
    }),
  );

  assert.equal(createResponse.status, 201);
  const created = (await createResponse.json()) as {
    session: { id: string; status: string; userId: string };
    metadata: { state: string; recoveryAction: string | null; scopeStatus: string };
  };

  assert.equal(created.session.status, 'pending');
  assert.equal(created.session.userId, userId);
  assert.equal(created.metadata.state, 'pairing_pending');
  assert.equal(created.metadata.recoveryAction, 'claim_pairing_session');
  assert.equal(created.metadata.scopeStatus, 'satisfied');

  const getBeforeClaim = await pairingSessionGetRoute.GET(
    new Request(`http://localhost:3002/api/pairing/sessions/${created.session.id}`),
    { params: Promise.resolve({ id: created.session.id }) },
  );

  assert.equal(getBeforeClaim.status, 200);

  const claimResponse = await pairingSessionClaimRoute.POST(
    new Request(`http://localhost:3002/api/pairing/sessions/${created.session.id}/claim`, {
      method: 'POST',
      body: JSON.stringify({
        deviceId,
        deviceLabel: 'LMX Node A Claimed',
      }),
      headers: { 'content-type': 'application/json' },
    }),
    { params: Promise.resolve({ id: created.session.id }) },
  );

  assert.equal(claimResponse.status, 200);
  const claimed = (await claimResponse.json()) as {
    session: { status: string; claimedAt: string | null };
    metadata: { state: string; recoveryAction: string | null };
  };

  assert.equal(claimed.session.status, 'claimed');
  assert.ok(claimed.session.claimedAt);
  assert.equal(claimed.metadata.state, 'pairing_claimed');
  assert.equal(claimed.metadata.recoveryAction, 'mint_bridge_token');

  const events = getRecordedAuditEvents();
  assert.equal(events.length, 2);
  assert.equal(events[0]?.eventType, 'pairing.session.create');
  assert.equal(events[1]?.eventType, 'pairing.session.claim');
});

test('bridge token route mints active claims and invalidates revoked token usage', async () => {
  const userId = randomUUID();
  const deviceId = randomUUID();
  setMockUser(userId);
  upsertMockDevice({
    id: deviceId,
    userId,
    trustState: 'trusted',
    deviceLabel: 'Desktop Agent',
  });

  const mintResponse = await bridgeTokensRoute.POST(
    new Request('http://localhost:3002/api/bridge/tokens', {
      method: 'POST',
      body: JSON.stringify({
        deviceId,
        scopes: ['device.commands.consume'],
        ttlSeconds: 300,
      }),
      headers: { 'content-type': 'application/json' },
    }),
  );

  assert.equal(mintResponse.status, 201);
  const minted = (await mintResponse.json()) as {
    token: string;
    claims: { tokenId: string; status: string; deviceId: string; userId: string };
    metadata: { state: string; scopeStatus: string };
  };

  assert.equal(minted.claims.status, 'active');
  assert.equal(minted.claims.deviceId, deviceId);
  assert.equal(minted.claims.userId, userId);
  assert.equal(minted.metadata.state, 'bridge_connected');
  assert.equal(minted.metadata.scopeStatus, 'satisfied');

  const revoked = await revokeBridgeToken(minted.claims.tokenId, { supabase: null });
  assert.ok(revoked);
  assert.equal(revoked?.status, 'revoked');

  setMockUser(null);
  const postRevokeStreamResponse = await deviceCommandStreamRoute.GET(
    new Request(`http://localhost:3002/api/device-commands/stream?deviceId=${deviceId}`, {
      headers: { authorization: `Bearer ${minted.token}` },
    }),
  );

  assert.equal(postRevokeStreamResponse.status, 401);
  const postRevokePayload = (await postRevokeStreamResponse.json()) as { error: string };
  assert.equal(postRevokePayload.error, 'unauthenticated');
});

test('device command routes cover queued -> delivered -> completed transition contract', async () => {
  const userId = randomUUID();
  const deviceId = randomUUID();
  setMockUser(userId);
  upsertMockDevice({
    id: deviceId,
    userId,
    trustState: 'trusted',
    deviceLabel: 'Desktop Agent',
  });

  const createResponse = await deviceCommandsRoute.POST(
    new Request('http://localhost:3002/api/device-commands', {
      method: 'POST',
      body: JSON.stringify({
        deviceId,
        command: 'lmx.http.request',
        payload: { path: '/admin/status', method: 'POST' },
        scope: 'device.commands.consume',
        idempotencyKey: randomUUID(),
      }),
      headers: { 'content-type': 'application/json' },
    }),
  );

  assert.equal(createResponse.status, 201);
  const created = (await createResponse.json()) as { command: { id: string; status: string } };
  assert.equal(created.command.status, 'queued');

  const streamResponse = await deviceCommandStreamRoute.GET(
    new Request(
      `http://localhost:3002/api/device-commands/stream?deviceId=${deviceId}&limit=10`,
      { headers: { accept: 'application/json' } },
    ),
  );

  assert.equal(streamResponse.status, 200);
  const streamed = (await streamResponse.json()) as {
    delivered: number;
    commands: Array<{ id: string; status: string }>;
  };
  assert.equal(streamed.delivered, 1);
  assert.equal(streamed.commands[0]?.id, created.command.id);
  assert.equal(streamed.commands[0]?.status, 'queued');

  const afterDeliveryResponse = await deviceCommandRoute.GET(
    new Request(`http://localhost:3002/api/device-commands/`),
    { params: Promise.resolve({ id: created.command.id }) },
  );

  assert.equal(afterDeliveryResponse.status, 200);
  const afterDelivery = (await afterDeliveryResponse.json()) as { command: { status: string } };
  assert.equal(afterDelivery.command.status, 'delivered');

  const resultResponse = await deviceCommandResultRoute.POST(
    new Request(`http://localhost:3002/api/device-commands/${created.command.id}/result`, {
      method: 'POST',
      body: JSON.stringify({
        deviceId,
        status: 'completed',
        result: { ok: true },
        resultHash: 'sha256:done',
      }),
      headers: { 'content-type': 'application/json' },
    }),
    { params: Promise.resolve({ id: created.command.id }) },
  );

  assert.equal(resultResponse.status, 200);
  const resultPayload = (await resultResponse.json()) as {
    command: { id: string; status: string; resultHash: string | null };
  };
  assert.equal(resultPayload.command.id, created.command.id);
  assert.equal(resultPayload.command.status, 'completed');
  assert.equal(resultPayload.command.resultHash, 'sha256:done');

  const getResponse = await deviceCommandRoute.GET(
    new Request(`http://localhost:3002/api/device-commands/${created.command.id}`),
    { params: Promise.resolve({ id: created.command.id }) },
  );

  assert.equal(getResponse.status, 200);
  const fetched = (await getResponse.json()) as { command: { status: string } };
  assert.equal(fetched.command.status, 'completed');
});

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  activationSequenceSnapshot,
  buildBridgeTokenMetadata,
  buildPairingSessionMetadata,
} from '../lib/control-plane/types.ts';

test('activation sequence snapshot preserves canonical contract order', () => {
  assert.deepEqual(activationSequenceSnapshot(), [
    'runtime_unavailable',
    'runtime_ready',
    'accounts_authenticated',
    'pairing_pending',
    'pairing_claimed',
    'bridge_connected',
    'code_ready',
  ]);
});

test('pairing session metadata maps pending state and empty scopes', () => {
  const metadata = buildPairingSessionMetadata({
    id: 'sess-1',
    userId: 'user-1',
    code: 'ABCD1234',
    status: 'pending',
    deviceId: null,
    deviceLabel: null,
    capabilityScopes: [],
    createdAt: '2026-03-06T00:00:00.000Z',
    expiresAt: '2026-03-06T00:10:00.000Z',
    claimedAt: null,
    bridgeTokenId: null,
  });

  assert.equal(metadata.state, 'pairing_pending');
  assert.equal(metadata.expiresAt, '2026-03-06T00:10:00.000Z');
  assert.equal(metadata.recoveryAction, 'claim_pairing_session');
  assert.equal(metadata.scopeStatus, 'pending');
});

test('pairing session metadata maps claimed state and populated scopes', () => {
  const metadata = buildPairingSessionMetadata({
    id: 'sess-2',
    userId: 'user-2',
    code: 'EFGH5678',
    status: 'claimed',
    deviceId: 'device-2',
    deviceLabel: 'My Device',
    capabilityScopes: ['device.commands.consume'],
    createdAt: '2026-03-06T00:00:00.000Z',
    expiresAt: '2026-03-06T00:10:00.000Z',
    claimedAt: '2026-03-06T00:01:00.000Z',
    bridgeTokenId: 'token-2',
  });

  assert.equal(metadata.state, 'pairing_claimed');
  assert.equal(metadata.recoveryAction, 'mint_bridge_token');
  assert.equal(metadata.scopeStatus, 'satisfied');
});

test('bridge token metadata maps active bridge and fallback recovery', () => {
  const active = buildBridgeTokenMetadata({
    tokenId: 'token-3',
    userId: 'user-3',
    deviceId: 'device-3',
    trustState: 'trusted',
    scopes: ['device.commands.consume'],
    issuedAt: '2026-03-06T00:00:00.000Z',
    expiresAt: '2026-03-06T01:00:00.000Z',
    status: 'active',
  });

  assert.equal(active.state, 'bridge_connected');
  assert.equal(active.recoveryAction, 'open_code_surface');
  assert.equal(active.scopeStatus, 'satisfied');

  const revoked = buildBridgeTokenMetadata({
    tokenId: 'token-4',
    userId: 'user-4',
    deviceId: 'device-4',
    trustState: 'trusted',
    scopes: ['device.commands.consume'],
    issuedAt: '2026-03-06T00:00:00.000Z',
    expiresAt: '2026-03-06T01:00:00.000Z',
    status: 'revoked',
  });

  assert.equal(revoked.state, 'pairing_claimed');
  assert.equal(revoked.scopeStatus, 'insufficient');
});

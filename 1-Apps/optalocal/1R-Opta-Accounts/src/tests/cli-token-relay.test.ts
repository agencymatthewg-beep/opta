import assert from 'node:assert/strict';
import test from 'node:test';
import {
  consumeCliTokenRelay,
  isValidCliRelayCode,
  registerCliTokenRelay,
} from '../lib/cli/token-relay.ts';

function resetRelayState(): void {
  globalThis.__optaCliTokenRelayStore = undefined;
  globalThis.__optaCliReplayStore = undefined;
  globalThis.__optaCliReplaySupabase = undefined;
}

function clearRelayEnv(): void {
  delete process.env['OPTA_CLI_TOKEN_RELAY_SECRET'];
  delete process.env['OPTA_ACCOUNTS_CLI_TOKEN_RELAY_SECRET'];
  delete process.env['OPTA_CLI_HANDOFF_SECRET'];
  delete process.env['OPTA_ACCOUNTS_CLI_HANDOFF_SECRET'];
  delete process.env['OPTA_CLI_TOKEN_RELAY_DISABLE_STATELESS'];
  delete process.env['OPTA_ACCOUNTS_CLI_TOKEN_RELAY_DISABLE_STATELESS'];
  delete process.env['OPTA_CLI_REQUIRE_DURABLE_REPLAY'];
  delete process.env['SUPABASE_URL'];
  delete process.env['NEXT_PUBLIC_SUPABASE_URL'];
  delete process.env['SUPABASE_SERVICE_KEY'];
  delete process.env['SUPABASE_SERVICE_ROLE_KEY'];
}

test.beforeEach(() => {
  clearRelayEnv();
  resetRelayState();
});

test.afterEach(() => {
  clearRelayEnv();
  resetRelayState();
});

test('relay code validator enforces expected token shape', () => {
  assert.equal(isValidCliRelayCode('abcDEF123_-relay-token-sample'), true);
  assert.equal(
    isValidCliRelayCode('v1.abcdefghijklmnopqrstuvwxyz.ABCDEFGHIJKLMNOPQRSTUVWXYZ.abcdef1234567890'),
    true,
  );
  assert.equal(isValidCliRelayCode('bad token with spaces'), false);
  assert.equal(isValidCliRelayCode('short'), false);
});

test('registered relay code can be consumed exactly once', async () => {
  const registration = registerCliTokenRelay({
    state: '0123456789abcdef0123456789abcdef',
    port: 43123,
    handoff: 'handoff_token_1234',
    returnTo: 'opta-code://auth/callback',
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    expiresAt: 1_900_000_000,
    expiresIn: 3600,
    tokenType: 'bearer',
    providerToken: 'provider-token',
    providerRefreshToken: 'provider-refresh-token',
  });

  const first = await consumeCliTokenRelay({
    code: registration.code,
    state: '0123456789abcdef0123456789abcdef',
    port: 43123,
    handoff: 'handoff_token_1234',
  });
  assert.ok(first);
  assert.equal(first.accessToken, 'access-token');
  assert.equal(first.refreshToken, 'refresh-token');
  assert.equal(first.tokenType, 'bearer');
  assert.equal(first.expiresIn, 3600);
  assert.equal(first.providerToken, 'provider-token');
  assert.equal(first.providerRefreshToken, 'provider-refresh-token');
  assert.equal(first.returnTo, 'opta-code://auth/callback');

  const second = await consumeCliTokenRelay({
    code: registration.code,
    state: '0123456789abcdef0123456789abcdef',
    port: 43123,
    handoff: 'handoff_token_1234',
  });
  assert.equal(second, null);
});

test('signed relay supports stateless exchange when memory record is missing', async () => {
  process.env['OPTA_CLI_TOKEN_RELAY_SECRET'] = '0123456789abcdef0123456789abcdef';

  const registration = registerCliTokenRelay({
    state: '0123456789abcdef0123456789abcdef',
    port: 43123,
    handoff: 'handoff_token_1234',
    returnTo: 'opta-code://auth/callback',
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    expiresAt: 1_900_000_000,
  });

  assert.equal(registration.strategy, 'signed');

  // Simulate callback/exchange landing on a different instance.
  globalThis.__optaCliTokenRelayStore = new Map();

  const first = await consumeCliTokenRelay({
    code: registration.code,
    state: '0123456789abcdef0123456789abcdef',
    port: 43123,
    handoff: 'handoff_token_1234',
  });
  assert.ok(first);
  assert.equal(first.accessToken, 'access-token');
  assert.equal(first.refreshToken, 'refresh-token');

  const replay = await consumeCliTokenRelay({
    code: registration.code,
    state: '0123456789abcdef0123456789abcdef',
    port: 43123,
    handoff: 'handoff_token_1234',
  });
  assert.equal(replay, null);
});

test('signed stateless fallback can be disabled for strict single-use operation', async () => {
  process.env['OPTA_CLI_TOKEN_RELAY_SECRET'] = '0123456789abcdef0123456789abcdef';
  process.env['OPTA_CLI_TOKEN_RELAY_DISABLE_STATELESS'] = '1';

  const registration = registerCliTokenRelay({
    state: 'fedcba9876543210fedcba9876543210',
    port: 43124,
    handoff: 'expected_handoff',
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
  });

  assert.equal(registration.strategy, 'memory');

  // Cross-instance memory miss should fail when stateless fallback is disabled.
  globalThis.__optaCliTokenRelayStore = new Map();
  const exchange = await consumeCliTokenRelay({
    code: registration.code,
    state: 'fedcba9876543210fedcba9876543210',
    port: 43124,
    handoff: 'expected_handoff',
  });
  assert.equal(exchange, null);
});

test('relay consumption rejects state/port/handoff mismatches', async () => {
  const registration = registerCliTokenRelay({
    state: 'fedcba9876543210fedcba9876543210',
    port: 43124,
    handoff: 'expected_handoff',
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
  });

  const badState = await consumeCliTokenRelay({
    code: registration.code,
    state: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    port: 43124,
    handoff: 'expected_handoff',
  });
  assert.equal(badState, null);

  const badPort = await consumeCliTokenRelay({
    code: registration.code,
    state: 'fedcba9876543210fedcba9876543210',
    port: 43125,
    handoff: 'expected_handoff',
  });
  assert.equal(badPort, null);

  const badHandoff = await consumeCliTokenRelay({
    code: registration.code,
    state: 'fedcba9876543210fedcba9876543210',
    port: 43124,
    handoff: 'wrong_handoff',
  });
  assert.equal(badHandoff, null);

  const good = await consumeCliTokenRelay({
    code: registration.code,
    state: 'fedcba9876543210fedcba9876543210',
    port: 43124,
    handoff: 'expected_handoff',
  });
  assert.ok(good);
});

test('strict durable replay mode rejects relay consume without service credentials', async () => {
  process.env['OPTA_CLI_REQUIRE_DURABLE_REPLAY'] = '1';

  const registration = registerCliTokenRelay({
    state: 'aaaaaaaa11111111bbbbbbbb22222222',
    port: 43127,
    handoff: 'strict_relay_handoff',
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
  });

  await assert.rejects(
    () =>
      consumeCliTokenRelay({
        code: registration.code,
        state: 'aaaaaaaa11111111bbbbbbbb22222222',
        port: 43127,
        handoff: 'strict_relay_handoff',
      }),
    /Durable replay store is required/,
  );
});

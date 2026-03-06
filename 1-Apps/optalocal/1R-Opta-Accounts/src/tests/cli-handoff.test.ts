import assert from 'node:assert/strict';
import test from 'node:test';
import {
  consumeCliHandoff,
  isValidCliHandoff,
  isValidCliState,
  parseCliCallbackPort,
  peekCliHandoff,
  registerCliHandoff,
} from '../lib/cli/handoff.ts';

function resetHandoffState(): void {
  globalThis.__optaCliHandoffStore = undefined;
  globalThis.__optaCliReplayStore = undefined;
  globalThis.__optaCliReplaySupabase = undefined;
}

function clearHandoffEnv(): void {
  delete process.env['OPTA_CLI_HANDOFF_SECRET'];
  delete process.env['OPTA_CLI_REQUIRE_DURABLE_REPLAY'];
  delete process.env['SUPABASE_URL'];
  delete process.env['NEXT_PUBLIC_SUPABASE_URL'];
  delete process.env['SUPABASE_SERVICE_KEY'];
  delete process.env['SUPABASE_SERVICE_ROLE_KEY'];
}

test.beforeEach(() => {
  resetHandoffState();
  clearHandoffEnv();
});

test.afterEach(() => {
  resetHandoffState();
  clearHandoffEnv();
});

test('parseCliCallbackPort enforces numeric localhost-safe callback range', () => {
  assert.equal(parseCliCallbackPort('1234'), 1234);
  assert.equal(parseCliCallbackPort('65535'), 65535);
  assert.equal(parseCliCallbackPort('1023'), null);
  assert.equal(parseCliCallbackPort('65536'), null);
  assert.equal(parseCliCallbackPort('abc'), null);
});

test('state and handoff validators enforce expected token shapes', () => {
  assert.equal(isValidCliState('0123456789abcdef0123456789abcdef'), true);
  assert.equal(isValidCliState('short'), false);

  assert.equal(isValidCliHandoff('abcDEF12_-token'), true);
  assert.equal(isValidCliHandoff('bad token with space'), false);
});

test('registered handoff can be peeked and consumed exactly once', async () => {
  registerCliHandoff({
    state: '0123456789abcdef0123456789abcdef',
    port: 43123,
    handoff: 'handoff_token_1234',
    returnTo: 'opta-code://auth/callback',
  });

  const peeked = peekCliHandoff({
    state: '0123456789abcdef0123456789abcdef',
    port: 43123,
    handoff: 'handoff_token_1234',
  });
  assert.ok(peeked);
  assert.equal(peeked.returnTo, 'opta-code://auth/callback');

  const consumed = await consumeCliHandoff({
    state: '0123456789abcdef0123456789abcdef',
    port: 43123,
    handoff: 'handoff_token_1234',
  });
  assert.ok(consumed);

  const missingAfterConsume = peekCliHandoff({
    state: '0123456789abcdef0123456789abcdef',
    port: 43123,
    handoff: 'handoff_token_1234',
  });
  assert.equal(missingAfterConsume, null);
});

test('handoff mismatch is rejected', () => {
  registerCliHandoff({
    state: 'fedcba9876543210fedcba9876543210',
    port: 43124,
    handoff: 'expected_handoff',
  });

  const mismatch = peekCliHandoff({
    state: 'fedcba9876543210fedcba9876543210',
    port: 43124,
    handoff: 'wrong_handoff',
  });
  assert.equal(mismatch, null);
});

test('signed proof supports stateless handoff validation', async () => {
  process.env['OPTA_CLI_HANDOFF_SECRET'] = '0123456789abcdef-proof-secret';
  const registration = registerCliHandoff({
    state: 'aaaabbbbccccddddeeeeffff11112222',
    port: 43125,
    handoff: 'proof_handoff_token',
    returnTo: 'opta-code://auth/callback',
  });

  assert.equal(typeof registration.proof, 'string');
  assert.equal(registration.strategy, 'signed');

  const peeked = peekCliHandoff({
    state: 'aaaabbbbccccddddeeeeffff11112222',
    port: 43125,
    handoff: 'proof_handoff_token',
    proof: registration.proof,
  });
  assert.ok(peeked);
  assert.equal(peeked.returnTo, 'opta-code://auth/callback');

  const consumed = await consumeCliHandoff({
    state: 'aaaabbbbccccddddeeeeffff11112222',
    port: 43125,
    handoff: 'proof_handoff_token',
    proof: registration.proof,
  });
  assert.ok(consumed);

  const replay = await consumeCliHandoff({
    state: 'aaaabbbbccccddddeeeeffff11112222',
    port: 43125,
    handoff: 'proof_handoff_token',
    proof: registration.proof,
  });
  assert.equal(replay, null);

  delete process.env['OPTA_CLI_HANDOFF_SECRET'];
});

test('strict durable replay mode rejects handoff consume without service credentials', async () => {
  process.env['OPTA_CLI_REQUIRE_DURABLE_REPLAY'] = '1';

  registerCliHandoff({
    state: 'bbbbccccddddeeeeffff111122223333',
    port: 43126,
    handoff: 'strict_handoff_token',
  });

  await assert.rejects(
    () =>
      consumeCliHandoff({
        state: 'bbbbccccddddeeeeffff111122223333',
        port: 43126,
        handoff: 'strict_handoff_token',
      }),
    /Durable replay store is required/,
  );
});

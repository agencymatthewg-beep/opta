import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBearerToken } from '../lib/supabase/auth-header.ts';

test('parseBearerToken parses a valid bearer header', () => {
  assert.equal(parseBearerToken('Bearer abc.def.ghi'), 'abc.def.ghi');
});

test('parseBearerToken is case-insensitive and trims spaces', () => {
  assert.equal(parseBearerToken('bearer    token-123   '), 'token-123');
});

test('parseBearerToken returns null for missing or malformed headers', () => {
  assert.equal(parseBearerToken(null), null);
  assert.equal(parseBearerToken(undefined), null);
  assert.equal(parseBearerToken(''), null);
  assert.equal(parseBearerToken('Basic Zm9vOmJhcg=='), null);
  assert.equal(parseBearerToken('Bearer     '), null);
});

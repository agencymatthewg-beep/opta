import test from "node:test";
import assert from "node:assert/strict";
import {
  isUuid,
  parseProvider,
  parseTrustState,
  parseString,
} from "../lib/api/policy.ts";

test("parseTrustState only allows supported states", () => {
  assert.equal(parseTrustState("trusted"), "trusted");
  assert.equal(parseTrustState("revoked"), "revoked");
  assert.equal(parseTrustState("unknown"), null);
});

test("parseProvider only allows configured providers", () => {
  assert.equal(parseProvider("openai"), "openai");
  assert.equal(parseProvider("not-a-provider"), null);
});

test("isUuid validates canonical UUID format", () => {
  assert.equal(isUuid("550e8400-e29b-41d4-a716-446655440000"), true);
  assert.equal(isUuid("550e8400e29b41d4a716446655440000"), false);
});

test("parseString trims and enforces max length", () => {
  assert.equal(parseString("  hello  "), "hello");
  assert.equal(parseString(""), null);
  assert.equal(parseString("a".repeat(161)), null);
});

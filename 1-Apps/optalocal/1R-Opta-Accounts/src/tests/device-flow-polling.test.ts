import test from "node:test";
import assert from "node:assert/strict";

import { resolveDevicePollOutcome } from "../components/providers/deviceFlowPolling.ts";

test("resolveDevicePollOutcome preserves success and retry states", () => {
  assert.deepEqual(resolveDevicePollOutcome("authorized"), {
    kind: "authorized",
  });
  assert.deepEqual(resolveDevicePollOutcome("pending"), {
    kind: "pending",
  });
  assert.deepEqual(resolveDevicePollOutcome("expired"), {
    kind: "expired",
  });
  assert.deepEqual(resolveDevicePollOutcome("denied"), {
    kind: "denied",
  });
});

test("resolveDevicePollOutcome falls back to a stable error message", () => {
  assert.deepEqual(resolveDevicePollOutcome(undefined, "bad gateway"), {
    kind: "error",
    message: "bad gateway",
  });
  assert.deepEqual(resolveDevicePollOutcome(undefined), {
    kind: "error",
    message: "Unknown error from poll",
  });
});

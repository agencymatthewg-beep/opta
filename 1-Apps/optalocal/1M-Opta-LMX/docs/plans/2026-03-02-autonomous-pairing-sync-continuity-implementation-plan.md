# Autonomous Pairing, Sync, and Continuity Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make Opta LMX, Opta CLI, and Opta Code pair and stay connected automatically (discovery, failover, resume, and recovery) with no mandatory manual terminal commands for normal local usage.

**Architecture:** Use LMX as the discovery source of truth, CLI as the endpoint resolver/orchestrator, and Opta Code as an auto-bootstrap daemon client. Standardize one discovery contract, one endpoint scoring strategy, and one continuity model (event cursor + replay) across all clients. Keep backward compatibility by introducing additive schema fields and route aliases.

**Tech Stack:** Python (FastAPI, pytest), TypeScript (Node 20, Vitest), Rust (Tauri commands), shared daemon SDK (`@opta/daemon-client`).

**Skill refs:** `@opta-project` `@test-driven-development` `@verification-before-completion` `@subagent-driven-development`

---

### Task 1: Lock LMX Discovery Contract v2 (Source of Truth)

**Files:**
- Modify: `src/opta_lmx/discovery.py`
- Modify: `src/opta_lmx/api/health.py`
- Modify: `tests/test_health.py`
- Create: `tests/test_discovery_contract.py`

**Step 1: Write failing tests for additive discovery fields**

```python
async def test_discovery_contract_v2_fields(client: AsyncClient) -> None:
    res = await client.get("/.well-known/opta-lmx")
    data = res.json()
    assert data["schema_version"] == "2026-03-02"
    assert "instance_id" in data
    assert "continuity" in data
    assert data["continuity"]["event_resume_supported"] is True
```

**Step 2: Run test to verify it fails**

Run: `pytest tests/test_discovery_contract.py::test_discovery_contract_v2_fields -q`
Expected: `FAIL` with missing keys (`schema_version`, `continuity`).

**Step 3: Write minimal implementation**

```python
return {
    ...,
    "schema_version": "2026-03-02",
    "instance_id": f"{socket.gethostname()}:{config.server.port}",
    "continuity": {
        "event_resume_supported": True,
        "session_log_api": "/admin/sessions",
    },
}
```

**Step 4: Run tests to verify pass**

Run: `pytest tests/test_health.py::TestDiscovery tests/test_discovery_contract.py -q`
Expected: all targeted discovery tests `PASS`.

**Step 5: Commit**

```bash
git add src/opta_lmx/discovery.py src/opta_lmx/api/health.py tests/test_health.py tests/test_discovery_contract.py
git commit -m "feat(lmx): add discovery contract v2 metadata for pairing and continuity"
```

### Task 2: Add LMX mDNS Advertisement (So CLI Discovery Is Fast and Deterministic)

**Files:**
- Create: `src/opta_lmx/discovery_mdns.py`
- Modify: `src/opta_lmx/config.py`
- Modify: `src/opta_lmx/main.py`
- Modify: `pyproject.toml`
- Create: `tests/test_discovery_mdns.py`

**Step 1: Write failing lifecycle test**

```python
def test_mdns_advertiser_starts_when_enabled(monkeypatch):
    started = {"value": False}
    class FakeAdvertiser:
        def start(self): started["value"] = True
        def stop(self): pass
    monkeypatch.setattr("opta_lmx.discovery_mdns.MdnsAdvertiser", FakeAdvertiser)
    # assert startup path calls start() when config.discovery.mdns_enabled
    assert started["value"] is True
```

**Step 2: Run test to verify fail**

Run: `pytest tests/test_discovery_mdns.py::test_mdns_advertiser_starts_when_enabled -q`
Expected: `FAIL` (module/config/lifecycle hooks not present yet).

**Step 3: Write minimal implementation**

```python
class DiscoveryConfig(BaseModel):
    mdns_enabled: bool = True
    mdns_service_name: str = "_opta-lmx._tcp.local"

# lifespan
if config.discovery.mdns_enabled:
    advertiser = MdnsAdvertiser(host=config.server.host, port=config.server.port)
    advertiser.start()
```

**Step 4: Run tests**

Run: `pytest tests/test_discovery_mdns.py tests/test_health.py::TestDiscovery -q`
Expected: `PASS` and no regression on health/discovery endpoints.

**Step 5: Commit**

```bash
git add src/opta_lmx/discovery_mdns.py src/opta_lmx/config.py src/opta_lmx/main.py pyproject.toml tests/test_discovery_mdns.py
git commit -m "feat(lmx): advertise discovery over mDNS for zero-config pairing"
```

### Task 3: Make CLI Discovery Consumer Honor LMX Contract and Probe Order

**Files:**
- Modify: `../1D-Opta-CLI-TS/src/lmx/types.ts`
- Modify: `../1D-Opta-CLI-TS/src/lmx/connection.ts`
- Modify: `../1D-Opta-CLI-TS/tests/lmx/connection.test.ts`

**Step 1: Write failing tests for multi-endpoint discovery fallback**

```ts
it("falls back to /v1/discovery when /.well-known/opta-lmx is absent", async () => {
  // mock 404 on well-known, 200 on /v1/discovery
  // expect result.discovery to be defined
});
```

**Step 2: Run test to verify fail**

Run: `cd ../1D-Opta-CLI-TS && npm run test:run -- tests/lmx/connection.test.ts`
Expected: `FAIL` for new fallback expectation.

**Step 3: Write minimal implementation**

```ts
async function fetchLmxDiscovery(host: string, port: number, timeoutMs: number) {
  for (const path of ["/.well-known/opta-lmx", "/v1/discovery"]) {
    const res = await fetch(`http://${host}:${port}${path}`, { signal: AbortSignal.timeout(timeoutMs) });
    if (res.ok) return (await res.json()) as LmxDiscoveryDoc;
  }
  return null;
}
```

**Step 4: Run tests**

Run: `cd ../1D-Opta-CLI-TS && npm run test:run -- tests/lmx/connection.test.ts tests/lmx/endpoints.test.ts`
Expected: both suites `PASS`.

**Step 5: Commit**

```bash
cd ../1D-Opta-CLI-TS
git add src/lmx/types.ts src/lmx/connection.ts tests/lmx/connection.test.ts
git commit -m "feat(cli): consume LMX discovery via well-known and v1 fallback"
```

### Task 4: Add CLI Endpoint Profile Scoring and Auto-Promotion

**Files:**
- Create: `../1D-Opta-CLI-TS/src/lmx/endpoint-profile.ts`
- Modify: `../1D-Opta-CLI-TS/src/lmx/endpoints.ts`
- Modify: `../1D-Opta-CLI-TS/src/lmx/client.ts`
- Create: `../1D-Opta-CLI-TS/tests/lmx/endpoint-profile.test.ts`
- Modify: `../1D-Opta-CLI-TS/tests/lmx/endpoints.test.ts`

**Step 1: Write failing scoring tests**

```ts
it("prefers host with recent successful probes", async () => {
  // seed profile with success score on fallback host
  // expect resolver returns scored host first
});
```

**Step 2: Run tests to fail**

Run: `cd ../1D-Opta-CLI-TS && npm run test:run -- tests/lmx/endpoint-profile.test.ts`
Expected: `FAIL` (new module not implemented).

**Step 3: Implement minimal profile store + resolver integration**

```ts
export interface EndpointScore { host: string; success: number; failure: number; lastSeenAt: string }
// load/save at ~/.config/opta/lmx-endpoints.json
// on success: success += 1; on failure: failure += 1
```

**Step 4: Run tests**

Run: `cd ../1D-Opta-CLI-TS && npm run test:run -- tests/lmx/endpoint-profile.test.ts tests/lmx/endpoints.test.ts`
Expected: `PASS` and resolver still honors primary grace window behavior.

**Step 5: Commit**

```bash
cd ../1D-Opta-CLI-TS
git add src/lmx/endpoint-profile.ts src/lmx/endpoints.ts src/lmx/client.ts tests/lmx/endpoint-profile.test.ts tests/lmx/endpoints.test.ts
git commit -m "feat(cli): add endpoint scoring for autonomous host failover and promotion"
```

### Task 5: Remove CLI Manual-Command Failure Paths in Provider Probe

**Files:**
- Modify: `../1D-Opta-CLI-TS/src/providers/manager.ts`
- Modify: `../1D-Opta-CLI-TS/src/commands/onboard.ts`
- Modify: `../1D-Opta-CLI-TS/tests/providers/manager.test.ts`
- Create: `../1D-Opta-CLI-TS/tests/commands/onboard-autodiscovery.test.ts`

**Step 1: Write failing UX regression tests**

```ts
it("does not return command-only remediation when daemon/lmx unreachable", async () => {
  // expect structured remediation object or onboarding trigger flag
});
```

**Step 2: Run tests to fail**

Run: `cd ../1D-Opta-CLI-TS && npm run test:run -- tests/providers/manager.test.ts tests/commands/onboard-autodiscovery.test.ts`
Expected: `FAIL` for new no-manual-command assertions.

**Step 3: Implement minimal behavior**

```ts
throw new Error(JSON.stringify({
  code: "lmx_unreachable",
  autoActions: ["discover_hosts", "try_fallback", "launch_onboarding"],
  humanHint: "Run opta onboard to repair connection automatically.",
}));
```

**Step 4: Run tests**

Run: `cd ../1D-Opta-CLI-TS && npm run test:run -- tests/providers/manager.test.ts tests/commands/onboard-autodiscovery.test.ts`
Expected: `PASS`.

**Step 5: Commit**

```bash
cd ../1D-Opta-CLI-TS
git add src/providers/manager.ts src/commands/onboard.ts tests/providers/manager.test.ts tests/commands/onboard-autodiscovery.test.ts
git commit -m "feat(cli): replace manual-only provider remediation with autonomous recovery flow"
```

### Task 6: Expose LMX Discovery via Daemon + Shared SDK

**Files:**
- Modify: `../1D-Opta-CLI-TS/src/daemon/http-server.ts`
- Modify: `../1D-Opta-CLI-TS/packages/daemon-client/src/types.ts`
- Modify: `../1D-Opta-CLI-TS/packages/daemon-client/src/http-client.ts`
- Modify: `../1D-Opta-CLI-TS/tests/daemon/http-server.test.ts`

**Step 1: Add failing contract test**

```ts
it("serves /v3/lmx/discovery", async () => {
  // authenticated request should proxy discovery doc from LMX
});
```

**Step 2: Run test to fail**

Run: `cd ../1D-Opta-CLI-TS && npm run test:run -- tests/daemon/http-server.test.ts`
Expected: `FAIL` with route not found.

**Step 3: Implement route and SDK method**

```ts
app.get('/v3/lmx/discovery', async (req, reply) => {
  // authorize
  // lmx.fetch('/.well-known/opta-lmx') fallback '/v1/discovery'
});
```

**Step 4: Run tests**

Run: `cd ../1D-Opta-CLI-TS && npm run test:run -- tests/daemon/http-server.test.ts`
Expected: `PASS`.

**Step 5: Commit**

```bash
cd ../1D-Opta-CLI-TS
git add src/daemon/http-server.ts packages/daemon-client/src/types.ts packages/daemon-client/src/http-client.ts tests/daemon/http-server.test.ts
git commit -m "feat(daemon-sdk): add authenticated lmx discovery route for app clients"
```

### Task 7: Make Opta Code Setup Wizard Discovery-First (No Hardcoded IP)

**Files:**
- Modify: `../1P-Opta-Code-Universal/src/components/setup/shared.ts`
- Modify: `../1P-Opta-Code-Universal/src/components/setup/StepConnection.tsx`
- Modify: `../1P-Opta-Code-Universal/src/components/SetupWizard.test.tsx`
- Modify: `../1P-Opta-Code-Universal/src/lib/daemonClient.ts`

**Step 1: Write failing wizard test**

```tsx
it("prefills connection using daemon lmx discovery instead of static 192.168.x.x", async () => {
  // mock lmxDiscovery response and assert rendered host:port
});
```

**Step 2: Run test to fail**

Run: `cd ../1P-Opta-Code-Universal && npm run test:run -- src/components/SetupWizard.test.tsx`
Expected: `FAIL` because static default host is still used.

**Step 3: Implement minimal discovery prefill**

```ts
const meta = await bootstrapDaemonConnection(true);
const doc = await daemonClient.lmxDiscovery({ host: meta.host, port: meta.port, token });
setForm((prev) => ({ ...prev, lmxHost: new URL(doc.endpoints.preferred_base_url).hostname }));
```

**Step 4: Run tests**

Run: `cd ../1P-Opta-Code-Universal && npm run test:run -- src/components/SetupWizard.test.tsx`
Expected: `PASS`.

**Step 5: Commit**

```bash
cd ../1P-Opta-Code-Universal
git add src/components/setup/shared.ts src/components/setup/StepConnection.tsx src/components/SetupWizard.test.tsx src/lib/daemonClient.ts
git commit -m "feat(code): discovery-first setup wizard with daemon-backed lmx prefill"
```

### Task 8: Remove Manual `opta daemon start` UX Dependency in Opta Code

**Files:**
- Modify: `../1P-Opta-Code-Universal/src/pages/OnboardingPage.tsx`
- Modify: `../1P-Opta-Code-Universal/src/App.tsx`
- Modify: `../1P-Opta-Code-Universal/src/hooks/useDaemonSessions.ts`
- Modify: `../1P-Opta-Code-Universal/src/App.test.tsx`

**Step 1: Write failing UX test**

```tsx
it("shows auto-repair action instead of command-only daemon instructions", async () => {
  // disconnected state should render "Repair now" action
  // should not require literal "opta daemon start" guidance
});
```

**Step 2: Run tests to fail**

Run: `cd ../1P-Opta-Code-Universal && npm run test:run -- src/App.test.tsx`
Expected: `FAIL` (current copy includes command instructions).

**Step 3: Implement auto-repair entry points**

```ts
// useDaemonSessions
await bootstrapDaemonConnection(true);
await refreshNow();

// App.tsx / OnboardingPage.tsx
<button onClick={() => void refreshNow()}>Repair daemon connection</button>
```

**Step 4: Run tests**

Run: `cd ../1P-Opta-Code-Universal && npm run test:run -- src/App.test.tsx`
Expected: `PASS`.

**Step 5: Commit**

```bash
cd ../1P-Opta-Code-Universal
git add src/pages/OnboardingPage.tsx src/App.tsx src/hooks/useDaemonSessions.ts src/App.test.tsx
git commit -m "feat(code): auto-repair daemon connectivity without mandatory manual commands"
```

### Task 9: Harden Session Continuity (Cursor Resume + Gap Recovery)

**Files:**
- Modify: `../1P-Opta-Code-Universal/src/hooks/useDaemonSessions.ts`
- Modify: `../1P-Opta-Code-Universal/src/hooks/daemonSessions/useSessionSockets.ts`
- Modify: `../1P-Opta-Code-Universal/src/hooks/useDaemonSessions.test.tsx`

**Step 1: Write failing continuity tests**

```tsx
it("resumes websocket from max persisted seq after restart", async () => {
  // load_session_events returns seq 40
  // connectWebSocket should be called with afterSeq=40
});
```

**Step 2: Run tests to fail**

Run: `cd ../1P-Opta-Code-Universal && npm run test:run -- src/hooks/useDaemonSessions.test.tsx`
Expected: `FAIL` (cursor currently defaults to 0 when tracking).

**Step 3: Implement minimal cursor restore + gap fetch**

```ts
seqCursorRef.current[sessionId] = Math.max(...persistedSeqs);
const gap = await daemonClient.sessionEvents(connection, sessionId, seqCursorRef.current[sessionId]);
```

**Step 4: Run tests**

Run: `cd ../1P-Opta-Code-Universal && npm run test:run -- src/hooks/useDaemonSessions.test.tsx`
Expected: `PASS`.

**Step 5: Commit**

```bash
cd ../1P-Opta-Code-Universal
git add src/hooks/useDaemonSessions.ts src/hooks/daemonSessions/useSessionSockets.ts src/hooks/useDaemonSessions.test.tsx
git commit -m "feat(code): resume session streams from persisted seq cursor with gap recovery"
```

### Task 10: Align LMX Discovery and CLI Types for Backward-Compatible Sync

**Files:**
- Modify: `../1D-Opta-CLI-TS/src/lmx/types.ts`
- Modify: `../1D-Opta-CLI-TS/src/lmx/connection.ts`
- Modify: `../1D-Opta-CLI-TS/tests/lmx/connection.test.ts`
- Modify: `src/opta_lmx/discovery.py`
- Modify: `tests/test_health.py`

**Step 1: Add failing compatibility tests**

```ts
it("accepts both legacy and v2 discovery payloads", async () => {
  // parse without throwing for old/new fields
});
```

**Step 2: Run tests to fail**

Run: `cd ../1D-Opta-CLI-TS && npm run test:run -- tests/lmx/connection.test.ts`
Expected: `FAIL` on strict type assumptions.

**Step 3: Implement tolerant parsing**

```ts
const wsUrl = typeof doc.endpoints?.websocket_url === "string" ? doc.endpoints.websocket_url : undefined;
const schemaVersion = typeof doc.schema_version === "string" ? doc.schema_version : "legacy";
```

**Step 4: Run tests across both repos**

Run: `cd ../1D-Opta-CLI-TS && npm run test:run -- tests/lmx/connection.test.ts`
Expected: `PASS`.

Run: `pytest tests/test_health.py::TestDiscovery -q`
Expected: `PASS`.

**Step 5: Commit**

```bash
# In CLI repo
cd ../1D-Opta-CLI-TS
git add src/lmx/types.ts src/lmx/connection.ts tests/lmx/connection.test.ts
git commit -m "fix(cli): support legacy and v2 discovery schema"

# In LMX repo
cd ../1M-Opta-LMX
git add src/opta_lmx/discovery.py tests/test_health.py
git commit -m "chore(lmx): keep discovery contract backward compatible"
```

### Task 11: Add Cross-Repo Pairing + Continuity Smoke Gate

**Files:**
- Create: `../1D-Opta-CLI-TS/scripts/smoke/autopair-continuity.mjs`
- Modify: `../1D-Opta-CLI-TS/package.json`
- Create: `../1P-Opta-Code-Universal/src/test/autopair-continuity.test.ts`

**Step 1: Write failing smoke test harness**

```ts
it("discovers lmx, connects daemon, resumes session stream after reconnect", async () => {
  // orchestrate: discover -> connect -> emit events -> reconnect -> assert continuity
});
```

**Step 2: Run and confirm fail**

Run: `cd ../1D-Opta-CLI-TS && node scripts/smoke/autopair-continuity.mjs`
Expected: non-zero exit until all plumbing is complete.

**Step 3: Implement harness**

```ts
// 1) call discoverLmxHosts
// 2) call /v3/lmx/discovery through daemon client
// 3) open ws with afterSeq cursor
// 4) assert no event gaps
```

**Step 4: Run smoke + targeted suites**

Run: `cd ../1D-Opta-CLI-TS && node scripts/smoke/autopair-continuity.mjs`
Expected: `PASS: autopair continuity`.

Run: `cd ../1P-Opta-Code-Universal && npm run test:run -- src/hooks/useDaemonSessions.test.tsx src/App.test.tsx`
Expected: `PASS`.

**Step 5: Commit**

```bash
cd ../1D-Opta-CLI-TS
git add scripts/smoke/autopair-continuity.mjs package.json
git commit -m "test(cli): add autopair-continuity smoke gate"

cd ../1P-Opta-Code-Universal
git add src/test/autopair-continuity.test.ts
git commit -m "test(code): add continuity integration assertions"
```

### Task 12: Rollout, Metrics, and Operator Documentation

**Files:**
- Create: `docs/DAEMON-LMX-AUTOPAIRMETRICS.md`
- Modify: `../1D-Opta-CLI-TS/docs/OPERATOR-RUNBOOK.md`
- Modify: `../1P-Opta-Code-Universal/src/pages/OnboardingPage.tsx`

**Step 1: Add failing doc/test gate (if docs lint exists) or checklist file**

```md
- pairing_success_rate_5m >= 99%
- reconnect_p95_seconds <= 8
- continuity_gap_count == 0 in smoke run
```

**Step 2: Run docs/quality check**

Run: `cd ../1D-Opta-CLI-TS && npm run quality:gate`
Expected: if unrelated failures exist, capture and isolate; pairing docs change itself should be clean.

**Step 3: Implement rollout controls**

```md
1. Enable discovery v2 in canary environment.
2. Enable code auto-repair UX for local endpoints only.
3. Expand to remote endpoints after smoke gate is stable for 72h.
```

**Step 4: Verify end-to-end one-command local launch UX**

Run: local scripted check that opens Opta Code with no pre-started daemon and confirms automatic bootstrap + connected state.
Expected: user reaches connected workspace without typing `opta daemon start` manually.

**Step 5: Commit**

```bash
git add docs/DAEMON-LMX-AUTOPAIRMETRICS.md ../1D-Opta-CLI-TS/docs/OPERATOR-RUNBOOK.md ../1P-Opta-Code-Universal/src/pages/OnboardingPage.tsx
git commit -m "docs: define autonomous pairing rollout and SLO gates"
```

---

## Global Verification Sequence (Run Before Declaring Complete)

1. `cd ../1M-Opta-LMX && pytest tests/test_health.py tests/test_discovery_contract.py tests/test_discovery_mdns.py -q`
2. `cd ../1D-Opta-CLI-TS && npm run test:run -- tests/lmx/connection.test.ts tests/lmx/endpoints.test.ts tests/providers/manager.test.ts tests/daemon/http-server.test.ts`
3. `cd ../1P-Opta-Code-Universal && npm run test:run -- src/components/SetupWizard.test.tsx src/hooks/useDaemonSessions.test.tsx src/App.test.tsx`
4. `cd ../1D-Opta-CLI-TS && node scripts/smoke/autopair-continuity.mjs`

Expected final outcome:
- LMX is discoverable via well-known + v1 + mDNS.
- CLI auto-selects/reorders best endpoint without manual config edits.
- Opta Code auto-bootstraps daemon and self-repairs auth/connectivity.
- Session streams resume without duplicated or missing events after reconnect.


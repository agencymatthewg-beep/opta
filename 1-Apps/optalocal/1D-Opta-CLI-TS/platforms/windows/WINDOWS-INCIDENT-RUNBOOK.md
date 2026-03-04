# Opta CLI Windows Incident Runbook

Purpose: fast triage for Windows users blocked on startup/connectivity issues.

Primary incidents covered:
- `No model configured` startup failure.
- Windows assertion crash involving `UV_HANDLE_CLOSING`.
- OpenClaw gateway timeout (`ETIMEDOUT`).

## 1. Fast Triage (2 minutes)

Run these first in PowerShell:

```powershell
opta --version
opta doctor
opta status --full
```

Capture the full output before changing config.

If startup text references `/load <model-id>` instead of `opta models load <model-id>`, you are likely on an older CLI build. Upgrade before deeper debugging.

## 2. Incident A: `No model configured`

Symptom:
- `No model configured ...`

Interpretation:
- No loaded local model and no cloud fallback key.

Preferred Windows path (cloud-first):

```powershell
opta config set provider.active anthropic
$env:ANTHROPIC_API_KEY = "YOUR_KEY"
opta chat
```

If using a persistent shell profile, set `ANTHROPIC_API_KEY` there instead of per-session.

Remote LMX path (if your team runs LMX on another host):

```powershell
opta config set connection.host <lmx-host-or-ip>
opta config set connection.port 1234
opta chat
```

## 3. Incident B: Assertion `UV_HANDLE_CLOSING` on startup

Symptom:
- Assertion failure mentioning `src\win\async.c` and `UV_HANDLE_CLOSING`.

Interpretation:
- Historically associated with overlapping close paths in discovery; fixed in current CLI source.

Actions:
1. Upgrade to the latest CLI build containing the discovery idempotent-close fix.
2. Re-run:

```powershell
opta doctor
opta
```

Temporary mitigation (if upgrade is blocked):

```powershell
opta config set connection.autoDiscover false
opta config set connection.host <known-lmx-host-or-localhost>
opta config set connection.port 1234
```

## 4. Incident C: OpenClaw gateway timeout (`ETIMEDOUT`)

Symptom:
- `node host gateway connect failed: connect ETIMEDOUT <ip>:<port>`

Interpretation:
- Network reachability/auth or wrong endpoint; not usually an LMX API contract failure.

Check reachability from the affected Windows host:

```powershell
Test-NetConnection -ComputerName <gateway-ip-or-host> -Port <gateway-port>
```

If this fails, check:
- Gateway host is online and listening on expected port.
- Firewall/NAT rules allow that source network.
- Correct port is configured (OpenClaw defaults may differ from local custom config).

If TCP is reachable but handshake still fails:
- Validate pairing token/device auth.
- Validate gateway TLS mode (`ws://` vs `wss://`) and certificate trust.
- Confirm no stale host/port override in local config.

## 5. Escalation Bundle

When escalating, include:
- `opta --version`
- `opta doctor` output
- `opta status --full` output
- Full PowerShell error text
- Output of `Test-NetConnection` for gateway host/port (if OpenClaw-related)
- Date/time + timezone of failure and target host/IP


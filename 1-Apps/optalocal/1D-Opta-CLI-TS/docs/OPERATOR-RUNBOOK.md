---
title: Opta Daemon Operator Runbook
purpose: Start, monitor, and recover the opta daemon in production
updated: 2026-02-28
audience: Matthew, bots deploying the daemon
---

# Opta Daemon — Operator Runbook

The daemon (`opta daemon start`) is the persistent background server that manages agent sessions, streams tokens over WebSocket, and coordinates tool permissions across clients. This runbook covers every operational task from first start to incident recovery.

---

## Quick Reference

```bash
opta daemon start       # Start daemon (background, port 9999)
opta daemon status      # Print pid, port, uptime, session count
opta daemon logs        # Tail daemon log (Ctrl+C to exit)
opta daemon stop        # Graceful shutdown
opta daemon restart     # Stop + start
```

---

## 1. Prerequisites

| Requirement | Check | Notes |
|-------------|-------|-------|
| Node.js ≥ 20 | `node --version` | ESM mode requires 20+ |
| Built dist/ | `ls dist/index.js` | Run `npm run build` first |
| Port 9999 free | `lsof -i :9999` | Daemon binds `127.0.0.1:9999` |
| `~/.config/opta/` | exists automatically on first start | |

---

## 2. Starting the Daemon

### Standard start

```bash
opta daemon start
```

Starts the daemon in the background and prints the PID. State is written to `~/.config/opta/daemon/state.json`.

### Verify it's running

```bash
opta daemon status
```

Expected output:
```
daemon  running   pid=12345   port=9999   sessions=0   uptime=3s
```

Or verify with a direct health probe:
```bash
curl -s http://127.0.0.1:9999/v3/health | jq .
```

Expected:
```json
{
  "status": "ok",
  "version": "0.5.0",
  "daemonId": "daemon_xxxxxxxx",
  "runtime": { ... }
}
```

### Start via npm (development)

```bash
npm run dev -- daemon start
```

Uses `tsx` watch mode — useful when iterating on daemon source.

---

## 3. Authentication

Every client request requires the daemon bearer token.

**Token location:** `~/.config/opta/daemon/state.json` → `token` field.

```bash
# Read token
jq -r .token ~/.config/opta/daemon/state.json
```

**HTTP requests:**
```bash
TOKEN=$(jq -r .token ~/.config/opta/daemon/state.json)
curl -H "Authorization: Bearer $TOKEN" http://127.0.0.1:9999/v3/health
```

**WebSocket connect:**
```
ws://127.0.0.1:9999/v3/ws?sessionId=<sid>&afterSeq=0&token=<TOKEN>
```

Token is stable for the lifetime of a daemon process. It rotates on restart.

---

## 4. Monitoring

### Runtime metrics

```bash
TOKEN=$(jq -r .token ~/.config/opta/daemon/state.json)
curl -s -H "Authorization: Bearer $TOKEN" http://127.0.0.1:9999/v3/metrics | jq .
```

Key fields:
| Field | Meaning |
|-------|---------|
| `runtime.sessionCount` | Total sessions (including idle) |
| `runtime.activeTurnCount` | Turns currently streaming |
| `runtime.queuedTurnCount` | Turns waiting to execute |
| `runtime.subscriberCount` | Active WebSocket clients |

### Live log tail

```bash
opta daemon logs
```

Follows the daemon log file. Press Ctrl+C to stop following without stopping the daemon.

### Check sessions

```bash
TOKEN=$(jq -r .token ~/.config/opta/daemon/state.json)
curl -s -H "Authorization: Bearer $TOKEN" http://127.0.0.1:9999/v3/sessions | jq '[.[] | {id, title, turnCount}]'
```

---

## 5. Stopping and Restarting

### Graceful stop

```bash
opta daemon stop
```

Sends SIGTERM. The daemon finishes in-flight turns, closes WebSocket clients, and exits. Typically completes within 2–5 seconds.

### Force kill (if graceful stop hangs)

```bash
kill $(jq -r .pid ~/.config/opta/daemon/state.json)
```

Or kill by port:
```bash
lsof -ti :9999 | xargs kill
```

### Restart

```bash
opta daemon restart
```

Equivalent to `stop` then `start`. Token rotates — connected clients will receive 401 and must reconnect.

---

## 6. Contract Mismatch

If `opta chat` reports a contract version mismatch:

```
Error: Daemon contract mismatch — expected opta-daemon-v3@1, got opta-daemon-v3@0
```

**Resolution:**
1. Stop the running daemon: `opta daemon stop`
2. Rebuild the CLI: `npm run build`
3. Restart: `opta daemon start`
4. Verify: `curl http://127.0.0.1:9999/v3/health | jq .contract`

The daemon embeds its contract version from the build. Mismatches always indicate the running daemon was built from a different code version than the CLI.

---

## 7. Common Failure Modes

### Daemon exits immediately

**Symptoms:** `opta daemon status` shows `stopped` seconds after `start`.

**Check:**
```bash
opta daemon logs
# Look for: "port already in use" or module import errors
```

**Fix:**
```bash
lsof -i :9999   # Find who owns the port
kill <pid>      # Free the port
opta daemon start
```

### WebSocket clients drop every turn

**Symptoms:** CLI shows "Connection interrupted, reconnecting..." on every model turn.

**Root cause:** LMX WebSocket endpoint unreachable (LMX server down or LAN unavailable).

**Fix:**
```bash
# Check LMX health
curl http://192.168.188.11:1234/healthz

# If LMX is down, Opta falls back to SSE — this is expected behavior.
# The lmxWsUnavailable flag suppresses reconnect noise after turn 1.
# No daemon restart needed.
```

### Permission requests hang (no prompt appears)

**Symptoms:** Tool call waits indefinitely, no prompt in TUI.

**Root cause:** Permission coordinator received duplicate resolve attempts or timeout misconfiguration.

**Fix:**
```bash
# Cancel the stuck turn
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}' \
  http://127.0.0.1:9999/v3/sessions/<sessionId>/cancel
```

### State file corrupt

**Symptoms:** `opta daemon status` crashes with JSON parse error.

**Fix:**
```bash
rm ~/.config/opta/daemon/state.json
opta daemon start   # Creates fresh state
```

---

## 8. Session Operations

### List all sessions

```bash
TOKEN=$(jq -r .token ~/.config/opta/daemon/state.json)
curl -s -H "Authorization: Bearer $TOKEN" http://127.0.0.1:9999/v3/sessions
```

### Create a session

```bash
curl -s -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title": "My session", "metadata": {"workspace": "/path/to/project"}}' \
  http://127.0.0.1:9999/v3/sessions
```

### Cancel an active turn

```bash
curl -s -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}' \
  http://127.0.0.1:9999/v3/sessions/<sessionId>/cancel
```

### Resolve a permission request

```bash
curl -s -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"decision": "allow", "remember": false}' \
  http://127.0.0.1:9999/v3/sessions/<sessionId>/permission-requests/<requestId>/resolve
```

---

## 9. Event Streaming (WebSocket Reconnect)

When reconnecting after a disconnect, pass `afterSeq` to avoid re-receiving old events:

```
ws://127.0.0.1:9999/v3/ws?sessionId=<sid>&afterSeq=<lastSeq>&token=<token>
```

The daemon buffers events in memory for active sessions. Events are delivered in sequence order. Cursor `afterSeq` is exclusive — you receive all events with `seq > afterSeq`.

**Stop events** (signals end of a turn):
- `turn.done` — model finished normally
- `turn.error` — model returned an error
- `session.cancelled` — turn was cancelled

---

## 10. Configuration Defaults

| Setting | Default | Override |
|---------|---------|---------|
| Host | `127.0.0.1` | `OPTA_DAEMON_HOST` |
| Port | `9999` | `OPTA_DAEMON_PORT` |
| Max sessions | `10` | `opta config set daemon.maxSessions N` |
| Worker pool size | `4` | `opta config set daemon.workerPoolSize N` |
| Permission timeout | `30s` | `opta config set daemon.permissionTimeoutMs N` |

---

## 11. Startup Verification Checklist

Run this after any system restart or daemon update:

```bash
# 1. Check daemon is running
opta daemon status

# 2. Health check
curl -s http://127.0.0.1:9999/v3/health | jq '{status, version}'

# 3. Verify contract version
TOKEN=$(jq -r .token ~/.config/opta/daemon/state.json)
curl -s -H "Authorization: Bearer $TOKEN" http://127.0.0.1:9999/v3/health | jq .contract

# 4. Metrics baseline
curl -s -H "Authorization: Bearer $TOKEN" http://127.0.0.1:9999/v3/metrics | jq .runtime

# 5. Smoke test: chat route
opta do "say hello"
```

Expected: All steps succeed, `opta do` completes without reconnect errors.

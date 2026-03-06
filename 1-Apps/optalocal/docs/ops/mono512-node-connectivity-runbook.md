# Mono512 Node Connectivity Runbook (Opta48 ↔ Mono512)

## Purpose
Canonical non-destructive procedure to detect and recover node disconnects between Opta48 (controller) and Mono512 (remote node).

This runbook verifies four signals automatically:
1. Node connected state (`openclaw nodes status --json`)
2. SSH batch auth (key-based, non-interactive)
3. Remote daemon reachability (`openclaw gateway status` on Mono512)
4. LAN reachability to Mono512 gateway port (`nc`)

---

## Quick Check (single command)
From `~/Synced/Opta/1-Apps/optalocal`:

```bash
bash scripts/ops/check-mono512-connectivity.sh
```

### Optional overrides
```bash
MONO_HOST='opta@192.168.188.11' \
MONO_NODE_MATCH='Mono512' \
GATEWAY_PORT=19001 \
bash scripts/ops/check-mono512-connectivity.sh
```

---

## Expected Healthy Output
- `Node connected state: connected`
- `SSH batch auth: success`
- `Daemon reachability ... healthy`
- `LAN port 192.168.188.11:19001 reachable`
- Summary ends with `FAIL=0`

---

## Recovery Procedure (non-destructive)
Run in order:

```bash
# 1) Confirm current node state from Opta48
openclaw nodes status

# 2) Verify key auth still works
ssh -o BatchMode=yes opta@192.168.188.11 'echo ok'

# 3) Verify remote gateway status (PATH-safe for nvm)
ssh opta@192.168.188.11 'export PATH=/Users/opta/.nvm/versions/node/v22.22.0/bin:$PATH; openclaw gateway status'

# 4) If gateway is down/unhealthy, restart gateway only
ssh opta@192.168.188.11 'export PATH=/Users/opta/.nvm/versions/node/v22.22.0/bin:$PATH; openclaw gateway restart && openclaw gateway status'

# 5) If still disconnected, restart node host only
ssh opta@192.168.188.11 'export PATH=/Users/opta/.nvm/versions/node/v22.22.0/bin:$PATH; openclaw node restart || (openclaw node stop; openclaw node start)'

# 6) Re-run quick check
bash scripts/ops/check-mono512-connectivity.sh
```

---

## Rollback Notes
These steps are state-safe and service-scoped.

If a restart worsens state, rollback is:

```bash
# Return to prior steady service state by starting services back up
ssh opta@192.168.188.11 'export PATH=/Users/opta/.nvm/versions/node/v22.22.0/bin:$PATH; openclaw gateway start; openclaw node start'

# Verify
ssh opta@192.168.188.11 'export PATH=/Users/opta/.nvm/versions/node/v22.22.0/bin:$PATH; openclaw gateway status'
openclaw nodes status
```

No files, keys, or pairings are deleted by this runbook.

---

## Canonical Files
- Script: `scripts/ops/check-mono512-connectivity.sh`
- Runbook: `docs/ops/mono512-node-connectivity-runbook.md`

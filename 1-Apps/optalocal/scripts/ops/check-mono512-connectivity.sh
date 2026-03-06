#!/usr/bin/env bash
set -u

# Quick, non-destructive health check between Opta48 and Mono512.
# Checks:
# 1) Node connected state via OpenClaw gateway
# 2) SSH batch auth
# 3) Remote OpenClaw gateway daemon reachability
# 4) LAN port reachability to Mono512 gateway port

MONO_LABEL="${MONO_LABEL:-Mono512}"
MONO_NODE_MATCH="${MONO_NODE_MATCH:-Mono512}"
MONO_HOST="${MONO_HOST:-opta@192.168.188.11}"
MONO_IP="${MONO_IP:-192.168.188.11}"
GATEWAY_PORT="${GATEWAY_PORT:-19001}"
SSH_TIMEOUT="${SSH_TIMEOUT:-5}"
NVM_NODE_BIN="${NVM_NODE_BIN:-/Users/opta/.nvm/versions/node/v22.22.0/bin}"

PASS=0
FAIL=0
WARN=0

say() { printf "%s\n" "$*"; }
pass() { PASS=$((PASS+1)); say "✅ $*"; }
fail() { FAIL=$((FAIL+1)); say "❌ $*"; }
warn() { WARN=$((WARN+1)); say "⚠️  $*"; }

say "=== OptaLocal Mono512 Connectivity Quick Check ==="
say "Target node: ${MONO_LABEL}"
say "SSH target: ${MONO_HOST}"
say "Gateway target: ${MONO_IP}:${GATEWAY_PORT}"
say

# 1) Node connected state (gateway-side truth)
NODES_JSON=""
if NODES_JSON="$(openclaw nodes status --json 2>/dev/null)"; then
  if printf "%s" "$NODES_JSON" | jq -e --arg needle "$MONO_NODE_MATCH" '.nodes[] | select((.displayName // "") | test($needle; "i"))' >/dev/null 2>&1; then
    NODE_CONNECTED="$(printf "%s" "$NODES_JSON" | jq -r --arg needle "$MONO_NODE_MATCH" '.nodes[] | select((.displayName // "") | test($needle; "i")) | .connected' | head -n1)"
    NODE_ID="$(printf "%s" "$NODES_JSON" | jq -r --arg needle "$MONO_NODE_MATCH" '.nodes[] | select((.displayName // "") | test($needle; "i")) | .nodeId' | head -n1)"
    if [ "$NODE_CONNECTED" = "true" ]; then
      pass "Node connected state: connected (nodeId=${NODE_ID})"
    else
      fail "Node connected state: disconnected (nodeId=${NODE_ID})"
    fi
  else
    warn "Node connected state: ${MONO_LABEL} not found in openclaw nodes status"
  fi
else
  fail "Node connected state: unable to query openclaw nodes status"
fi

# 2) SSH batch auth (no prompts)
if ssh -o BatchMode=yes -o ConnectTimeout="$SSH_TIMEOUT" "$MONO_HOST" 'echo ssh-ok' >/tmp/mono512-ssh-check.out 2>/tmp/mono512-ssh-check.err; then
  pass "SSH batch auth: success"
else
  fail "SSH batch auth: failed"
  say "   ↳ stderr: $(tr '\n' ' ' </tmp/mono512-ssh-check.err | sed 's/  */ /g' | cut -c1-220)"
fi

# 3) Remote daemon reachability (on Mono512)
REMOTE_CMD="export PATH=${NVM_NODE_BIN}:\$PATH; openclaw gateway status"
if ssh -o BatchMode=yes -o ConnectTimeout="$SSH_TIMEOUT" "$MONO_HOST" "$REMOTE_CMD" >/tmp/mono512-gateway-status.out 2>/tmp/mono512-gateway-status.err; then
  if rg -q "RPC probe: ok|Runtime: running" /tmp/mono512-gateway-status.out; then
    pass "Daemon reachability (remote openclaw gateway): healthy"
  else
    warn "Daemon reachability: command succeeded but health markers not found"
  fi
else
  fail "Daemon reachability: unable to run remote openclaw gateway status"
  say "   ↳ stderr: $(tr '\n' ' ' </tmp/mono512-gateway-status.err | sed 's/  */ /g' | cut -c1-220)"
fi

# 4) LAN TCP port reachability from Opta48 -> Mono512
if nc -z -G "$SSH_TIMEOUT" "$MONO_IP" "$GATEWAY_PORT" >/dev/null 2>&1; then
  pass "LAN port ${MONO_IP}:${GATEWAY_PORT} reachable"
else
  fail "LAN port ${MONO_IP}:${GATEWAY_PORT} unreachable"
fi

say
say "--- Summary ---"
say "PASS=${PASS} WARN=${WARN} FAIL=${FAIL}"

say
say "--- Remediation (copy/paste, non-destructive) ---"
say "# 1) Check pairing + node state locally"
say "openclaw nodes status"
say
say "# 2) Validate SSH key auth"
say "ssh -o BatchMode=yes ${MONO_HOST} 'echo ok'"
say
say "# 3) Check gateway on Mono512 (PATH-safe)"
say "ssh ${MONO_HOST} 'export PATH=${NVM_NODE_BIN}:\$PATH; openclaw gateway status'"
say
say "# 4) Restart gateway service on Mono512 if down"
say "ssh ${MONO_HOST} 'export PATH=${NVM_NODE_BIN}:\$PATH; openclaw gateway restart && openclaw gateway status'"
say
say "# 5) If node still disconnected, force node host restart on Mono512"
say "ssh ${MONO_HOST} 'export PATH=${NVM_NODE_BIN}:\$PATH; openclaw node restart || (openclaw node stop; openclaw node start)'
"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
exit 0

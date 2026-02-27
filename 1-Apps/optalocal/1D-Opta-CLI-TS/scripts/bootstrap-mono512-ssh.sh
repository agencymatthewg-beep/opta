#!/usr/bin/env bash
set -euo pipefail

# Bootstrap permanent SSH key auth on Mono512 for Opta48 -> Mono512 access.
# Usage:
#   sudo bash scripts/bootstrap-mono512-ssh.sh [target_user]
# Example:
#   sudo bash scripts/bootstrap-mono512-ssh.sh opta

TARGET_USER="${1:-opta}"

if ! id "${TARGET_USER}" >/dev/null 2>&1; then
  echo "ERROR: user '${TARGET_USER}' does not exist on this machine."
  exit 1
fi

TARGET_HOME="$(eval echo "~${TARGET_USER}")"
if [[ -z "${TARGET_HOME}" || ! -d "${TARGET_HOME}" ]]; then
  echo "ERROR: could not resolve home directory for '${TARGET_USER}'."
  exit 1
fi

TARGET_GROUP="$(id -gn "${TARGET_USER}")"
SSH_DIR="${TARGET_HOME}/.ssh"
AUTH_KEYS="${SSH_DIR}/authorized_keys"
SSHD_CONFIG="/etc/ssh/sshd_config"

KEY_1='ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIDjI4PTviGlVTec+2InNOXXTmJMYPZmpsH3F8qEBjJby macbook-to-mac-studio'
KEY_2='ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOSTUDg9BB8UrvTEGYDntnIR7r9gZXiDd91Tn9OgaEmQ matthew@macbook'

PASS_COUNT=0
FAIL_COUNT=0
WARN_COUNT=0

pass() { echo "PASS: $1"; PASS_COUNT=$((PASS_COUNT + 1)); }
warn() { echo "WARN: $1"; WARN_COUNT=$((WARN_COUNT + 1)); }
fail() { echo "FAIL: $1"; FAIL_COUNT=$((FAIL_COUNT + 1)); }

upsert_key() {
  local key="$1"
  if grep -qxF "${key}" "${AUTH_KEYS}" 2>/dev/null; then
    pass "key already present: ${key##* }"
  else
    echo "${key}" >> "${AUTH_KEYS}"
    pass "key added: ${key##* }"
  fi
}

read_config_value() {
  local key_lc="$1"
  local value
  value="$(
    awk -v wanted="${key_lc}" '
      /^[[:space:]]*#/ { next }
      NF < 2 { next }
      {
        k = tolower($1)
        if (k == wanted) {
          $1 = ""
          sub(/^[[:space:]]+/, "", $0)
          print $0
          found = 1
        }
      }
      END {
        if (!found) exit 1
      }
    ' "${SSHD_CONFIG}" 2>/dev/null || true
  )"
  echo "${value}"
}

echo "== SSH Bootstrap =="
echo "Target user: ${TARGET_USER}"
echo "Target home: ${TARGET_HOME}"
echo ""

mkdir -p "${SSH_DIR}"
touch "${AUTH_KEYS}"
chmod 700 "${SSH_DIR}"
chmod 600 "${AUTH_KEYS}"
pass "created/fixed ${SSH_DIR} and ${AUTH_KEYS}"

upsert_key "${KEY_1}"
upsert_key "${KEY_2}"

if [[ "$(id -u)" -eq 0 ]]; then
  chown -R "${TARGET_USER}:${TARGET_GROUP}" "${SSH_DIR}"
  pass "ownership set to ${TARGET_USER}:${TARGET_GROUP} on ${SSH_DIR}"
elif [[ "$(id -un)" == "${TARGET_USER}" ]]; then
  pass "ownership unchanged (running as target user ${TARGET_USER})"
else
  warn "not root and not target user; ownership may be wrong. Run with sudo."
fi

if [[ ! -f "${SSHD_CONFIG}" ]]; then
  warn "${SSHD_CONFIG} not found; skipping sshd config checks"
else
  pubkey_auth="$(read_config_value pubkeyauthentication)"
  auth_keys_file="$(read_config_value authorizedkeysfile)"
  pwd_auth="$(read_config_value passwordauthentication)"
  kbd_auth="$(read_config_value kbdinteractiveauthentication)"
  chal_resp="$(read_config_value challengeresponseauthentication)"

  if [[ -z "${pubkey_auth}" || "${pubkey_auth,,}" == "yes" ]]; then
    pass "PubkeyAuthentication is enabled (or default-enabled)"
  else
    fail "PubkeyAuthentication is '${pubkey_auth}' (expected yes)"
  fi

  if [[ -z "${auth_keys_file}" || "${auth_keys_file}" == *".ssh/authorized_keys"* || "${auth_keys_file}" == *"%h/.ssh/authorized_keys"* ]]; then
    pass "AuthorizedKeysFile includes .ssh/authorized_keys (or default)"
  else
    fail "AuthorizedKeysFile is '${auth_keys_file}' (unexpected)"
  fi

  if [[ -z "${pwd_auth}" ]]; then
    warn "PasswordAuthentication not explicitly set (uses default)"
  else
    pass "PasswordAuthentication is '${pwd_auth}'"
  fi

  if [[ -n "${kbd_auth}" ]]; then
    pass "KbdInteractiveAuthentication is '${kbd_auth}'"
  else
    warn "KbdInteractiveAuthentication not explicitly set"
  fi

  if [[ -n "${chal_resp}" ]]; then
    pass "ChallengeResponseAuthentication is '${chal_resp}'"
  else
    warn "ChallengeResponseAuthentication not explicitly set"
  fi
fi

if command -v pgrep >/dev/null 2>&1 && pgrep -x sshd >/dev/null 2>&1; then
  pass "sshd process is running"
else
  warn "sshd process not detected"
fi

if command -v lsof >/dev/null 2>&1 && lsof -nP -iTCP:22 -sTCP:LISTEN >/dev/null 2>&1; then
  pass "port 22 is listening"
else
  warn "port 22 listener not detected"
fi

echo ""
echo "== Summary =="
echo "PASS=${PASS_COUNT} WARN=${WARN_COUNT} FAIL=${FAIL_COUNT}"

echo ""
echo "Next: from Opta48 run:"
echo "  ssh -o IdentitiesOnly=yes -i ~/.ssh/mac_studio opta@mono512 'whoami && hostname'"
echo "  ssh -o IdentitiesOnly=yes -i ~/.ssh/id_ed25519 opta@mono512 'whoami && hostname'"
echo "  Opta update --dry-run --json"
echo "  Opta update"

if [[ "${FAIL_COUNT}" -gt 0 ]]; then
  exit 2
fi


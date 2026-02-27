#!/usr/bin/env bash
set -euo pipefail

ROOT_APPS_DIR="/Users/matthewbyrden/Synced/Opta/1-Apps"
CLI_DIR="${ROOT_APPS_DIR}/1D-Opta-CLI-TS"
WEB_DIR="${ROOT_APPS_DIR}/1L-Opta-Local/web"

LMX_URL="${OPTA_LMX_URL:-http://127.0.0.1:1234}"
TEST_EMAIL="${E2E_SUPABASE_TEST_EMAIL:-${OPTA_E2E_TEST_EMAIL:-}}"
TEST_PASSWORD="${E2E_SUPABASE_TEST_PASSWORD:-${OPTA_E2E_TEST_PASSWORD:-}}"
SERVICE_ROLE_KEY="${E2E_SUPABASE_SERVICE_ROLE_KEY:-${OPTA_SUPABASE_SERVICE_ROLE_KEY:-}}"

if [[ -z "${OPTA_SUPABASE_URL:-}" ]]; then
  echo "Missing OPTA_SUPABASE_URL"
  exit 2
fi

if [[ -z "${OPTA_SUPABASE_ANON_KEY:-}" ]]; then
  echo "Missing OPTA_SUPABASE_ANON_KEY"
  exit 2
fi

if [[ -z "${TEST_EMAIL}" ]]; then
  echo "Missing E2E_SUPABASE_TEST_EMAIL (or OPTA_E2E_TEST_EMAIL)"
  exit 2
fi

if [[ -z "${TEST_PASSWORD}" ]]; then
  echo "Missing E2E_SUPABASE_TEST_PASSWORD (or OPTA_E2E_TEST_PASSWORD)"
  exit 2
fi

echo "== Opta cross-app auth smoke =="
echo "Supabase project: ${OPTA_SUPABASE_URL}"
echo "LMX URL: ${LMX_URL}"
echo "Fixture user: ${TEST_EMAIL}"

if [[ -n "${SERVICE_ROLE_KEY}" ]]; then
  echo
  echo "-- Ensuring fixture user exists via service role --"
  (
    cd "${WEB_DIR}"
    OPTA_SUPABASE_URL="${OPTA_SUPABASE_URL}" \
    SERVICE_ROLE_KEY="${SERVICE_ROLE_KEY}" \
    TEST_EMAIL="${TEST_EMAIL}" \
    TEST_PASSWORD="${TEST_PASSWORD}" \
    node - <<'NODE'
const { createClient } = require('@supabase/supabase-js');

const url = process.env.OPTA_SUPABASE_URL;
const serviceRole = process.env.SERVICE_ROLE_KEY;
const email = process.env.TEST_EMAIL;
const password = process.env.TEST_PASSWORD;

async function main() {
  const admin = createClient(url, serviceRole, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });

  const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listed.error) {
    throw new Error(`listUsers failed: ${listed.error.message}`);
  }

  const existing = listed.data.users.find(
    (user) => user.email && user.email.toLowerCase() === email.toLowerCase(),
  );

  if (!existing) {
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: 'Opta E2E Fixture' },
    });
    if (created.error) {
      throw new Error(`createUser failed: ${created.error.message}`);
    }
    console.log(`created user ${created.data.user?.id ?? 'unknown-id'}`);
    return;
  }

  const updated = await admin.auth.admin.updateUserById(existing.id, {
    email_confirm: true,
    password,
    user_metadata: { full_name: 'Opta E2E Fixture' },
  });
  if (updated.error) {
    throw new Error(`updateUser failed: ${updated.error.message}`);
  }
  console.log(`updated user ${existing.id}`);
}

main().catch((error) => {
  console.error(error.message || String(error));
  process.exit(1);
});
NODE
  )
else
  echo
  echo "-- No service role key provided; skipping fixture user bootstrap --"
fi

echo
echo "-- CLI login (Supabase password auth) --"
(
  cd "${CLI_DIR}"
  export OPTA_SUPABASE_URL
  export OPTA_SUPABASE_ANON_KEY
  npx tsx src/index.ts account login \
    --identifier "${TEST_EMAIL}" \
    --password "${TEST_PASSWORD}" \
    --json
)

echo
echo "-- Reading access token from CLI account state --"
ACCESS_TOKEN="$(node -e "const fs=require('fs');const p=require('path').join(process.env.HOME,'.config','opta','account.json');const d=JSON.parse(fs.readFileSync(p,'utf8'));process.stdout.write((d.session&&d.session.access_token)||'');")"
if [[ -z "${ACCESS_TOKEN}" ]]; then
  echo "Missing access token in ~/.config/opta/account.json"
  exit 3
fi

echo
echo "-- LMX bearer probe: /v1/models --"
NOAUTH_CODE="$(curl -sS -o /tmp/opta_lmx_models_noauth.json -w "%{http_code}" "${LMX_URL}/v1/models" || true)"
AUTH_CODE="$(curl -sS -o /tmp/opta_lmx_models_auth.json -w "%{http_code}" -H "Authorization: Bearer ${ACCESS_TOKEN}" "${LMX_URL}/v1/models" || true)"
echo "no-auth HTTP=${NOAUTH_CODE}"
echo "bearer  HTTP=${AUTH_CODE}"

if [[ "${AUTH_CODE}" != "200" ]]; then
  echo "LMX bearer request did not return 200."
  cat /tmp/opta_lmx_models_auth.json || true
  exit 4
fi

if [[ "${NOAUTH_CODE}" == "200" ]]; then
  echo "WARN: LMX currently allows unauthenticated /v1/models; bearer acceptance verified, strict JWT enforcement not enabled."
fi

echo
echo "-- Web authenticated devices/pair smoke --"
(
  cd "${WEB_DIR}"
  export NEXT_PUBLIC_SUPABASE_URL="${OPTA_SUPABASE_URL}"
  export NEXT_PUBLIC_SUPABASE_ANON_KEY="${OPTA_SUPABASE_ANON_KEY}"
  export E2E_SUPABASE_TEST_EMAIL="${TEST_EMAIL}"
  export E2E_SUPABASE_TEST_PASSWORD="${TEST_PASSWORD}"
  if [[ -n "${SERVICE_ROLE_KEY}" ]]; then
    export E2E_SUPABASE_SERVICE_ROLE_KEY="${SERVICE_ROLE_KEY}"
  fi
  pnpm exec playwright test tests/e2e/authenticated-devices-pair.spec.ts
)

echo
echo "PASS: cross-app auth smoke completed."

#!/usr/bin/env node

import process from 'node:process';

const OPTIONAL_FLAG = '--optional';
const optional = process.argv.includes(OPTIONAL_FLAG);
const timeoutMs = Number.parseInt(process.env.OPTA_ACCOUNTS_VERIFY_TIMEOUT_MS ?? '8000', 10);

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY;

const CONTROL_PLANE_RELATIONS = [
  'accounts_pairing_sessions',
  'accounts_bridge_tokens',
  'accounts_device_commands',
  'accounts_cli_replay_nonces',
  'accounts_device_command_queue_health',
];

const KEY_READINESS_REQUIRED_RELATIONS = [
  'accounts_devices',
  'accounts_capability_grants',
  'api_keys',
  'credentials',
];

const KEY_READINESS_OPTIONAL_RELATIONS = ['sync_files'];

const REQUIRED_RPCS = ['claim_device_commands_for_delivery', 'cleanup_control_plane_data'];

function log(status, message) {
  const prefix = status.padEnd(5, ' ');
  console.log(`[${prefix}] ${message}`);
}

function printSummary(results) {
  for (const result of results) {
    const label = `${result.category}.${result.name}`;
    if (result.ok) {
      log('PASS', `${label} (${result.detail})`);
    } else if (result.category === 'key_readiness_optional') {
      log('WARN', `${label} (${result.detail})`);
    } else {
      log('FAIL', `${label} (${result.detail})`);
    }
  }
}

async function fetchWithTimeout(url, init) {
  return fetch(url, {
    ...init,
    signal: AbortSignal.timeout(timeoutMs),
  });
}

function normalizeSupabaseBase(url) {
  return url.replace(/\/$/, '');
}

async function checkRelation(base, headers, category, relation) {
  const resourceUrl = `${base}/rest/v1/${relation}?select=*&limit=0`;
  try {
    let response = await fetchWithTimeout(resourceUrl, { method: 'HEAD', headers });

    if (response.status === 405 || response.status === 501) {
      response = await fetchWithTimeout(resourceUrl, { method: 'GET', headers });
    }

    if (response.status === 404) {
      return {
        category,
        name: relation,
        ok: false,
        detail: 'missing (404)',
      };
    }

    const ok = response.status >= 200 && response.status < 300;
    return {
      category,
      name: relation,
      ok,
      detail: `status=${response.status}`,
    };
  } catch (error) {
    return {
      category,
      name: relation,
      ok: false,
      detail: `request_failed:${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

async function checkRpc(base, headers, rpcName) {
  const rpcUrl = `${base}/rest/v1/rpc/${rpcName}`;

  try {
    const response = await fetchWithTimeout(rpcUrl, {
      method: 'OPTIONS',
      headers,
    });

    if (response.status === 404) {
      return {
        category: 'rpc',
        name: rpcName,
        ok: false,
        detail: 'missing (404)',
      };
    }

    const ok = response.status === 200 || response.status === 204 || response.status === 405;
    return {
      category: 'rpc',
      name: rpcName,
      ok,
      detail: `status=${response.status}`,
    };
  } catch (error) {
    return {
      category: 'rpc',
      name: rpcName,
      ok: false,
      detail: `request_failed:${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

async function run() {
  if (!supabaseUrl || !serviceRoleKey) {
    const missing = [
      !supabaseUrl ? 'SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)' : null,
      !serviceRoleKey ? 'SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SERVICE_KEY)' : null,
    ]
      .filter(Boolean)
      .join(', ');

    if (optional) {
      log('SKIP', `schema verification skipped (missing env: ${missing})`);
      process.exit(0);
    }

    log('FAIL', `missing required env: ${missing}`);
    process.exit(1);
  }

  const base = normalizeSupabaseBase(supabaseUrl);
  const headers = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    Prefer: 'count=none',
  };

  const relationChecks = await Promise.all([
    ...CONTROL_PLANE_RELATIONS.map((relation) =>
      checkRelation(base, headers, 'control_plane', relation),
    ),
    ...KEY_READINESS_REQUIRED_RELATIONS.map((relation) =>
      checkRelation(base, headers, 'key_readiness', relation),
    ),
    ...KEY_READINESS_OPTIONAL_RELATIONS.map((relation) =>
      checkRelation(base, headers, 'key_readiness_optional', relation),
    ),
  ]);

  const rpcChecks = await Promise.all(REQUIRED_RPCS.map((rpcName) => checkRpc(base, headers, rpcName)));
  const results = [...relationChecks, ...rpcChecks];

  printSummary(results);

  const failed = results.filter(
    (result) => !result.ok && result.category !== 'key_readiness_optional',
  );

  if (failed.length > 0) {
    log(
      'FAIL',
      `control-plane schema verification failed (${failed.length}/${results.length} checks failed).`,
    );
    process.exit(1);
  }

  log('PASS', `control-plane schema verification passed (${results.length} checks).`);
}

await run();

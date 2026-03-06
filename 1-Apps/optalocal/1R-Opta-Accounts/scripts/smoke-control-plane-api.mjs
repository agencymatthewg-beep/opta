#!/usr/bin/env node

import process from 'node:process';

const OPTIONAL_FLAG = '--optional';
const optional = process.argv.includes(OPTIONAL_FLAG);
const timeoutMs = Number.parseInt(process.env.OPTA_ACCOUNTS_SMOKE_TIMEOUT_MS ?? '5000', 10);
const baseUrl = (process.env.OPTA_ACCOUNTS_BASE_URL ?? 'http://127.0.0.1:3002').replace(/\/$/, '');

const checks = [
  {
    name: 'pairing.get_invalid_id',
    method: 'GET',
    path: '/api/pairing/sessions/not-a-uuid',
    expectedStatuses: [400],
    expectedErrors: ['invalid_pairing_session_id'],
  },
  {
    name: 'pairing.claim_invalid_id',
    method: 'POST',
    path: '/api/pairing/sessions/not-a-uuid/claim',
    body: {},
    expectedStatuses: [400],
    expectedErrors: ['invalid_pairing_session_id'],
  },
  {
    name: 'pairing.create_safe_unauth',
    method: 'POST',
    path: '/api/pairing/sessions',
    body: {},
    expectedStatuses: [401, 500],
    expectedErrors: ['unauthenticated', 'supabase_unconfigured'],
  },
  {
    name: 'bridge.issue_safe_unauth',
    method: 'POST',
    path: '/api/bridge/tokens',
    body: {},
    expectedStatuses: [401, 500],
    expectedErrors: ['unauthenticated', 'supabase_unconfigured'],
  },
  {
    name: 'commands.get_invalid_id',
    method: 'GET',
    path: '/api/device-commands/not-a-uuid',
    expectedStatuses: [400],
    expectedErrors: ['invalid_command_id'],
  },
  {
    name: 'commands.stream_invalid_device_id',
    method: 'GET',
    path: '/api/device-commands/stream?deviceId=not-a-uuid',
    expectedStatuses: [400],
    expectedErrors: ['invalid_device_id'],
  },
  {
    name: 'commands.create_safe_unauth',
    method: 'POST',
    path: '/api/device-commands',
    body: {},
    expectedStatuses: [401, 500],
    expectedErrors: ['unauthenticated', 'supabase_unconfigured'],
  },
];

function log(status, message) {
  const prefix = status.padEnd(5, ' ');
  console.log(`[${prefix}] ${message}`);
}

async function fetchWithTimeout(url, init) {
  return fetch(url, {
    ...init,
    signal: AbortSignal.timeout(timeoutMs),
  });
}

function buildRequest(check) {
  const headers = {
    Accept: 'application/json',
  };

  const init = {
    method: check.method,
    headers,
  };

  if (check.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(check.body);
  }

  return init;
}

async function runCheck(check) {
  const url = `${baseUrl}${check.path}`;
  const init = buildRequest(check);
  const response = await fetchWithTimeout(url, init);

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  const statusOk = check.expectedStatuses.includes(response.status);
  const errorValue = payload && typeof payload === 'object' ? payload.error : undefined;
  const errorOk =
    !check.expectedErrors ||
    (typeof errorValue === 'string' && check.expectedErrors.includes(errorValue));

  return {
    name: check.name,
    ok: statusOk && errorOk,
    status: response.status,
    error: typeof errorValue === 'string' ? errorValue : 'missing_error_field',
    expectedStatuses: check.expectedStatuses,
    expectedErrors: check.expectedErrors,
  };
}

async function run() {
  const results = [];

  for (const check of checks) {
    try {
      const result = await runCheck(check);
      results.push(result);
    } catch (error) {
      if (optional) {
        log(
          'SKIP',
          `API smoke checks skipped (unable to reach ${baseUrl}: ${error instanceof Error ? error.message : String(error)})`,
        );
        process.exit(0);
      }

      log(
        'FAIL',
        `unable to reach ${baseUrl} for API smoke checks: ${error instanceof Error ? error.message : String(error)}`,
      );
      process.exit(1);
    }
  }

  for (const result of results) {
    if (result.ok) {
      log('PASS', `${result.name} status=${result.status} error=${result.error}`);
    } else {
      log(
        'FAIL',
        `${result.name} status=${result.status} expected_statuses=${result.expectedStatuses.join(',')} error=${result.error} expected_errors=${(result.expectedErrors ?? []).join(',')}`,
      );
    }
  }

  const failed = results.filter((result) => !result.ok);
  if (failed.length > 0) {
    log('FAIL', `control-plane API smoke failed (${failed.length}/${results.length} checks failed).`);
    process.exit(1);
  }

  log('PASS', `control-plane API smoke passed (${results.length} checks).`);
}

await run();

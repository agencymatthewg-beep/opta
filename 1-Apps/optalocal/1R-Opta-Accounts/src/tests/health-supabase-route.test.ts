import assert from 'node:assert/strict';
import test from 'node:test';
import { runSupabaseHealthCheck } from '../app/api/health/supabase/health.ts';

const BASE_URL = 'https://project-ref.supabase.co';

const REQUIRED_RELATIONS = new Set([
  'accounts_profiles',
  'accounts_devices',
  'accounts_sessions',
  'accounts_capability_grants',
  'accounts_provider_connections',
  'accounts_audit_events',
  'accounts_cli_replay_nonces',
  'api_keys',
  'sync_files',
  'credentials',
  'accounts_pairing_sessions',
  'accounts_bridge_tokens',
  'accounts_device_commands',
  'accounts_device_command_queue_health',
]);

const REQUIRED_RPC_FUNCTIONS = new Set([
  'cleanup_control_plane_data',
  'claim_device_commands_for_delivery',
]);

const SUPABASE_ENV_KEYS = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const;

const originalFetch = globalThis.fetch;
const originalEnv = Object.fromEntries(
  SUPABASE_ENV_KEYS.map((key) => [key, process.env[key]]),
) as Record<(typeof SUPABASE_ENV_KEYS)[number], string | undefined>;

type MissingObjectId = `relation:${string}` | `rpc:${string}`;

function configureSupabaseEnv() {
  process.env.SUPABASE_URL = BASE_URL;
  process.env.SUPABASE_ANON_KEY = 'anon-key';
  process.env.SUPABASE_SERVICE_KEY = 'service-key';
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
}

function restoreSupabaseEnv() {
  for (const key of SUPABASE_ENV_KEYS) {
    const value = originalEnv[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

function installFetchMock(options?: { missing?: MissingObjectId[] }) {
  const missing = new Set(options?.missing ?? []);
  const calls: Array<{ method: string; url: string }> = [];

  const fetchMock: typeof fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const method = (init?.method ?? 'GET').toUpperCase();
    const requestUrl =
      input instanceof Request
        ? new URL(input.url)
        : input instanceof URL
          ? input
          : new URL(input);

    calls.push({ method, url: requestUrl.toString() });

    if (requestUrl.pathname === '/auth/v1/health') {
      return new Response(null, { status: 200 });
    }

    if (requestUrl.pathname === '/rest/v1/') {
      return new Response(null, { status: 200 });
    }

    if (requestUrl.pathname === '/storage/v1/version') {
      return new Response(null, { status: 200 });
    }

    if (requestUrl.pathname.startsWith('/rest/v1/rpc/')) {
      const fnName = requestUrl.pathname.split('/rest/v1/rpc/')[1] ?? '';
      if (REQUIRED_RPC_FUNCTIONS.has(fnName)) {
        const status = missing.has(`rpc:${fnName}`) ? 404 : 405;
        return new Response(null, { status });
      }
      return new Response(null, { status: 404 });
    }

    if (requestUrl.pathname.startsWith('/rest/v1/')) {
      const relationName = (requestUrl.pathname.split('/rest/v1/')[1] ?? '').replace(/\/$/, '');
      if (REQUIRED_RELATIONS.has(relationName)) {
        const status = missing.has(`relation:${relationName}`) ? 404 : 200;
        return new Response(null, { status });
      }
      return new Response(null, { status: 404 });
    }

    return new Response(null, { status: 503 });
  };

  globalThis.fetch = fetchMock;
  return { calls };
}

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  restoreSupabaseEnv();
});

test('reports control-plane readiness details and keeps optional extension checks out of health gate', async () => {
  configureSupabaseEnv();
  const { calls } = installFetchMock();

  const result = await runSupabaseHealthCheck(
    new Request('http://localhost:3002/api/health/supabase?mode=deep'),
  );
  const payload = result.payload as Record<string, any>;

  assert.equal(result.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.schemaReady, true);

  assert.equal(payload.services.auth.ok, true);
  assert.equal(payload.services.rest.ok, true);
  assert.equal(payload.services.storage.ok, true);

  assert.equal(payload.tables.accounts_pairing_sessions.present, true);
  assert.equal(payload.tables.accounts_bridge_tokens.present, true);
  assert.equal(payload.tables.accounts_device_commands.present, true);

  assert.equal(payload.controlPlane.ready, true);
  assert.equal(payload.controlPlane.views.accounts_device_command_queue_health.present, true);
  assert.equal(payload.controlPlane.functions.cleanup_control_plane_data.present, true);
  assert.equal(payload.controlPlane.functions.claim_device_commands_for_delivery.present, true);

  const optionalExtensionProbe = calls.some(({ url }) =>
    url.includes('pg_cron') || url.includes('cron.job') || url.includes('cron.schedule'),
  );
  assert.equal(optionalExtensionProbe, false);
});

test('keeps schema ready when optional sync_files relation is missing', async () => {
  configureSupabaseEnv();
  installFetchMock({
    missing: ['relation:sync_files'],
  });

  const result = await runSupabaseHealthCheck(
    new Request('http://localhost:3002/api/health/supabase?mode=deep'),
  );
  const payload = result.payload as Record<string, any>;

  assert.equal(result.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.schemaReady, true);
  assert.equal(payload.tables.sync_files.present, false);
});

test('marks schema not ready when required control-plane objects are missing', async () => {
  configureSupabaseEnv();
  installFetchMock({
    missing: [
      'relation:accounts_device_command_queue_health',
      'rpc:cleanup_control_plane_data',
      'relation:accounts_pairing_sessions',
    ],
  });

  const result = await runSupabaseHealthCheck(
    new Request('http://localhost:3002/api/health/supabase?deep=1'),
  );
  const payload = result.payload as Record<string, any>;

  assert.equal(result.status, 503);
  assert.equal(payload.ok, false);
  assert.equal(payload.schemaReady, false);

  assert.equal(payload.tables.accounts_pairing_sessions.present, false);

  assert.equal(payload.controlPlane.ready, false);
  assert.equal(payload.controlPlane.tables.accounts_pairing_sessions.present, false);
  assert.equal(payload.controlPlane.views.accounts_device_command_queue_health.present, false);
  assert.equal(payload.controlPlane.functions.cleanup_control_plane_data.present, false);
  assert.equal(payload.controlPlane.functions.claim_device_commands_for_delivery.present, true);
});

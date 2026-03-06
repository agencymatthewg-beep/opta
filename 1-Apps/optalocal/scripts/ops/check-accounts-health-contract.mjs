#!/usr/bin/env node

const DEFAULT_URL = 'https://accounts.optalocal.com/api/health/supabase?mode=deep';
const REQUEST_TIMEOUT_MS = 8_000;

const REQUIRED_TABLES = [
  'accounts_pairing_sessions',
  'accounts_bridge_tokens',
  'accounts_device_commands',
];

const REQUIRED_CONTROL_PLANE_TABLES = [
  'accounts_pairing_sessions',
  'accounts_bridge_tokens',
  'accounts_device_commands',
];

const REQUIRED_CONTROL_PLANE_VIEWS = ['accounts_device_command_queue_health'];
const REQUIRED_CONTROL_PLANE_FUNCTIONS = [
  'cleanup_control_plane_data',
  'claim_device_commands_for_delivery',
];

function parseOptions(argv) {
  const options = {
    url: DEFAULT_URL,
    allowLegacy: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--url') {
      options.url = argv[index + 1] ?? DEFAULT_URL;
      index += 1;
      continue;
    }
    if (arg === '--allow-legacy') {
      options.allowLegacy = true;
      continue;
    }
  }

  return options;
}

function fail(message) {
  console.error(`FAIL ${message}`);
}

function pass(message) {
  console.log(`PASS ${message}`);
}

function checkObjectPath(value, path) {
  return path.reduce((current, key) => {
    if (!current || typeof current !== 'object') return null;
    return current[key];
  }, value);
}

function hasTable(payload, tableName) {
  const entry = checkObjectPath(payload, ['tables', tableName]);
  return Boolean(entry && typeof entry === 'object' && entry.present === true);
}

function hasControlPlaneEntry(payload, group, name) {
  const entry = checkObjectPath(payload, ['controlPlane', group, name]);
  return Boolean(entry && typeof entry === 'object' && entry.present === true);
}

async function fetchJson(url) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });

  const bodyText = await response.text();
  let parsed;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    throw new Error(`invalid JSON payload (status=${response.status})`);
  }

  return {
    status: response.status,
    payload: parsed,
  };
}

async function main() {
  const options = parseOptions(process.argv.slice(2));

  let result;
  try {
    result = await fetchJson(options.url);
  } catch (error) {
    fail(`accounts health probe failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }

  if (result.status !== 200) {
    fail(`accounts health status=${result.status} expected=200`);
    process.exit(1);
  }

  const payload = result.payload;
  if (!payload || typeof payload !== 'object') {
    fail('accounts health payload missing object body');
    process.exit(1);
  }

  const legacyPayload = !('controlPlane' in payload);
  if (legacyPayload && options.allowLegacy) {
    pass('accounts health returned legacy payload shape (allow-legacy mode)');
    return;
  }

  if (legacyPayload) {
    fail('accounts health payload missing controlPlane object');
    process.exit(1);
  }

  const missingTables = REQUIRED_TABLES.filter((tableName) => !hasTable(payload, tableName));
  const missingControlPlaneTables = REQUIRED_CONTROL_PLANE_TABLES.filter(
    (name) => !hasControlPlaneEntry(payload, 'tables', name),
  );
  const missingControlPlaneViews = REQUIRED_CONTROL_PLANE_VIEWS.filter(
    (name) => !hasControlPlaneEntry(payload, 'views', name),
  );
  const missingControlPlaneFunctions = REQUIRED_CONTROL_PLANE_FUNCTIONS.filter(
    (name) => !hasControlPlaneEntry(payload, 'functions', name),
  );

  const failures = [
    ...missingTables.map((name) => `tables.${name}`),
    ...missingControlPlaneTables.map((name) => `controlPlane.tables.${name}`),
    ...missingControlPlaneViews.map((name) => `controlPlane.views.${name}`),
    ...missingControlPlaneFunctions.map((name) => `controlPlane.functions.${name}`),
  ];

  if (failures.length > 0) {
    fail(`accounts health contract missing required entries: ${failures.join(', ')}`);
    process.exit(1);
  }

  pass('accounts health contract includes control-plane readiness shape');
}

main().catch((error) => {
  fail(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});

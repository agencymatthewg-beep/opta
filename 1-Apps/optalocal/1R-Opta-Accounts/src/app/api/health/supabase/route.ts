import { NextResponse } from 'next/server';

const REQUIRED_TABLES = [
  'accounts_profiles',
  'accounts_devices',
  'accounts_sessions',
  'accounts_capability_grants',
  'accounts_provider_connections',
  'accounts_audit_events',
] as const;

const REQUEST_TIMEOUT_MS =
  Number.parseInt(process.env.OPTA_ACCOUNTS_HEALTH_TIMEOUT_MS ?? '1800', 10) || 1800;
const RESPONSE_CACHE_TTL_MS =
  Number.parseInt(process.env.OPTA_ACCOUNTS_HEALTH_CACHE_TTL_MS ?? '5000', 10) || 5000;
const TABLE_CACHE_TTL_MS =
  Number.parseInt(process.env.OPTA_ACCOUNTS_HEALTH_TABLE_CACHE_TTL_MS ?? '30000', 10) || 30000;

type ProbeResult = {
  ok: boolean;
  status: number;
};

type TableProbeResult = {
  present: boolean;
  status: number;
};

type ServicesResult = {
  auth: ProbeResult;
  rest: ProbeResult;
  storage: ProbeResult;
};

type TablesResult = Record<string, TableProbeResult>;

type HealthPayload = {
  ok: boolean;
  services: ServicesResult;
  schemaReady: boolean;
  tables: TablesResult;
};

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

let responseCache: CacheEntry<HealthPayload> | null = null;
let tableCache: CacheEntry<TablesResult> | null = null;

async function fetchWithTimeout(url: string, init?: RequestInit) {
  return fetch(url, {
    cache: 'no-store',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    ...init,
  });
}

async function checkEndpoint(url: string, headers: Record<string, string>) {
  try {
    const res = await fetchWithTimeout(url, { headers });
    return { ok: res.ok, status: res.status } as ProbeResult;
  } catch {
    return { ok: false, status: 503 } as ProbeResult;
  }
}

async function checkTable(
  base: string,
  table: (typeof REQUIRED_TABLES)[number],
  headers: Record<string, string>,
) {
  const probeUrl = `${base}/rest/v1/${table}?select=*&limit=1`;
  try {
    // HEAD avoids row payload transfer while preserving existence/status checks.
    const headRes = await fetchWithTimeout(probeUrl, {
      method: 'HEAD',
      headers,
    });

    if (headRes.status === 405 || headRes.status === 501) {
      const getRes = await fetchWithTimeout(`${base}/rest/v1/${table}?select=*&limit=0`, {
        headers,
      });
      return { present: getRes.status !== 404, status: getRes.status };
    }

    return { present: headRes.status !== 404, status: headRes.status };
  } catch {
    return { present: false, status: 503 };
  }
}

function isTransientStatus(status: number) {
  return status === 503;
}

function isDeepRequest(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('mode')?.toLowerCase();
  const deep = searchParams.get('deep')?.toLowerCase();
  return mode === 'deep' || deep === '1' || deep === 'true';
}

function getFreshCacheValue<T>(entry: CacheEntry<T> | null, now: number) {
  if (!entry || entry.expiresAt <= now) {
    return null;
  }
  return entry.value;
}

function setCacheValue<T>(value: T, ttlMs: number) {
  return {
    value,
    expiresAt: Date.now() + ttlMs,
  } satisfies CacheEntry<T>;
}

function buildPayload(services: ServicesResult, tables: TablesResult): HealthPayload {
  const schemaReady = Object.values(tables).every((table) => table.present);
  const ok = services.auth.ok && services.rest.ok && services.storage.ok && schemaReady;
  return {
    ok,
    services,
    schemaReady,
    tables,
  };
}

function hasTransientFailures(services: ServicesResult, tables: TablesResult) {
  const servicesTransient = Object.values(services).some((service) =>
    isTransientStatus(service.status),
  );
  const tablesTransient = Object.values(tables).some((table) =>
    isTransientStatus(table.status),
  );
  return servicesTransient || tablesTransient;
}

async function probeServices(base: string, authHeaders: Record<string, string>) {
  const [auth, rest, storage] = await Promise.all([
    checkEndpoint(`${base}/auth/v1/health`, authHeaders),
    checkEndpoint(`${base}/rest/v1/`, authHeaders),
    checkEndpoint(`${base}/storage/v1/version`, authHeaders),
  ]);

  return { auth, rest, storage } satisfies ServicesResult;
}

async function probeTables(
  base: string,
  serviceHeaders: Record<string, string>,
) {
  const tableEntries = await Promise.all(
    REQUIRED_TABLES.map(async (table) => [table, await checkTable(base, table, serviceHeaders)] as const),
  );
  return Object.fromEntries(tableEntries) as TablesResult;
}

async function getTablesResult(
  base: string,
  serviceHeaders: Record<string, string>,
  options: { bypassCache: boolean },
) {
  const now = Date.now();
  if (!options.bypassCache) {
    const cachedTables = getFreshCacheValue(tableCache, now);
    if (cachedTables) {
      return cachedTables;
    }
  }

  const freshTables = await probeTables(base, serviceHeaders);
  const hasTransientTableFailure = Object.values(freshTables).some((table) =>
    isTransientStatus(table.status),
  );

  if (hasTransientTableFailure && !options.bypassCache && tableCache?.value) {
    return tableCache.value;
  }

  if (!hasTransientTableFailure) {
    tableCache = setCacheValue(freshTables, TABLE_CACHE_TTL_MS);
  }

  return freshTables;
}

export async function GET(request: Request) {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  const deep = isDeepRequest(request);

  if (!supabaseUrl || !anon) {
    return NextResponse.json({ ok: false, error: 'supabase_env_missing' }, { status: 500 });
  }

  if (!deep) {
    const cachedResponse = getFreshCacheValue(responseCache, Date.now());
    if (cachedResponse) {
      return NextResponse.json(cachedResponse, { status: cachedResponse.ok ? 200 : 503 });
    }
  }

  const base = supabaseUrl.replace(/\/$/, '');
  const authHeaders = { apikey: anon, Authorization: `Bearer ${anon}` };
  const serviceHeaders = service
    ? { apikey: anon, Authorization: `Bearer ${service}` }
    : authHeaders;

  const services = await probeServices(base, authHeaders);
  const tables = await getTablesResult(base, serviceHeaders, { bypassCache: deep });
  const payload = buildPayload(services, tables);

  const transientFailure = hasTransientFailures(services, tables);
  if (transientFailure && !deep && responseCache?.value) {
    const stalePayload = responseCache.value;
    return NextResponse.json(stalePayload, { status: stalePayload.ok ? 200 : 503 });
  }

  if (!transientFailure) {
    responseCache = setCacheValue(payload, RESPONSE_CACHE_TTL_MS);
  }

  return NextResponse.json(payload, { status: payload.ok ? 200 : 503 });
}

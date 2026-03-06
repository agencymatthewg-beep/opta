const REQUIRED_CORE_TABLES = [
  'accounts_profiles',
  'accounts_devices',
  'accounts_sessions',
  'accounts_capability_grants',
  'accounts_provider_connections',
  'accounts_audit_events',
  'accounts_cli_replay_nonces',
  'api_keys',
  'credentials',
] as const;

const OPTIONAL_CORE_TABLES = ['sync_files'] as const;

const REQUIRED_CONTROL_PLANE_TABLES = [
  'accounts_pairing_sessions',
  'accounts_bridge_tokens',
  'accounts_device_commands',
] as const;

const REQUIRED_CONTROL_PLANE_VIEWS = [
  'accounts_device_command_queue_health',
] as const;

const REQUIRED_CONTROL_PLANE_FUNCTIONS = [
  'cleanup_control_plane_data',
  'claim_device_commands_for_delivery',
] as const;

const REQUEST_TIMEOUT_MS =
  Number.parseInt(process.env.OPTA_ACCOUNTS_HEALTH_TIMEOUT_MS ?? '1800', 10) || 1800;
const RESPONSE_CACHE_TTL_MS =
  Number.parseInt(process.env.OPTA_ACCOUNTS_HEALTH_CACHE_TTL_MS ?? '5000', 10) || 5000;
const SCHEMA_CACHE_TTL_MS =
  Number.parseInt(process.env.OPTA_ACCOUNTS_HEALTH_TABLE_CACHE_TTL_MS ?? '30000', 10) || 30000;

type ProbeResult = {
  ok: boolean;
  status: number;
};

type SchemaProbeResult = {
  present: boolean;
  status: number;
};

type ServicesResult = {
  auth: ProbeResult;
  rest: ProbeResult;
  storage: ProbeResult;
};

type SchemaObjectResult = Record<string, SchemaProbeResult>;

type ControlPlaneResult = {
  ready: boolean;
  tables: SchemaObjectResult;
  views: SchemaObjectResult;
  functions: SchemaObjectResult;
};

type SchemaResult = {
  schemaReady: boolean;
  tables: SchemaObjectResult;
  views: SchemaObjectResult;
  functions: SchemaObjectResult;
  controlPlane: ControlPlaneResult;
};

export type HealthPayload = {
  ok: boolean;
  services: ServicesResult;
  schemaReady: boolean;
  tables: SchemaObjectResult;
  controlPlane: ControlPlaneResult;
};

export type HealthErrorPayload = {
  ok: false;
  error: 'supabase_env_missing';
};

export type HealthResponse = {
  payload: HealthPayload | HealthErrorPayload;
  status: number;
};

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

let responseCache: CacheEntry<HealthPayload> | null = null;
let schemaCache: CacheEntry<SchemaResult> | null = null;

async function fetchWithTimeout(fetchImpl: typeof fetch, url: string, init?: RequestInit) {
  return fetchImpl(url, {
    cache: 'no-store',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    ...init,
  });
}

async function checkEndpoint(
  fetchImpl: typeof fetch,
  url: string,
  headers: Record<string, string>,
) {
  try {
    const res = await fetchWithTimeout(fetchImpl, url, { headers });
    return { ok: res.ok, status: res.status } as ProbeResult;
  } catch {
    return { ok: false, status: 503 } as ProbeResult;
  }
}

async function checkRelation(
  fetchImpl: typeof fetch,
  base: string,
  relation: string,
  headers: Record<string, string>,
) {
  const probeUrl = `${base}/rest/v1/${relation}?select=*&limit=1`;
  try {
    // HEAD avoids row payload transfer while preserving existence/status checks.
    const headRes = await fetchWithTimeout(fetchImpl, probeUrl, {
      method: 'HEAD',
      headers,
    });

    if (headRes.status === 405 || headRes.status === 501) {
      const getRes = await fetchWithTimeout(fetchImpl, `${base}/rest/v1/${relation}?select=*&limit=0`, {
        headers,
      });
      return { present: getRes.status !== 404, status: getRes.status };
    }

    return { present: headRes.status !== 404, status: headRes.status };
  } catch {
    return { present: false, status: 503 };
  }
}

async function checkRpcFunction(
  fetchImpl: typeof fetch,
  base: string,
  functionName: string,
  headers: Record<string, string>,
) {
  const probeUrl = `${base}/rest/v1/rpc/${functionName}`;
  try {
    // OPTIONS verifies endpoint existence without invoking function side effects.
    const optionsRes = await fetchWithTimeout(fetchImpl, probeUrl, {
      method: 'OPTIONS',
      headers,
    });
    if (optionsRes.status !== 404) {
      return { present: true, status: optionsRes.status };
    }

    // Fallbacks for gateways that do not surface RPC endpoints for OPTIONS.
    const headRes = await fetchWithTimeout(fetchImpl, probeUrl, {
      method: 'HEAD',
      headers,
    });
    if (headRes.status !== 404) {
      return { present: true, status: headRes.status };
    }

    const getRes = await fetchWithTimeout(fetchImpl, probeUrl, { headers });
    return { present: getRes.status !== 404, status: getRes.status };
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

function buildPayload(services: ServicesResult, schema: SchemaResult): HealthPayload {
  const ok = services.auth.ok && services.rest.ok && services.storage.ok && schema.schemaReady;
  return {
    ok,
    services,
    schemaReady: schema.schemaReady,
    tables: schema.tables,
    controlPlane: schema.controlPlane,
  };
}

function hasTransientFailures(services: ServicesResult, schema: SchemaResult) {
  const servicesTransient = Object.values(services).some((service) =>
    isTransientStatus(service.status),
  );

  const schemaTransient = [schema.tables, schema.views, schema.functions].some((objects) =>
    Object.values(objects).some((entry) => isTransientStatus(entry.status)),
  );

  return servicesTransient || schemaTransient;
}

async function probeServices(
  fetchImpl: typeof fetch,
  base: string,
  authHeaders: Record<string, string>,
) {
  const [auth, rest, storage] = await Promise.all([
    checkEndpoint(fetchImpl, `${base}/auth/v1/health`, authHeaders),
    checkEndpoint(fetchImpl, `${base}/rest/v1/`, authHeaders),
    checkEndpoint(fetchImpl, `${base}/storage/v1/version`, authHeaders),
  ]);

  return { auth, rest, storage } satisfies ServicesResult;
}

async function probeRelationSet(
  fetchImpl: typeof fetch,
  base: string,
  relations: readonly string[],
  serviceHeaders: Record<string, string>,
) {
  const entries = await Promise.all(
    relations.map(async (relation) => [relation, await checkRelation(fetchImpl, base, relation, serviceHeaders)] as const),
  );
  return Object.fromEntries(entries) as SchemaObjectResult;
}

async function probeFunctionSet(
  fetchImpl: typeof fetch,
  base: string,
  functionNames: readonly string[],
  serviceHeaders: Record<string, string>,
) {
  const entries = await Promise.all(
    functionNames.map(
      async (functionName) => [
        functionName,
        await checkRpcFunction(fetchImpl, base, functionName, serviceHeaders),
      ] as const,
    ),
  );

  return Object.fromEntries(entries) as SchemaObjectResult;
}

async function probeSchema(
  fetchImpl: typeof fetch,
  base: string,
  serviceHeaders: Record<string, string>,
): Promise<SchemaResult> {
  const [requiredCoreTables, optionalCoreTables, controlPlaneTables, controlPlaneViews, controlPlaneFunctions] =
    await Promise.all([
      probeRelationSet(fetchImpl, base, REQUIRED_CORE_TABLES, serviceHeaders),
      probeRelationSet(fetchImpl, base, OPTIONAL_CORE_TABLES, serviceHeaders),
      probeRelationSet(fetchImpl, base, REQUIRED_CONTROL_PLANE_TABLES, serviceHeaders),
      probeRelationSet(fetchImpl, base, REQUIRED_CONTROL_PLANE_VIEWS, serviceHeaders),
      probeFunctionSet(fetchImpl, base, REQUIRED_CONTROL_PLANE_FUNCTIONS, serviceHeaders),
    ]);

  const tables = { ...requiredCoreTables, ...optionalCoreTables, ...controlPlaneTables };
  const views = controlPlaneViews;
  const functions = controlPlaneFunctions;

  const controlPlaneReady = [controlPlaneTables, controlPlaneViews, controlPlaneFunctions].every(
    (objects) => Object.values(objects).every((entry) => entry.present),
  );

  const schemaReady = [requiredCoreTables, controlPlaneTables, views, functions].every((objects) =>
    Object.values(objects).every((entry) => entry.present),
  );

  return {
    schemaReady,
    tables,
    views,
    functions,
    controlPlane: {
      ready: controlPlaneReady,
      tables: controlPlaneTables,
      views: controlPlaneViews,
      functions: controlPlaneFunctions,
    },
  };
}

async function getSchemaResult(
  fetchImpl: typeof fetch,
  base: string,
  serviceHeaders: Record<string, string>,
  options: { bypassCache: boolean },
) {
  const now = Date.now();
  if (!options.bypassCache) {
    const cachedSchema = getFreshCacheValue(schemaCache, now);
    if (cachedSchema) {
      return cachedSchema;
    }
  }

  const freshSchema = await probeSchema(fetchImpl, base, serviceHeaders);
  const hasTransientSchemaFailure = [freshSchema.tables, freshSchema.views, freshSchema.functions].some(
    (objects) => Object.values(objects).some((entry) => isTransientStatus(entry.status)),
  );

  if (hasTransientSchemaFailure && !options.bypassCache && schemaCache?.value) {
    return schemaCache.value;
  }

  if (!hasTransientSchemaFailure) {
    schemaCache = setCacheValue(freshSchema, SCHEMA_CACHE_TTL_MS);
  }

  return freshSchema;
}

export async function runSupabaseHealthCheck(
  request: Request,
  options?: { env?: NodeJS.ProcessEnv; fetchImpl?: typeof fetch },
): Promise<HealthResponse> {
  const env = options?.env ?? process.env;
  const fetchImpl = options?.fetchImpl ?? fetch;

  const supabaseUrl = env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = env.SUPABASE_ANON_KEY ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = env.SUPABASE_SERVICE_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY;
  const deep = isDeepRequest(request);

  if (!supabaseUrl || !anon) {
    return {
      payload: { ok: false, error: 'supabase_env_missing' },
      status: 500,
    };
  }

  if (!deep) {
    const cachedResponse = getFreshCacheValue(responseCache, Date.now());
    if (cachedResponse) {
      return {
        payload: cachedResponse,
        status: cachedResponse.ok ? 200 : 503,
      };
    }
  }

  const base = supabaseUrl.replace(/\/$/, '');
  const authHeaders = { apikey: anon, Authorization: `Bearer ${anon}` };
  const serviceHeaders = service
    ? { apikey: anon, Authorization: `Bearer ${service}` }
    : authHeaders;

  const services = await probeServices(fetchImpl, base, authHeaders);
  const schema = await getSchemaResult(fetchImpl, base, serviceHeaders, { bypassCache: deep });
  const payload = buildPayload(services, schema);

  const transientFailure = hasTransientFailures(services, schema);
  if (transientFailure && !deep && responseCache?.value) {
    const stalePayload = responseCache.value;
    return {
      payload: stalePayload,
      status: stalePayload.ok ? 200 : 503,
    };
  }

  if (!transientFailure) {
    responseCache = setCacheValue(payload, RESPONSE_CACHE_TTL_MS);
  }

  return {
    payload,
    status: payload.ok ? 200 : 503,
  };
}

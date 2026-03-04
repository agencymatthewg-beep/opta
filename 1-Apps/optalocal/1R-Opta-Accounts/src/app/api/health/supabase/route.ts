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

type ProbeResult = {
  ok: boolean;
  status: number;
};

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

export async function GET() {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !anon) {
    return NextResponse.json({ ok: false, error: 'supabase_env_missing' }, { status: 500 });
  }

  const base = supabaseUrl.replace(/\/$/, '');
  const authHeaders = { apikey: anon, Authorization: `Bearer ${anon}` };
  const serviceHeaders = service
    ? { apikey: anon, Authorization: `Bearer ${service}` }
    : authHeaders;

  const [auth, rest, storage] = await Promise.all([
    checkEndpoint(`${base}/auth/v1/health`, authHeaders),
    checkEndpoint(`${base}/rest/v1/`, authHeaders),
    checkEndpoint(`${base}/storage/v1/version`, authHeaders),
  ]);

  const tableEntries = await Promise.all(
    REQUIRED_TABLES.map(async (table) => [table, await checkTable(base, table, serviceHeaders)] as const),
  );
  const tables: Record<string, { present: boolean; status: number }> = Object.fromEntries(tableEntries);

  const schemaReady = Object.values(tables).every((t) => t.present);
  const ok = auth.ok && rest.ok && storage.ok && schemaReady;

  return NextResponse.json({
    ok,
    services: {
      auth: { ok: auth.ok, status: auth.status },
      rest: { ok: rest.ok, status: rest.status },
      storage: { ok: storage.ok, status: storage.status },
    },
    schemaReady,
    tables,
  }, { status: ok ? 200 : 503 });
}

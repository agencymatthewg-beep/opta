import { NextResponse } from 'next/server';

const REQUIRED_TABLES = [
  'accounts_profiles',
  'accounts_devices',
  'accounts_sessions',
  'accounts_capability_grants',
  'accounts_provider_connections',
  'accounts_audit_events',
] as const;

async function checkEndpoint(url: string, headers: Record<string, string>) {
  const res = await fetch(url, { headers, cache: 'no-store' });
  return { ok: res.ok, status: res.status, body: (await res.text()).slice(0, 180) };
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

  const auth = await checkEndpoint(`${base}/auth/v1/health`, authHeaders);
  const rest = await checkEndpoint(`${base}/rest/v1/`, authHeaders);
  const storage = await checkEndpoint(`${base}/storage/v1/version`, authHeaders);

  const tables: Record<string, { present: boolean; status: number }> = {};
  for (const table of REQUIRED_TABLES) {
    const r = await fetch(`${base}/rest/v1/${table}?select=*&limit=1`, {
      headers: serviceHeaders,
      cache: 'no-store',
    });
    tables[table] = { present: r.status !== 404, status: r.status };
  }

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

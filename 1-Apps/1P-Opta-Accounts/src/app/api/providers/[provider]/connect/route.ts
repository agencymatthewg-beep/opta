import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { asObject, parseProvider, parseString } from '@/lib/api/policy';

type RouteContext = { params: Promise<{ provider: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { provider: rawProvider } = await context.params;
  const provider = parseProvider(rawProvider);
  if (!provider) {
    return NextResponse.json({ error: 'unsupported_provider' }, { status: 400 });
  }

  const body = asObject(await request.json().catch(() => ({})));
  const externalAccountId = parseString(body.externalAccountId, 200);

  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: 'supabase_unconfigured' }, { status: 500 });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const { data, error } = await supabase
    .from('accounts_provider_connections')
    .upsert(
      {
        user_id: user.id,
        provider,
        status: 'connected',
        meta: {
          externalAccountId,
          connectedVia: 'stub',
          connectedAt: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,provider' },
    )
    .select('id,provider,status,meta,updated_at')
    .maybeSingle();

  if (error?.code === 'PGRST205') {
    return NextResponse.json({ error: 'schema_missing_accounts_provider_connections' }, { status: 503 });
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, provider: data, mode: 'stub' });
}

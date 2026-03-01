import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { upsertApiKey } from '@/lib/supabase/key-actions';

export async function GET(request: Request) {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: 'supabase_unconfigured' }, { status: 500 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const url = new URL(request.url);
  const provider = url.searchParams.get('provider')?.trim().toLowerCase();

  let query = supabase
    .from('api_keys')
    .select('id,provider,label,key_value,is_active,updated_at')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
    .limit(5);

  if (provider) query = query.eq('provider', provider);

  const { data, error } = await query;
  if (error?.code === 'PGRST205') {
    return NextResponse.json({ error: 'schema_missing_api_keys' }, { status: 503 });
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ keys: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: 'supabase_unconfigured' }, { status: 500 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  let body: { provider?: string; keyValue?: string; label?: string };
  try {
    body = (await request.json()) as { provider?: string; keyValue?: string; label?: string };
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const provider = body.provider?.trim().toLowerCase();
  const keyValue = body.keyValue?.trim();
  const label = body.label?.trim() || undefined;

  if (!provider || !keyValue) {
    return NextResponse.json({ error: 'provider and keyValue are required' }, { status: 400 });
  }

  const result = await upsertApiKey(provider, keyValue, label);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}

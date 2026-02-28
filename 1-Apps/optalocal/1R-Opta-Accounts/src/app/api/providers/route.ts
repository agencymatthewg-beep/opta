import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { PROVIDERS } from '@/lib/api/policy';

export async function GET() {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: 'supabase_unconfigured' }, { status: 500 });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const { data, error } = await supabase
    .from('accounts_provider_connections')
    .select('id,provider,status,meta,updated_at')
    .eq('user_id', user.id)
    .in('provider', [...PROVIDERS])
    .order('provider', { ascending: true });

  if (error?.code === 'PGRST205') {
    return NextResponse.json({ error: 'schema_missing_accounts_provider_connections' }, { status: 503 });
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ providers: data ?? [] });
}

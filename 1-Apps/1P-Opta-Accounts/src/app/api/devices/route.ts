import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: 'supabase_unconfigured' }, { status: 500 });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const { data, error } = await supabase
    .from('accounts_devices')
    .select('id,device_label,platform,trust_state,last_seen_at,last_ip,created_at')
    .eq('user_id', user.id)
    .order('last_seen_at', { ascending: false, nullsFirst: false });

  if (error?.code === 'PGRST205') {
    return NextResponse.json({ error: 'schema_missing_accounts_devices' }, { status: 503 });
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ devices: data ?? [] });
}

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isUuid } from '@/lib/api/policy';
import { requireScopeOrPrivilegedRole } from '@/lib/api/authz';
import { getDeviceCommand } from '@/lib/control-plane/store';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: 'invalid_command_id' }, { status: 400 });
  }

  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: 'supabase_unconfigured' }, { status: 500 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const authz = await requireScopeOrPrivilegedRole(supabase, user.id, 'device.commands.issue');
  if (!authz.ok && authz.error !== 'schema_missing_accounts_capability_grants') {
    return NextResponse.json({ error: authz.error }, { status: authz.status });
  }

  const command = await getDeviceCommand(id, { supabase });
  if (!command || command.userId !== user.id) {
    return NextResponse.json({ error: 'command_not_found' }, { status: 404 });
  }

  return NextResponse.json({ ok: true, command });
}
